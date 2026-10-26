//webpack.config.js
// Bundle browser dependencies and the CommonJS streams build used by tests.
const path = require('path');

const forgeConfig = {
  mode: 'none',
  target: 'web',
  devtool: 'cheap-module-source-map', // External maps keep the bundles compatible with extension CSP.
  resolve: {
    tsconfig: false, // Bundle the npm package, not the declaration file mapped in tsconfig.json.
  },
};

module.exports = [
  {
    ...forgeConfig,
    entry: require.resolve('node-forge'),
    output: {
      path: path.resolve(__dirname, '../build/generic-extension-wip/lib'),
      filename: 'forge.js',
      library: {
        name: 'forge',
        type: 'var',
      },
    },
  },
  {
    ...forgeConfig,
    entry: path.resolve(__dirname, 'forge.mjs'),
    experiments: {
      outputModule: true,
    },
    output: {
      path: path.resolve(__dirname, '../build/generic-extension-wip/lib'),
      filename: 'forge.mjs',
      library: {
        type: 'module',
      },
    },
  },
  {
    mode: 'production',
    entry: {
      main: '../build/generic-extension-wip/lib/streams/streams.js',
    },
    output: {
      library: {
        name: 'Stream',
        type: 'var',
      },
      path: path.resolve('../build/generic-extension-wip/lib'),
      filename: 'streams_web.js', // <--- Will be compiled to this single file
    },
    resolve: {
      fallback: {
        stream: false,
      },
      extensions: ['.js'],
    },
  },
  {
    mode: 'production',
    entry: {
      main: '../build/generic-extension-wip/lib/streams/streams.js',
    },
    output: {
      library: {
        type: 'commonjs',
      },
      path: path.resolve('../build/generic-extension-wip/lib'),
      filename: 'streams_common.js', // <--- Will be compiled to this single file
    },
    resolve: {
      fallback: {
        stream: false,
      },
      extensions: ['.js'],
    },
  },
];
