export const categories = [
  ['all', '모든 앱', 'grid'], ['everyday', '생활 · 유틸리티', 'send'],
  ['photo', '사진 · 디자인', 'image'], ['video', '영상 · 음악', 'video'],
  ['productivity', '문서 · 생산성', 'note'], ['developer', '개발 도구', 'code'],
];
export const platforms = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };
const levels = { easy: '간단히 시작', setup: '준비 조건 확인', developer: '개발자용' };
const imageLabels = { screenshot: '공식 소개 화면', logo: '공식 로고', social: '홈페이지 대표 이미지', website: '홈페이지 캡처', generated: '프로젝트 소개 카드' };
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  send: '<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  note: '<path d="M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const normalize = text => text.normalize('NFC').toLocaleLowerCase('ko');

export function filterApps(apps, { q = '', category = 'all', os = 'all', easy = false } = {}) {
  const words = normalize(q).trim().split(/\s+/).filter(Boolean);
  return apps.filter(app => (category === 'all' || app.category === category)
    && (os === 'all' || app.platforms.includes(os)) && (!easy || app.level === 'easy')
    && words.every(word => normalize([app.name, app.summary, app.description, ...app.tags].join(' ')).includes(word)));
}

export function detectOS(userAgent) {
  if (/Android|iPhone|iPad|Mobile/i.test(userAgent)) return '';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macos';
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Linux/i.test(userAgent)) return 'linux';
  return '';
}

export function validateCatalog(apps) {
  if (!Array.isArray(apps) || !apps.length) throw new Error('앱 목록이 비어 있습니다.');
  const ids = new Set(), repositories = new Set();
  for (const app of apps) {
    const textKeys = ['id', 'name', 'repo', 'summary', 'description', 'requirements', 'license', 'licenseSource', 'version', 'published', 'checked'];
    if (!textKeys.every(key => typeof app[key] === 'string' && app[key].trim())
      || !/^[a-z0-9-]+$/.test(app.id) || ids.has(app.id) || !/^[\w.-]+\/[\w.-]+$/.test(app.repo) || repositories.has(app.repo.toLowerCase())
      || !categories.some(([id]) => id === app.category && id !== 'all') || !Object.hasOwn(levels, app.level)
      || !['screenshot', 'logo', 'social', 'website', 'generated', 'none'].includes(app.imageKind)
      || !['tags', 'firstSteps', 'platforms'].every(key => Array.isArray(app[key]) && app[key].length && app[key].every(v => typeof v === 'string'))
      || !app.platforms.every(os => Object.hasOwn(platforms, os)) || !Array.isArray(app.downloads) || !app.downloads.length) {
      throw new Error('앱 정보 형식이 올바르지 않습니다.');
    }
    ids.add(app.id);
    repositories.add(app.repo.toLowerCase());
    const localImage = typeof app.image === 'string' && app.image.startsWith('./assets/previews/');
    if (localImage && !new RegExp(`^\\./assets/previews/${app.id}-[a-f0-9]{12}\\.(png|jpg|webp|gif|svg)$`).test(app.image)) throw new Error('잘못된 로컬 이미지 경로입니다.');
    for (const key of ['website', 'guide', 'release', 'licenseSource', ...(app.imageKind === 'none' ? [] : [...(localImage ? [] : ['image']), 'imageSource'])]) {
      const url = new URL(app[key]);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('안전하지 않은 출처 주소입니다.');
    }
    const release = new URL(app.release);
    if (release.hostname !== 'github.com' || decodeURIComponent(release.pathname) !== `/${app.repo}/releases/tag/${app.version}`) throw new Error('공식 릴리스 주소를 확인하세요.');
    for (const file of app.downloads) {
      const url = new URL(file.url);
      if (!app.platforms.includes(file.os) || typeof file.label !== 'string' || !file.label.trim()
        || typeof file.name !== 'string' || !Number.isFinite(file.bytes) || file.bytes <= 0
        || url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password
        || url.search || url.hash || decodeURIComponent(url.pathname) !== `/${app.repo}/releases/download/${app.version}/${file.name}`
        || /DONT.USE|unsigned|PDBs|(?:^|-)src\./i.test(file.name)) {
        throw new Error('공식 설치 파일 정보를 확인하세요.');
      }
    }
  }
  return apps;
}

export function getDownload(app, os, index) {
  if (index === '' || index === null || index === undefined) return null;
  const file = app.downloads[Number(index)];
  return file?.os === os ? file : null;
}

export function fileInstructions(file) {
  if (/\.dmg$/i.test(file.name)) return 'DMG 파일을 열고 앱을 응용 프로그램 폴더로 옮겨 실행하세요.';
  if (/\.exe$/i.test(file.name)) return '다운로드한 실행 파일을 열고 프로젝트의 안내에 따라 실행하거나 설치하세요.';
  if (/\.(msi|msix|msixbundle|appx|appxbundle)$/i.test(file.name)) return '다운로드한 Windows 설치 패키지를 열고 설치 안내를 따르세요. 요구하는 Windows 버전과 추가 구성 요소는 공식 안내에서 확인하세요.';
  if (/\.pkg$/i.test(file.name)) return 'macOS 설치 패키지를 열고 설치 안내를 따르세요.';
  if (/\.(deb|rpm)$/i.test(file.name)) return '내 Linux 배포판에 맞는 패키지인지 확인한 뒤 패키지 관리자로 설치하세요. Ubuntu·Debian 계열은 DEB, Fedora 계열은 RPM을 사용합니다. 세부 버전은 공식 안내를 확인하세요.';
  if (/\.AppImage$/.test(file.name)) return '파일 속성에서 실행 권한을 허용한 뒤 엽니다. 배포판별 추가 요구사항은 공식 안내를 확인하세요.';
  return `${/\.7z$/i.test(file.name) ? '7z를 지원하는 압축 해제 도구로' : '다운로드한 파일의'} 압축을 풀고 ${file.os === 'macos' ? '앱을 응용 프로그램 폴더로 옮겨' : '폴더 안의 앱을'} 실행하세요.`;
}

async function start() {
  const $ = selector => document.querySelector(selector);
  let apps = [], lastApp = '', installerOS = '', detailApp = null;
  let page = 1, total = 0, listRequest = 0, routeRequest = 0, searchTimer;
  const pagination = document.createElement('nav');
  pagination.setAttribute('aria-label', '앱 목록 페이지');
  $('#app-grid').after(pagination);
  const params = new URLSearchParams(location.search);
  const state = { q: (params.get('q') || '').slice(0, 120), category: params.get('category') || 'all', os: params.get('os') || 'all', easy: params.get('easy') === '1' };
  if (!categories.some(([id]) => id === state.category)) state.category = 'all';
  if (!Object.hasOwn(platforms, state.os)) state.os = 'all';
  $('#search').value = state.q;
  $('#platform').value = state.os;
  $('#easy-only').checked = state.easy;
  $('#categories').innerHTML = categories.map(([id, name, glyph]) => `<button class="category" data-category="${id}" aria-pressed="${state.category === id}">${icon(glyph)}${name}</button>`).join('');

  const external = (url, label, className = '') => `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (새 탭)</span></a>`;
  const visual = app => app.imageKind === 'none'
    ? `<div class="app-visual" data-app="${app.id}" aria-hidden="true"><span class="image-fallback">${escapeHtml(app.name)}</span></div>`
    : `<div class="app-visual" data-app="${app.id}"><img class="${app.imageKind === 'logo' ? 'logo' : ''}" src="${escapeHtml(app.image)}" alt="${escapeHtml(app.name)} ${imageLabels[app.imageKind]}" loading="lazy" referrerpolicy="no-referrer"><span class="image-fallback" hidden>${escapeHtml(app.name)}</span></div>`;
  const level = app => `<span class="level ${app.level}">${levels[app.level]}</span>`;
  function renderCatalog() {
    const filtered = apps;
    $('#results-title').textContent = categories.find(([id]) => id === state.category)[1];
    $('#result-count').textContent = `${total}개`;
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === state.category)));
    $('#app-grid').innerHTML = filtered.length ? filtered.map(app => `<a class="app-card" id="card-${app.id}" href="#app/${app.id}">
      ${visual(app)}<div class="card-content"><div class="card-title"><h3>${escapeHtml(app.name)}</h3><span class="free-label">공식 배포</span></div>
      <p class="card-summary">${escapeHtml(app.summary)}</p><div class="card-meta">${level(app)}<span>${escapeHtml(app.tags[0])}</span></div>
      <div class="card-bottom"><span class="card-os">${app.platforms.map(os => platforms[os]).join(' · ')}</span><span class="card-action">설치 방법 ${icon('arrow')}</span></div></div></a>`).join('')
      : '<div class="empty"><h3>조건에 맞는 앱이 아직 없어요.</h3><p>다른 검색어를 쓰거나 필터를 해제해 보세요.</p><button class="button" id="reset-filters">전체 앱 보기</button></div>';
    pagination.innerHTML = total > 24 ? `<button class="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>이전</button> <span>${page} / ${Math.ceil(total / 24)}</span> <button class="button" data-page="${page + 1}" ${page * 24 >= total ? 'disabled' : ''}>다음</button>` : '';
  }

  function saveFilters() {
    const query = new URLSearchParams();
    if (state.q) query.set('q', state.q);
    if (state.category !== 'all') query.set('category', state.category);
    if (state.os !== 'all') query.set('os', state.os);
    if (state.easy) query.set('easy', '1');
    history.replaceState(null, '', `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}`);
    page = 1;
    load();
  }

  function renderFile(app) {
    const panel = $('#codex-install');
    panel.hidden = true; panel.replaceChildren();
    const file = getDownload(app, installerOS, $('#file-select')?.value);
    $('#file-action').innerHTML = file
      ? `<div class="file-meta"><code>${escapeHtml(file.name)}</code>${(file.bytes / 1048576).toFixed(1)} MB · GitHub 공식 배포</div>${external(file.url, `${icon('download')} 공식 파일 다운로드`, 'button')}<p class="install-steps">${escapeHtml(fileInstructions(file))}</p><button class="button" type="button" id="show-codex-install" aria-controls="codex-install" aria-expanded="false">Codex와 검토하고 설치</button>`
      : `<p class="file-meta">${installerOS ? '내 기기에 맞는 파일을 선택하세요. 기기 종류는 운영체제의 시스템 정보에서 확인할 수 있어요.' : '앱을 설치할 컴퓨터의 운영체제를 선택하세요.'}</p><button class="button" disabled>파일을 선택해 주세요</button>`;
    $('#show-codex-install')?.addEventListener('click', async event => {
      panel.hidden = !panel.hidden; event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) {
        if (!panel.childElementCount) { const content = document.createElement('div'); panel.append(content); await mountInstallation(content, app, file); if (!content.isConnected) return; }
        if (!panel.hidden) panel.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
  }

  function renderInstaller(app) {
    $('#codex-install').hidden = true; $('#codex-install').replaceChildren();
    const files = app.downloads.map((file, index) => ({ ...file, index })).filter(file => file.os === installerOS);
    $('#file-picker').innerHTML = files.length
      ? `<label class="field-label" for="file-select">설치 파일</label><select id="file-select">${files.length > 1 ? '<option value="">기기 종류를 선택하세요</option>' : ''}${files.map(file => `<option value="${file.index}">${escapeHtml(file.label)}</option>`).join('')}</select><div id="file-action"></div>`
      : `<div id="file-action"></div>`;
    if (installerOS && !files.length) {
      $('#file-action').innerHTML = `<p class="install-steps">이 컬렉션에는 ${platforms[installerOS]}용 직접 다운로드 파일을 등록하지 않았어요. 공식 안내에서 지원 기기와 설치 방법을 확인하세요.</p>`;
    } else renderFile(app);
  }

  function renderDetail(app) {
    installerOS = state.os !== 'all' ? state.os : detectOS(navigator.userAgent);
    if (!app.platforms.includes(installerOS)) installerOS = '';
    lastApp = app.id;
    document.title = `${app.name} 설치 방법 — OpenAppShelf`;
    $('#detail').innerHTML = `<a class="back-link" href="#catalog">← 앱 둘러보기</a><header class="detail-heading"><h1 id="detail-title" tabindex="-1">${escapeHtml(app.name)}</h1><p>${escapeHtml(app.summary)}</p>${level(app)}<span class="free-label">공식 배포본</span></header>
      <div class="detail-layout"><div>${app.imageKind === 'none' ? '' : `<figure class="detail-figure">${visual(app)}<figcaption>${external(app.imageSource, `${imageLabels[app.imageKind]} · 출처: ${escapeHtml(app.name)}`)}${app.imageChecked ? ` · ${escapeHtml(app.imageChecked)} 확인` : ''}</figcaption></figure>`}
      <section class="detail-description"><h2>이런 일을 할 수 있어요</h2><p>${escapeHtml(app.description)}</p></section>
      <section class="detail-description"><h2>시작하기 전에</h2><p>${escapeHtml(app.requirements)}</p></section>
      <section class="detail-description"><h2>설치하고 처음 할 일</h2><ol>${app.firstSteps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>
      <div class="source-links">${external(app.website, '공식 홈페이지 ↗')}${external(`https://github.com/${app.repo}`, 'GitHub에서 소스 보기 ↗')}</div></div>
      <aside class="installer" aria-label="설치 파일 선택"><h2>내 컴퓨터에 설치하기</h2><p>운영체제와 파일 종류를 확인하세요.</p><label class="field-label" for="install-os">설치할 운영체제</label><select id="install-os"><option value="">운영체제 선택</option>${app.platforms.map(os => `<option value="${os}"${installerOS === os ? ' selected' : ''}>${platforms[os]}</option>`).join('')}</select>
      <div id="file-picker"></div>${external(app.guide, '공식 설치 안내 · 다른 다운로드 ↗', 'guide-link')}<p class="download-note">지원하는 OS 버전과 기기는 공식 안내에서 확인하세요. 다운로드가 끝나면 파일을 직접 열어 설치합니다.</p>
      <dl class="facts"><dt>확인된 버전</dt><dd>${external(app.release, escapeHtml(app.version))}</dd><dt>출시일</dt><dd>${escapeHtml(app.published)}</dd><dt>정보 확인일</dt><dd>${escapeHtml(app.checked)}</dd><dt>라이선스</dt><dd>${external(app.licenseSource || `https://github.com/${app.repo}`, escapeHtml(app.license))}</dd></dl><p class="download-note">확인일 기준 정보이며 자동 갱신되지 않습니다.</p></aside></div><div id="codex-install" class="codex-install" hidden></div>`;
    renderInstaller(app);
  }

  async function renderRoute(moveFocus = false) {
    const request = ++routeRequest;
    const isDetail = location.hash.startsWith('#app/'), isAbout = location.hash === '#about';
    $('#catalog').hidden = isDetail || isAbout;
    $('#detail').hidden = !isDetail;
    $('#about').hidden = !isAbout;
    document.title = 'OpenAppShelf — 나에게 맞는 오픈소스 앱';
    if (isDetail) {
      detailApp = null;
      $('#detail').innerHTML = '<p role="status">앱 정보를 불러오고 있어요.</p>';
      try {
        const response = await fetch(`/api/apps/${encodeURIComponent(location.hash.slice(5))}`);
        if (!response.ok) throw new Error(response.status === 404 ? '앱을 찾을 수 없어요.' : '앱 정보를 불러오지 못했어요.');
        const app = validateCatalog([await response.json()])[0];
        if (request !== routeRequest) return;
        detailApp = app;
        renderDetail(app);
      } catch (error) {
        if (request !== routeRequest) return;
        $('#detail').innerHTML = `<a class="back-link" href="#catalog">← 앱 둘러보기</a><h1 id="detail-title" tabindex="-1">${escapeHtml(error.message)}</h1><button class="button" id="retry-detail">다시 불러오기</button>`;
      }
    }
    if (moveFocus) {
      (isDetail ? $('#detail-title') : isAbout ? $('#about-title') : $(`#card-${lastApp}`) || $('#main'))?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }

  $('#search').addEventListener('input', event => {
    state.q = event.target.value;
    ++listRequest;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(saveFilters, 200);
  });
  $('#platform').addEventListener('change', event => { state.os = event.target.value; saveFilters(); });
  $('#easy-only').addEventListener('change', event => { state.easy = event.target.checked; saveFilters(); });
  $('#categories').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    saveFilters();
    if (location.hash !== '#catalog') location.hash = 'catalog';
  });
  $('#detail').addEventListener('change', event => {
    const app = detailApp;
    if (!app) return;
    if (event.target.id === 'install-os') { installerOS = event.target.value; renderInstaller(app); }
    if (event.target.id === 'file-select') renderFile(app);
  });
  $('#detail').addEventListener('click', event => { if (event.target.closest('#retry-detail')) renderRoute(true); });
  pagination.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    load();
  });
  $('#app-grid').addEventListener('click', event => {
    if (event.target.closest('#retry')) load();
    if (!event.target.closest('#reset-filters')) return;
    Object.assign(state, { q: '', category: 'all', os: 'all', easy: false });
    $('#search').value = ''; $('#platform').value = 'all'; $('#easy-only').checked = false;
    saveFilters(); $('#search').focus();
  });
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement) {
      event.target.hidden = true;
      event.target.nextElementSibling.hidden = false;
    }
  }, true);
  window.addEventListener('hashchange', () => renderRoute(true));

  async function load() {
    const request = ++listRequest;
    clearTimeout(searchTimer);
    $('#app-grid').setAttribute('aria-busy', 'true');
    pagination.innerHTML = '';
    try {
      const params = new URLSearchParams({ q: state.q, category: state.category, os: state.os, easy: state.easy ? '1' : '0', page: String(page) });
      const response = await fetch(`/api/apps?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (request !== listRequest) return;
      apps = result.items.length ? validateCatalog(result.items) : [];
      total = result.total;
      renderCatalog();
    } catch (error) {
      if (request !== listRequest) return;
      console.error('Catalog load failed:', error);
      $('#result-count').textContent = '';
      $('#app-grid').innerHTML = '<div class="empty"><h3>앱 목록을 불러오지 못했어요.</h3><p>연결을 확인한 뒤 다시 시도해 주세요.</p><button class="button" id="retry">다시 불러오기</button></div>';
    } finally { if (request === listRequest) $('#app-grid').setAttribute('aria-busy', 'false'); }
  }
  await Promise.all([load(), renderRoute()]);
}

if (typeof document !== 'undefined') start();

if (import.meta.main && process.argv.includes('--self-test')) {
  const { default: assert } = await import('node:assert/strict');
  const { readFile } = await import('node:fs/promises');
  const apps = validateCatalog(JSON.parse(await readFile(new URL('./apps.json', import.meta.url), 'utf8')));
  assert.equal(filterApps(apps, { q: '  LOCALsend  ' })[0].id, 'localsend');
  assert.ok(filterApps(apps, { q: '영상 자르기' }).some(app => app.id === 'losslesscut'));
  assert.equal(filterApps(apps, { q: '없는앱-12345' }).length, 0);
  assert.ok(filterApps(apps, { category: 'photo', easy: true }).every(app => app.category === 'photo' && app.level === 'easy'));
  assert.equal(filterApps(apps, { category: 'developer', os: 'macos' })[0].id, 'vscodium');
  assert.equal(detectOS('Mozilla Macintosh Intel Mac OS X'), 'macos');
  assert.equal(detectOS('Mozilla iPhone CPU iPhone OS like Mac OS X'), '');
  assert.equal(detectOS('Mozilla Linux Android Mobile'), '');
  assert.equal(detectOS('Unknown'), '');
  assert.equal(getDownload(apps[0], 'windows', 0), null);
  assert.equal(getDownload(apps[0], 'macos', ''), null);
  assert.equal(getDownload(apps[0], 'macos', -1), null);
  assert.equal(getDownload(apps[0], 'macos', 0).os, 'macos');
  for (const url of ['javascript:alert(1)', 'https://github.com.evil.example/file.dmg', 'https://github.com/other/repo/releases/download/v1/app.dmg']) {
    const bad = structuredClone(apps); bad[0].downloads[0].url = url;
    assert.throws(() => validateCatalog(bad));
  }
  const duplicate = [...apps, apps[0]];
  for (const licenseSource of [undefined, '', 'javascript:alert(1)']) {
    assert.throws(() => validateCatalog([{ ...apps[0], licenseSource }]));
  }
  const unsafeImage = structuredClone(apps); unsafeImage[0].image = './assets/previews/../../.env';
  assert.throws(() => validateCatalog(unsafeImage));
  assert.throws(() => validateCatalog(duplicate));
  const sameRepo = [...apps, { ...apps[0], id: 'duplicate-repo', repo: apps[0].repo.toUpperCase() }];
  assert.throws(() => validateCatalog(sameRepo));
  assert.match(fileInstructions({ name: 'app.msi' }), /Windows 설치 패키지/);
  assert.match(fileInstructions({ name: 'app.deb' }), /패키지 관리자/);
  assert.match(fileInstructions({ name: 'app.AppImage' }), /실행 권한/);
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  console.log(`PASS: ${apps.length} apps, ${apps.reduce((sum, app) => sum + app.downloads.length, 0)} official files; search, filters, device detection, download selection, unsafe URLs, duplicates, HTML escaping.`);
}

async function mountInstallation(container, app, file) {
  container.innerHTML = "<style>.codex-install { max-width: 900px; margin: 32px 0; padding: 24px; border: 1px solid var(--line); border-radius: 14px; } .codex-install > div > section:first-of-type { margin-top: 0; padding-top: 0; border-top: 0; } .codex-install summary { cursor: pointer; } .codex-install h2 { font-size: 1.25rem; margin-bottom: 12px; }.codex-install h3 { font-size: 1rem; margin: 20px 0 8px; }.codex-install p { max-width: 68ch; line-height: 1.75; margin: 10px 0; }.codex-install section { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--line); }.codex-install .meta { color: var(--muted); font-size: .9rem; }.codex-install .actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; align-items: center; }.codex-install .button { border: 1px solid var(--blue); cursor: pointer; }.codex-install .secondary { color: var(--blue); background: white; }.codex-install button:disabled { opacity: .5; cursor: default; }.codex-install label { display: flex; gap: 10px; align-items: start; max-width: 68ch; line-height: 1.65; margin: 16px 0; }.codex-install input[type=checkbox] { width: 18px; height: 18px; flex: 0 0 18px; margin-top: 4px; }.codex-install input[type=password] { display: block; width: min(100%, 420px); padding: 12px; border: 1px solid var(--line); border-radius: 8px; }.codex-install li { margin: 9px 0; line-height: 1.65; }.codex-install ul, .codex-install ol { padding-left: 24px; }.codex-install code, .codex-install blockquote { overflow-wrap: anywhere; white-space: pre-wrap; }.codex-install blockquote { padding: 12px 16px; margin: 10px 0; background: var(--surface); border-left: 1px solid var(--line); font-size: .875rem; }.codex-install .notice { background: var(--surface); border-radius: 10px; padding: 16px; margin: 16px 0; }.codex-install #status { min-height: 28px; }.codex-install [hidden] { display: none !important; }.codex-install .finding { padding-bottom: 12px; border-bottom: 1px solid var(--line); }\n</style><section aria-labelledby=\"assist-title\"><h2 id=\"assist-title\">Codex와 검토하고 설치하기</h2><p class=\"meta\" id=\"selected-file\"></p><p>선택 버전의 공개 코드를 먼저 검토합니다. 설치는 이 서버가 실행 중인 Mac에 적용됩니다. DMG 열기는 사용자가 진행하고, Codex가 확인과 복사를 이어갑니다.</p>\n<div id=\"login\" hidden><label for=\"secret\">로컬 관리자 키 또는 비밀번호</label><input id=\"secret\" type=\"password\" autocomplete=\"current-password\"><div class=\"actions\"><button class=\"button\" id=\"login-button\">로그인</button></div><p class=\"meta\">기존 관리자 인증을 사용합니다. 키는 서버 폴더에서 <code>npm run admin -- key</code>로 확인할 수 있습니다.</p></div>\n<div id=\"review-controls\" hidden><label><input id=\"consent\" type=\"checkbox\">선택 버전의 공개 소스 일부와 배포 정보를 Codex로 전송하여 검토하는 데 동의합니다. Codex 사용량이 소모될 수 있습니다.</label><button class=\"button\" id=\"review-button\" disabled>코드 검토 시작</button></div>\n<p id=\"status\" role=\"status\" aria-live=\"polite\"></p><div id=\"result\"></div>\n</section>";

const $ = id => container.querySelector('#' + id);
const appId = app.id, index = app.downloads.indexOf(file), key = `installation:${appId}:${index}`; let token, job, busy = false;
$('selected-file').textContent = `${app.version} · ${file.name}`;
const escape = escapeHtml;
function status(message) { $('status').textContent = message; }
async function json(url, options) { const response = await fetch(url, options); const data = await response.json(); if(!response.ok) throw Object.assign(new Error(data.error || '요청에 실패했습니다.'), {status:response.status}); return data; }
function controls() { $('review-button').disabled = busy || !$('consent').checked; const button = $('install-button'); if(button) button.disabled = busy || !$('approve').checked; }
function render(value) {
  job = value; const severity = {info:'참고',medium:'주의',high:'높은 위험',critical:'심각한 위험'};
  $('result').innerHTML = `<section><h2>코드 검토 결과</h2><p>${escape(job.review.summary)}</p><p class="meta">${escape(job.version)} · 소스 커밋 <code>${escape(job.commit)}</code></p><div class="notice"><strong>일부 소스의 검토이며 안전 인증이 아닙니다.</strong><p>소스 트리 ${job.coverage.treeFiles}개 파일 중 ${job.coverage.sampled}개를 검토했습니다.${job.coverage.truncated ? ' 소스 트리 목록도 일부만 확인되었습니다.' : ''} 실행 분석, 전체 의존성 감사, 배포 바이너리와 소스의 동일성은 확인하지 않았습니다.</p></div>
  ${job.review.findings.length ? job.review.findings.map(f => `<div class="finding"><h3>${escape(severity[f.severity])} · ${escape(f.path)}</h3><p>${escape(f.detail)}</p><blockquote>${escape(f.quote)}</blockquote></div>`).join('') : '<p>검토한 범위에서 구체적인 위험 근거를 찾지 못했습니다. 위험이 없다는 뜻은 아닙니다.</p>'}
  <h3>확인하지 못한 내용</h3><ul>${job.review.limitations.map(item=>`<li>${escape(item)}</li>`).join('')}</ul><details><summary>검토한 소스 ${job.sources.length}개</summary><ul>${job.sources.map(source=>`<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.path)}</a></li>`).join('')}</ul></details></section>
  <section><h2>설치 계획</h2><p>대상 컴퓨터: <strong>${escape(job.host)}</strong></p><p>설치 폴더: <code>${escape(job.folder)}</code></p><p class="meta">DMG 안의 앱 이름을 사용합니다. 기존 앱 덮어쓰기, 관리자 권한 요청, 보안 설정 해제, 앱 자동 실행은 하지 않습니다.</p><ol>${job.plan.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><details><summary>확인할 배포 파일</summary><p>${escape(file.name)} · ${(job.asset.bytes/1048576).toFixed(1)} MB</p><p><code>${escape(job.asset.digest || '공식 SHA-256 없음')}</code></p></details>
  ${job.result?.needsMount ? `<div class="notice"><strong>Finder에서 DMG를 열어 주세요.</strong><p>Finder에서 ⌘⇧G를 누르고 아래 경로를 붙여 넣어 파일을 여세요. 열린 DMG 안의 앱은 아직 실행하지 마세요. 위 계획에 다시 동의한 뒤 설치 버튼을 누르면 검증과 복사를 이어갑니다.</p><p><code>${escape(job.result.imagePath)}</code></p></div>` : ''}
  ${job.blockers.length ? `<div class="notice"><strong>자동 설치를 진행할 수 없습니다.</strong><ul>${job.blockers.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul><p>위의 공식 다운로드로 직접 설치할 수 있습니다.</p></div>` : ['reviewed','awaiting_mount'].includes(job.status) ? '<label><input id="approve" type="checkbox">검토의 한계와 설치 계획을 확인했으며, 이 Mac에 공식 파일을 내려받아 설치하는 것을 승인합니다.</label><button class="button" id="install-button" disabled>승인한 계획으로 설치</button><p class="meta">검토는 30분 동안 유효합니다. 설치 중 화면을 닫아도 서버에서 현재 단계를 마무리합니다.</p>' : ''}

  <p><strong>${escape({awaiting_mount:job.result?.message,installing:'설치 진행 중',interrupted:'서버 재시작으로 설치 결과가 불확실합니다. 설치 폴더를 확인한 뒤 다시 검토하세요.',installed:job.result?.message,failed:job.error}[job.status] || '')}</strong></p>${job.result?.destination ? `<p><code>${escape(job.result.destination)}</code></p>` : ''}</section>`;
  if (job.status === 'awaiting_mount' && $('install-button')) $('install-button').textContent = 'DMG 열기 완료 · 설치 계속';
  $('approve')?.addEventListener('change',controls); $('install-button')?.addEventListener('click',()=>run('install')); controls();
}
async function authenticate() {
  try { token=(await json('/api/admin/installation')).token; $('login').hidden=true; $('review-controls').hidden=false; }
  catch(error) { if(error.status!==401) throw error; $('login').hidden=false; $('review-controls').hidden=true; return; }
  const reviewId = sessionStorage.getItem(key);
  if(reviewId) { const saved=await json('/api/admin/installation',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':token},body:JSON.stringify({action:'status',id:reviewId})}); if(saved.app!==appId || saved.file!==index) throw Error('저장된 검토와 선택 파일이 다릅니다.'); render(saved); }
}
async function run(action) {
  busy=true; controls(); status(action==='review'?'공개 소스를 확인하고 있습니다.':'설치를 시작합니다.');
  try {
    const response=await fetch('/api/admin/installation',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':token},body:JSON.stringify({action,app:appId,file:index,fileUrl:file.url,version:app.version,consent:$('consent').checked,id:job?.id,approve:$('approve')?.checked===true})});
    if(!response.ok) { const data=await response.json(); throw Error(data.error); }
    const reader=response.body.getReader(), decoder=new TextDecoder(); let buffer='', ended=false;
    while(true) { const chunk=await reader.read(); buffer+=decoder.decode(chunk.value || new Uint8Array(),{stream:!chunk.done}); let newline;
      while((newline=buffer.indexOf('\n'))>=0) { const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line)continue;const event=JSON.parse(line);
        if(event.type==='progress')status(event.message);
        if(event.type==='error')throw Error(event.error);
        if(event.type==='result') {render(event.job);sessionStorage.setItem(key,job.id);ended=true;status(action==='review'?'검토 결과와 설치 계획을 확인하세요.':job.status==='awaiting_mount'?'DMG를 열고 설치를 계속하세요.':'설치 결과를 확인하세요.');}
      } if(chunk.done)break;
    } if(!ended)throw Error('연결이 끊겼습니다. 설치 요청 후라면 새로고침하여 결과를 확인하세요.');
  } catch(error) {status(error.message); if(action==='install'&&job) { job.status='failed'; job.error='설치 요청이 끝났거나 결과 확인이 필요합니다. 새로고침하여 저장된 상태를 확인하세요.'; render(job); }}
  finally {busy=false;controls();}
}
$('consent').addEventListener('change',controls);$('review-button').addEventListener('click',()=>run('review'));
$('login-button').addEventListener('click',async()=>{try{await json('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:$('secret').value})});$('secret').value='';status('로그인했습니다.');await authenticate();}catch(error){status(error.message);}});
try { await authenticate(); } catch(error) { status(error.message); }
}
