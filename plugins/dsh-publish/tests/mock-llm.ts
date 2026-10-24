/** E2E mock LLM adapter：按 system 提示区分 understand/adapt，返回符合契约的 JSON。仅测试 profile 使用。 */
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'

export const name = 'publish-mock-llm'
export const inject = ['llm']

function understandJson(user: string): string {
  return JSON.stringify({
    summary: '这条讲发布插件的智能助手升级',
    audience: '内容创作者',
    facts: [{ claim: '素材首句', quote: user.split('\n')[1]?.slice(0, 20) ?? '' }],
    suggestions: [
      { platform: 'xiaohongshu', form: 'note', reason: '口语化素材适合图文' },
      { platform: 'gongzhonghao', form: 'article', reason: '成稿结构完整适合文章' },
    ],
  })
}

function adaptJson(system: string, user: string): string {
  const targeted = system.includes('定向修改指令')
  // 分支按 system 里的字段声明判断：小红书 title/body/tags，公众号 title/digest/body。
  const isXhs = system.includes('title/body/tags')
  if (isXhs) {
    return JSON.stringify({
      fields: {
        title: targeted ? '定向标题：智能发布助手' : '智能发布助手上线',
        body: '这是一段按小红书语气生成的正文，包含素材要点。',
        tags: '#自媒体 #效率工具',
      },
      changes: [{ field: 'title', what: '按素材提炼', why: '素材第一句' }],
      warnings: [],
    })
  }
  return JSON.stringify({
    fields: {
      title: '发布插件的智能助手升级说明',
      digest: '一段一百二十字以内的摘要，说明智能助手如何减少重复填写。',
      body: '正文第一段。\n\n正文第二段，保留素材结构与要点。',
    },
    changes: [{ field: 'digest', what: '从素材压缩', why: '硬限 120 字' }],
    warnings: [],
  })
}

class MockAdapter extends LlmAdapter {
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const system = options.system ?? ''
    const user = options.messages.at(-1)
    const userText = typeof user === 'object' && user !== null && 'content' in user
      ? JSON.stringify((user as { content: unknown }).content)
      : String(user)
    const output = system.includes('内容理解器')
      ? understandJson(userText)
      : system.includes('平台适配器') ? adaptJson(system, userText) : 'ok'
    console.error('[mock-llm] system=', system.slice(0, 30), 'output_len=', output.length)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    for (const piece of output.match(/.{1,24}/gs) ?? []) {
      if (options.signal?.aborted) { yield { type: 'finish', reason: { kind: 'aborted', failure: { message: 'aborted' } } }; return }
      yield { type: 'text-delta', index: 0, text: piece }
    }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: output } }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 10 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.llm.registerAdapter(['publish-mock'], new MockAdapter()))
}
