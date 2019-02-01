const fs = require('fs');
const path = require('path');
const concat = require('concat-stream');
const execa = require('execa');
const mkdirp = require('mkdirp');
const toml = require('toml');
const rimraf = require('rimraf');
const { createLambda } = require('@now/build-utils/lambda.js'); // eslint-disable-line import/no-extraneous-dependencies
const download = require('@now/build-utils/fs/download.js'); // eslint-disable-line import/no-extraneous-dependencies
const glob = require('@now/build-utils/fs/glob.js'); // eslint-disable-line import/no-extraneous-dependencies
const FileFsRef = require('@now/build-utils/file-fs-ref.js'); // eslint-disable-line import/no-extraneous-dependencies
const installRustAndGCC = require('./download-install-rust-toolchain.js');
const inferCargoBinaries = require('./inferCargoBinaries.js');

exports.config = {
  maxLambdaSize: '25mb',
};

async function parseTOMLStream(stream) {
  return new Promise(resolve => {
    stream.pipe(concat(data => resolve(toml.parse(data))));
  });
}

exports.build = async ({ files, entrypoint, workPath }) => {
  console.log('downloading files');
  const downloadedFiles = await download(files, workPath);

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
    await execa('cargo', ['build', '--release'], {
      env: rustEnv,
      cwd: entrypointDirname,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('failed to `cargo build --release`');
    throw err;
  }

  const targetPath = path.join(entrypointDirname, 'target', 'release');
  const binaries = await inferCargoBinaries(
    cargoToml,
    path.join(entrypointDirname, 'src'),
  );

  const lambdas = {};
  await Promise.all(
    binaries.map(async binary => {
      const fsPath = path.join(targetPath, binary);
      const lambda = await createLambda({
        files: {
          bootstrap: new FileFsRef({ mode: 0o755, fsPath }),
        },
        handler: 'bootstrap',
        runtime: 'provided',
      });

      lambdas[binary] = lambda;
    }),
  );

  return lambdas;
};

exports.prepareCache = async ({ cachePath, entrypoint, files, workPath }) => {
  console.log('preparing cache...');
  // const downloadedFiles = await download(files, workPath);
  // const entrypointDirname = path.dirname(downloadedFiles[entrypoint].fsPath);
  const entrypointDirname = path.dirname(path.join(workPath, entrypoint));
  console.log('argh', entrypointDirname);
  try {
    await execa('ls', ['-lah', entrypointDirname], {
      cwd: entrypointDirname,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('failed to `ls`');
  }

  const cacheEntrypointDirname = path.dirname(path.join(cachePath, entrypoint));
  rimraf.sync(path.join(cacheEntrypointDirname, 'target'));
  mkdirp.sync(cacheEntrypointDirname);
  fs.renameSync(
    path.join(entrypointDirname, 'target'),
    path.join(cacheEntrypointDirname, 'target'),
  );

  return {
    ...(await glob('target/**', path.join(cachePath))),
  };
};
