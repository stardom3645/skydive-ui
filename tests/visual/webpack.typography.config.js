const path = require('path')
const performanceConfig = require('./webpack.performance.config')
module.exports = (_env, argv) => ({
    ...performanceConfig(_env, argv),
    entry: path.resolve(__dirname, 'TypographyAudit.tsx'),
    output: { filename: 'preview.js', publicPath: '/', path: '/tmp/netdive-typography-audit' },
    devServer: { ...performanceConfig(_env, argv).devServer, port: 8094 }
})
