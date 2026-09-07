import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rename, unlink, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

const root = new URL('./', import.meta.url);
const scrypt = promisify(derive);
const random = () => randomBytes(32).toString('base64url');
const path = base => new URL('.local/admin-auth.json', base);
const hash = (secret, salt) => scrypt(secret, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const error = (status, message) => Object.assign(new Error(message), { status });

export async function readCredential(base = root) {
  const value = JSON.parse(await readFile(path(base), 'utf8'));
  if (!['key', 'password'].includes(value.mode) || !/^[a-f0-9]{64}$/.test(value.hash)
    || !/^[a-f0-9]{32}$/.test(value.salt) || !/^[\w-]{43}$/.test(value.version)
    || (value.mode === 'key' && !/^[\w-]{43}$/.test(value.key))) throw new Error('관리자 인증 파일을 확인하세요.');
  return value;
}

export async function setCredential(mode, secret, base = root, initial = false) {
  if (!['key', 'password'].includes(mode)) throw new Error('인증 방식을 확인하세요.');
  if (mode === 'key') secret = random();
  if (typeof secret !== 'string' || secret.length < 12 || secret.length > 256) throw new Error('비밀번호는 12~256자로 입력하세요.');
  const salt = randomBytes(16).toString('hex');
  const record = { mode, salt, hash: (await hash(secret, salt)).toString('hex'), version: random(), ...(mode === 'key' ? { key: secret } : {}) };
  await mkdir(new URL('.local/', base), { recursive: true, mode: 0o700 });
  if (initial) {
    try { await writeFile(path(base), JSON.stringify(record), { flag: 'wx', mode: 0o600 }); }
    catch (cause) { if (cause.code !== 'EEXIST') throw cause; }
  } else {
    const temporary = new URL(`.local/admin-auth-${random()}.tmp`, base);
    try { await writeFile(temporary, JSON.stringify(record), { mode: 0o600 }); await rename(temporary, path(base)); }
    finally { await unlink(temporary).catch(cause => { if (cause.code !== 'ENOENT') throw cause; }); }
  }
}

export async function ensureCredential(base = root) {
  try { await readCredential(base); }
  catch (cause) { if (cause.code !== 'ENOENT') throw cause; await setCredential('key', undefined, base, true); }
}

export function createAdminAuth(base = root) {
  // ponytail: one local owner, in-memory sessions; restart logs everyone out. Shared deployments need a separate identity provider.
  const sessions = new Map();
  let attempts = 0, windowEnd = 0;
  const lifetime = 12 * 60 * 60 * 1000;
  const cookieName = 'awesome_admin';
  const cookie = (id, maxAge) => `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
  const idFrom = req => (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return {
    async login(secret) {
      const now = Date.now();
      if (now >= windowEnd) { attempts = 0; windowEnd = now + 60_000; }
      if (attempts >= 5) throw error(429, '로그인 시도가 많습니다. 1분 후 다시 시도하세요.');
      attempts++;
      if (typeof secret !== 'string' || secret.length < 1 || secret.length > 256) throw error(401, '관리자 키 또는 비밀번호가 올바르지 않습니다.');
      const credential = await readCredential(base);
      const actual = await hash(secret, credential.salt);
      if (!timingSafeEqual(actual, Buffer.from(credential.hash, 'hex'))) throw error(401, '관리자 키 또는 비밀번호가 올바르지 않습니다.');
      if ((await readCredential(base)).version !== credential.version) throw error(401, '인증 정보가 변경되었습니다. 다시 로그인하세요.');
      for (const [id, session] of sessions) if (session.expires <= Date.now() || session.version !== credential.version) sessions.delete(id);
      if (sessions.size >= 32) sessions.delete(sessions.keys().next().value);
      const id = random(), csrf = random();
      sessions.set(id, { csrf, version: credential.version, expires: Date.now() + lifetime });
      return { cookie: cookie(id, lifetime / 1000) };
    },
    async session(req) {
      const id = idFrom(req), session = sessions.get(id);
      if (!session) return null;
      if (session.expires <= Date.now() || session.version !== (await readCredential(base)).version) { sessions.delete(id); return null; }
      return session;
    },
    logout(req) { sessions.delete(idFrom(req)); return cookie('', 0); },
  };
}

async function passwordPrompt(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('비밀번호 설정은 대화형 터미널에서 실행하세요.');
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const abort = new AbortController();
  rl.on('SIGINT', () => abort.abort());
  process.stdout.write(label);
  try { return await rl.question('', { signal: abort.signal }); }
  finally { rl.close(); process.stdout.write('\n'); }
}

export async function selfTestAuth() {
  const { default: assert } = await import('node:assert/strict');
  const base = pathToFileURL(await mkdtemp(`${tmpdir()}/awesome-auth-`) + '/');
  try {
    await ensureCredential(base);
    const initial = await readCredential(base), auth = createAdminAuth(base);
    await ensureCredential(base);
    assert.equal((await readCredential(base)).version, initial.version);
    assert.equal((await stat(path(base))).mode & 0o777, 0o600);
    assert.equal(await auth.session({ headers: {} }), null);
    await assert.rejects(auth.login('incorrect'), { status: 401 });
    const login = await auth.login(initial.key), req = { headers: { cookie: login.cookie.split(';')[0] } };
    assert.match(login.cookie, /HttpOnly; SameSite=Strict/);
    assert.ok((await auth.session(req)).csrf);
    auth.logout(req); assert.equal(await auth.session(req), null);
    const old = await auth.login(initial.key), oldReq = { headers: { cookie: old.cookie.split(';')[0] } };
    const password = 'test-only-long-password';
    await setCredential('password', password, base);
    assert.ok(!(await readFile(path(base), 'utf8')).includes(password));
    assert.equal((await readCredential(base)).key, undefined);
    assert.equal(await auth.session(oldReq), null);
    await assert.rejects(auth.login(initial.key), { status: 401 });
    const manual = await auth.login(password), manualReq = { headers: { cookie: manual.cookie.split(';')[0] } };
    assert.ok(await auth.session(manualReq));
    const session = await auth.session(manualReq); session.expires = Date.now() - 1;
    assert.equal(await auth.session(manualReq), null);
    await assert.rejects(auth.login(password), { status: 429 });
    await setCredential('key', undefined, base);
    const fresh = createAdminAuth(base);
    await assert.rejects(fresh.login(password), { status: 401 });
    assert.ok((await fresh.login((await readCredential(base)).key)).cookie);
    await assert.rejects(setCredential('password', 'short', base));
    console.log('PASS: automatic key, hashed password, switching modes, session expiry/logout/revocation, throttling, private file permissions; isolated credentials.');
  } finally { await rm(base, { recursive: true, force: true }); }
}

if (import.meta.main) {
  try {
    const command = process.argv[2];
    if (command === '--self-test') await selfTestAuth();
    else if (command === 'password') {
      const password = await passwordPrompt('새 관리자 비밀번호 (12~256자, 입력 내용은 표시되지 않음): ');
      if (password !== await passwordPrompt('비밀번호 확인: ')) throw new Error('비밀번호가 일치하지 않습니다. 기존 인증을 유지합니다.');
      await setCredential('password', password);
      console.log('비밀번호 방식으로 설정했습니다. 기존 키와 로그인 세션은 무효화됩니다.');
    } else if (command === 'key' || command === 'generate-key') {
      if (!process.stdout.isTTY) throw new Error('관리자 키는 대화형 터미널에서만 확인할 수 있습니다.');
      if (command === 'generate-key') await setCredential('key'); else await ensureCredential();
      const credential = await readCredential();
      if (credential.mode !== 'key') throw new Error('현재 비밀번호 방식입니다. 키 방식으로 바꾸려면 npm run admin -- generate-key를 실행하세요.');
      console.log(`관리자 키: ${credential.key}\nhttp://127.0.0.1:4173/admin 에서 입력하세요.`);
    } else throw new Error('사용법: npm run admin -- key | password | generate-key');
  } catch (cause) { console.error(cause.name === 'AbortError' ? '설정을 취소했습니다.' : cause.message); process.exitCode = 1; }
}
