const TsPathPlugin = require('tsconfig-paths-webpack-plugin');

const options = {
    plugins: [ 
        '@babel/plugin-transform-runtime',
    ],
    presets: [
        "@babel/env",
        "@babel/typescript",
    ],
};

const resolve = {
    extensions: ['.tsx', '.ts', '.js'],
    plugins: [
        new TsPathPlugin({ configFile: './tsconfig.json' }),
    ],
};

module.exports = [
    {
        target: 'node',
        entry: './test/fixture/server',
        resolve,
        module: {
            rules: [
                {
                    test: /\.(ts|js)x?$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader',
                    options,
                },
            ],
        },
    },
    {
        entry: './test/fixture/client',
        output: {
            filename: 'test.bundle.js',
        },
        devServer: {
            publicPath: '/',
        },
        resolve,
        module: {
            rules: [
                {
                    test: /\.(ts|js)x?$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader',
                    options,
                },
            ],
        },
    },
];
