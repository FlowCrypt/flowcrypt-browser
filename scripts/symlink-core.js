const fs = require('fs');
const path = require('path');

const target = path.resolve(process.cwd(), 'extension/js/common/core');
const link = path.resolve(process.cwd(), 'test/source/core');

if (!fs.existsSync(link)) {
  fs.symlinkSync(target, link, 'junction'); // 'junction' works for Windows directories
  console.log('✅ Symlink created: core → ' + target);
} else {
  console.log('ℹ️ Symlink already exists: core');
}
