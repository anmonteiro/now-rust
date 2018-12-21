const path = require('path');
const concat = require('concat-stream');
const toml = require('toml');
const { createLambda } = require('@now/build-utils/lambda.js');
const glob = require('@now/build-utils/fs/glob.js');
const rename = require('@now/build-utils/fs/rename.js');
const objectHash = require('object-hash');
const download = require('@now/build-utils/fs/download.js');
const installRust = require('./download-install-rust-toolchain');
const downloadGit = require('lambda-git');
const getWritableDirectory = require('@now/build-utils/fs/get-writable-directory.js');

exports.config = {
  maxLambdaSize: '25mb',
};

async function parseTOMLStream(stream) {
  return new Promise((resolve, reject) => {
    stream.pipe(concat(data => resolve(toml.parse(data))));
  });
}

exports.build = async ({ files, entrypoint }) => {
  console.log('downloading files');
  const srcPath = await getWritableDirectory();
  const downloadedFiles = await download(files, srcPath);

  // move all user code to 'user' subdirectory
  const userFiles = rename(files, name => path.join('user', name));
  // const launcherFiles = await glob('**', path.join(__dirname, 'dist'));
  // const zipFiles = { ...userFiles, ...launcherFiles };

  await installRust();

  console.log('downloading git binary...');
  // downloads a git binary that works on Amazon Linux and sets
  // `process.env.GIT_EXEC_PATH` so `go(1)` can see it
  await downloadGit({ targetDirectory: gitPath });

  const { PATH, HOME } = process.env;
  const rustEnv = {
    ...process.env,
    PATH: `${path.join(HOME, '.cargo/bin')}:${envPath}`,
  };

  let cargoToml;
  try {
    cargoToml = await parseTOMLStream(files[entrypoint].toStream());
  } catch (err) {
    console.error('Failed to parse TOML from entrypoint:', entrypoint);
    throw err;
  }
  // TODO: require package name in `Cargo.toml`
  const executableName = package.name.replace(/-/g, '_');

  const entrypointDirname = path.dirname(downloadedFiles[entrypoint].fsPath);
  console.log('running `cargo build --release`...');
  try {
    await execa('cargo', ['build', '--release'], {
      env: rustEnv,
      cwd: entrypointDirname,
      stdio: 'inherit',
    });
  } catch (err) {
    console.log('failed to `cargo build`');
    throw err;
  }

  const fsPath = path.join(srcPath, 'target/release', executableName);
  const lambda = await createLambda({
    files: {
      bootstrap: new FileFsRef({ mode: 0o755, fsPath }),
    },
    handler: 'bootstrap',
    runtime: 'provided',
  });

  return { [executableName]: lambda };
};
