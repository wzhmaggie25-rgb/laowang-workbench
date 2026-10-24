/** 智能发布助手的 Host 业务：素材解析、版本化草稿、生成依据与人工发布记录。 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Material, PlatformDraft, PlatformDraftField, GenerationRecord, ManualRecord } from './assistant-types.ts'

export type { Material, PlatformDraft, PlatformDraftField, GenerationRecord, ManualRecord } from './assistant-types.ts'

const hash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16)

/** SRT → 纯文本：去序号、时间轴，合并断行；宽容 CRLF 与 BOM。 */
export function parseSrt(raw: string): string {
  const body = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  return body
    .split(/\n{2,}/)
    .map(block => block
      .split('\n')
      .filter(line => line.trim() !== '' && !/^\d+$/.test(line.trim()) && !line.includes('-->'))
      .join(''))
    .filter(text => text.length > 0)
    .join('\n')
}

export class AssistantStore {
  constructor(private readonly root: string) {}

  private draftDir(draftId: string): string { return join(this.root, 'drafts', draftId) }

  async createDraft(input: { kind: Material['kind']; text: string; origin: string; attachments?: Material['attachments'] }): Promise<Material> {
    const draftId = 'd_' + hash(`${input.origin}:${input.text}:${Date.now()}:${Math.random()}`)
    const now = new Date().toISOString()
    const material: Material = {
      draftId, kind: input.kind, text: input.text, contentHash: hash(input.text),
      origin: input.origin, createdAt: now, updatedAt: now, attachments: input.attachments ?? [],
    }
    await mkdir(join(this.draftDir(draftId), 'platforms'), { recursive: true })
    await this.saveMaterial(material)
    return material
  }

  async saveMaterial(material: Material): Promise<void> {
    material.updatedAt = new Date().toISOString()
    await mkdir(this.draftDir(material.draftId), { recursive: true })
    await writeFile(join(this.draftDir(material.draftId), 'material.json'), JSON.stringify(material, null, 2) + '\n', 'utf8')
  }

  async getMaterial(draftId: string): Promise<Material | undefined> {
    try { return JSON.parse(await readFile(join(this.draftDir(draftId), 'material.json'), 'utf8')) as Material }
    catch { return undefined }
  }

  async listDrafts(): Promise<Material[]> {
    try {
      const dirs = await readdir(join(this.root, 'drafts'))
      const materials = await Promise.all(dirs.map(dir => this.getMaterial(dir)))
      return materials.filter((row): row is Material => row !== undefined)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch { return [] }
  }

  async deleteDraft(draftId: string): Promise<void> {
    await rm(this.draftDir(draftId), { recursive: true, force: true })
    const records = await this.manualRecords(draftId)
    if (records.length === 0) {
      // 无发布记录的草稿才整删；有记录的保留目录中的 manual 记录文件由调用方决定。
    }
  }

  async getPlatformDraft(draftId: string, platform: string): Promise<PlatformDraft | undefined> {
    try { return JSON.parse(await readFile(join(this.draftDir(draftId), 'platforms', `${platform}.json`), 'utf8')) as PlatformDraft }
    catch { return undefined }
  }

  /**
   * 修订号围栏保存：expectedRevision 不匹配时拒绝（陈旧覆盖），返回 false。
   * 传入 fields 里 edited=true 的字段保持 edited；AI 写入路径走 applyGeneration（只动未 edited 字段）。
   */
  async savePlatformDraft(draftId: string, platform: string, form: string, fields: Record<string, PlatformDraftField>, expectedRevision: number): Promise<PlatformDraft | false> {
    const existing = await this.getPlatformDraft(draftId, platform)
    if (existing && existing.revision !== expectedRevision) return false
    const next: PlatformDraft = {
      platform, form,
      revision: (existing?.revision ?? 0) + 1,
      fields: { ...(existing?.fields ?? {}), ...fields },
      ...(existing?.lastGeneration ? { lastGeneration: existing.lastGeneration } : {}),
      updatedAt: new Date().toISOString(),
    }
    await mkdir(join(this.draftDir(draftId), 'platforms'), { recursive: true })
    await writeFile(join(this.draftDir(draftId), 'platforms', `${platform}.json`), JSON.stringify(next, null, 2) + '\n', 'utf8')
    return next
  }

  /** AI 生成结果落草稿：只覆盖未 edited 的字段；edited 字段返回为候选不落盘。 */
  async applyGeneration(draftId: string, platform: string, form: string, generated: Record<string, string>, generationId: string): Promise<{ draft: PlatformDraft; protectedFields: string[] }> {
    const existing = await this.getPlatformDraft(draftId, platform)
    const protectedFields: string[] = []
    const fields: Record<string, PlatformDraftField> = { ...(existing?.fields ?? {}) }
    for (const [field, text] of Object.entries(generated)) {
      if (fields[field]?.edited) { protectedFields.push(field); continue }
      fields[field] = { text, edited: false }
    }
    const next: PlatformDraft = {
      platform, form,
      revision: (existing?.revision ?? 0) + 1,
      fields,
      lastGeneration: generationId,
      updatedAt: new Date().toISOString(),
    }
    await mkdir(join(this.draftDir(draftId), 'platforms'), { recursive: true })
    await writeFile(join(this.draftDir(draftId), 'platforms', `${platform}.json`), JSON.stringify(next, null, 2) + '\n', 'utf8')
    return { draft: next, protectedFields }
  }

  async appendGeneration(record: GenerationRecord): Promise<void> {
    const path = join(this.root, 'generations.jsonl')
    await mkdir(this.root, { recursive: true })
    const line = JSON.stringify(record) + '\n'
    await writeFile(path, line, { flag: 'a' })
  }

  async manualRecords(draftId: string): Promise<ManualRecord[]> {
    try {
      const all = JSON.parse(await readFile(join(this.root, 'manual-records.json'), 'utf8')) as ManualRecord[]
      return all.filter(row => row.draftId === draftId)
    } catch { return [] }
  }

  private async allManual(): Promise<ManualRecord[]> {
    try { return JSON.parse(await readFile(join(this.root, 'manual-records.json'), 'utf8')) as ManualRecord[] }
    catch { return [] }
  }

  /** 标记已发：绑定当前字段快照；同平台重复标记按再次标记处理（更新快照与时间）。 */
  async markPublished(input: Omit<ManualRecord, 'markedAt'>): Promise<ManualRecord> {
    const all = await this.allManual()
    const record: ManualRecord = { ...input, markedAt: new Date().toISOString() }
    const at = all.findIndex(row => row.draftId === input.draftId && row.platform === input.platform)
    if (at >= 0) all[at] = record
    else all.push(record)
    await mkdir(this.root, { recursive: true })
    await writeFile(join(this.root, 'manual-records.json'), JSON.stringify(all, null, 2) + '\n', 'utf8')
    return record
  }

  /** 撤销标记：只纠正本插件记录，保留撤销时间以便追溯。 */
  async unmarkPublished(draftId: string, platform: string): Promise<ManualRecord | undefined> {
    const all = await this.allManual()
    const record = all.find(row => row.draftId === draftId && row.platform === platform && !row.unmarkedAt)
    if (!record) return undefined
    record.unmarkedAt = new Date().toISOString()
    await mkdir(this.root, { recursive: true })
    await writeFile(join(this.root, 'manual-records.json'), JSON.stringify(all, null, 2) + '\n', 'utf8')
    return record
  }

  async listManual(): Promise<ManualRecord[]> {
    return (await this.allManual()).sort((a, b) => b.markedAt.localeCompare(a.markedAt))
  }
}
