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
    const file = getDownload(app, installerOS, $('#file-select')?.value);
    $('#file-action').innerHTML = file
      ? `<div class="file-meta"><code>${escapeHtml(file.name)}</code>${(file.bytes / 1048576).toFixed(1)} MB · GitHub 공식 배포</div>${external(file.url, `${icon('download')} 공식 파일 다운로드`, 'button')}<p class="install-steps">${escapeHtml(fileInstructions(file))}</p>`
      : `<p class="file-meta">${installerOS ? '내 기기에 맞는 파일을 선택하세요. 기기 종류는 운영체제의 시스템 정보에서 확인할 수 있어요.' : '앱을 설치할 컴퓨터의 운영체제를 선택하세요.'}</p><button class="button" disabled>파일을 선택해 주세요</button>`;
  }

  function renderInstaller(app) {
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
      <dl class="facts"><dt>확인된 버전</dt><dd>${external(app.release, escapeHtml(app.version))}</dd><dt>출시일</dt><dd>${escapeHtml(app.published)}</dd><dt>정보 확인일</dt><dd>${escapeHtml(app.checked)}</dd><dt>라이선스</dt><dd>${external(app.licenseSource || `https://github.com/${app.repo}`, escapeHtml(app.license))}</dd></dl><p class="download-note">확인일 기준 정보이며 자동 갱신되지 않습니다.</p></aside></div>`;
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
