/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

const fs = require('fs-extra');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const FORGE_REPO_URL = 'https://github.com/digitalbazaar/forge';
const TEMP_DIR = path.join(__dirname, '../.tmp-forge-build');
const EXTENSION_LIB_DIR = path.join(__dirname, '../extension/lib');

const updateForge = async (version) => {
  if (!version) {
    console.error('Error: Version parameter is required');
    console.error('Usage: npm run update-forge -- v1.3.3');
    process.exit(1);
  }

  // Ensure version starts with 'v'
  if (!version.startsWith('v')) {
    version = 'v' + version;
  }

  console.log(`Starting Forge update process for version ${version}...`);

  try {
    // Clean up any existing temp directory
    await fs.remove(TEMP_DIR);

    // Step 1: Clone the forge repository at the desired version
    console.log('\n1. Cloning forge repository...');
    execFileSync('git', ['clone', '-b', version, FORGE_REPO_URL, TEMP_DIR], { stdio: 'inherit' });

    // Step 2: Install dependencies
    console.log('\n2. Installing dependencies...');
    execSync('npm install', { cwd: TEMP_DIR, stdio: 'inherit' });

    // Step 3: Modify webpack.config.js to add source maps
    console.log('\n3. Modifying webpack.config.js to add source maps...');
    const webpackConfigPath = path.join(TEMP_DIR, 'webpack.config.js');
    let webpackConfig = fs.readFileSync(webpackConfigPath, 'utf8');

    // According to the readme, we need to add devtool to the plain unoptimized bundle
    // This is the bundle object created around line 78
    // Look for "// plain unoptimized unminified bundle" comment and the bundle object after it

    const bundlePattern = /(\/\/ plain unoptimized unminified bundle\s*\n\s*const bundle = Object\.assign\(\{}, common, \{[\s\S]*?\n\s*}\);)/;
    const match = webpackConfig.match(bundlePattern);

    if (match) {
      const bundleBlock = match[1];

      // Check if devtool already exists in this bundle configuration
      if (!bundleBlock.includes('devtool:')) {
        // Find the right place to insert devtool (after mode: 'development')
        const modifiedBundle = bundleBlock.replace(
          /(mode:\s*'development',)/,
          "$1\n    devtool: 'cheap-module-source-map',"
        );

        webpackConfig = webpackConfig.replace(bundleBlock, modifiedBundle);
        await fs.writeFile(webpackConfigPath, webpackConfig, 'utf8');
        console.log('   Added source map configuration to webpack.config.js');
      } else {
        console.log('   Source map configuration already present');
      }
    } else {
      console.warn('   Warning: Could not find the bundle configuration in webpack.config.js');
      console.warn('   The webpack.config.js structure may have changed');
      console.warn('   You may need to manually add devtool: \'cheap-module-source-map\' to the plain unoptimized bundle configuration');
    }

    // Step 4: Build forge.js
    console.log('\n4. Building forge.js...');
    execSync('npm run build', { cwd: TEMP_DIR, stdio: 'inherit' });

    // Step 5: Create conversion script for forge.mjs
    console.log('\n5. Creating conversion script for forge.mjs...');
    const conversionScriptPath = path.join(TEMP_DIR, 'convert-forge-to-mjs.js');
    const conversionScript = `const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'dist', 'forge.js');
const targetFile = path.join(__dirname, 'dist', 'forge.mjs');

console.log('Reading forge.js...');
let content = fs.readFileSync(sourceFile, 'utf8');

// Split content into lines
const lines = content.split('\\n');

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

console.log(\`Extracting lines \${startLine} to \${endLine}\`);

// Extract just the webpack bundle
const bundleLines = lines.slice(startLine, endLine);

// Remove 'return ' from the first line if present (from UMD wrapper)
// The line looks like: return /******/ (function(modules) { // webpackBootstrap
bundleLines[0] = bundleLines[0].replace(/^\\s*return\\s+/, '');

// Prepend 'var forge = ' to capture the return value
bundleLines[0] = 'var forge = ' + bundleLines[0];

const bundle = bundleLines.join('\\n');

// Create ES module wrapper
const esModule = \`const globalThis = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

\${bundle}

var lib = forge;

export { lib as default };
\`;

console.log('Writing forge.mjs...');
fs.writeFileSync(targetFile, esModule, 'utf8');
console.log('forge.mjs generated successfully!');
`;

    await fs.writeFile(conversionScriptPath, conversionScript, 'utf8');

    // Step 6: Run the conversion script
    console.log('\n6. Converting forge.js to forge.mjs...');
    execSync('node convert-forge-to-mjs.js', { cwd: TEMP_DIR, stdio: 'inherit' });

    // Step 7: Copy files to extension/lib
    console.log('\n7. Copying files to extension/lib...');

    // Ensure the destination directory exists
    await fs.ensureDir(EXTENSION_LIB_DIR);

    // Copy forge.js
    const sourceForgeJs = path.join(TEMP_DIR, 'dist', 'forge.js');
    const destForgeJs = path.join(EXTENSION_LIB_DIR, 'forge.js');
    await fs.copy(sourceForgeJs, destForgeJs);
    console.log(`   Copied forge.js to ${destForgeJs}`);

    // Copy forge.mjs
    const sourceForgeMjs = path.join(TEMP_DIR, 'dist', 'forge.mjs');
    const destForgeMjs = path.join(EXTENSION_LIB_DIR, 'forge.mjs');
    await fs.copy(sourceForgeMjs, destForgeMjs);
    console.log(`   Copied forge.mjs to ${destForgeMjs}`);

    // Step 8: Clean up
    console.log('\n8. Cleaning up temporary files...');
    await fs.remove(TEMP_DIR);

    console.log(`\n✅ Successfully updated Forge to version ${version}!`);
    console.log('Files have been copied to extension/lib/');

  } catch (error) {
    console.error('\n❌ Error during Forge update:', error.message);

    // Clean up on error
    try {
      await fs.remove(TEMP_DIR);
    } catch {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Get version from command line arguments
const version = process.argv[2];
void updateForge(version);
