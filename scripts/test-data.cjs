// Test the production SQL and repositories against real SQLite, without loading Expo in Node.
const { mkdtempSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = path.dirname(require.resolve('../package.json'));
const temporaryRoot = path.resolve(tmpdir());
const build = mkdtempSync(path.join(temporaryRoot, 'meditation-data-tests-'));
function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd: project, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
try {
  require('node:sqlite'); // Node 24+ supplies SQLite; no additional testing dependency.
  process.exitCode = run([require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.data-tests.json', '--outDir', build]);
  if (process.exitCode === 0) {
    const files = readdirSync(path.join(project, 'tests/data')).filter((name) => name.endsWith('.test.cjs')).sort()
      .map((name) => path.join(project, 'tests/data', name));
    if (!files.length) throw new Error('No data tests found');
    const coverage = process.argv.includes('--coverage') ? ['--experimental-test-coverage'] : [];
    process.exitCode = run(['--test', ...coverage, ...files], {
      ...process.env, DATA_BUILD_DIR: path.join(build, 'data'), DOMAIN_BUILD_DIR: path.join(build, 'domain'),
    });
  }
} finally {
  if (path.dirname(path.resolve(build)) !== temporaryRoot || !path.basename(build).startsWith('meditation-data-tests-')) {
    throw new Error('Refusing to clean up an unexpected directory');
  }
  rmSync(build, { recursive: true, force: true });
}
