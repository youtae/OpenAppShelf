import { mkdir, readFile, writeFile, rename, readdir, open, unlink, mkdtemp, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { validateCatalog } from './app.mjs';
import { renderReadme, syncCatalog } from './catalog.mjs';

const root = new URL('./', import.meta.url);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const optional = async (path, fallback) => { try { return await json(path); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const fail = (status, message) => Object.assign(new Error(message), { status });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batchPattern = /^[a-z0-9-]+\.json$/;

async function atomic(path, value) {
  const temporary = new URL(`${path.href}.${randomUUID()}.tmp`);
  try { await writeFile(temporary, value, { mode: 0o600 }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

export async function withCatalogLock(work, base = root) {
  await mkdir(new URL('.local/', base), { recursive: true });
  const path = new URL('.local/catalog-write.lock', base);
  let lock;
  try { lock = await open(path, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw fail(409, '다른 반영 작업이 진행 중입니다. 잠시 후 다시 시도하세요.'); throw error; }
  try { await lock.writeFile(`${process.pid}\n`); return await work(); }
  finally { await lock.close(); await unlink(path); }
}

function entry(batch, filename, app, decisions, catalog) {
  validateCatalog([app]);
  const decision = decisions[`${filename}/${app.id}`] || { status: 'pending' };
  const approved = catalog.some(item => item.id === app.id || item.repo.toLowerCase() === app.repo.toLowerCase());
  return { batch: filename, collectedAt: batch.collectedAt, app,
    status: approved ? 'approved' : decision.status, reviewedAt: decision.at,
    revision: digest([app, decision, approved]) };
}

export async function readReviews(base = root) {
  const catalog = validateCatalog(await json(new URL('apps.json', base)));
  const decisions = await optional(new URL('.local/reviews.json', base), {});
  const directory = new URL('.local/collections/', base);
  let names;
  try { names = await readdir(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; names = []; }
  const items = [], warnings = [];
  for (const filename of names.filter(name => batchPattern.test(name)).sort().reverse()) {
    try {
      const batch = await json(new URL(filename, directory));
      for (const app of batch.candidates || []) items.push(entry(batch, filename, app, decisions, catalog));
    } catch { warnings.push(`${filename}: 후보 파일을 읽지 못했습니다. 새로고침 후 파일을 확인하세요.`); }
  }
  const worker = await optional(new URL('.local/collector-worker.json', base), null);
  return { items, warnings, catalogCount: catalog.length,
    publicationPending: Boolean(await optional(new URL('.local/review-publication.json', base), null)),
    worker: worker && { status: worker.status, completedAt: worker.completedAt, nextRunAt: worker.nextRunAt } };
}

async function publish(pool, base) {
  const apps = validateCatalog(await json(new URL('apps.json', base)));
  const path = new URL('README.md', base);
  await atomic(path, renderReadme(await readFile(path, 'utf8'), apps));
  await syncCatalog(pool, apps);
  await unlink(new URL('.local/review-publication.json', base));
}

export async function reviewCandidate(input, pool, base = root) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || !['approve', 'hold', 'reject', 'pending', 'sync'].includes(input.action)
    || Object.keys(input).some(key => !['action', 'batch', 'id', 'revision', 'items'].includes(key))
    || (Object.hasOwn(input, 'items') && (input.action === 'sync' || ['batch', 'id', 'revision'].some(key => Object.hasOwn(input, key))))) throw fail(400, '검토 요청 형식이 올바르지 않습니다.');
  const targets = Object.hasOwn(input, 'items') ? input.items : [{ batch: input.batch, id: input.id, revision: input.revision }];
  if (input.action !== 'sync' && (!Array.isArray(targets) || !targets.length || targets.some(item => !item || typeof item !== 'object'
    || Object.keys(item).some(key => !['batch', 'id', 'revision'].includes(key))
    || typeof item.batch !== 'string' || !batchPattern.test(item.batch)
    || typeof item.id !== 'string' || !/^[a-z0-9-]+$/.test(item.id) || typeof item.revision !== 'string')
    || new Set(targets.map(item => `${item.batch}/${item.id}`)).size !== targets.length)) throw fail(400, '처리할 후보를 중복 없이 선택하세요.');
  return withCatalogLock(async () => {
    const marker = new URL('.local/review-publication.json', base);
    if (input.action === 'sync') {
      await atomic(marker, JSON.stringify({ at: new Date().toISOString() }));
      try { await publish(pool, base); } catch { throw fail(503, '게시 동기화에 실패했습니다. DB 연결과 파일 권한을 확인한 뒤 다시 동기화하세요.'); }
      return { message: 'JSON 기준으로 README와 검색 DB를 동기화했습니다.' };
    }
    const catalogPath = new URL('apps.json', base), decisionsPath = new URL('.local/reviews.json', base);
    const original = await readFile(catalogPath, 'utf8');
    const catalog = validateCatalog(JSON.parse(original));
    const decisions = await optional(decisionsPath, {});
    const batches = new Map(), apps = [];
    // Validate the whole selection before writing anything, including decisions from other browser tabs.
    for (const target of targets) {
      if (!batches.has(target.batch)) batches.set(target.batch, await optional(new URL(`.local/collections/${target.batch}`, base), null));
      const batch = batches.get(target.batch);
      const app = batch?.candidates?.find(item => item.id === target.id);
      if (!app) throw fail(404, '선택한 후보를 찾을 수 없어 전체 처리를 취소했습니다. 목록을 새로고침하세요.');
      const current = entry(batch, target.batch, app, decisions, catalog);
      if (current.revision !== target.revision || current.status === 'approved') throw fail(409, '선택한 후보 중 변경되거나 처리된 항목이 있어 전체 처리를 취소했습니다. 목록을 새로고침하세요.');
      apps.push(app);
    }
    if (input.action !== 'approve') {
      const decision = { status: input.action === 'hold' ? 'held' : input.action === 'reject' ? 'rejected' : 'pending', at: new Date().toISOString() };
      for (const target of targets) decisions[`${target.batch}/${target.id}`] = decision;
      await atomic(decisionsPath, JSON.stringify(decisions, null, 2) + '\n');
      return { message: `${apps.length}개 후보를 ${input.action === 'hold' ? '보류했습니다.' : input.action === 'reject' ? '거절했습니다.' : '검토 대기로 되돌렸습니다.'}` };
    }
    if (await optional(marker, null)) throw fail(409, '이전 승인의 게시 동기화를 먼저 완료하세요.');
    const merged = validateCatalog([...catalog, ...apps]);
    const readme = await readFile(new URL('README.md', base), 'utf8');
    renderReadme(readme, merged);
    const backup = new URL(`.local/review-backups/${randomUUID()}/`, base);
    await mkdir(backup, { recursive: true });
    await writeFile(new URL('apps.json', backup), original, { mode: 0o600 });
    await writeFile(new URL('README.md', backup), readme, { mode: 0o600 });
    if (await readFile(catalogPath, 'utf8') !== original) throw fail(409, '카탈로그가 변경되었습니다. 다시 검토하세요.');
    // ponytail: JSON is canonical; a durable marker lets the operator retry derived publication after a crash or DB failure.
    await atomic(marker, JSON.stringify({ ids: apps.map(app => app.id), at: new Date().toISOString() }));
    await atomic(catalogPath, JSON.stringify(merged, null, 2) + '\n');
    try { await publish(pool, base); }
    catch { return { message: 'JSON에 승인되었습니다. README 또는 검색 DB 반영에 실패했으므로 다시 동기화하세요.', publicationPending: true }; }
    return { message: `${apps.length}개 후보를 승인하고 README와 검색 DB에 반영했습니다.` };
  }, base);
}

export async function selfTestReviews() {
  const { default: assert } = await import('node:assert/strict');
  const { Pool } = await import('pg');
  const base = pathToFileURL(await mkdtemp(`${tmpdir()}/awesome-review-`) + '/');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const [original, candidate, second, unselected] = validateCatalog(await json(new URL('apps.json', root)));
    await mkdir(new URL('.local/collections/', base), { recursive: true });
    await writeFile(new URL('apps.json', base), JSON.stringify([original]));
    await writeFile(new URL('README.md', base), '<!-- catalog:start -->\n<!-- catalog:end -->');
    await writeFile(new URL('.local/collections/test.json', base), JSON.stringify({ collectedAt: new Date().toISOString(), candidates: [candidate] }));
    await writeFile(new URL('.local/collections/other.json', base), JSON.stringify({ collectedAt: new Date().toISOString(), candidates: [second, unselected] }));
    await pool.query('CREATE TEMP TABLE app_catalog (LIKE public.app_catalog INCLUDING ALL)');
    const item = async () => (await readReviews(base)).items[0];
    const act = async (action, db = pool) => { const current = await item(); return reviewCandidate({ action, batch: current.batch, id: current.app.id, revision: current.revision }, db, base); };
    const selected = async () => (await readReviews(base)).items.filter(item => item.app.id !== unselected.id).map(item => ({ batch: item.batch, id: item.app.id, revision: item.revision }));
    const bulk = async (action, db = pool) => reviewCandidate({ action, items: await selected() }, db, base);
    const earlier = await selected();
    const stale = await item();
    await act('hold'); assert.equal((await item()).status, 'held');
    await assert.rejects(reviewCandidate({ action: 'approve', items: earlier }, pool, base), { status: 409 });
    assert.equal((await json(new URL('apps.json', base))).length, 1);
    await assert.rejects(reviewCandidate({ action: 'approve', batch: stale.batch, id: stale.app.id, revision: stale.revision }, pool, base), { status: 409 });
    await act('reject'); assert.equal((await item()).status, 'rejected');
    await act('pending'); assert.equal((await item()).status, 'pending');
    for (const [action, status] of [['hold', 'held'], ['reject', 'rejected'], ['pending', 'pending']]) {
      await bulk(action);
      for (const current of (await readReviews(base)).items) assert.equal(current.status, current.app.id === unselected.id ? 'pending' : status);
    }
    for (const items of [[], [earlier[0], earlier[0]], [earlier[0], null]]) await assert.rejects(reviewCandidate({ action: 'approve', items }, pool, base), { status: 400 });
    const beforeMissing = await readFile(new URL('.local/reviews.json', base), 'utf8');
    await assert.rejects(reviewCandidate({ action: 'reject', items: [...await selected(), { batch: 'missing.json', id: 'missing', revision: 'x' }] }, pool, base), { status: 404 });
    assert.equal(await readFile(new URL('.local/reviews.json', base), 'utf8'), beforeMissing);
    assert.equal((await json(new URL('apps.json', base))).length, 1);
    await withCatalogLock(async () => { await assert.rejects(act('approve'), { status: 409 }); }, base);
    await assert.rejects(reviewCandidate({ action: 'approve', batch: '../apps.json', id: candidate.id, revision: 'x' }, pool, base), { status: 400 });
    const failed = await bulk('approve', { connect: async () => { throw new Error('offline'); } });
    assert.equal(failed.publicationPending, true);
    assert.equal((await item()).status, 'approved');
    assert.equal((await readReviews(base)).publicationPending, true);
    await reviewCandidate({ action: 'sync' }, pool, base);
    assert.equal((await readReviews(base)).publicationPending, false);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM app_catalog')).rows[0].n, 3);
    await assert.rejects(act('approve'), { status: 409 });
    assert.deepEqual(await json(new URL('apps.json', base)), [original, candidate, second]);
    assert.equal((await readReviews(base)).items.find(item => item.app.id === unselected.id).status, 'pending');
    const readme = await readFile(new URL('README.md', base), 'utf8');
    assert.equal(readme, renderReadme(readme, [original, candidate, second]));
    console.log('PASS: single/bulk review across batches, unselected preservation, stale/missing/duplicate selections cancel all, lock, traversal, approval, DB failure recovery, README/DB consistency; isolated files and temporary DB table.');
  } finally { await pool.end(); await rm(base, { recursive: true, force: true }); }
}
