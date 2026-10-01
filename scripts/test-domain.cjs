// Compile pure TypeScript with existing tsc, then use Node's stable built-in test runner.
const { mkdtempSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const project = path.dirname(require.resolve('../package.json'));
const temporaryRoot = path.resolve(tmpdir());
const build = mkdtempSync(path.join(temporaryRoot, 'meditation-domain-tests-'));

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd: project, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

try {
  process.exitCode = run([
    require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.domain-tests.json', '--outDir', build,
  ]);
  if (process.exitCode === 0) {
    const files = readdirSync(path.join(project, 'tests/domain'))
      .filter((name) => name.endsWith('.test.cjs')).sort()
      .map((name) => path.join(project, 'tests/domain', name));
    if (!files.length) throw new Error('No domain tests found');
    const coverage = process.argv.includes('--coverage') ? ['--experimental-test-coverage'] : [];
    process.exitCode = run(['--test', ...coverage, ...files], { ...process.env, DOMAIN_BUILD_DIR: build });
  }
} finally {
  // Verify the resolved target stays in the intended temporary directory before recursive cleanup.
  if (path.dirname(path.resolve(build)) !== temporaryRoot || !path.basename(build).startsWith('meditation-domain-tests-')) {
    throw new Error('Refusing to clean up an unexpected directory');
  }
  rmSync(build, { recursive: true, force: true });
}
