//webpack.config.js
//bundle the web version of @openpgp/web-stream-tools for content script
const path = require('path');

module.exports = {
  mode: 'production',
  entry: ['../build/generic-extension-wip/lib/emoji-regex.js'],
  output: {
    library: {
      name: 'emojiRegex',
      type: 'var',
    },
    path: path.resolve('../build/generic-extension-wip/lib'),
    filename: 'emoji_regex_web.js', // <--- Will be compiled to this single file
  },
  resolve: {
    fallback: {
      stream: false,
    },
    extensions: ['.js'],
  },
};
