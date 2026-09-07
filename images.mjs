import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { publicGet, publicURL } from './public-web.mjs';
import { escapeHtml, validateCatalog } from './app.mjs';

const root = new URL('./', import.meta.url);
export function imageExtension(buffer) {
  if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  if (/^GIF8[79]a/.test(buffer.toString('ascii',0,6))) return 'gif';
  return null;
}

async function saveImage(app, body, extension, kind, source) {
  const name = `${app.id}-${createHash('sha256').update(body).digest('hex').slice(0,12)}.${extension}`;
  await mkdir(new URL('assets/previews/', root), { recursive: true });
  await writeFile(new URL(`assets/previews/${name}`, root), body);
  return { ...app, image: `./assets/previews/${name}`, imageKind: kind, imageSource: source, imageChecked: new Date().toISOString().slice(0,10) };
}

export async function illustrate(app, browser, { screenshot = false } = {}) {
  if (app.imageKind !== 'none' && !screenshot) {
    if (app.image.startsWith('./assets/previews/')) return app;
    try {
      const original = await publicGet(app.image);
      const extension = imageExtension(original.body);
      if (extension) return await saveImage(app, original.body, extension, app.imageKind, app.imageSource);
    } catch { /* Preserve the source image when possible, otherwise use its homepage. */ }
  }
  const context = await browser.newContext({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1, javaScriptEnabled: false, serviceWorkers: 'block', acceptDownloads: false });
  const page = await context.newPage();
  let requests = 0, capturing = false;
  await context.route('**/*', async route => {
    try {
      if (!capturing || ++requests > 80 || !['document','stylesheet','image','font'].includes(route.request().resourceType())) return await route.abort();
      const response = await publicGet(route.request().url());
      await route.fulfill({ status: 200, body: response.body, contentType: response.headers['content-type'] || 'application/octet-stream' });
    } catch { await route.abort().catch(() => {}); }
  });
  try {
    const site = publicURL(app.website || `https://github.com/${app.repo}`).href;
    const response = await publicGet(site, { maxBytes: 2_000_000 });
    if (!/text\/html/i.test(response.headers['content-type'] || '')) throw new Error('Homepage is not HTML');
    await page.setContent(response.body.toString('utf8'), { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!screenshot) {
      const image = await page.locator('meta[property="og:image"], meta[name="twitter:image"]').first().getAttribute('content', { timeout: 1000 }).catch(() => null);
      if (image) {
        try {
          const source = publicURL(new URL(image, response.url)).href;
          const picture = await publicGet(source);
          const extension = imageExtension(picture.body);
          if (extension) return await saveImage(app, picture.body, extension, 'social', response.url);
        } catch { /* Try an actual homepage capture when its preview image is unavailable. */ }
      }
    }
    capturing = true;
    await page.goto(response.url, { waitUntil: 'load', timeout: 25000 });
    const title = await page.title();
    const text = await page.locator('body').innerText({ timeout: 3000 });
    if (text.trim().length < 40 || /access denied|just a moment|verify you are human|checking your browser/i.test(title + text.slice(0,250))) throw new Error('Homepage is unavailable for capture');
    const body = await page.screenshot({ type: 'jpeg', quality: 80, animations: 'disabled', timeout: 5000 });
    return await saveImage(app, body, 'jpg', 'website', response.url);
  } catch (error) {
    console.log(`IMAGE ${app.id}: homepage unavailable (${error.message.split('\n')[0].slice(0,100)}); using labeled card`);
    const title = escapeHtml(app.name.slice(0,40));
    const repo = escapeHtml(app.repo);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><rect width="1200" height="750" fill="#edf2ff"/><rect x="72" y="72" width="80" height="12" fill="#2454df"/><text x="72" y="180" font-family="sans-serif" font-size="24" fill="#2454df">OpenAppShelf · PROJECT CARD</text><text x="72" y="360" font-family="sans-serif" font-size="${app.name.length > 24 ? 36 : 58}" font-weight="700" fill="#172549">${title}</text><text x="72" y="450" font-family="sans-serif" font-size="24" fill="#455879">${repo}</text><text x="72" y="655" font-family="sans-serif" font-size="22" fill="#455879">프로젝트 소개 카드 · 홈페이지 화면이 아닙니다</text></svg>`;
    return await saveImage(app, Buffer.from(svg), 'svg', 'generated', `https://github.com/${app.repo}`);
  } finally { await context.close(); }
}

if (import.meta.main) {
  if (process.argv.includes('--self-test')) {
    const { default: assert } = await import('node:assert/strict');
    assert.equal(imageExtension(Buffer.from('<svg><script>bad</script></svg>')), null);
    assert.equal(imageExtension(Buffer.from([137,80,78,71,13,10,26,10])), 'png');
    assert.equal(imageExtension(Buffer.from([255,216,255,0])), 'jpg');
    console.log('PASS: image format sniffing rejects executable markup.');
  } else {
    const original = await readFile(new URL('apps.json', root), 'utf8');
    const apps = validateCatalog(JSON.parse(original));
    const id = process.argv.find(arg => arg.startsWith('--id='))?.slice(5);
    if (id && !apps.some(app => app.id === id)) throw new Error('Unknown app ID');
    const targets = apps.filter(app => id ? app.id === id : app.imageKind === 'none' || !app.image.startsWith('./assets/previews/'));
    const browser = await chromium.launch({ chromiumSandbox: true });
    try {
      for (let i = 0; i < targets.length; i += 3) {
        await Promise.all(targets.slice(i, i + 3).map(async app => {
          apps[apps.findIndex(item => item.id === app.id)] = await illustrate(app, browser, { screenshot: process.argv.includes('--screenshot') });
          console.log(`IMAGE ${app.id}: ${apps.find(item => item.id === app.id).imageKind}`);
        }));
      }
      validateCatalog(apps);
      if (await readFile(new URL('apps.json', root), 'utf8') !== original) throw new Error('apps.json changed during capture; images saved but catalog not overwritten');
      await mkdir(new URL('.local/', root), { recursive: true });
      await writeFile(new URL(`.local/apps-before-images-${Date.now()}.json`, root), original);
      await writeFile(new URL('apps.json.tmp', root), JSON.stringify(apps, null, 2) + '\n');
      await rename(new URL('apps.json.tmp', root), new URL('apps.json', root));
      console.log(`IMAGES: ${targets.length} processed; run npm run sync to update the website.`);
    } finally { await browser.close(); }
  }
}
