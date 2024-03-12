// webpack.background-config.js
//bundle the background.js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    main: '../build/generic-extension-wip/js/service_worker/background.js',
  },
  output: {
    path: path.resolve('../build/generic-extension-wip/lib'),
    filename: 'background_bundle.js', // <--- Will be compiled to this single file
  },
  resolve: {
    extensions: ['.js'],
  },
};
