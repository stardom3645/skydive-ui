// Run: npx webpack serve --config tests/visual/webpack.logs.config.js
// Local-only fixture API; the production request helper is used without changes.
const path = require('path')
const base = require('./webpack.config')
let requests = 0
const attempts = new Map()
const stack = '2026-10-15T09:00:00Z ERROR request failed: sample failure\n\tat handleRequest (/app/server.js:42:7)\n\tat processQueue (/app/queue.js:18:3)\n'
const sample = '2026-10-15T09:00:00Z INFO web server ready\r\n2026-10-15T09:00:01Z WARN retrying upstream\r\n' + stack +
    '2026-10-15T09:00:02Z INFO literal <script> and 한글 로그\n' + '2026-10-15T09:00:03Z INFO request path=/' + 'long-segment/'.repeat(24) + '\n' +
    Array.from({ length: 100 }, (_, index) => `2026-10-15T09:01:00.${String(index + 1).padStart(9, '0')}Z INFO sample request ${index + 1}\n`).join('')
module.exports = {
    ...base, entry: path.resolve(__dirname, 'KubernetesLogsVisualRegression.tsx'),
    devServer: { ...base.devServer, port: 8094, setupMiddlewares(middlewares, server) {
        server.app.get('/fixture-stats', (_req, res) => res.json({ requests }))
        server.app.get('/api/mold/kubernetes-clusters/pods/logs', (req, res) => {
            requests++
            const q = req.query
            const key = JSON.stringify([q.uid, q.container, q.previous, q.tailLines])
            const attempt = (attempts.get(key) || 0) + 1
            attempts.set(key, attempt)
            setTimeout(() => {
                if (res.destroyed) return
                if (q.uid === 'network') return req.socket.destroy()
                if (q.uid === 'unauthenticated') return res.status(401).json({ code: 'KUBERNETES_AUTHENTICATION_FAILED', message: '샘플: Kubernetes 인증에 실패했습니다.' })
                if (q.uid === 'denied') return res.status(403).json({ code: 'LOG_PERMISSION_DENIED', message: '샘플: pods/log 읽기 권한이 없습니다.' })
                if (q.uid === 'timeout') return res.status(504).json({ code: 'LOG_TIMEOUT', message: '샘플: 조회 시간이 초과되었습니다.' })
                if (q.uid === 'previous-unavailable' && q.previous === 'true') return res.status(409).json({ code: 'PREVIOUS_LOG_UNAVAILABLE', message: '샘플: 이전 로그가 남아 있지 않습니다.' })
                if ((q.uid === 'retry' && attempt === 1) || (q.uid === 'refresh-failure' && attempt === 2)) return res.status(502).json({ code: 'LOG_UNAVAILABLE', message: '샘플: 로그 서버에 일시적인 오류가 발생했습니다.' })
                res.json({ clusterId: q.id, uid: q.uid, namespace: q.namespace, name: q.name, container: q.container,
                    previous: q.previous === 'true', tailLines: Number(q.tailLines), logs: q.uid === 'empty' || q.uid === 'previous-empty' && q.previous === 'true' ? '' : (q.previous === 'true' ? 'WARN previous container sample\n' : sample),
                    truncated: false, fetchedAt: new Date().toISOString() })
            }, 1800)

        })
        return middlewares
    } }
}
