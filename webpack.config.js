const HtmlWebPackPlugin = require("html-webpack-plugin");
const CopyWebPackPlugin = require('copy-webpack-plugin');

var path = require('path');

const devBackend = process.env.NETDIVE_DEV_BACKEND || 'http://10.10.254.191:8082';
const devPort = Number(process.env.NETDIVE_DEV_PORT || 8082);

const htmlPlugin = new HtmlWebPackPlugin({
    template: "./src/index.html",
    filename: "./index.html"
});

module.exports = {
    entry: './src/index.tsx',
    output: {
        filename: 'dist/bundle.js',
        publicPath: '/ui_v2/'
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        fallback: {
            url: require.resolve('url/')
        }
    },
    module: {
        rules: [
            {
                test: /\.(t|j)sx?$/,
                use: {
                    loader: 'awesome-typescript-loader'
                },
                exclude: /node_modules/
            },
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.(gif|png|jpe?g|svg)$/i,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                        }
                    }
                ],
            },
            {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/'
                        }
                    }
                ]
            },
        ]
    },

    devServer: {
        historyApiFallback: {
            rewrites: [
                { from: /^\/ui_v2\/.*$/, to: '/index.html' }
            ]
        },
        static: {
            directory: path.join(__dirname, 'dist'),
            publicPath: '/ui_v2/'
        },
        compress: true,
        port: devPort,
        allowedHosts: 'all',
        client: {
            overlay: {
                errors: true,
                warnings: false
            },
            webSocketURL: {
                pathname: '/netdive-dev-ws'
            }
        },
        webSocketServer: {
            type: 'ws',
            options: {
                path: '/netdive-dev-ws'
            }
        },
        devMiddleware: {
            publicPath: '/ui_v2/'
        },
        proxy: {
            '/api': {
                target: devBackend,
                changeOrigin: true,
                secure: false
            },
            '/ws': {
                target: devBackend,
                changeOrigin: true,
                secure: false,
                ws: true
            }
        }
    },

    devtool: "source-map",

    plugins: [
        htmlPlugin,
        new CopyWebPackPlugin({
            patterns: [
                { from: 'assets', to: 'assets' }
            ]
        })
    ]
}
