# Dependencies

To add a dependency, list it in `package.json` and then add a bash line in `build.sh` to copy appropriate dist files from the npm module in node_modules to the `lib` folder in the build directory.

Libraries that remain here verbatim are planned to use this mechanism in the future, too.

Only add a copy of a library here if it's not published as a npm module.

## How to update forge.js and forge.mjs

Both `forge.js` and `forge.mjs` need to be rebuilt when updating node-forge to a new version.

### Automated Method (Recommended)

Use the automated update script:

```bash
npm run update-forge -- v1.3.3
```

This script will automatically:
1. Clone the forge repository at the specified version
2. Modify webpack.config.js to add source maps
3. Build forge.js with source maps
4. Convert forge.js to forge.mjs
5. Copy both files to `extension/lib/`
6. Clean up temporary files

The version can be specified with or without the 'v' prefix (e.g., `v1.3.3` or `1.3.3`).

### Manual Method

If you prefer to update manually, follow these steps:

### 1) Clone the forge repository at the desired version

```bash
git clone -b v1.3.2 https://github.com/digitalbazaar/forge
cd forge
```

Replace `v1.3.2` with the desired version tag.

### 2) Install dependencies

```bash
npm install
```

### 3) Build forge.js (UMD bundle with source maps)

In `webpack.config.js`, add a line `devtool: 'cheap-module-source-map'` in the plain unoptimized unminified bundle configuration (around line 82), similar to what exists in the optimized bundle configuration.

Then build:

```bash
npm run build
```

Copy `dist/forge.js` to `extension/lib/forge.js` in this repository.

### 4) Build forge.mjs (ES module)

Since `node-forge` uses webpack and has Node.js built-ins that can be tricky to bundle with rollup for the browser, the most stable way to generate the ES module is to convert the already-built `forge.js`.

Create a script `convert-forge-to-mjs.js`:

```javascript
const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'dist', 'forge.js');
const targetFile = path.join(__dirname, 'dist', 'forge.mjs');

console.log('Reading forge.js...');
let content = fs.readFileSync(sourceFile, 'utf8');

// Split content into lines
const lines = content.split('\n');

// Find where the webpack bundle starts
// It starts with the webpack bootstrap function
let startLine = lines.findIndex(line => line.includes('/******/ (function(modules) { // webpackBootstrap'));

if (startLine === -1) {
  throw new Error('Could not find webpack bundle start');
}

// Find the end - the webpack bundle ends with "/******/ });"
// This closes the modules object passed to the bootstrap function
let endLine = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() === '/******/ });') {
    endLine = i + 1; // Include this line
    break;
  }
}

if (endLine === -1) {
  throw new Error('Could not find bundle end');
}

console.log(`Extracting lines ${startLine} to ${endLine}`);

// Extract just the webpack bundle
const bundleLines = lines.slice(startLine, endLine);

// Remove 'return ' from the first line if present (from UMD wrapper)
// The line looks like: return /******/ (function(modules) { // webpackBootstrap
bundleLines[0] = bundleLines[0].replace(/^\s*return\s+/, '');

// Prepend 'var forge = ' to capture the return value
bundleLines[0] = 'var forge = ' + bundleLines[0];

const bundle = bundleLines.join('\n');

// Create ES module wrapper
const esModule = `const globalThis = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

${bundle}

var lib = forge;

export { lib as default };
`;

console.log('Writing forge.mjs...');
fs.writeFileSync(targetFile, esModule, 'utf8');
```

Run the script:

```bash
node convert-forge-to-mjs.js
```

Copy `dist/forge.mjs` to `extension/lib/forge.mjs` in this repository.

