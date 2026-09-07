import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile, rename, unlink, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = fileURLToPath(new URL('./', import.meta.url));
const directory = join(root, '.local');
const statePath = join(directory, 'collector-worker.json');
const lockPath = join(directory, 'collector-worker.lock');
const hour = 60 * 60 * 1000;
let stopping = false, child, wake;

function terminateChild() {
  if (!child?.pid) return;
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}

export function nextRunAt(completedAt, success) {
  return new Date(completedAt + (success ? 3 : 1) * hour).toISOString();
}

export function delayUntil(state, now) {
  if (!state?.nextRunAt) return 0;
  const due = Date.parse(state.nextRunAt);
  if (!Number.isFinite(due)) throw new Error('Invalid collector-worker.json nextRunAt');
  return Math.max(0, due - now);
}

async function save(state) {
  const temporary = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, statePath);
}

async function lock(path) {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(String(process.pid) + '\n'); }
  finally { await handle.close(); }
}

async function runNode(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['--env-file-if-exists=.env', ...args], {
      cwd: root, stdio: 'inherit', detached: process.platform !== 'win32',
    });
    const timer = setTimeout(terminateChild, 30 * 60 * 1000);
    child.once('error', error => { clearTimeout(timer); child = null; reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timer); child = null; resolve({ code, signal }); });
  });
}

export async function watch() {
  await mkdir(directory, { recursive: true });
  try { await lock(lockPath); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Collector worker lock exists. Check its PID before removing a stale .local/collector-worker.lock.');
    throw error;
  }
  let state = {};
  const stop = () => { stopping = true; terminateChild(); wake?.(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try {
    try { state = JSON.parse(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (state.completedAt && Array.isArray(state.steps)) {
      const success = state.steps.length === 2 && state.steps.every(step => step.code === 0);
      state.nextRunAt = nextRunAt(Date.parse(state.completedAt), success);
    }
    while (!stopping) {
      const delay = delayUntil(state, Date.now());
      if (delay > 0) {
        if (state.pid !== process.pid || state.status !== 'waiting') {
          state = { ...state, pid: process.pid, status: 'waiting' };
          await save(state);
          console.log(`WAIT: next collection at ${state.nextRunAt}`);
        }
        // Recheck the wall clock each minute after sleep or clock adjustments.
        await new Promise(resolve => {
          const timer = setTimeout(resolve, Math.min(delay, 60000));
          wake = () => { clearTimeout(timer); resolve(); };
          if (stopping) wake();
        });
        wake = null;
        continue;
      }
      state = { pid: process.pid, status: 'running', startedAt: new Date().toISOString(), steps: [] };
      await save(state);
      console.log(`RUN: ${state.startedAt}`);
      // The same public CLI is used by operators, tests and the scheduled worker.
      for (const args of [['collect.mjs', '--limit=3', '--scan=12'], ['collect.mjs', '--refresh', '--scan=12']]) {
        if (stopping) break;
        let result;
        try { result = await runNode(args); }
        catch (error) { result = { code: 1, error: error.message }; }
        state.steps.push({ command: args.join(' '), ...result });
        await save(state);
        if (result.code !== 0) break;
      }
      const success = state.steps.length === 2 && state.steps.every(step => step.code === 0);
      state = { ...state, status: stopping ? 'stopped' : success ? 'completed' : 'failed',
        completedAt: new Date().toISOString(), nextRunAt: nextRunAt(Date.now(), success) };
      await save(state);
      console.log(`RESULT: ${state.status}; next collection at ${state.nextRunAt}`);
    }
  } finally {
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
    if (stopping) await save({ ...state, pid: null, status: 'stopped' });
    await unlink(lockPath);
  }
}

if (import.meta.main) {
  if (process.argv.includes('--self-test')) {
    const { default: assert } = await import('node:assert/strict');
    const now = Date.parse('2026-09-07T00:00:00Z');
    assert.equal(delayUntil({}, now), 0);
    assert.equal(delayUntil({ nextRunAt: nextRunAt(now, true) }, now), 3 * hour);
    assert.equal(delayUntil({ nextRunAt: nextRunAt(now, false) }, now), hour);
    assert.equal(delayUntil({ nextRunAt: new Date(now - 1).toISOString() }, now), 0);
    assert.throws(() => delayUntil({ nextRunAt: 'invalid' }, now));
    const testDirectory = await mkdtemp(join(tmpdir(), 'awesome-worker-test-'));
    try {
      const path = join(testDirectory, 'worker.lock');
      await lock(path);
      await assert.rejects(lock(path), { code: 'EEXIST' });
      await unlink(path); await lock(path);
      assert.equal((await runNode(['--eval', 'process.exit(0)'])).code, 0);
      assert.equal((await runNode(['--eval', 'process.exit(7)'])).code, 7);
    } finally { await rm(testDirectory, { recursive: true, force: true }); }
    console.log('PASS: three-hour/retry schedule, overdue restart, invalid state, exclusive worker lock and child exit results.');
  } else {
    await watch();
  }
}
