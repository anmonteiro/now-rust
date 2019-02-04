/* global beforeAll, expect, it, jest */
const fs = require('fs');
const path = require('path');
const toml = require('toml');

const inferCargoBinaries = require('../inferCargoBinaries');

const { exists, readdir, stat } = fs;
const isDir = fs.Stats.prototype.isDirectory;

beforeEach(() => {
  fs.exists = jest.fn((p, cb) => {
    return cb(false);
  });
});

afterEach(() => {
  fs.readdir = readdir;
  fs.stat = stat;
  fs.Stats.prototype.isDirectory = isDir;
  fs.exists = exists;
});

// src/
// |- main.rs
describe('one binary, src/main.rs', async () => {
  beforeEach(() => {
    fs.readdir = jest.fn((p, cb) => {
      return cb(null, ['main.rs']);
    });
    fs.exists = jest.fn((p, cb) => {
      return cb(p.endsWith('main.rs'));
    });
  });

  it('infers only one binary', async () => {
    const toml = {
      package: {
        name: 'foo',
      },
    };
    expect(inferCargoBinaries(toml, '/path/to/src')).resolves.toEqual(['foo']);
  });
});

// [[bin]] sections in `Cargo.toml`
// `main.rs` -> `package.name`
// `bar.rs` -> `bin.name`
// src/
// |- bar.rs
// |- main.rs
describe('two binaries, src/main.rs, src/bar.rs', async () => {
  beforeEach(() => {
    fs.readdir = jest.fn((p, cb) => {
      return cb(null, ['main.rs', 'bar.rs']);
    });
    fs.exists = jest.fn((p, cb) => {
      return cb(p.endsWith('main.rs'));
    });
  });

  it('infers two binaries', async () => {
    const toml = {
      package: {
        name: 'foo',
      },
      bin: [{ name: 'bar', path: 'src/bar.rs' }],
    };
    expect((await inferCargoBinaries(toml, '/path/to/src')).sort()).toEqual([
      'bar',
      'foo',
    ]);
  });
});

// no main.rs
// src/
// |- foo.rs
describe('one named binary, no main.rs', async () => {
  beforeEach(() => {
    fs.readdir = jest.fn((p, cb) => {
      return cb(null, ['bar.rs']);
    });
  });

  it('infers only one binary', async () => {
    const toml = {
      package: {
        name: 'foo',
      },
      bin: [{ name: 'bar', path: 'src/bar.rs' }],
    };
    expect((await inferCargoBinaries(toml, '/path/to/src')).sort()).toEqual([
      'bar',
    ]);
  });
});

// `src/bin` folder
// src/
// |- bin/
// |  |- bar.rs
// |  |- baz.rs
// |- main.rs
describe('multiple binaries in bin/, no [[bin]] section', async () => {
  beforeEach(() => {
    fs.readdir = jest.fn((p, cb) => {
      if (p === '/path/to/src') {
        return cb(null, ['bin', 'main.rs']);
      }
      if (p === '/path/to/src/bin') {
        return cb(null, ['bar.rs', 'baz.rs']);
      }

      return cb('some error');
    });
    fs.exists = jest.fn((p, cb) => {
      return cb(p.endsWith('bin') || p.endsWith('main.rs'));
    });
    fs.stat = jest.fn((_, cb) => cb(null, new fs.Stats()));
    fs.Stats.prototype.isDirectory = jest.fn(() => true);
  });

  it('infers three binaries', async () => {
    const toml = {
      package: {
        name: 'foo',
      },
    };
    expect((await inferCargoBinaries(toml, '/path/to/src')).sort()).toEqual([
      'bar',
      'baz',
      'foo',
    ]);
  });
});

// `src/bin` folder, bin sections ignore baz.rs
// src/
// |- bin/
// |  |- bar.rs
// |  |- baz.rs
// |- main.rs
describe('src/bin exists but one binary is ignored', async () => {
  beforeEach(() => {
    fs.readdir = jest.fn((p, cb) => {
      if (p === '/path/to/src') {
        return cb(null, ['bin', 'main.rs']);
      }
      if (p === '/path/to/src/bin') {
        return cb(null, ['bar.rs', 'baz.rs']);
      }

      return cb('some error');
    });
    fs.exists = jest.fn((p, cb) => {
      return cb(p.endsWith('bin') || p.endsWith('main.rs'));
    });
    fs.stat = jest.fn((_, cb) => cb(null, new fs.Stats()));
    fs.Stats.prototype.isDirectory = jest.fn(() => true);
  });

  it('infers only one binary', async () => {
    const toml = {
      package: {
        name: 'foo',
      },
      bin: [{ name: 'bar', path: 'src/bar.rs' }],
    };
    expect((await inferCargoBinaries(toml, '/path/to/src')).sort()).toEqual([
      'bar',
      'foo',
    ]);
  });
});
