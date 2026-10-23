import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { digestRequest, hashFile, idempotencyKey } from '../src/digest'
import { Ledger } from '../src/ledger'
import type { PublishRequest } from '../src/types'

/** 最小烟测：不进 DSH 运行时，只验台账与摘要这两块纯逻辑。 */
async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'publish-smoke-'))
  try {
    const media = join(dir, 'a.txt')
    await writeFile(media, 'hello', 'utf8')

    const first = await hashFile(media)
    const second = await hashFile(media)
    assert(first.hash === second.hash, '同一文件两次哈希应一致')
    assert(first.size === 5, `文件大小应为 5，实际 ${first.size}`)

    const request: PublishRequest = {
      platform: 'xiaohongshu',
      account: 'default',
      kind: 'note',
      title: '测试标题',
      body: '正文',
      media: [media],
    }
    const digest = digestRequest(request, [first.hash])
    assert(digest.length === 64, '摘要应为 sha256 hex')
    const changed = digestRequest({ ...request, title: '换个标题' }, [first.hash])
    assert(digest !== changed, '标题变了摘要必须变')
    assert(idempotencyKey('xiaohongshu', 'default', digest) !== idempotencyKey('douyin', 'default', digest), '不同平台不能同键')

    const ledger = new Ledger(join(dir, 'ledger.json'))
    const now = new Date().toISOString()
    const entry = {
      key: idempotencyKey(request.platform, request.account, digest),
      prepareId: 'prep_smoke',
      digest,
      request,
      status: 'preparing' as const,
      createdAt: now,
      updatedAt: now,
      deviations: [],
    }
    await ledger.insert({ ...entry, status: 'prepared' })
    const duplicate = await ledger.insert({ ...entry, status: 'prepared' })
    assert(duplicate.prepareId === 'prep_smoke', '同键重复插入应返回已有记录')
    assert((await ledger.list()).length === 1, '台账不应出现重复行')

    await ledger.update(entry.key, { status: 'submitting' })
    const reconciled = await ledger.reconcileOnStart()
    assert(reconciled === 1, '启动应把 submitting 改判 unknown')
    const after = await ledger.byPrepare('prep_smoke')
    assert(after?.status === 'unknown', `应改判 unknown，实际 ${after?.status}`)

    console.log('smoke: ok')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`断言失败：${message}`)
}

await main()
