import { readFile, writeFile, rename } from 'node:fs/promises';
import { categories, platforms, validateCatalog } from './app.mjs';

export const readCatalog = async () => validateCatalog(JSON.parse(await readFile(new URL('./apps.json', import.meta.url), 'utf8')));
export const searchText = app => [app.name, app.summary, app.description, ...app.tags].join(' ').normalize('NFC').toLocaleLowerCase('ko');

export async function connectDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL을 설정하세요. README의 DB 실행 안내를 확인하세요.');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  pool.on('error', error => console.error('Database connection failed:', error.code));
  return pool;
}

export async function syncCatalog(pool, apps) {
  validateCatalog(apps);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(4173, 1)');
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE TABLE IF NOT EXISTS app_catalog (
        id text PRIMARY KEY,
        repo text NOT NULL UNIQUE,
        position integer NOT NULL,
        document jsonb NOT NULL,
        search_text text NOT NULL
      );
      CREATE INDEX IF NOT EXISTS app_catalog_search ON app_catalog USING gin (search_text gin_trgm_ops);`);
    for (const [position, app] of apps.entries()) {
      await client.query(`INSERT INTO app_catalog (id, repo, position, document, search_text) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET repo=EXCLUDED.repo, position=EXCLUDED.position, document=EXCLUDED.document, search_text=EXCLUDED.search_text`,
      [app.id, app.repo.toLowerCase(), position, app, searchText(app)]);
    }
    await client.query('DELETE FROM app_catalog WHERE NOT (id = ANY($1::text[]))', [apps.map(app => app.id)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const begin = '<!-- catalog:start -->', end = '<!-- catalog:end -->';
const markdown = value => String(value).replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]<>|]/g, '\\$&');
const link = (label, url) => `[${markdown(label)}](<${new URL(url).href.replace(/>/g, '%3E')}>)`;

export function renderReadme(readme, apps) {
  validateCatalog(apps);
  if (readme.split(begin).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(begin) > readme.indexOf(end)) {
    throw new Error('README 카탈로그 경계가 없거나 중복되었습니다.');
  }
  const lines = [begin, '', `총 **${apps.length}개 앱** · apps.json에서 자동 생성합니다. 목록 수정은 JSON으로 기여해 주세요.`, ''];
  for (const [category, name] of categories.filter(([id]) => id !== 'all')) {
    const group = apps.filter(app => app.category === category);
    lines.push(`### ${name} (${group.length})`, '');
    for (const app of group) {
      lines.push(`- ${link(app.name, `https://github.com/${app.repo}`)} — ${markdown(app.summary)} · ${app.platforms.map(os => platforms[os]).join(' / ')} · ${link('다운로드', app.release)} · ${link('설치 안내', app.guide)}`);
    }
    lines.push('');
  }
  lines.push(end);
  return readme.slice(0, readme.indexOf(begin)) + lines.join('\n') + readme.slice(readme.indexOf(end) + end.length);
}

if (import.meta.main) {
  const apps = await readCatalog();
  if (process.argv.includes('--self-test')) {
    const { default: assert } = await import('node:assert/strict');
    const { Pool } = await import('pg');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL을 설정하세요.');
    // A single session keeps the test table temporary; the real catalog is only read.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 3000 });
    try {
      await pool.query(`CREATE TEMP TABLE app_catalog (LIKE public.app_catalog INCLUDING ALL,
        CHECK (document->>'name' <> '__rollback_test__'))`);
      await syncCatalog(pool, apps);
      await syncCatalog(pool, apps);
      const documents = async () => (await pool.query('SELECT document FROM app_catalog ORDER BY position')).rows.map(row => row.document);
      assert.deepEqual(await documents(), apps);
      const bad = structuredClone(apps);
      bad[0].summary = 'This update must roll back';
      bad[1].name = '__rollback_test__';
      await assert.rejects(syncCatalog(pool, bad), { code: '23514' });
      assert.deepEqual(await documents(), apps);
      const subset = [{ ...apps[0], summary: 'Updated test summary' }, apps[1]];
      await syncCatalog(pool, subset);
      assert.deepEqual(await documents(), subset);
      await assert.rejects(syncCatalog(pool, []));
      assert.deepEqual(await documents(), subset);
      console.log('PASS: temporary DB table; sync insert/update/removal, idempotence, rollback, invalid input preserves data.');
    } finally { await pool.end(); }
  } else if (process.argv.includes('--sync')) {
    const pool = await connectDatabase();
    try {
      await syncCatalog(pool, apps);
      console.log(`SYNC: ${apps.length} apps from JSON to PostgreSQL.`);
    } finally { await pool.end(); }
  } else if (process.argv.includes('--readme') || process.argv.includes('--check')) {
    const path = new URL('./README.md', import.meta.url);
    const current = await readFile(path, 'utf8');
    const generated = renderReadme(current, apps);
    if (process.argv.includes('--check')) {
      const { default: assert } = await import('node:assert/strict');
      assert.equal(current, generated, 'README 목록이 JSON과 다릅니다. npm run readme를 실행하세요.');
      assert.equal(renderReadme(generated, apps), generated);
      assert.throws(() => renderReadme('no markers', apps));
      assert.match(renderReadme(`${begin}\n${end}`, [{ ...apps[0], summary: '[unsafe]<script>\ntext' }]), /\\\[unsafe\\\]\\<script\\>/);
      console.log(`PASS: ${apps.length} apps; README freshness, idempotence, escaping, markers.`);
    } else {
      const temporary = new URL('./README.md.tmp', import.meta.url);
      await writeFile(temporary, generated);
      await rename(temporary, path);
      console.log(`README: ${apps.length} apps.`);
    }
  } else {
    throw new Error('사용법: node catalog.mjs --readme | --check | --sync');
  }
}
