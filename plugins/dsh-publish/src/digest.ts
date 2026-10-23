import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { PublishRequest } from './types'

/** 流式算文件 sha256，顺便拿到字节数。视频文件也能吃下，不整读进内存。 */
export async function hashFile(path: string): Promise<{ hash: string; size: number }> {
  const info = await stat(path)
  if (!info.isFile()) throw new Error(`不是文件：${path}`)
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return { hash: hash.digest('hex'), size: info.size }
}

/**
 * 审批要绑定的摘要：内容字段 + 每个媒体文件的哈希。
 * 只绑「发什么」，不绑执行细节，保证执行前可复核且不随临时文件变动。
 */
export function digestRequest(request: PublishRequest, mediaHashes: readonly string[]): string {
  const canonical = JSON.stringify({
    platform: request.platform,
    account: request.account,
    kind: request.kind,
    title: request.title,
    body: request.body ?? '',
    tags: request.tags ?? [],
    media: mediaHashes,
    scheduleAt: request.scheduleAt ?? '',
    visibility: request.visibility ?? '',
    isOriginal: request.isOriginal ?? null,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/** 台账幂等键：同平台同账号同内容 = 同一条。 */
export function idempotencyKey(platform: string, account: string, digest: string): string {
  return `${platform}|${account}|${digest}`
}
