const path = require('path');
const fs = require('fs');

const execa = require('execa');
const fetch = require('node-fetch');
const getWritableDirectory = require('@now/build-utils/fs/get-writable-directory.js');

const url = 'https://sh.rustup.rs';

async function downloadInstaller() {
  console.log('downloading the rustup installer');
  const res = await fetch(url);
  const dir = await getWritableDirectory();
  const writable = fs.createWriteStream(path.join(dir, 'rustup-installer'));

  if (!res.ok) {
    throw new Error(`Failed to download: ${url}`);
  }

  return new Promise((resolve, reject) => {
    res.body
      .on('error', reject)
      .pipe(writable)
      .on('finish', async () => {
        const installerPath = path.join(dir, 'rustup-installer');
        await fs.chmodSync(installerPath, 0o755);
        return resolve(installerPath);
      });
  });
}

module.exports = async () => {
  const installer = await downloadInstaller();

  try {
    await execa(installer, ['-y'], {
      stdio: 'inherit',
    });
  } catch (err) {
    console.log('failed to `rustup-installer -y`');
    throw err;
  }
};
