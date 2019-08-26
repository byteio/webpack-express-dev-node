webpack-express-dev-node
=========

**beta software**

webpack-compiled client & server hot-reloading in a single process

This is a tool for local development - use in production at your own peril.

## Features

Launch your hot-reloading server application in development mode directly from a webpack configuration. This allows for easier alignment of server & client bundle outputs reducing unexpected inconsistencies between them.
  - helps to reduce errors related to client/server module resolution and SSR content matching
  - easier client/server code sharing between complex webpack configurations
  - minimal application differences between development and production at run-time

Transparently wires up webpack-dev-middleware and webpack-hot-middleware to your express stack. This allows you to serve up webpack HMR client assets from memory, in the same process that powers server-side routes, without needing to write development code branches to accomplish this.
  - hot-reload your express server code without forking or killing & restarting the process
  - no need to manage webpack dist output in development
  - no need to manage multiple webpack-dev-servers and their ports

## Usage

`yarn webpack-express-dev-node webpack.dev.js`

1. Install
2. Config 

#### Install 

```bash
yarn add --dev webpack-express-dev-node
```

#### Configure webpack

Create a webpack configuration file that exports your server and client configurations. 

Use the `target: 'node'` webpack configuration attribute to designate your server.
Below is an **example** configuration.

```js
const TsPathPlugin = require('tsconfig-paths-webpack-plugin');
const mode = 'development';
const nodeExternals = require('webpack-node-externals');

const resolve = {
    extensions: ['.tsx', '.ts', '.js'],
    plugins: [
        new TsPathPlugin({ configFile: './tsconfig.json' }),
    ],
};

module.exports = {
    target: 'node',
    externals: [nodeExternals()],
    entry: './test.index.js',
    resolve,
    mode,
    module: {
        rules: [
            {
                test: /\.(ts|js)x?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
            },
        ],
    },
    output: {
        filename: 'server.js',
    },
};

```

#### Run
```bash
yarn webpack-express-dev-node webpack.dev.js
```


## Contributions

This software sucks and there are some missing features, I'll get to them eventually, but PRs are welcome.
