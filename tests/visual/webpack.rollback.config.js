const path = require('path')
const { DefinePlugin } = require('webpack')
const base = require('./webpack.performance.config')
module.exports = (env, argv) => {
    const config = base(env, argv)
    return { ...config, entry: path.resolve(__dirname, 'TopologySemanticRollback.tsx'),
        output: { ...config.output, path: process.env.NETDIVE_ROLLBACK_OUTPUT || '/tmp/netdive-semantic-rollback-build' },
        plugins: [...config.plugins, new DefinePlugin({ 'process.env.NETDIVE_ROLLBACK_VARIANT': JSON.stringify(process.env.NETDIVE_ROLLBACK_VARIANT || 'after') })] }
}
