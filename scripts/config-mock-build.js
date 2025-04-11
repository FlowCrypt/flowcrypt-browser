const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// Check arguments: expects source directory and the mock port.
if (process.argv.length < 4) {
  console.error('Usage: node config-mock-build.js <source_directory> <mock_port>');
  process.exit(1);
}

const srcDir = process.argv[2];
const mockPort = process.argv[3];

// Generate a random hex string (24 characters, same as `openssl rand -hex 12`)
const randomHex = crypto.randomBytes(12).toString('hex');
// Build the new folder path
const buildPath = path.join(process.cwd(), 'build', 'test', 'mock-builds', `port-${mockPort}-${randomHex}`);

// Ensure the target directory exists.
fs.ensureDirSync(buildPath);

// Recursively copy all files from srcDir to buildPath using fs-extra's copySync.
fs.copySync(srcDir, buildPath);

// Function to recursively search and replace the token in all files.
function replaceTokenInFiles(dir, token, replacement) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceTokenInFiles(fullPath, token, replacement);
    } else if (entry.isFile()) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(token)) {
        // Create a backup of the original file.
        fs.writeFileSync(fullPath + '.bak', content, 'utf8');
        // Replace all occurrences of the token.
        content = content.split(token).join(replacement);
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

// Replace the token [TEST_REPLACEABLE_MOCK_PORT] with the provided mockPort.
replaceTokenInFiles(buildPath, '[TEST_REPLACEABLE_MOCK_PORT]', mockPort);

// Output the final build path.
console.log(buildPath);
