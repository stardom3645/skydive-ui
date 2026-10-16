const path = require('path')
const base = require('../../webpack.config')
module.exports = { ...base, entry: path.resolve(__dirname, 'TopologyLayerGuide.tsx'),
    output: { ...base.output, publicPath: '/' },
    devServer: { ...base.devServer, host: '127.0.0.1', port: 8098, proxy: undefined,
        devMiddleware: { publicPath: '/' }, historyApiFallback: true, client: { overlay: false } } }
