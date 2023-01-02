# Dependencies

To add a dependency, list it in `package.json` and then add a bash line in `build.sh` to copy appropriate dist files fromt he npm module in node_modules to the `lib` folder in the build directory.

Libraries that remain here verbatim are planned to use this mechanism in the future, too.

Only add a copy of a library here if it's not published as a npm module.

## How to update a non-minimzed forge.js
1) Checkout the needed tag, e.g.
```
git clone -b v1.3.1 https://github.com/digitalbazaar/forge
cd forge
```

2) In `webpack.config.js` add a line `devtool: 'cheap-module-source-map'` for the plain unoptimized unminified bundle configuration similar to what there is in the optimized and minified bundle configuration.

3) Build the package
```
sudo apt install webpack
npm install
npm run build
```

4) A newly-generated `forge.js` should appear in `dist` subfolder, copy it over the file in this repo.