import { createServer, request } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { categories, platforms, filterApps } from './app.mjs';
import { connectDatabase, readCatalog } from './catalog.mjs';
import { readReviews, reviewCandidate, selfTestReviews } from './review.mjs';
import { createAdminAuth, ensureCredential, readCredential } from './admin-auth.mjs';

const pool = await connectDatabase();
const adminToken = randomBytes(32).toString('hex');
const testing = process.argv.includes('--self-test');
const authBase = testing ? pathToFileURL(await mkdtemp(`${tmpdir()}/awesome-http-auth-`) + '/') : new URL('./', import.meta.url);
await ensureCredential(authBase);
const auth = createAdminAuth(authBase);

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/apps.json', ['apps.json', 'application/json']],
]);

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  const route = req.url.split('?')[0];
  if (['/admin', '/admin.html', '/api/admin/reviews', '/api/admin/login', '/api/admin/logout'].includes(route)) {
    const send = (status, data) => {
      const body = JSON.stringify(data);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const host = req.headers.host;
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const validHost = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`].includes(host);
    if (!local || !validHost || req.headers.forwarded || Object.keys(req.headers).some(key => key.startsWith('x-forwarded-'))
      || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: '관리자 기능은 로컬 주소에서 직접 접근하세요.' });
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'nonce-${adminToken}'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
    try {
      if (route === '/admin' || route === '/admin.html') {
        if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '지원하지 않는 요청입니다.' });
        const body = (await readFile(new URL('admin.html', import.meta.url), 'utf8')).replace('__ADMIN_NONCE__', adminToken);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      const session = await auth.session(req);
      if (route !== '/api/admin/login' && !session) return send(401, { error: '관리자 로그인이 필요합니다.' });
      if (route === '/api/admin/reviews' && ['GET', 'HEAD'].includes(req.method)) return send(200, { ...await readReviews(), token: session.csrf });
      if (req.method !== 'POST') return send(405, { error: '지원하지 않는 요청입니다.' });
      if (req.headers.origin !== `http://${host}` || (route !== '/api/admin/login' && req.headers['x-admin-token'] !== session.csrf)) return send(403, { error: '검토 화면을 새로고침한 뒤 다시 시도하세요.' });
      if (req.headers['content-type'] !== 'application/json') return send(415, { error: 'JSON 요청이 필요합니다.' });
      const text = await new Promise((resolve, reject) => {
        let body = '', size = 0;
        req.setEncoding('utf8');
        req.on('data', chunk => {
          size += Buffer.byteLength(chunk);
          if (size > (route === '/api/admin/reviews' ? 1048576 : 4096)) reject(Object.assign(new Error('요청 크기가 너무 큽니다.'), { status: 413 }));
          else body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
      });
      let input;
      try { input = JSON.parse(text); } catch { return send(400, { error: 'JSON 요청 형식이 올바르지 않습니다.' }); }
      if (route === '/api/admin/login') {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.secret !== 'string') return send(400, { error: '관리자 키 또는 비밀번호를 입력하세요.' });
        const result = await auth.login(input.secret);
        res.setHeader('Set-Cookie', result.cookie);
        return send(200, { message: '로그인했습니다.' });
      }
      if (route === '/api/admin/logout') {
        res.setHeader('Set-Cookie', auth.logout(req));
        return send(200, { message: '로그아웃했습니다.' });
      }
      return send(200, await reviewCandidate(input, pool));
    } catch (error) {
      console.error('Review failed:', error.code || error.status || error.name);
      return send(error.status || 500, { error: error.status ? error.message : '검토 처리에 실패했습니다. 후보 파일과 서버 로그를 확인하고 새로고침하세요.' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = files.get(pathname);
  if (/^\/assets\/previews\/[a-z0-9-]+-[a-f0-9]{12}\.(png|jpg|webp|gif|svg)$/.test(pathname)) {
    const extension = pathname.split('.').at(-1);
    file = [pathname.slice(1), { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[extension]];
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  if (pathname === '/api/apps' || pathname.startsWith('/api/apps/')) {
    const send = (status, data) => {
      const body = JSON.stringify(data);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    try {
      if (pathname !== '/api/apps') {
        const id = pathname.slice('/api/apps/'.length);
        if (!/^[a-z0-9-]+$/.test(id)) return send(400, { error: '앱 ID가 올바르지 않습니다.' });
        const result = await pool.query('SELECT document FROM app_catalog WHERE id=$1', [id]);
        return result.rows.length ? send(200, result.rows[0].document) : send(404, { error: '앱을 찾을 수 없습니다.' });
      }
      const params = new URLSearchParams(req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '');
      const q = (params.get('q') || '').normalize('NFC').toLocaleLowerCase('ko');
      const category = params.get('category') || 'all', os = params.get('os') || 'all', easy = params.get('easy') || '0';
      const pageText = params.get('page') || '1', limitText = params.get('limit') || '24';
      const page = Number(pageText), limit = Number(limitText);
      if ([...params.keys()].some(key => !['q', 'category', 'os', 'easy', 'page', 'limit'].includes(key) || params.getAll(key).length !== 1)
        || q.length > 120 || q.includes('\0') || !categories.some(([id]) => id === category)
        || (os !== 'all' && !Object.hasOwn(platforms, os)) || !['0', '1'].includes(easy)
        || !/^[1-9]\d*$/.test(pageText) || !/^[1-9]\d*$/.test(limitText) || page > 100000 || limit > 100) {
        return send(400, { error: '검색 조건을 확인하세요.' });
      }
      const values = [], where = [];
      if (category !== 'all') { values.push(category); where.push(`document->>'category' = $${values.length}`); }
      if (os !== 'all') { values.push(os); where.push(`(document->'platforms') ? $${values.length}`); }
      if (easy === '1') where.push(`document->>'level' = 'easy'`);
      for (const word of q.trim().split(/\s+/).filter(Boolean)) {
        values.push(`%${word.replace(/[\\%_]/g, '\\$&')}%`);
        where.push(`search_text LIKE $${values.length}`);
      }
      values.push(limit, (page - 1) * limit);
      // ponytail: OFFSET is adequate for this catalog; switch to a cursor if deep pages become slow.
      const result = await pool.query(`WITH matches AS (
        SELECT document, position, id FROM app_catalog ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ), page_rows AS (SELECT * FROM matches ORDER BY position, id LIMIT $${values.length - 1} OFFSET $${values.length})
      SELECT (SELECT count(*)::int FROM matches) AS total,
        COALESCE((SELECT jsonb_agg(document ORDER BY position, id) FROM page_rows), '[]'::jsonb) AS items`, values);
      return send(200, { ...result.rows[0], page, limit });
    } catch (error) {
      console.error('Catalog query failed:', error.code);
      return send(503, { error: '검색 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.' });
    }
  }
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  try {
    // ponytail: small preview files fit in memory; stream if large assets are hosted later.
    const body = await readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, {
      'Content-Type': `${file[1]}; charset=utf-8`,
      'Content-Length': body.length,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error('Static file read failed:', error.code);
    res.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});

if (process.argv.includes('--self-test')) {
  const { default: assert } = await import('node:assert/strict');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const get = (path, method = 'GET', headers = {}, body) => new Promise((resolve, reject) => {
    request({ hostname: '127.0.0.1', port, path, method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject).end(body);
  });
  try {
    for (const [path, [name, type]] of files) {
      const response = await get(`${path}?q=test`);
      assert.equal(response.status, 200);
      assert.equal(response.headers['content-type'], `${type}; charset=utf-8`);
      assert.deepEqual(response.body, await readFile(new URL(name, import.meta.url)));
    }
    const head = await get('/apps.json', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.ok(Number(head.headers['content-length']) > 0);
    for (const path of ['/../README.md', '/%2e%2e/README.md', '/.env', '/server.mjs', '/missing', '//apps.json']) {
      assert.equal((await get(path)).status, 404);
    }
    assert.equal((await get('/%ZZ')).status, 400);
    assert.equal((await get('/', 'POST')).status, 405);
    const admin = await get('/admin');
    assert.equal(admin.status, 200);
    assert.match(admin.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(admin.body.toString(), /후보 검토/);
    assert.equal((await get('/admin', 'GET', { Host: `attacker.example:${port}` })).status, 403);
    assert.equal((await get('/api/admin/reviews', 'GET', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await get('/api/admin/reviews', 'GET', { 'X-Forwarded-For': '127.0.0.1' })).status, 403);
    assert.equal((await get('/api/admin/reviews')).status, 401);
    assert.equal((await get('/api/admin/reviews', 'POST')).status, 401);
    assert.equal((await get('/api/admin/login', 'POST', { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, '{}')).status, 403);
    const loginHeaders = { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json' };
    assert.equal((await get('/api/admin/login', 'POST', loginHeaders, JSON.stringify({ secret: 'wrong' }))).status, 401);
    const login = await get('/api/admin/login', 'POST', loginHeaders, JSON.stringify({ secret: (await readCredential(authBase)).key }));
    assert.equal(login.status, 200);
    const Cookie = login.headers['set-cookie'][0].split(';')[0];
    assert.match(login.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);
    const reviews = JSON.parse((await get('/api/admin/reviews', 'GET', { Cookie })).body);
    assert.ok(Array.isArray(reviews.items));
    const headers = { ...loginHeaders, Cookie, 'X-Admin-Token': reviews.token };
    assert.equal((await get('/api/admin/reviews', 'POST', { ...headers, 'X-Admin-Token': 'wrong' }, '{}')).status, 403);
    assert.equal((await get('/api/admin/reviews', 'POST', { ...headers, Origin: 'https://attacker.example' }, '{}')).status, 403);
    assert.equal((await get('/api/admin/reviews', 'POST', headers, '{')).status, 400);
    assert.equal((await get('/api/admin/reviews', 'POST', headers, 'x'.repeat(1048577))).status, 413);
    assert.equal((await get('/api/admin/reviews', 'POST', headers, '{"action":"invalid"}')).status, 400);
    assert.equal((await get('/api/admin/logout', 'POST', headers, '{}')).status, 200);
    assert.equal((await get('/api/admin/reviews', 'GET', { Cookie })).status, 401);
    await selfTestReviews();
    const apps = await readCatalog();
    for (const app of apps.filter(app => app.image.startsWith('./assets/previews/'))) {
      const picture = await get(app.image.slice(1));
      assert.equal(picture.status, 200);
      assert.match(picture.headers['content-type'], /^image\//);
      assert.deepEqual(picture.body, await readFile(new URL(app.image, import.meta.url)));
    }
    const api = async path => {
      const response = await get(path);
      assert.equal(response.status, 200);
      return JSON.parse(response.body);
    };
    for (const filters of [{}, { q: 'LOCALsend' }, { q: '영상 자르기' }, { q: '영상'.normalize('NFD') }, { category: 'photo', easy: '1', os: 'windows' }, { q: '%' }, { q: '_' }, { q: "' OR 1=1 --" }]) {
      const result = await api(`/api/apps?${new URLSearchParams({ ...filters, limit: '100' })}`);
      const expected = filterApps(apps, { ...filters, easy: filters.easy === '1' });
      assert.deepEqual(result.items, expected.slice(0, 100));
      assert.equal(result.total, expected.length);
    }
    const first = await api('/api/apps?page=1&limit=24'), second = await api('/api/apps?page=2&limit=24');
    assert.deepEqual(first.items, apps.slice(0, 24));
    assert.deepEqual(second.items, apps.slice(24, 48));
    assert.equal((await api('/api/apps?page=100000')).total, apps.length);
    assert.deepEqual((await api('/api/apps?page=100000')).items, []);
    assert.deepEqual(await api(`/api/apps/${apps.at(-1).id}`), apps.at(-1));
    for (const query of ['page=-1', 'page=1.5', 'limit=101', 'os=invalid', 'easy=true', 'category=invalid', 'q=a&q=b', 'q=%00', `q=${'a'.repeat(121)}`]) {
      assert.equal((await get(`/api/apps?${query}`)).status, 400);
    }
    assert.equal((await get('/api/apps/no-such-app')).status, 404);
    console.log(`PASS: Node ${process.version}; HTTP, ${apps.length} JSON/DB records, keyword and Korean search, filters, pagination, detail, input validation.`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
    await rm(authBase, { recursive: true, force: true });
  }
} else {
  server.on('error', error => {
    console.error(`Server failed: ${error.code}`);
    process.exitCode = 1;
  });
  server.listen(4173, '127.0.0.1', () => {
    console.log(`OpenAppShelf: http://127.0.0.1:4173/ (Node ${process.version})`);
    console.log('관리자 로그인: npm run admin -- key (자동 키 확인) / npm run admin -- password (비밀번호 설정)');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(async () => { await pool.end(); }));
}
