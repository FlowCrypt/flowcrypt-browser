
// @ts-check

// todo - could one day be switched to .ts and compiled with the rest of tooling

const { readFileSync } = require('fs');
const originalExec = require('child_process').exec;

const version = JSON.parse(readFileSync('./package.json').toString()).version;

const CHROME_CONSUMER = 'chrome-consumer';
const CHROME_ENTERPRISE = 'chrome-enterprise';

const releaseZip = (buildType) => `../release/${buildType}/flowcrypt-${buildType}-${version.replace(/\./g, '-')}.zip`;

const exec = (shell_command) => new Promise((resolve, reject) => {
  let subprocess = originalExec(shell_command, (err) => err === null ? resolve() : reject(err));
  subprocess.stdout.pipe(process.stdout);
  subprocess.stderr.pipe(process.stderr);
});

(async () => {
  await exec(`cd ./build; rm -f ${releaseZip(CHROME_CONSUMER)}; zip -rq ${releaseZip(CHROME_CONSUMER)} ./${CHROME_CONSUMER}/*`);
  await exec(`cd ./build; rm -f ${releaseZip(CHROME_ENTERPRISE)}; zip -rq ${releaseZip(CHROME_ENTERPRISE)} ./${CHROME_ENTERPRISE}/*`);
  for (const i in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reverse()) {
    console.log(`running firefox release in ${i} seconds...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await exec('../flowcrypt-script/browser/firefox_release');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
