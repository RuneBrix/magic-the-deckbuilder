import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('compact runner forwards selection, preserves full logs and fails on a failing test or missing file', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'arcana-agent-test-'));
  const runner = fileURLToPath(new URL('../scripts/run-tests.mjs', import.meta.url));
  try {
    writeFileSync(join(cwd, 'sample.mjs'), "import {test} from 'node:test';test('pass example',()=>{});test('fail example',()=>{throw Error('expected failure detail')});");
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = args => spawnSync(process.execPath, [runner, ...args], { cwd, encoding: 'utf8', env });
    const passing = run(['--test-name-pattern=^pass', 'sample.mjs']);
    assert.equal(passing.status, 0, passing.stderr);
    assert.match(passing.stdout, /pass 1/);
    assert.doesNotMatch(passing.stdout, /pass example/);
    assert.match(readFileSync(join(cwd, 'test-results', 'agent-tests.log'), 'utf8'), /pass example/);
    const failing = run(['sample.mjs']);
    assert.notEqual(failing.status, 0);
    assert.match(failing.stderr, /expected failure detail/);
    assert.match(failing.stderr, /fail example/);
    const missing = run(['missing.mjs']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /missing\.mjs/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
