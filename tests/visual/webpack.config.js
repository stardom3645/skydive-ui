const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

module.exports = {
    mode: 'development',
    entry: path.resolve(__dirname, 'KubernetesDetailVisualRegression.tsx'),
    output: {
        filename: 'preview.js',
        publicPath: '/'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    module: {
        rules: [
            {
                test: /\.(t|j)sx?$/,
                use: { loader: 'awesome-typescript-loader' },
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    devServer: {
        host: '127.0.0.1',
        port: 8083,
        allowedHosts: 'all',
        client: { overlay: false }
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'kubernetes-detail-preview.html')
        })
    ]
}
