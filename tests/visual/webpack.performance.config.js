const path = require('path')
const base = require('./webpack.config')
const { NormalModuleReplacementPlugin } = require('webpack')
module.exports = (_env, argv) => ({
    ...base, mode: argv.mode || 'development',
    entry: path.resolve(__dirname, 'TopologyPerformance.tsx'),
    output: { ...base.output, path: process.env.NETDIVE_PERF_OUTPUT || '/tmp/netdive-perf-build', publicPath: '/' },
    resolve: { ...base.resolve, fallback: { url: require.resolve('url/') } },
    module: { rules: [...base.module.rules, { test: /\.(svg|woff2?|ttf|eot)(\?.*)?$/, type: 'asset/inline' }] },
    devServer: { ...base.devServer, port: Number(process.env.NETDIVE_PERF_PORT || 8096) },
    plugins: [...base.plugins, new NormalModuleReplacementPlugin(/.*/, resource => {
        if (!process.env.NETDIVE_PERF_SOURCE || !resource.request.startsWith('.')) return
        const resolved = path.resolve(resource.context, resource.request)
        const source = path.resolve(__dirname, '../../src')
        if (resolved.startsWith(source + path.sep)) resource.request = process.env.NETDIVE_PERF_SOURCE + resolved.slice(source.length)
    })]
})
