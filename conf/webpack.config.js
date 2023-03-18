//webpack.config.js
//bundle the web version of @openpgp/web-stream-tools for content script
const path = require('path');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
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
};
