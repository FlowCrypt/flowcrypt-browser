# Dependencies

To add a dependency, list it in `package.json` and add its distribution files to `copyDependencies` in `scripts/build.js`, or bundle it through `conf/webpack.config.js`.

Libraries that remain here verbatim are planned to use this mechanism in the future, too.

Only add a copy of a library here if it is not published as an npm module.

## Updating Forge

Update the pinned `node-forge` dependency in `package.json` and `package-lock.json` using npm, then run `npm run build` (or `npm run build-incremental`).

The existing Webpack build generates both unminified browser bundles from the installed npm package directly into `build/generic-extension-wip/lib/`:

- `forge.js` exposes the global `forge` used by classic scripts and content scripts.
- `forge.mjs` exports Forge as an ES module through `conf/forge.mjs`.

Both bundles include external source maps and are copied into each extension build. The source map configuration avoids Webpack's `eval` output to comply with extension CSP.

No separate updater, upstream repository clone, or checked-in Forge bundles are needed. Use a full or incremental build after dependency updates; `build-assets-only` only copies source assets.
