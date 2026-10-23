import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
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
