/** 数据回采存储：按台账 key 记录笔记关联与互动数据快照。 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { MetricsSnapshot, NoteMetrics, NoteRef } from './metrics-types.ts'

interface MetricsFile {
  version: 1
  notes: Record<string, NoteMetrics>
}

export const SNAPSHOT_LIMIT = 30
export { latestSnapshot, matchByTitle } from './metrics-types.ts'
export type { MetricsSnapshot, NoteMetrics, NoteRef } from './metrics-types.ts'

export class MetricsStore {
  private data: MetricsFile | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly file: string) {}

  private async load(): Promise<MetricsFile> {
    if (this.data) return this.data
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as MetricsFile
      if (parsed.version !== 1 || typeof parsed.notes !== 'object' || parsed.notes === null) throw new Error('数据回采存储格式不认')
      this.data = parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.data = { version: 1, notes: {} }
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

  async get(key: string): Promise<NoteMetrics | undefined> {
    return (await this.load()).notes[key]
  }

  async all(): Promise<Record<string, NoteMetrics>> {
    return { ...(await this.load()).notes }
  }

  /** 绑定或改绑（同 key 幂等覆盖）。 */
  async bind(key: string, ref: NoteRef): Promise<void> {
    const data = await this.load()
    const previous = data.notes[key]
    data.notes[key] = { noteRef: ref, snapshots: previous?.snapshots ?? [] }
    await this.persist()
  }

  async unbind(key: string): Promise<void> {
    const data = await this.load()
    if (data.notes[key] === undefined) return
    delete data.notes[key]
    await this.persist()
  }

  async pushSnapshot(key: string, snapshot: Omit<MetricsSnapshot, 'at'>): Promise<void> {
    const data = await this.load()
    const metrics = data.notes[key]
    if (!metrics) return
    metrics.snapshots = [...metrics.snapshots, { ...snapshot, at: new Date().toISOString() }].slice(-SNAPSHOT_LIMIT)
    await this.persist()
  }
}
