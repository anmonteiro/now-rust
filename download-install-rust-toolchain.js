const path = require('path');
const execa = require('execa');
const fs = require('fs');
const tar = require('tar');
const fetch = require('node-fetch');
const getWritableDirectory = require('@now/build-utils/fs/get-writable-directory.js');

const url = 'https://s3.eu-west-3.amazonaws.com/anmonteiro/rust.tar';
const ccUrl = 'https://lambci.s3.amazonaws.com/binaries/gcc-4.8.5.tgz';

async function downloadRust() {
  console.log('downloading the rust toolchain');
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download: ${url}`);
  }

  const { HOME } = process.env;
  return new Promise((resolve, reject) => {
    res.body
      .on('error', reject)
      .pipe(tar.extract({ cwd: HOME }))
      .on('finish', () => resolve(path.join(HOME, '.cargo/bin', 'cargo')));
  });
}

// async function downloadRustInstaller() {
//   console.log('downloading the rustup installer');
//   const res = await fetch(url);
//   const dir = await getWritableDirectory();
//   const writable = fs.createWriteStream(path.join(dir, 'rustup-installer'));

//   if (!res.ok) {
//     throw new Error(`Failed to download: ${url}`);
//   }

//   return new Promise((resolve) => {
//     res.body
//       .on('error', reject)
//       .pipe(writable)
//       .on('finish', async () => {
//         const installerPath = path.join(dir, 'rustup-installer');
//         await fs.chmodSync(installerPath, 0o755);
//         return resolve(installerPath);
//       });
//   });
// }

async function downloadGCC() {
  console.log('downloading GCC');
  const dir = await getWritableDirectory();
  const res = await fetch(ccUrl);

  if (!res.ok) {
    throw new Error(`Failed to download: ${url}`);
  }

  return new Promise((resolve, reject) => {
    res.body
      .on('error', reject)
      .pipe(tar.extract({ gzip: true, cwd: '/tmp' }))
      .on('finish', async () => {
        const { LD_LIBRARY_PATH } = process.env;
        const newEnv = {
          PATH: `/tmp/bin:/tmp/sbin`,
          LD_LIBRARY_PATH: `/tmp/lib:/tmp/lib64:${LD_LIBRARY_PATH}`,
          CPATH: `/tmp/include`,
          LIBRARY_PATH: `/tmp/lib`,
        };

        return resolve(newEnv);
      });
  });
}

module.exports = async () => {
  const installer = await downloadRustInstaller();
  try {
    await execa(installer, ['-y'], {
      stdio: 'inherit',
    });
  } catch (err) {
    console.log('failed to `rustup-installer -y`');
    throw err;
  }

  const newEnv = await downloadGCC();

  return newEnv;
};
