// npx webpack serve --config tests/visual/webpack.tabs.config.js
const path = require('path')
const base = require('./webpack.config')
module.exports = { ...base, entry: path.resolve(__dirname, 'DetailTabsVisualRegression.tsx'),
    devServer: { ...base.devServer, port: 8095 } }
