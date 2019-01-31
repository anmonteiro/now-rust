const path = require('path');
const concat = require('concat-stream');
const execa = require('execa');
const toml = require('toml');
const { createLambda } = require('@now/build-utils/lambda.js');
const rename = require('@now/build-utils/fs/rename.js');
const download = require('@now/build-utils/fs/download.js');
const getWritableDirectory = require('@now/build-utils/fs/get-writable-directory.js');
const FileFsRef = require('@now/build-utils/file-fs-ref.js');
const installRustAndGCC = require('./download-install-rust-toolchain');
const inferCargoBinaries = require('./inferCargoBinaries');

exports.config = {
  maxLambdaSize: '25mb',
};

async function parseTOMLStream(stream) {
  return new Promise(resolve => {
    stream.pipe(concat(data => resolve(toml.parse(data))));
  });
}

exports.build = async ({ files, entrypoint }) => {
  console.log('downloading files');
  const srcPath = await getWritableDirectory();
  const downloadedFiles = await download(files, srcPath);

  // move all user code to 'user' subdirectory
  rename(files, name => path.join('user', name));

  const { PATH: toolchainPath, ...otherEnv } = await installRustAndGCC();
  const { PATH, HOME } = process.env;
  const rustEnv = {
    ...process.env,
    ...otherEnv,
    PATH: `${path.join(HOME, '.cargo/bin')}:${toolchainPath}:${PATH}`,
  };

  let cargoToml;
  try {
    cargoToml = await parseTOMLStream(files[entrypoint].toStream());
  } catch (err) {
    console.error('Failed to parse TOML from entrypoint:', entrypoint);
    throw err;
  }

  const entrypointDirname = path.dirname(downloadedFiles[entrypoint].fsPath);
  console.log('running `cargo build --release`...');
  try {
    await execa('cargo', ['build', '-j', '8', '--release'], {
      env: rustEnv,
      cwd: entrypointDirname,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('failed to `cargo build --release`');
    throw err;
  }

  const targetPath = path.join(srcPath, 'target', 'release');
  const binaries = await inferCargoBinaries(
    cargoToml,
    path.join(srcPath, 'dir'),
  );

  const lambdas = {};
  binaries.forEach(async binary => {
    const fsPath = path.join(targetPath, binary);
    const lambda = await createLambda({
      files: {
        bootstrap: new FileFsRef({ mode: 0o755, fsPath }),
      },
      handler: 'bootstrap',
      runtime: 'provided',
    });

    lambdas[executableName] = lambda;
  });

  return lambdas;
};
