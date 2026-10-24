import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { LedgerEntry, PublishStatus } from './types'

interface LedgerFile {
  version: 1
  entries: LedgerEntry[]
}

/**
 * 发布台账：JSON 落盘 + 原子替换。
 * P1 单进程用 JSON 足够；多进程/多实例前必须换 SQLite（见 README「已知边界」）。
 */
export class Ledger {
  private data: LedgerFile | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly file: string) {}

  private async load(): Promise<LedgerFile> {
    if (this.data) return this.data
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as LedgerFile
      if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error('台账格式不认')
      this.data = parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.data = { version: 1, entries: [] }
      } else {
        throw error
      }
    }
    return this.data
  }

  private async persist(): Promise<void> {
    const data = await this.load()
    const text = `${JSON.stringify(data, null, 2)}\n`
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${process.pid}.tmp`
      await writeFile(tmp, text, 'utf8')
      await rename(tmp, this.file)
    })
    await this.queue
  }

  async insert(entry: LedgerEntry): Promise<LedgerEntry> {
    const data = await this.load()
    const existing = data.entries.find(e => e.key === entry.key)
    if (existing) return existing
    data.entries.push(entry)
    await this.persist()
    return entry
  }

  async get(key: string): Promise<LedgerEntry | undefined> {
    const data = await this.load()
    return data.entries.find(e => e.key === key)
  }

  async byPrepare(prepareId: string): Promise<LedgerEntry | undefined> {
    const data = await this.load()
    return data.entries.find(e => e.prepareId === prepareId)
  }

  async update(key: string, patch: Partial<LedgerEntry> & { status?: PublishStatus }): Promise<LedgerEntry | undefined> {
    const data = await this.load()
    const entry = data.entries.find(e => e.key === key)
    if (!entry) return undefined
    Object.assign(entry, patch, { updatedAt: new Date().toISOString() })
    await this.persist()
    return entry
  }

  async list(limit = 20): Promise<LedgerEntry[]> {
    const data = await this.load()
    return [...data.entries].slice(-limit).reverse()
  }

  /**
   * 一次性并入 v0.1 默认位置的台账（仅当新台账文件还不存在时）。
   * 旧文件保持原样，作为可回退证据；损坏的旧文件按配置错误报错，不静默丢弃历史。
   */
  async adoptLegacy(legacyFile: string): Promise<number> {
    if (resolve(legacyFile) === resolve(this.file)) return 0
    if (existsSync(this.file)) return 0
    let legacy: LedgerFile
    try {
      legacy = JSON.parse(await readFile(legacyFile, 'utf8')) as LedgerFile
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
      throw new Error(`旧发布台账无法读取（${legacyFile}）：${(error as Error).message}；请先人工处理该文件再启动插件`)
    }
    if (legacy.version !== 1 || !Array.isArray(legacy.entries)) {
      throw new Error(`旧发布台账格式不认（${legacyFile}）；请先人工处理该文件再启动插件`)
    }
    const data = await this.load()
    let adopted = 0
    for (const entry of legacy.entries) {
      if (!isLedgerEntry(entry) || data.entries.some(row => row.key === entry.key)) continue
      data.entries.push({ ...entry, deviations: Array.isArray(entry.deviations) ? entry.deviations : [] })
      adopted += 1
    }
    if (adopted > 0) await this.persist()
    return adopted
  }

  /**
   * 启动时把停在 submitting 的行改判 unknown。
   * 进程可能死在「已点发布」和「拿到回执」之间，此时只能人工核，不能重发。
   */
  async reconcileOnStart(): Promise<number> {
    const data = await this.load()
    let changed = 0
    for (const entry of data.entries) {
      if (entry.status === 'submitting') {
        entry.status = 'unknown'
        entry.note = '进程中断：提交结果未确认，须人工核对该平台原记录，禁止直接重发'
        entry.updatedAt = new Date().toISOString()
        changed += 1
      }
    }
    if (changed > 0) await this.persist()
    return changed
  }
}

/** v0.1 起共同的核心字段；旧记录缺的只有 v0.2 新增的可选字段。 */
function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry.key === 'string' && entry.key.length > 0
    && typeof entry.prepareId === 'string' && entry.prepareId.length > 0
    && typeof entry.digest === 'string' && entry.digest.length > 0
    && typeof entry.request === 'object' && entry.request !== null
    && typeof entry.status === 'string'
    && typeof entry.createdAt === 'string' && typeof entry.updatedAt === 'string'
}
