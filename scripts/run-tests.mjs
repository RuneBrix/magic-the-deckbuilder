import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Keep the ordinary Node runner and exit status; shorten only successful output.
const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...process.argv.slice(2)], {
  encoding: 'utf8',
  env: { ...process.env, FORCE_COLOR: '0' },
  maxBuffer: 32 * 1024 * 1024,
});
const output = (result.stdout || '') + (result.stderr || '');
const log = resolve('test-results', 'agent-tests.log');
mkdirSync(resolve('test-results'), { recursive: true });
writeFileSync(log, output + (result.error ? `\n${result.error.stack}\n` : ''));
if (result.status === 0 && !result.error) {
  const summary = output.split(/\r?\n/).filter(line => /^ℹ (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/.test(line));
  console.log(summary.length ? summary.join('\n') : output);
} else {
  process.stderr.write(output);
  if (result.error) console.error(result.error);
  if (result.signal) console.error(`Test runner ended with ${result.signal}.`);
}
console.log(`Full log: ${log}`);
process.exitCode = result.error ? 1 : result.status ?? 1;
