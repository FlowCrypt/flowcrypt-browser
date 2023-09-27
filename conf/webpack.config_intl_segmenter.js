const path = require('path');

module.exports = {
  mode: 'production',
  entry: ['../build/generic-extension-wip/lib/intl_segmenter.js'],
  output: {
    library: {
      name: 'Segmenter',
      type: 'var',
    },
    path: path.resolve('../build/generic-extension-wip/lib'),
    filename: 'intl_segmenter.js', // <--- Will be compiled to this single file
  },
  resolve: {
    fallback: {
      stream: false,
    },
    extensions: ['.js'],
  },
};
