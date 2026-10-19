// Local-only fixture. No collector or live Kubernetes credentials are used.
const path = require('path')
const base = require('./webpack.config')
const requests = {}
module.exports = {
    ...base, entry: path.resolve(__dirname, 'KubernetesYAMLVisualRegression.tsx'),
    devServer: { ...base.devServer, port: 8097, setupMiddlewares(middlewares, server) {
        server.app.get('/fixture-stats', (_req, res) => res.json(requests))
        server.app.get('/api/mold/kubernetes-clusters/pods/detail', (req, res) => {
            const q = req.query
            res.json({ clusterId: q.id, uid: q.uid, name: `yaml-viewer-${q.uid}`, namespace: 'sample-system', phase: 'Running',
                containers: [{ name: 'web', image: 'example/web:1', type: 'APPLICATION', ready: true, state: 'RUNNING' }] })
        })
        server.app.get('/api/mold/kubernetes-clusters/pods/logs', (req, res) => {
            const q = req.query
            res.json({ clusterId: q.id, uid: q.uid, namespace: q.namespace, name: q.name, container: q.container, previous: false, logs: 'Sample log\n', fetchedAt: new Date().toISOString() })
        })
        server.app.get('/api/mold/kubernetes-clusters/pods/yaml', (req, res) => {
            const q = req.query
            requests[q.uid] = (requests[q.uid] || 0) + 1
            setTimeout(() => {
                if (res.destroyed) return
                const error = (status, code, message) => res.status(status).json({ code, message })
                if (q.uid === 'denied') return error(403, 'YAML_PERMISSION_DENIED', '샘플 권한 오류')
                if (q.uid === 'unauthenticated') return error(401, 'KUBERNETES_AUTHENTICATION_FAILED', '샘플 인증 오류')
                if (q.uid === 'missing') return error(404, 'POD_NOT_FOUND', '샘플 파드 삭제')
                if (q.uid === 'timeout') return error(504, 'YAML_TIMEOUT', '샘플 시간 초과')
                if (q.uid === 'retry' && requests[q.uid] === 1 || q.uid === 'refresh-failure' && requests[q.uid] === 2) return error(502, 'YAML_UNAVAILABLE', '샘플 일시적 조회 실패')
                const yaml = `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${q.name}\n  namespace: ${q.namespace}\n  uid: ${q.uid}\n  labels:\n    app: yaml-viewer-test\nspec:\n  containers:\n  - name: web\n    image: example/web:1\n    env:\n    - name: '[REDACTED]'\n      value: '[REDACTED]'\n    resources:\n      requests:\n        cpu: 100m\n        memory: 128Mi\n      limits:\n        memory: 512Mi\n    volumeMounts:\n    - name: config\n      mountPath: /sample/${'long-path/'.repeat(30)}\n  restartPolicy: Always\nstatus:\n  phase: Running\n` + Array.from({ length: 80 }, (_, i) => `# 개발 검증용 주석 ${i + 1}\n`).join('')
                res.json({ clusterId: q.id, uid: q.uid, namespace: q.namespace, name: q.name, yaml: q.uid === 'empty' ? '' : yaml,
                    redacted: true, fetchedAt: new Date().toISOString() })
            }, q.uid === 'slow' ? 5000 : 180)
        })
        return middlewares
    } }
}
