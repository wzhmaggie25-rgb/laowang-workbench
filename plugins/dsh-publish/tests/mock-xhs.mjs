/** Minimal mock of xiaohongshu-mcp's HTTP surface for isolated E2E; loopback only, never real. */
import http from 'node:http'

export async function startMockXhs(port = 18106) {
  const state = { lastTitle: '', publishes: 0, detailCalls: 0 }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') : {}
      const send = (code, payload) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)) }
      if (url.pathname === '/health') return send(200, { success: true, message: 'mock ok' })
      if (url.pathname === '/api/v1/login/status') return send(200, { success: true, data: { is_logged_in: true, nickname: 'page-test' }, message: '已登录' })
      if (url.pathname === '/api/v1/publish' || url.pathname === '/api/v1/publish_video') {
        state.lastTitle = typeof body.title === 'string' ? body.title : ''
        state.publishes += 1
        return send(200, { success: true, message: '发布完成' })
      }
      if (url.pathname === '/api/v1/user/me') {
        const feeds = state.lastTitle
          ? [{ id: 'mocknote1', xsecToken: 'tok1', modelType: 'note', noteCard: { type: 'normal', displayTitle: state.lastTitle, interactInfo: {} } }]
          : []
        return send(200, { success: true, data: { feeds, interactions: [] }, message: 'ok' })
      }
      if (url.pathname === '/api/v1/feeds/detail') {
        state.detailCalls += 1
        return send(200, { success: true, data: { note: { id: body.feed_id ?? 'mocknote1', time: Date.now(), title: state.lastTitle, interactInfo: { likedCount: '12', collectedCount: '3', commentCount: '5', sharedCount: '1' } } }, message: 'ok' })
      }
      send(404, { success: false, message: 'mock: not found ' + url.pathname })
    })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  return { port, state, close: () => new Promise(resolve => server.close(resolve)) }
}
