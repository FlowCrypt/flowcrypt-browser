# Dependencies

To add a dependency, list it in `package.json` and then add a bash line in `build.sh` to copy appropriate dist files fromt he npm module in node_modules to the `lib` folder in the build directory.

Libraries that remain here verbatim are planned to use this mechanism in the future, too.

Only add a copy of a library here if it's not published as a npm module.