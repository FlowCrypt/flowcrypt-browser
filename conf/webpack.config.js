//webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    main: './node_modules/@openpgp/web-stream-tools/lib/streams.js',
  },
  output: {
    library: {
      name: 'web-stream-tools',
      type: 'window',
    },
    path: path.resolve('./build/generic-extension-wip/lib'),
    filename: 'web-stream-tools-bundle.js', // <--- Will be compiled to this single file
  },
  resolve: {
    fallback: {
      stream: require.resolve('stream-browserify'),
    },
    extensions: ['.js'],
  },
};
