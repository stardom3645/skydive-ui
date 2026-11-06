const path = require('path')
const base = require('./webpack.performance.config')
module.exports = (env, argv) => {
    const config = base(env, argv)
    return { ...config, entry: path.resolve(__dirname, 'InfrastructureVMSemanticZoom.tsx'),
        output: { ...config.output, path: '/tmp/netdive-semantic-build' },
        devServer: { ...config.devServer, port: 8097 } }
}
