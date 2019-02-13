const fs = require('fs-extra');
const path = require('path');
const concat = require('concat-stream');
const execa = require('execa');
const toml = require('@iarna/toml');
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
  return toml.parse.stream(stream);
}

async function buildWholeProject({
  files,
  entrypoint,
  downloadedFiles,
  rustEnv,
}) {
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
  const lambdaPath = path.dirname(entrypoint);
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

      lambdas[path.join(lambdaPath, binary)] = lambda;
    }),
  );

  return lambdas;
}

async function buildSingleFile({
  workPath,
  entrypoint,
  downloadedFiles,
  rustEnv,
}) {
  console.log('building single file');
  const launcherPath = path.join(__dirname, 'launcher.rs');
  let launcherData = await fs.readFile(launcherPath, 'utf8');

  const entrypointPath = downloadedFiles[entrypoint].fsPath;
  const entrypointDirname = path.dirname(entrypointPath);
  console.log('launcher datqa', launcherData);
  launcherData = launcherData.replace(
    '// PLACEHOLDER',
    await fs.readFile(path.join(workPath, entrypoint)),
  );
  // replace the entrypoint with one that includes the the imports + lambda.start
  await fs.remove(entrypointPath);
  await fs.writeFile(entrypointPath, launcherData);

  // Find a Cargo.toml file or TODO: create one
  let cargoTomlFile;
  try {
    const { stdout: projectDescriptionStr } = await execa(
      'cargo',
      ['locate-project'],
      {
        env: rustEnv,
        cwd: entrypointDirname,
      },
    );
    const projectDescription = JSON.parse(projectDescriptionStr);
    if (projectDescription != null && projectDescription.root != null) {
      cargoTomlFile = projectDescription.root;
    }
  } catch (e) {
    if (!/could not find/g.test(e.stderr)) {
      console.error("Couldn't run `cargo locate-project`");
      throw e;
    }
  }

  // TODO: we're assuming there's a Cargo.toml file. We need to create one
  // otherwise
  let cargoToml;
  try {
    cargoToml = await parseTOMLStream(fs.createReadStream(cargoTomlFile));
  } catch (err) {
    console.error('Failed to parse TOML from entrypoint:', entrypoint);
    throw err;
  }

  const binName = path
    .basename(entrypointPath)
    .replace(path.extname(entrypointPath), '');
  const { package, dependencies } = cargoToml;
  dependencies.now_lambda = {
    git: 'https://github.com/zeit/now-builders',
  };
  const tomlToWrite = toml.stringify({
    package,
    dependencies,
    bin: [
      {
        name: binName,
        path: entrypointPath,
      },
    ],
  });
  console.log('toml to write:', tomlToWrite);

  // Overwrite the Cargo.toml file with one that includes the `now_lambda`
  // dependency and our binary. `dependencies` is a map so we don't run the
  // risk of having 2 `now_lambda`s in there.
  await fs.writeFile(cargoTomlFile, tomlToWrite);

  console.log('running `cargo build --release`...');
  try {
    await execa('cargo', ['build', '--bin', binName], {
      env: rustEnv,
      cwd: entrypointDirname,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('failed to `cargo build --release`');
    throw err;
  }

  const bin = path.join(
    path.dirname(cargoTomlFile),
    'target',
    'debug',
    binName,
  );
  console.log('bin', bin);
  try {
    await execa('ls', ['-lah', path.join('target', 'debug')], {
      env: rustEnv,
      cwd: entrypointDirname,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('failed to `cls`');
  }

  const lambda = await createLambda({
    files: {
      bootstrap: new FileFsRef({ mode: 0o755, fsPath: bin }),
    },
    handler: 'bootstrap',
    runtime: 'provided',
  });

  return {
    [entrypoint]: lambda,
  };
}

exports.build = async m => {
  const { files, entrypoint, workPath } = m;
  console.log('downloading files');
  const downloadedFiles = await download(files, workPath);

  const { PATH: toolchainPath, ...otherEnv } = await installRustAndGCC();
  const { PATH, HOME } = process.env;
  const rustEnv = {
    ...process.env,
    ...otherEnv,
    PATH: `${path.join(HOME, '.cargo/bin')}:${toolchainPath}:${PATH}`,
  };

  const newM = Object.assign(m, { downloadedFiles, rustEnv });
  if (path.extname(entrypoint) === '.toml') {
    return await buildWholeProject(newM);
  } else {
    return await buildSingleFile(newM);
  }
};

exports.prepareCache = async ({ cachePath, entrypoint, workPath }) => {
  console.log('preparing cache...');

  let targetFolderDir;
  if (path.extname(entrypoint) === '.toml') {
    targetFolderDir = path.dirname(path.join(workPath, entrypoint));
  } else {
    const { PATH, HOME } = process.env;
    const rustEnv = {
      ...process.env,
      PATH: `${path.join(HOME, '.cargo/bin')}:${PATH}`,
    };

    try {
      const { stdout: projectDescriptionStr } = await execa(
        'cargo',
        ['locate-project'],
        {
          env: rustEnv,
          cwd: path.dirname(entrypoint),
        },
      );
      const projectDescription = JSON.parse(projectDescriptionStr);
      if (projectDescription != null && projectDescription.root != null) {
        targetFolderDir = path.dirname(projectDescription.root);
      }
    } catch (e) {
      if (!/could not find/g.test(e.stderr)) {
        console.error("Couldn't run `cargo locate-project`");
        throw e;
      }
    }
    if (targetFolderDir == null) {
      // `Cargo.toml` doesn't exist, in `build` we put it in the same
      // path as the entrypoint.
      targetFolderDir = path.dirname(path.join(workPath, entrypoint));
    }
  }

  const cacheEntrypointDirname = path.join(
    cachePath,
    path.relative(workPath, targetFolderDir),
  );

  // Remove the target folder to avoid 'directory already exists' errors
  fs.removeSync(path.join(cacheEntrypointDirname, 'target'));
  fs.mkdirpSync(cacheEntrypointDirname);
  // Move the target folder to the cache location
  fs.renameSync(
    path.join(targetFolderDir, 'target'),
    path.join(cacheEntrypointDirname, 'target'),
  );

  return {
    ...(await glob('**/**', path.join(cachePath))),
  };
};
