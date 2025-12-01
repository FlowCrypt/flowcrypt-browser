# Dependencies

To add a dependency, list it in `package.json` and then add a bash line in `build.sh` to copy appropriate dist files from the npm module in node_modules to the `lib` folder in the build directory.

Libraries that remain here verbatim are planned to use this mechanism in the future, too.

Only add a copy of a library here if it's not published as a npm module.

## How to update forge.js and forge.mjs

Both `forge.js` and `forge.mjs` need to be rebuilt when updating node-forge to a new version.

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

Install rollup and create a rollup configuration:

```bash
npm install --save-dev rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs
```

Create `rollup.config.js`:

```javascript
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'lib/index.js',
  output: {
    file: 'dist/forge.mjs',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    resolve(),
    commonjs()
  ]
};
```

Build the ES module:

```bash
npx rollup -c rollup.config.js
```

Copy `dist/forge.mjs` to `extension/lib/forge.mjs` in this repository.

