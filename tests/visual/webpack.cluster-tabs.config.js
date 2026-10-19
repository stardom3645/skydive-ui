const path = require('path')
const base = require('./webpack.config')
const requests = {}
module.exports = { ...base, entry: path.resolve(__dirname, 'KubernetesClusterTabsVisualRegression.tsx'),
    devServer: { ...base.devServer, port: 8098, setupMiddlewares(middlewares, server) {
        server.app.get('/fixture-stats', (_req, res) => res.json(requests))
        server.app.get('/api/mold/kubernetes-clusters/summary', (req, res) => {
            const id = req.query.id
            requests[id] = (requests[id] || 0) + 1
            if (id === 'failed') return res.status(502).json({ message: '샘플 조회 실패' })
            res.json({ clusterUid: id, apiConnectionStatus: 'API Healthy', collectedAt: new Date().toISOString(), lastSyncAt: new Date().toISOString(),
                namespaceCount: 1, currentlyImpactedServiceCount: id === 'issues' ? 1 : 0,
                nodes: { total: 2, ready: id === 'issues' ? 1 : 2, notReady: id === 'issues' ? 1 : 0 }, controlPlane: { total: 1, ready: 1 },
                resources: { metricsAvailable: id !== 'no-metrics', allocatableCpuCores: 8, allocatableMemoryBytes: 8 * 1024 ** 3, allocatablePods: 220,
                    usageCpuCores: 0, usageMemoryBytes: 1024 ** 3, requestsCpuCores: 2, requestsMemoryBytes: 2 * 1024 ** 3, limitsCpuCores: 4, limitsMemoryBytes: 4 * 1024 ** 3 },
                recentChanges: Array.from({ length: id === 'issues' ? 6 : 1 }, (_, index) => ({ type: 'Pod', resourceType: 'pod', resourceName: 'sample-web-0', resource: 'sample-web-0', reason: 'BackOff', message: '샘플 컨테이너 재시작', time: new Date(Date.now() - index * 120000).toISOString() })) })
        })
        server.app.get('/api/mold/kubernetes-clusters/pods/logs', (req, res) => res.json({ clusterId: req.query.id, uid: req.query.uid, namespace: req.query.namespace, name: req.query.name, container: req.query.container, previous: req.query.previous === 'true', logs: 'Sample cluster log\n', fetchedAt: new Date().toISOString() }))
        return middlewares
    } }
}
