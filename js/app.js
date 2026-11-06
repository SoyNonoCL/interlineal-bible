// Biblia Interlineal — app principal (vanilla JS, sin dependencias, 100 % local)
import { decode, morphShort } from './morph.js';
import * as store from './store.js';
import { importEpub, matchBook } from './epub.js';
import * as RW from './refworks.js';
import { importPdfBible } from './pdfbible.js';
import { t, setLang, uiLang, LANGS, bookNameL, bookAbbrL, ABOUT, langName, ALL_BOOK_NAMES } from './i18n.js';

const KOFI = 'https://ko-fi.com/omunozcifuentes';
const FLAVOR = window.APP_FLAVOR || 'direct'; // 'direct' (APK/web) | 'play' (Google Play: sin enlaces externos de donación)
const VERSION = window.APP_VERSION || '0.5';

// ------------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const debounce = (fn, ms) => { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); }; };
const nf = (n) => Number(n).toLocaleString(uiLang());
function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
  document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('Copiado')); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); toast(ok ? t('Copiado') : t('No se pudo copiar'));
  }
}

const IC = {
  books: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H19v-5"/><path d="M8 7h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5M14 3v5h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>', text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  conc: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  cols: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
  open: '<path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

// ------------------------------------------------------------------ estado
const DEF_SETTINGS = {
  theme: 'system', fs: 18, view: 'int', gloss: 'lex', glossLang: 'es', tr: true, gl: true, mo: true, st: false,
  rvInInt: true, main: 'rv', texts: ['rv'], parOrig: true, spur: true, searchIn: 'rv', accents: true, vowels: true,
  morphemes: false, ed: 's', bookList: false, testament: 'ot', ui: null
};
const S = { settings: { ...DEF_SETTINGS }, user: { hl: {}, notes: {}, bm: {}, last: null }, meta: null,
  books: new Map(), bibles: [], bibleData: new Map(), works: [], workData: new Map(), lex: {}, conc: null, rv: null, notes: null, route: null, search: { q: '', page: 1 } };

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${t('No se pudo cargar')} ${path} (${r.status})`);
  return r.json();
}
async function getBook(id) {
  if (S.books.has(id)) return S.books.get(id);
  const p = loadJSON(`data/books/${id}.json`);
  S.books.set(id, p);
  if (S.books.size > 6) S.books.delete(S.books.keys().next().value);
  try { return await p; } catch (e) { S.books.delete(id); throw e; }
}
async function getLex(lang) {
  const k = lang === 'hbo' ? 'heb' : 'grk';
  if (!S.lex[k]) S.lex[k] = loadJSON(`data/lex/${k}.json`).catch(e => { S.lex[k] = null; throw e; });
  return S.lex[k];
}
async function getConc() { if (!S.conc) S.conc = loadJSON('data/conc.json').catch(e => { S.conc = null; throw e; }); return S.conc; }
async function getRV() { if (!S.rv) S.rv = loadJSON('data/rv.json').catch(e => { S.rv = null; throw e; }); return S.rv; }
async function getNotes() { if (!S.notes) S.notes = loadJSON('data/notes.json').catch(e => { S.notes = null; throw e; }); return S.notes; }
async function getBible(id) {
  if (!S.bibleData.has(id)) S.bibleData.set(id, store.get('bible:' + id, null));
  return S.bibleData.get(id);
}
const bibleMeta = (id) => S.bibles.find(b => b.id === id);
const RV_META = { id: 'rv', name: 'Reina-Valera 1909', abbr: 'RV1909', lang: 'es', builtin: true };
const allVersions = () => [RV_META, ...S.bibles];
const versionMeta = (id) => id === 'rv' ? RV_META : bibleMeta(id);

// versiones activas: la principal primero, luego las de comparación (máx. 4)
async function activeTexts() {
  const st = S.settings;
  if (!versionMeta(st.main)) st.main = 'rv';
  const ids = [st.main, ...(st.texts || []).filter(id => id !== st.main && versionMeta(id))].slice(0, 4);
  const out = [];
  for (const id of ids) {
    const m = versionMeta(id);
    out.push(id === 'rv' ? { id, abbr: m.abbr, lang: 'es' } : { id, abbr: m.abbr, lang: m.lang, data: await getBible(id) });
  }
  return out.filter(x => x.id === 'rv' || x.data);
}
function altText(x, b, c, v) { const bk = x.data && x.data.books[b]; return bk && bk[c] && bk[c][v] || ''; }
let CUR_TEXTS = [{ id: 'rv', abbr: 'RV1909', lang: 'es' }];

const bookById = (id) => S.meta.books.find(b => b.id === id);
const bookIdx = (id) => S.meta.books.findIndex(b => b.id === id);
const bookName = (id) => bookNameL(id) || (bookById(id) || {}).name || id;
const bookAbbr = (id) => bookAbbrL(id) || (bookById(id) || {}).abbr || id;
const refKey = (b, c, v) => `${b}.${c}.${v}`;
const refLabel = (b, c, v) => `${bookName(b)} ${c}${v != null ? ':' + v : ''}`;

function saveUser() { store.set('user', S.user); }
function saveSettings() { store.set('settings', S.settings); applyTheme(); }
function applyTheme() {
  const r = document.documentElement;
  if (S.settings.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.settings.theme);
  r.style.setProperty('--fs', S.settings.fs + 'px');
  r.lang = uiLang();
}

// ------------------------------------------------------------------ texto hebreo / griego
const RE_ACC = /[֑-ֽ֯׀]/g;                       // te'amim, meteg, paseq
const RE_VOW = /[ְ-ׇּׁׂׅׄ]/g;     // niqqud, puntos, dagesh
function hebForm(s, keepMorph = S.settings.morphemes) {
  s = s.replace(/\\/g, '');
  if (!S.settings.accents) s = s.replace(RE_ACC, '');
  if (!S.settings.vowels) s = s.replace(RE_VOW, '');
  const parts = s.split('/');
  if (keepMorph && parts.length > 1) return parts.map(esc).join('<span class="mb">/</span>');
  return esc(parts.join(''));
}
function hebPlain(s) { return hebForm(s, false); }
function trForm(x, lang) { return lang !== 'hbo' ? x : x.replace(/\//g, '').replace(/\./g, '').toLowerCase(); }
function glossForm(g, lang) { return lang === 'hbo' ? g.replace(/\//g, '·') : g; }
function glossOf(w, lang) {
  const [, , es, en] = w;
  if (S.settings.glossLang === 'en') return lang === 'hbo' ? en.replace(/\s*\/\s*/g, '·').replace(/[<>]/g, '') : en;
  return glossForm(es || en, lang);
}

const spurKind = (f) => !S.settings.spur ? '' : (f || '').includes('?') ? 'dub' : (f || '').includes('!') ? 'spu' : '';
function wordVisible(w, lang) {
  if (lang === 'hbo') return true;
  const f = w[6] || '';
  if (S.settings.spur && /[!?]/.test(f) && (f.includes('t') || f.includes('b') || f.includes('s'))) return true;
  if (S.settings.ed === 's') return f.includes('s');
  if (S.settings.ed === 't') return f.includes('t');
  return true;
}
function wordVariant(w, lang) {
  if (lang === 'hbo' || spurKind(w[6])) return false;
  const f = w[6] || '';
  return S.settings.ed === 'all' && !(f.includes('s') && f.includes('t'));
}
const verseSpur = (vs) => S.settings.spur && vs.sp ? vs.sp : '';

// ------------------------------------------------------------------ router
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  let m;
  if ((m = h.match(/^r-([0-9A-Z]{3})-(\d+)(?:-(\d+))?$/))) return { name: 'read', b: m[1], c: +m[2], v: m[3] ? +m[3] : null };
  if ((m = h.match(/^c-([0-9A-Z]{3})$/))) return { name: 'chapters', b: m[1] };
  if ((m = h.match(/^x-([0-9A-Z]{3})-(\d+)$/))) return { name: 'verses', b: m[1], c: +m[2] };
  if ((m = h.match(/^f-([0-9A-Z]{3})-(\d+)-(\d+)$/))) return { name: 'read', b: m[1], c: +m[2], v: +m[3], focus: true };
  if (h === 'buscar') return { name: 'search' };
  if (h === 'notas') return { name: 'notes' };
  if (h === 'opciones') return { name: 'options' };
  if (h === 'principios') return { name: 'principles' };
  if (h === 'bienvenida') return { name: 'welcome' };
  return { name: 'books' };
}
function go(hash) { if (location.hash.slice(1) === hash) render(); else location.hash = hash; }

// ------------------------------------------------------------------ esqueleto
const app = document.getElementById('app');
const WIDE = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: false };
const isWide = () => WIDE.matches;
function shell({ title, left = '', right = '', tab, wide = false }) {
  const split = tab === 'books' && isWide();
  const prevPanel = $('#panel'); if (prevPanel) S.panelScroll = prevPanel.scrollTop;
  app.innerHTML = `
  <header class="topbar">${left}<h1>${title}</h1>${right}</header>
  ${split ? `<div class="split"><aside class="bookpanel" id="panel" aria-label="${t('Libros de la Biblia')}"></aside><main class="content ${wide ? 'wide' : ''}" id="content"></main></div>`
    : `<main class="content ${wide ? 'wide' : ''}" id="content"></main>`}
  <nav class="tabbar" aria-label="${t('Secciones')}">
    ${[['books', '', t('Biblia'), 'books'], ['search', 'buscar', t('Buscar'), 'search'], ['notes', 'notas', t('Notas'), 'notes'], ['options', 'opciones', t('Ajustes'), 'gear']]
      .map(([k, h, l, i]) => `<button data-go="${h}" ${tab === k ? 'aria-current="page"' : ''}>${icon(i)}<span>${l}</span></button>`).join('')}
  </nav>`;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const h = b.dataset.go;
    if (h === '' && tab !== 'books' && S.user.last) return go(`r-${S.user.last.b}-${S.user.last.c}`);
    go(h);
  });
  if (split) renderPanel();
  return $('#content');
}

async function render() {
  closeSheet();
  const r = S.route = parseHash();
  try {
    if (r.name === 'read') await renderReader(r);
    else if (r.name === 'verses') await renderVerses(r);
    else if (r.name === 'chapters' && isWide()) { S.panelBook = r.b; await renderReader(S.route = homeRoute()); }
    else if (r.name === 'books' && isWide()) await renderReader(S.route = homeRoute());
    else if (r.name === 'chapters') renderChapters(r);
    else if (r.name === 'search') renderSearch();
    else if (r.name === 'notes') renderNotes();
    else if (r.name === 'options') renderOptions();
    else if (r.name === 'principles') await renderPrinciples();
    else if (r.name === 'welcome') await renderWelcome();
    else renderBooks();
  } catch (e) {
    console.error(e);
    const c = $('#content') || shell({ title: 'Error' });
    c.innerHTML = `<div class="wrap"><div class="empty">${t('No se pudo abrir esta sección.')}<br>${esc(e.message)}</div></div>`;
  }
}

// ------------------------------------------------------------------ libros
const SEC_NAMES = { ley: 'Pentateuco', hist: 'Libros históricos', poet: 'Libros poéticos y sapienciales', prof: 'Profetas mayores',
  menor: 'Profetas menores', evang: 'Evangelios', hech: 'Historia de la Iglesia', pabl: 'Cartas de Pablo', gen: 'Hebreos y cartas generales', apoc: 'Profecía' };

function renderBooks() {
  const st = S.settings;
  const c = shell({ title: t('Biblia Interlineal'), tab: 'books',
    right: `${versionBtn()}<button class="ibtn" id="bl" aria-label="${st.bookList ? t('Ver en cuadrícula') : t('Ver en lista')}">${icon(st.bookList ? 'grid' : 'list')}</button>` });
  const nt = st.testament === 'nt';
  const list = S.meta.books.filter(b => b.nt === nt);
  const secs = [...new Set(list.map(b => b.sec))];
  const last = S.user.last;
  c.innerHTML = `<div class="wrap ${st.bookList ? 'listmode' : ''}">
    ${last ? `<div class="btnrow" style="margin:0 0 16px"><button class="btn ghost" id="cont">${icon('bookmark')}${esc(t('Seguir leyendo: {ref}', { ref: refLabel(last.b, last.c) }))}</button></div>` : ''}
    <div class="seg" role="group" aria-label="${t('Testamento')}">
      <button data-t="ot" aria-pressed="${!nt}">${t('Escrituras Hebreas')}<small>${t('Antiguo Testamento')}</small></button>
      <button data-t="nt" aria-pressed="${nt}">${t('Escrituras Griegas')}<small>${t('Nuevo Testamento')}</small></button>
    </div>
    ${secs.map(s => `<div class="sec-title">${t(SEC_NAMES[s])}</div><div class="bookgrid">${list.filter(b => b.sec === s).map(b =>
      `<button class="book" style="background:var(--sec-${s})" data-b="${b.id}" aria-label="${esc(bookName(b.id))}"><span class="ba" aria-hidden="true">${esc(bookAbbr(b.id))}</span><span class="bn">${esc(bookName(b.id))}</span></button>`).join('')}</div>`).join('')}
  </div>`;
  c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { st.testament = b.dataset.t; saveSettings(); renderBooks(); });
  c.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const m = bookById(b.dataset.b);
    go(m.ch === 1 ? `x-${m.id}-1` : `c-${m.id}`);
  });
  $('#bl').onclick = () => { st.bookList = !st.bookList; saveSettings(); renderBooks(); };
  bindVersionBtn(() => renderBooks());
  const cb = $('#cont'); if (cb) cb.onclick = () => go(`r-${last.b}-${last.c}`);
  fitBookNames(c);
}

// En cuadrícula: nombre completo si todos caben en su casilla (sin cortar palabras); si no, solo la abreviatura.
function fitBookNames(root) {
  const grids = [...root.querySelectorAll('.bookgrid')]; if (!grids.length || root.querySelector('.listmode')) return;
  grids.forEach(g => g.classList.remove('names'));
  if (grids[0].clientWidth < 520) return;            // celular: abreviaturas (casillas cuadradas)
  grids.forEach(g => g.classList.add('names'));
  const fits = [...root.querySelectorAll('.bookgrid .bn')].every(n => n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.parentElement.clientHeight);
  if (!fits) grids.forEach(g => g.classList.remove('names'));
}
window.addEventListener('resize', debounce(() => { const c = $('#content'); if (c && c.querySelector('.bookgrid')) fitBookNames(c); }, 150));

function renderChapters(r) {
  const m = bookById(r.b); if (!m) return go('');
  const c = shell({ title: esc(bookName(m.id)), tab: 'books', left: `<button class="ibtn" id="bk" aria-label="${t('Volver a los libros')}">${icon('back')}</button>` });
  $('#bk').onclick = () => go('');
  const last = S.user.last;
  c.innerHTML = `<div class="wrap"><div class="sec-title">${t('Capítulos')} · ${m.ch}</div><div class="chapgrid">
    ${Array.from({ length: m.ch }, (_, i) => `<button class="chap ${last && last.b === m.id && last.c === i + 1 ? 'last' : ''}" data-c="${i + 1}">${i + 1}</button>`).join('')}
  </div></div>`;
  c.querySelectorAll('[data-c]').forEach(b => b.onclick = () => go(`x-${m.id}-${b.dataset.c}`));
}

// ------------------------------------------------------------------ elegir versículo / leer el capítulo completo
async function renderVerses(r) {
  const m = bookById(r.b); if (!m) return go('');
  const c = shell({ title: esc(`${bookName(m.id)} ${r.c}`), tab: 'books', left: `<button class="ibtn" id="bk" aria-label="${t('Volver')}">${icon('back')}</button>` });
  $('#bk').onclick = () => { if (isWide()) { S.panelBook = m.ch === 1 ? null : m.id; go(''); } else go(m.ch === 1 ? '' : `c-${m.id}`); };
  c.innerHTML = `<div class="loading">${t('Cargando')}…</div>`;
  const book = await getBook(m.id); if (S.route !== r) return;
  const ch = book.chs.find(x => x.c === r.c); if (!ch) return go(`c-${m.id}`);
  c.innerHTML = `<div class="wrap versepick">
    <button class="btn full" id="readall">${icon('books')}${t('Leer el capítulo completo')}</button>
    <div class="sec-title">${t('O elige un versículo para leerlo versículo a versículo')} · ${ch.vs.length}</div>
    <div class="chapgrid">${ch.vs.map(vs => `<button class="chap" data-v="${vs.v}">${vs.v}</button>`).join('')}</div></div>`;
  $('#readall').onclick = () => go(`r-${m.id}-${r.c}`);
  c.querySelectorAll('[data-v]').forEach(b => b.onclick = () => go(`f-${m.id}-${r.c}-${b.dataset.v}`));
  if (isWide()) markPanel(m.id, r.c);
}

// ------------------------------------------------------------------ pantallas anchas: libros (todos juntos) junto al texto
function homeRoute() { const l = S.user.last || { b: 'GEN', c: 1 }; return { name: 'read', b: l.b, c: l.c, v: null, home: true }; }
const SEC_ORDER = ['ley', 'hist', 'poet', 'prof', 'menor', 'evang', 'hech', 'pabl', 'gen', 'apoc'];
function renderPanel() {
  const p = $('#panel'); if (!p) return;
  const cur = S.route && S.route.b;
  const pb = S.panelBook && bookById(S.panelBook);
  if (pb) {
    const curC = S.route && S.route.b === pb.id ? S.route.c : null;
    p.innerHTML = `<div class="ph"><button class="ibtn" id="pback" aria-label="${t('Volver a los libros')}">${icon('back')}</button><b>${esc(bookName(pb.id))}</b>
        <span class="chip" style="background:var(--sec-${pb.sec});color:#fff">${t(SEC_NAMES[pb.sec])}</span></div>
      <div class="chapgrid">${Array.from({ length: pb.ch }, (_, i) => `<button class="chap ${curC === i + 1 ? 'last' : ''}" data-pc="${i + 1}">${i + 1}</button>`).join('')}</div>
      <p class="hint">${t('Elige un capítulo: podrás leerlo completo o versículo a versículo.')}</p>`;
    p.querySelector('#pback').onclick = () => { S.panelBook = null; renderPanel(); };
    p.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => go(`x-${pb.id}-${b.dataset.pc}`));
    p.scrollTop = 0;
    return;
  }
  const books = S.meta.books;
  const legend = (nt) => SEC_ORDER.filter(sc => books.some(b => b.sec === sc && b.nt === nt)).map(sc => `<span class="lgc"><i style="background:var(--sec-${sc})"></i>${t(SEC_NAMES[sc])}</span>`).join('');
  p.innerHTML = `<div class="pgrid66" role="list">${books.map(b => `<button role="listitem" class="pbook ${b.id === cur ? 'cur' : ''}" style="--c:var(--sec-${b.sec})" data-pb="${b.id}" title="${esc(t(SEC_NAMES[b.sec]))}">${esc(bookName(b.id))}</button>`).join('')}</div>
    <div class="plegend"><div class="plg"><b>${t('Escrituras Hebreas')} · ${t('Antiguo Testamento')}</b>${legend(false)}</div>
      <div class="plg"><b>${t('Escrituras Griegas')} · ${t('Nuevo Testamento')}</b>${legend(true)}</div></div>`;
  p.querySelectorAll('[data-pb]').forEach(b => b.onclick = () => { const m = bookById(b.dataset.pb); if (m.ch === 1) go(`x-${m.id}-1`); else { S.panelBook = m.id; renderPanel(); } });
  if (S.panelScroll) p.scrollTop = S.panelScroll;
}
function markPanel(b, c) {
  const p = $('#panel'); if (!p) return;
  p.querySelectorAll('.pbook').forEach(x => x.classList.toggle('cur', x.dataset.pb === b));
  p.querySelectorAll('[data-pc]').forEach(x => x.classList.toggle('last', S.panelBook === b && +x.dataset.pc === c));
}
if (WIDE.addEventListener) WIDE.addEventListener('change', () => { if (S.meta) render(); });

// ------------------------------------------------------------------ selector de versión (estilo JW Library)
function versionBtn() {
  const m = versionMeta(S.settings.main) || RV_META;
  const n = Math.max(0, (S.settings.texts || []).filter(id => id !== S.settings.main && versionMeta(id)).length);
  return `<button class="vbtn" id="ver" aria-label="${t('Versión')}: ${esc(m.name)}">${esc(m.abbr)}${n ? `<span class="vplus">+${n}</span>` : ''}${icon('down')}</button>`;
}
function bindVersionBtn(after) { const b = $('#ver'); if (b) b.onclick = () => openVersionSheet(after); }

function openVersionSheet(after) {
  const st = S.settings;
  const byLang = new Map();
  for (const v of allVersions()) { const k = (v.lang || 'und').toLowerCase().split('-')[0]; if (!byLang.has(k)) byLang.set(k, []); byLang.get(k).push(v); }
  const langs = [...byLang.keys()].sort((a, b) => (a === uiLang() ? -1 : b === uiLang() ? 1 : langName(a).localeCompare(langName(b))));
  const rows = () => langs.map(l => `<div class="sec-title" style="margin-top:6px">${esc(langName(l))}</div><div class="setgroup">${byLang.get(l).map(v => {
    const isMain = st.main === v.id, cmp = (st.texts || []).includes(v.id) || isMain;
    return `<div class="setrow vrow ${isMain ? 'main' : ''}">
      <button class="vpick" data-main="${v.id}" aria-pressed="${isMain}"><span class="radio" aria-hidden="true"></span>
        <span class="lb">${esc(v.name)}<small>${esc(v.abbr)} · ${v.builtin ? t('Incluida · alineada palabra por palabra') : t('Importada')}</small></span></button>
      <label class="cmp"><input type="checkbox" class="toggle" data-cmp="${v.id}" ${cmp ? 'checked' : ''} ${isMain ? 'disabled' : ''} aria-label="${t('Comparar')} ${esc(v.abbr)}"><span>${t('Comparar')}</span></label>
    </div>`; }).join('')}</div>`).join('');
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${t('Versiones')}</div><div class="sub">${t('Toca una versión para que sea la principal. Activa «Comparar» para verla en paralelo (hasta 4).')}</div>`,
    `<div id="vlist">${rows()}</div>
     <div class="btnrow"><button class="btn ghost" id="go-imp">${icon('download')}${t('Importar otra Biblia (EPUB)')}</button></div>`, t('Versiones'));
  const bind = () => {
    sh.querySelectorAll('[data-main]').forEach(b => b.onclick = () => {
      st.main = b.dataset.main;
      st.texts = [st.main, ...(st.texts || []).filter(x => x !== st.main)].slice(0, 4);
      saveSettings(); $('#vlist').innerHTML = rows(); bind(); refresh();
    });
    sh.querySelectorAll('[data-cmp]').forEach(i => i.onchange = () => {
      let tx = (st.texts || []).filter(x => x !== i.dataset.cmp);
      if (i.checked) tx.push(i.dataset.cmp);
      if (!tx.includes(st.main)) tx.unshift(st.main);
      if (tx.length > 4) { i.checked = false; toast(t('Puedes comparar hasta 4 versiones')); return; }
      st.texts = tx; saveSettings(); refresh();
    });
  };
  const refresh = () => { const keep = [...document.querySelectorAll('.scrim,.sheet')]; keep.forEach(k => k.remove()); Promise.resolve(after && after()).then(() => document.body.append(...keep)); };
  bind();
  sh.querySelector('#go-imp').onclick = () => go('opciones');
}

// ------------------------------------------------------------------ lector
const VIEWS = { int: 'Interlineal', par: 'Paralelo', read: 'Lectura' };

async function renderReader(r) {
  const m = bookById(r.b); if (!m) return go('');
  const st = S.settings;
  const view = st.view;
  const c = shell({
    title: `<button id="chsel" aria-label="${t('Elegir capítulo')}">${esc(bookName(m.id))} ${r.c} ${icon('down')}</button>`, tab: 'books', wide: view === 'par',
    left: `<button class="ibtn" id="bk" aria-label="${t('Volver a los libros')}">${icon('back')}</button>`,
    right: `${versionBtn()}<button class="ibtn" id="vw" aria-label="${t('Cambiar vista')} (${t(VIEWS[view])})" title="${t(VIEWS[view])}">${icon(view === 'par' ? 'cols' : 'layers')}</button>
            <button class="ibtn" id="aa" aria-label="${t('Opciones de lectura')}">${icon('text')}</button>`
  });
  $('#bk').onclick = () => { if (isWide()) { S.panelBook = m.ch === 1 ? null : m.id; renderPanel(); } else go(m.ch === 1 ? '' : `c-${m.id}`); };
  $('#chsel').onclick = () => { if (isWide()) { S.panelBook = m.id; renderPanel(); } else go(`c-${m.id}`); };
  $('#vw').onclick = () => { const k = Object.keys(VIEWS); st.view = k[(k.indexOf(st.view) + 1) % k.length]; saveSettings(); toast(t('Vista') + ': ' + t(VIEWS[st.view])); rerenderKeepScroll(); };
  $('#aa').onclick = () => openReadingSheet();
  bindVersionBtn(() => rerenderKeepScroll());
  c.innerHTML = `<div class="loading">${t('Cargando')} ${esc(bookName(m.id))}…</div>`;
  const [book, texts, notes] = await Promise.all([getBook(m.id), activeTexts(), getNotes().catch(() => null)]);
  if (S.route !== r) return;
  CUR_TEXTS = texts;
  const ch0 = book.chs.find(x => x.c === r.c);
  if (!ch0) return go(`c-${m.id}`);
  const focusV = r.focus ? ch0.vs.find(x => x.v === r.v) : null;
  if (r.focus && !focusV) return go(`r-${m.id}-${r.c}`);
  const ch = focusV ? { ...ch0, vs: [focusV] } : ch0;
  S.user.last = { b: m.id, c: r.c }; saveUser();

  const lang = book.lang, isHeb = lang === 'hbo';
  const hasSpur = !isHeb && st.spur && ch.vs.some(vs => vs.sp || vs.n != null || vs.w.some(w => /[!?]/.test(w[6])));
  const legend = [
    !isHeb && st.ed === 'all' && view === 'int' ? `<span><i>⟦ ⟧</i> ${t('palabra ausente en el texto crítico o en el Textus Receptus')}</span>` : '',
    hasSpur ? `<span><b class="lg spu"></b>${t('Espurio: ausente en los manuscritos más antiguos')}</span><span><b class="lg dub"></b>${t('Autenticidad debatida')}</span>` : '',
  ].join('');
  let html = `<div class="wrap reader ${view === 'read' ? 'reading' : ''} ${view === 'par' ? 'parw' : ''}">
    <div class="ch-head"><h2>${esc(bookName(m.id))} ${r.c}${focusV ? ':' + r.v : ''}</h2><span class="src">${isHeb ? t('Hebreo') : edLabel()} · ${esc(texts.map(x => x.abbr).join(' · '))}</span></div>
    ${legend ? `<div class="legend">${legend}</div>` : ''}`;
  if (view === 'par') html += parallelHTML(m.id, r.c, ch, lang, texts);
  else {
    if (view === 'read') html += `<div class="flow" dir="auto">`;
    for (const vs of ch.vs) html += verseHTML(m.id, r.c, vs, lang, view);
    if (view === 'read') html += `</div>`;
  }
  if (focusV) html += `<div class="focusbar"><button class="btn" id="fullch">${icon('books')}${t('Ver el capítulo completo')}</button>
    <span class="hint">${t('Versículo {v} de {n}', { v: r.v, n: ch0.vs.length })}</span></div>`;
  html += `<p class="hint" style="margin-top:24px">${isHeb ? t('LIC_OT') : t('LIC_NT')} · ${t('Español: Reina-Valera 1909 (dominio público).')}${texts.filter(x => x.id !== 'rv').map(x => ` · ${esc(bibleMeta(x.id).name)}: ${t('importada por el usuario.')}`).join('')}</p></div>
   <div class="pager"><button id="pv" aria-label="${t('Capítulo anterior')}">${icon('back')}</button><button id="nx" aria-label="${t('Capítulo siguiente')}">${icon('next')}</button></div>`;
  c.innerHTML = html;
  c._ch = { book, ch, lang, notes };

  if (focusV) {
    // versículo a versículo: ‹ › pasan al versículo anterior/siguiente (y cruzan capítulos)
    const i = ch0.vs.indexOf(focusV);
    const pc = neighbor(m.id, r.c, -1), nc = neighbor(m.id, r.c, 1);
    const pvT = i > 0 ? `f-${m.id}-${r.c}-${ch0.vs[i - 1].v}` : pc ? `last:${pc.b}-${pc.c}` : null;
    const nxT = i < ch0.vs.length - 1 ? `f-${m.id}-${r.c}-${ch0.vs[i + 1].v}` : nc ? `f-${nc.b}-${nc.c}-1` : null;
    const goT = async (h) => { if (h.startsWith('last:')) { const [bb, cc] = h.slice(5).split('-'); const bk = await getBook(bb); const cx = bk.chs.find(x => x.c === +cc); go(`f-${bb}-${cc}-${cx.vs[cx.vs.length - 1].v}`); } else go(h); };
    const pv = $('#pv'), nx = $('#nx');
    pv.setAttribute('aria-label', t('Versículo anterior')); nx.setAttribute('aria-label', t('Versículo siguiente'));
    if (pvT) pv.onclick = () => goT(pvT); else pv.disabled = true;
    if (nxT) nx.onclick = () => goT(nxT); else nx.disabled = true;
    $('#fullch').onclick = () => go(`r-${m.id}-${r.c}-${r.v}`);
    bindReader(c, m.id, r.c, lang);
    attachSwipe(c, pvT ? { f: () => goT(pvT) } : null, nxT ? { f: () => goT(nxT) } : null);
    c.scrollTop = 0;
    if (isWide()) markPanel(m.id, r.c);
    return;
  }
  const prev = neighbor(m.id, r.c, -1), next = neighbor(m.id, r.c, 1);
  const pv = $('#pv'), nx = $('#nx');
  if (prev) pv.onclick = () => go(`r-${prev.b}-${prev.c}`); else pv.disabled = true;
  if (next) nx.onclick = () => go(`r-${next.b}-${next.c}`); else nx.disabled = true;
  bindReader(c, m.id, r.c, lang);
  attachSwipe(c, prev, next);
  if (isWide()) markPanel(m.id, r.c);
  if (r.v != null) {
    const el = c.querySelector(`.verse[data-v="${r.v}"]`);
    const target = el && (getComputedStyle(el).display === 'contents' ? el.firstElementChild : el);
    if (target) { target.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1700); }
  } else c.scrollTop = 0;
}
async function rerenderKeepScroll() {
  const content = $('#content'); const y = content ? content.scrollTop : 0;
  const rr = S.route.focus ? { ...S.route } : { ...S.route, v: null }; S.route = rr;
  await renderReader(rr);
  const c2 = $('#content'); if (c2) c2.scrollTop = y;
}

function edLabel() { return { s: t('Griego · texto crítico (NA28)'), t: t('Griego · Textus Receptus'), all: t('Griego · todas las ediciones') }[S.settings.ed]; }

function neighbor(b, c, d) {
  const i = bookIdx(b), m = S.meta.books[i];
  if (d < 0) { if (c > 1) return { b, c: c - 1 }; const p = S.meta.books[i - 1]; return p ? { b: p.id, c: p.ch } : null; }
  if (c < m.ch) return { b, c: c + 1 }; const n = S.meta.books[i + 1]; return n ? { b: n.id, c: 1 } : null;
}

function rvHTML(vs, lab = '') {
  const segs = vs.rv;
  if (!segs || !segs.length) return '';
  const sp = verseSpur(vs), red = new Set(S.settings.spur ? vs.spr || [] : []);
  return `<div class="rvline ${sp ? 'sp-' + sp : ''}">${lab}${segs.map((s, i) => typeof s === 'string' ? esc(s)
    : `<span class="rvw ${red.has(i) ? 'spu' : ''}" data-ri="${i}">${esc(s[0])}</span>`).join('')}</div>`;
}

function textsHTML(b, c, vs, forceLab = false) {
  const many = forceLab || CUR_TEXTS.length > 1;
  const full = verseSpur(vs);
  return CUR_TEXTS.map(x => {
    const lab = many ? `<span class="vab">${esc(x.abbr)}</span>` : '';
    if (x.id === 'rv') return rvHTML(vs, lab);
    const tx = altText(x, b, c, vs.v);
    return tx ? `<div class="rvline alt ${full ? 'sp-' + full : ''}" dir="auto" lang="${esc(x.lang || '')}">${lab}${esc(tx)}</div>` : '';
  }).join('');
}

function marksHTML(key, vs) {
  const u = S.user;
  const tn = S.settings.spur && vs && vs.n != null
    ? `<button class="tnote ${vs.sp === 'dud' || (vs.w || []).some(w => (w[6] || '').includes('?')) ? 'dub' : 'spu'}" data-tn="${vs.v}" aria-label="${t('Nota textual')}">${icon('alert')}<span>${t('Nota textual')}</span></button>` : '';
  const lc = S.lect && S.lect.index[key] != null && vs ? `<button class="lchip" data-lc="${vs.v}" aria-label="${t('Lecturas alternativas')}">${icon('layers')}<span>${t('Lecturas')}</span></button>` : '';
  return `<span class="marks">${u.bm[key] ? icon('bookmark') : ''}${u.notes[key] || artIdx().main.has(key) ? icon('note') : ''}</span>${tn}${lc}`;
}

function verseHTML(b, c, vs, lang, view) {
  const st = S.settings, key = refKey(b, c, vs.v), isHeb = lang === 'hbo';
  const hl = S.user.hl[key] ? ` data-hl="${S.user.hl[key]}"` : '';
  const sp = verseSpur(vs);
  const vn = vs.v === 0 ? t('Tít.') : vs.v;
  const num = `<button class="vnum" data-vn="${vs.v}" aria-label="${t('Versículo')} ${vs.v}: ${t('opciones')}">${vn}</button>${marksHTML(key, vs)}`;
  if (view === 'read') {
    const t0 = CUR_TEXTS[0];
    let inner;
    if (t0.id === 'rv') {
      const red = new Set(st.spur ? vs.spr || [] : []);
      inner = (vs.rv || []).map((s, i) => typeof s === 'string' ? esc(s) : red.has(i) ? `<span class="spu">${esc(s[0])}</span>` : esc(s[0])).join('');
    } else inner = esc(altText(t0, b, c, vs.v));
    const tx = inner || `<span class="absent">[${t('sin texto en')} ${esc(t0.abbr)}]</span>`;
    return `<span class="verse ${sp ? 'sp-' + sp : ''}" data-v="${vs.v}"${hl}>${num} <span class="vtext">${tx}</span> </span>`;
  }
  const words = vs.w.map((w, i) => [w, i]).filter(([w]) => wordVisible(w, lang));
  let body = '';
  if (!words.length) body = `<div class="absent">${vs.w.length ? t('Versículo ausente en la edición seleccionada') : t('Sin texto original para este versículo')}</div>`;
  else body = `<div class="ilin ${isHeb ? 'rtl' : ''}">${words.map(([w, i]) => wordHTML(w, i, lang, vs.rv)).join('')}</div>`;
  if (st.rvInInt) body += textsHTML(b, c, vs);
  return `<div class="verse ${sp ? 'sp-' + sp : ''}" data-v="${vs.v}"${hl}>${num}${body}</div>`;
}

function wordHTML(w, i, lang, rv) {
  const st = S.settings, isHeb = lang === 'hbo';
  const [surf, tr, , , strong, morph, flag, rvi] = w;
  let g = '';
  if (st.gl) {
    if (st.gloss === 'rv' && rvi >= 0 && rv[rvi]) g = `<span class="g rvg">${esc(rv[rvi][0])}</span>`;
    else g = `<span class="g ${st.gloss === 'rv' ? 'dim' : ''}">${esc(glossOf(w, lang)) || '&nbsp;'}</span>`;
  }
  const sk = spurKind(flag);
  const cls = ['wd', wordVariant(w, lang) ? 'var' : '', sk, sk ? 'brk' : '', isHeb && flag === 'x' ? 'lxx' : ''].join(' ');
  return `<button class="${cls}" data-wi="${i}" ${rvi >= 0 ? `data-ri="${rvi}"` : ''}>
    <span class="o ${isHeb ? 'heb' : ''}">${isHeb ? hebForm(surf) : esc(surf)}</span>
    ${st.tr ? `<span class="t">${esc(trForm(tr, lang))}</span>` : ''}${g}
    ${st.mo ? `<span class="m">${esc(morphShort(morph, lang))}</span>` : ''}
    ${st.st ? `<span class="s">${esc(strong)}</span>` : ''}</button>`;
}

// vista paralela en columnas: una fila por versículo, una columna por versión
function parallelHTML(b, c, ch, lang, texts) {
  const st = S.settings, isHeb = lang === 'hbo';
  const cols = [];
  if (st.parOrig) cols.push({ id: 'orig', abbr: isHeb ? t('Hebreo') : t('Griego'), lang: isHeb ? 'he' : 'grc' });
  cols.push(...texts);
  if (cols.length === 1 && !st.parOrig) cols.unshift({ id: 'orig', abbr: isHeb ? t('Hebreo') : t('Griego') });
  const head = cols.map(x => {
    let miss = '';
    if (x.data) {
      const bk = x.data.books[b];
      miss = !bk ? t('no tiene este libro') : !bk[c] ? t('no tiene este capítulo') : '';
    }
    return `<div class="pc ph">${esc(x.abbr)}${miss ? `<span class="phmiss">${miss}</span>` : ''}</div>`;
  }).join('');
  const rows = ch.vs.map(vs => {
    const key = refKey(b, c, vs.v), hl = S.user.hl[key] ? ` data-hl="${S.user.hl[key]}"` : '';
    const sp = verseSpur(vs);
    const vn = vs.v === 0 ? t('Tít.') : vs.v;
    const num = `<button class="vnum" data-vn="${vs.v}" aria-label="${t('Versículo')} ${vs.v}: ${t('opciones')}">${vn}</button>`;
    const cells = cols.map((x, ci) => {
      let inner = '';
      if (x.id === 'orig') {
        const words = vs.w.map((w, i) => [w, i]).filter(([w]) => wordVisible(w, lang));
        inner = words.length ? `<div class="origline ${isHeb ? 'heb' : ''}">${words.map(([w, i]) => {
          const sk = spurKind(w[6]);
          return `<span data-wi="${i}" class="${sk}">${isHeb ? hebPlain(w[0]) : esc(w[0])}</span>`; }).join(' ')}</div>` : `<div class="absent">—</div>`;
      } else if (x.id === 'rv') {
        inner = rvHTML(vs) || `<div class="absent">—</div>`;
      } else {
        const tx = altText(x, b, c, vs.v);
        inner = tx ? `<div class="rvline alt ${sp ? 'sp-' + sp : ''}" dir="auto" lang="${esc(x.lang || '')}">${esc(tx)}</div>` : `<div class="absent">—</div>`;
      }
      const lab = cols.length > 1 ? `<span class="pab">${esc(x.abbr)}</span>` : '';
      return `<div class="pc ${sp ? 'sp-' + sp : ''}">${ci === 0 ? num + lab + marksHTML(key, vs) : `<span class="pvn">${vn}</span>${lab}`}${inner}</div>`;
    }).join('');
    return `<div class="verse prow" data-v="${vs.v}"${hl}>${cells}</div>`;
  }).join('');
  return `<div class="pscroll"><div class="pgrid" style="--n:${cols.length}">${head}${rows}</div></div>`;
}

function bindReader(c, b, ch, lang) {
  c.addEventListener('click', (e) => {
    const tn = e.target.closest('.tnote');
    if (tn) { openTextNote(b, ch, +tn.dataset.tn); return; }
    const lc = e.target.closest('.lchip');
    if (lc) { openLecturas(b, ch, +lc.dataset.lc); return; }
    const vn = e.target.closest('.vnum');
    if (vn) { openVerseSheet(b, ch, +vn.dataset.vn); return; }
    const wd = e.target.closest('[data-wi]');
    const verseEl = e.target.closest('.verse');
    if (wd && verseEl) { selectWord(c, verseEl, +wd.dataset.wi); openWordSheet(b, ch, +verseEl.dataset.v, +wd.dataset.wi, lang); return; }
    const rw = e.target.closest('.rvw');
    if (rw && verseEl) { litFromRV(c, verseEl, +rw.dataset.ri); return; }
    if (verseEl && verseEl.classList.contains('prow')) {
      const was = verseEl.classList.contains('rowsel');
      c.querySelectorAll('.rowsel').forEach(x => x.classList.remove('rowsel'));
      if (!was) verseEl.classList.add('rowsel');
    }
  });
}
function clearLit(c) { c.querySelectorAll('.lit,.sel').forEach(x => x.classList.remove('lit', 'sel')); }
function selectWord(c, verseEl, wi) {
  clearLit(c);
  verseEl.querySelectorAll(`[data-wi="${wi}"]`).forEach(w => w.classList.add('sel'));
  const w = verseEl.querySelector(`[data-wi="${wi}"]`);
  let ri = w && w.dataset.ri;
  if (ri == null && c._ch) { const d = c._ch.ch.vs.find(v => v.v === +verseEl.dataset.v); if (d && d.w[wi] && d.w[wi][7] >= 0) ri = d.w[wi][7]; }
  if (ri != null) verseEl.querySelectorAll(`.rvw[data-ri="${ri}"]`).forEach(x => x.classList.add('lit'));
}
function litFromRV(c, verseEl, ri) {
  clearLit(c);
  verseEl.querySelectorAll(`.rvw[data-ri="${ri}"]`).forEach(x => x.classList.add('lit'));
  const ws = verseEl.querySelectorAll(`.wd[data-ri="${ri}"]`);
  ws.forEach(x => x.classList.add('lit'));
  if (!ws.length) {
    const data = c._ch && c._ch.ch.vs.find(v => v.v === +verseEl.dataset.v);
    if (data) data.w.forEach((w, i) => { if (w[7] === ri) verseEl.querySelectorAll(`[data-wi="${i}"]`).forEach(x => x.classList.add('lit')); });
  }
}

function attachSwipe(c, prev, next) {
  let x0 = null, y0 = null, t0 = 0, inScroll = false;
  c.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    inScroll = !!e.target.closest('.pscroll') && $('.pscroll').scrollWidth > $('.pscroll').clientWidth + 4;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  c.addEventListener('touchend', e => {
    if (x0 == null || inScroll) { x0 = null; return; }
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Date.now() - t0 > 600 || Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (dx < 0 && next) { if (next.f) next.f(); else go(`r-${next.b}-${next.c}`); }
    if (dx > 0 && prev) { if (prev.f) prev.f(); else go(`r-${prev.b}-${prev.c}`); }
  }, { passive: true });
}

// ------------------------------------------------------------------ hojas
function closeSheet() { document.querySelectorAll('.scrim,.sheet').forEach(x => x.remove()); }
function openSheet(headHTML, bodyHTML, label) {
  closeSheet();
  const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.onclick = closeSheet;
  const sh = document.createElement('section'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', label);
  sh.innerHTML = `<div class="grab"></div><div class="sh-head"><div class="ttl">${headHTML}</div>
    <button class="ibtn" data-close aria-label="${t('Cerrar')}">${icon('close')}</button></div><div class="sh-body">${bodyHTML}</div>`;
  document.body.append(scrim, sh);
  sh.querySelector('[data-close]').onclick = closeSheet;
  sh.querySelector('[data-close]').focus();
  return sh;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

async function openTextNote(b, c, v) {
  const [book, notes] = await Promise.all([getBook(b), getNotes()]);
  const vs = book.chs.find(x => x.c === c).vs.find(x => x.v === v);
  const n = vs.n != null && vs.n >= 0 ? notes.notas[vs.n] : null;
  const words = vs.w.filter(w => /[!?]/.test(w[6]));
  const dub = n ? n.tipo === 'dud' : words.some(w => w[6].includes('?'));
  const range = n ? fmtRange(n.ref, n.hasta) : refLabel(b, c, v);
  const sh = openSheet(`<div class="tn-kind ${dub ? 'dub' : 'spu'}">${icon('alert')}${dub ? t('Autenticidad debatida') : t('Texto espurio')}</div>
    <div style="font-weight:700;font-size:18px;margin-top:4px">${esc(n ? n.titulo : t('Palabras añadidas en manuscritos tardíos'))}</div><div class="sub">${esc(range)}</div>`,
    `${uiLang() !== 'es' && n ? `<p class="hint">${t('(Nota en español)')}</p>` : ''}
     <p class="tn-text">${esc(n ? n.texto : t(notes.generica))}</p>
     ${words.length ? `<div class="h3">${t('Palabras griegas en cuestión')}</div><p class="tn-greek">${words.map(w => `<span class="${w[6].includes('?') ? 'dub' : 'spu'}">${esc(w[0])}</span>`).join(' ')}</p>` : ''}
     <div class="h3">${t('Cómo se marca')}</div>
     <p class="hint">${t('El rojo indica texto que falta en los manuscritos griegos más antiguos y que las ediciones críticas modernas (NA28) omiten o señalan como añadido. El ámbar indica pasajes cuya autenticidad los especialistas siguen debatiendo. La numeración de versículos se conserva por tradición.')}</p>
     ${n ? '' : `<p class="hint">${t(notes.generica)}</p>`}`, t('Nota textual'));
  sh.querySelector('.tn-text');
}
function fmtRange(a, z) {
  const [b1, c1, v1] = a.split('.'), [, c2, v2] = z.split('.');
  if (a === z) return `${bookName(b1)} ${c1}:${v1}`;
  return c1 === c2 ? `${bookName(b1)} ${c1}:${v1}-${v2}` : `${bookName(b1)} ${c1}:${v1}–${c2}:${v2}`;
}

async function openWordSheet(b, c, v, wi, lang) {
  const book = await getBook(b);
  const vs = book.chs.find(x => x.c === c).vs.find(x => x.v === v);
  const w = vs.w[wi];
  const [surf, tr, es, en, strong, morph, flag, rvi] = w;
  const isHeb = lang === 'hbo';
  const head = `<div class="lemma ${isHeb ? 'heb' : ''}">${isHeb ? hebForm(surf, true) : esc(surf)}</div>
    <div class="sub"><span><i>${esc(trForm(tr, lang))}</i></span>${strong ? `<span class="chip">${esc(strong)}</span>` : ''}<span>${esc(refLabel(b, c, v))}</span></div>`;
  const sh = openSheet(head, `<div class="loading">${t('Cargando léxico…')}</div>`, t('Análisis de la palabra'));
  let L = null;
  try { L = (await getLex(lang))[strong] || null; } catch {}
  const parts = decode(morph, lang);
  const surfParts = isHeb ? surf.replace(/\\.*/, '').split('/') : [surf];
  const parse = parts.map((p, i) => `<div class="pr"><b>${isHeb && surfParts.length === parts.length ? `<span style="font-family:var(--f-heb);font-size:1.15em">${esc(surfParts[i])}</span> · ` : ''}${esc(cap(p.pos))}</b>${p.feats.length ? ` <span>— ${esc(p.feats.join(', '))}</span>` : ''}</div>`).join('');
  const rvTxt = rvi >= 0 && vs.rv[rvi] ? vs.rv[rvi][0] : '';
  const eds = !isHeb ? edsText(flag) : (flag === 'x' ? t('Reconstruida desde la Septuaginta (BHS/BHK)') : flag === 'q' ? t('Qere (lectura marginal masorética)') : '');
  const sk = spurKind(flag);
  let body = `${sk ? `<button class="tnote big ${sk}" id="wtn">${icon('alert')}<span>${sk === 'dub' ? t('Autenticidad debatida') : t('Palabra espuria: ver nota textual')}</span></button>` : ''}
    <dl class="kv">
      ${L && L.l ? `<dt>${t('Lema')}</dt><dd><span style="font-family:${isHeb ? 'var(--f-heb)' : 'var(--f-text)'};font-size:1.25em">${esc(L.l)}</span> ${L.t ? `<i style="color:var(--ink-3)">${esc(trForm(L.t, lang))}</i>` : ''}</dd>` : ''}
      <dt>${t('Glosa')}</dt><dd style="color:var(--gloss);font-family:var(--f-text);font-size:1.08em">${esc(glossForm(es, lang)) || '—'}</dd>
      ${rvTxt ? `<dt>RV1909</dt><dd style="color:var(--rv);font-family:var(--f-text)">${esc(rvTxt)}</dd>` : ''}
      <dt>${t('Inglés')}</dt><dd style="color:var(--ink-2)">${esc(en)}</dd>
      ${eds ? `<dt>${t('Texto')}</dt><dd style="color:var(--ink-2)">${esc(eds)}</dd>` : ''}
    </dl>
    <div class="h3">${t('Morfología')} <span class="chip" style="margin-left:6px">${esc(morphShort(morph, lang))}</span></div>
    <div class="parse">${parse || '<div class="pr">—</div>'}</div>`;
  if (L && L.se && L.se.length) {
    const core = norm(String(es).split('/').pop());
    let ctxDone = false;
    body += `<div class="h3">${t('Sentidos')} · ${isHeb ? 'SDBH' : 'SDBG (Louw-Nida)'}</div><ol class="senses">${L.se.map(s => {
      const hit = isHeb && !ctxDone && core && norm(s[0]).split(', ').some(g => g === core || (core.length > 3 && core.startsWith(g)));
      if (hit) ctxDone = true;
      return `<li class="${hit ? 'ctx' : ''}"><b>${esc(s[0])}</b>${hit ? `<span class="here">${t('en este versículo')}</span>` : ''}${s[1] ? `<span class="d">${esc(s[1])}</span>` : ''}${s[2] ? `<span class="dom">${esc(s[2])}</span>` : ''}</li>`; }).join('')}</ol>`;
  }
  if (L && L.dn) body += `<details><summary>${t('Definición breve (inglés · Tyndale {lex})', { lex: isHeb ? 'TBESH' : 'TBESG' })}</summary><div class="defen">${esc(L.dn)}</div></details>`;
  if (S.works.length) body += `<div id="wdict"></div>`;
  body += `<div class="btnrow"><button class="btn" id="cc">${icon('conc')}${t('Concordancia')}</button>
    <button class="btn ghost" id="cpw">${icon('copy')}${t('Copiar')}</button></div>`;
  sh.querySelector('.sh-body').innerHTML = body;
  const wtn = sh.querySelector('#wtn'); if (wtn) wtn.onclick = () => openTextNote(b, c, v);
  if (S.works.length) dictHTML(strongBase(strong), [es, rvTxt]).then(h => { const el = sh.querySelector('#wdict'); if (el && h) { el.innerHTML = h; bindCites(el); } });
  sh.querySelector('#cc').onclick = () => { S.search = { q: strongBase(strong), page: 1 }; go('buscar'); };
  sh.querySelector('#cpw').onclick = () => copyText(`${isHeb ? hebPlain(surf).replace(/&[^;]+;/g, '') : surf} (${trForm(tr, lang)}) — ${strong} — ${glossForm(es, lang)} — ${morphShort(morph, lang)} — ${refLabel(b, c, v)}`);
}
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
function edsText(f) {
  const a = [];
  if (f.includes('s')) a.push(t('texto crítico')); if (f.includes('t')) a.push('Textus Receptus'); if (f.includes('b')) a.push(t('bizantino'));
  return a.length ? t('Presente en: ') + a.join(', ') : t('Solo en otras ediciones');
}
function strongBase(s) { const m = String(s).match(/^([HG])(\d+)/i); return m ? m[1].toUpperCase() + m[2].padStart(4, '0') : s; }

function openVerseSheet(b, c, v) {
  const key = refKey(b, c, v), u = S.user;
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${esc(refLabel(b, c, v))}</div>`, `
    <div class="h3" style="margin-top:4px">${t('Destacar')}</div>
    <div class="swatches">
      <button class="sw none" data-h="0" aria-label="${t('Sin destacado')}" aria-pressed="${!u.hl[key]}">${icon('close')}</button>
      ${[1, 2, 3, 4, 5].map(n => `<button class="sw" data-h="${n}" style="background:var(--hl${n})" aria-label="${t('Color')} ${n}" aria-pressed="${u.hl[key] === n}"></button>`).join('')}
    </div>
    <div class="h3">${t('Nota')}</div>
    <textarea class="note" id="note" placeholder="${t('Escribe tu nota de estudio…')}">${esc(u.notes[key] || '')}</textarea>
    <div class="btnrow">
      <button class="btn ghost" id="bm">${icon('bookmark')}${u.bm[key] ? t('Quitar marcador') : t('Agregar marcador')}</button>
      <button class="btn ghost" id="cprv">${icon('copy')}${t('Copiar')} ${esc(CUR_TEXTS[0].abbr)}</button>
      <button class="btn ghost" id="cpor">${icon('copy')}${t('Copiar original')}</button>
      <button class="btn ghost" id="addart">${icon('note')}${t('Pegar artículo')}</button>
      <button class="btn ghost" id="cmpv">${icon('layers')}${t('Comparar traducciones')}</button>
    </div>
    ${lectSummaryHTML(b, c, v)}
    ${artsForVerseHTML(b, c, v)}
    ${S.works.length ? `<div id="wcites"><div class="loading">${t('Buscando en tus obras de consulta…')}</div></div>` : ''}`, t('Opciones del versículo'));
  if (S.works.length) citesHTML(b, c, v).then(h => { const el = sh.querySelector('#wcites'); if (el) { el.innerHTML = h; bindCites(el); } });
  sh.querySelector('#addart').onclick = () => openArticleEditor({ ref: { b, c, v } });
  sh.querySelector('#cmpv').onclick = () => openCompare(b, c, v);
  const lo = sh.querySelector('#lectopen'); if (lo) lo.onclick = () => openLecturas(b, c, v);
  bindArts(sh);
  sh.querySelectorAll('[data-h]').forEach(btn => btn.onclick = () => {
    const n = +btn.dataset.h;
    if (n) u.hl[key] = n; else delete u.hl[key];
    saveUser();
    sh.querySelectorAll('[data-h]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.h === n)));
    const el = document.querySelector(`.verse[data-v="${v}"]`);
    if (el) { if (n) el.dataset.hl = n; else el.removeAttribute('data-hl'); }
  });
  const ta = sh.querySelector('#note');
  ta.oninput = debounce(() => { const x = ta.value.trim(); if (x) u.notes[key] = x; else delete u.notes[key]; saveUser(); refreshMarks(b, c, v); }, 400);
  sh.querySelector('#bm').onclick = (e) => {
    if (u.bm[key]) delete u.bm[key]; else u.bm[key] = Date.now();
    saveUser(); refreshMarks(b, c, v);
    e.currentTarget.innerHTML = `${icon('bookmark')}${u.bm[key] ? t('Quitar marcador') : t('Agregar marcador')}`;
    toast(u.bm[key] ? t('Marcador agregado') : t('Marcador quitado'));
  };
  getBook(b).then(book => {
    const vs = book.chs.find(x => x.c === c).vs.find(x => x.v === v);
    const t0 = CUR_TEXTS[0];
    const tx = t0.id === 'rv' ? (vs.rv || []).map(s => typeof s === 'string' ? s : s[0]).join('') : altText(t0, b, c, v);
    sh.querySelector('#cprv').onclick = () => copyText(`${tx} (${refLabel(b, c, v)}, ${t0.abbr})`);
    const lang = book.lang;
    const orig = vs.w.filter(w => wordVisible(w, lang)).map(w => lang === 'hbo' ? w[0].replace(/[\\/]/g, '') : w[0]).join(' ');
    sh.querySelector('#cpor').onclick = () => copyText(`${orig} (${refLabel(b, c, v)})`);
  });
}
function refreshMarks(b, c, v) {
  const el = document.querySelector(`.verse[data-v="${v}"] .marks`);
  if (el) el.innerHTML = `${S.user.bm[refKey(b, c, v)] ? icon('bookmark') : ''}${S.user.notes[refKey(b, c, v)] || artIdx().main.has(refKey(b, c, v)) ? icon('note') : ''}`;
}

function openReadingSheet() {
  const st = S.settings;
  const tg = (id, label, sub) => `<div class="setrow"><label for="${id}">${label}${sub ? `<small>${sub}</small>` : ''}</label><input type="checkbox" class="toggle" id="${id}" ${st[id.slice(2)] ? 'checked' : ''}></div>`;
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${t('Opciones de lectura')}</div>`, `
    <div class="seg" role="group" aria-label="${t('Vista')}" style="margin:4px 0 14px">
      ${Object.entries(VIEWS).map(([k, l]) => `<button data-view="${k}" aria-pressed="${st.view === k}">${t(l)}</button>`).join('')}
    </div>
    <div class="setgroup">
      <div class="setrow"><div class="lb">${t('Versiones')}<small>${esc(CUR_TEXTS.map(x => x.abbr).join(' · '))}</small></div><button class="btn ghost" id="o-ver">${icon('globe')}${t('Elegir')}</button></div>
      ${tg('o-spur', t('Marcar textos espurios'), t('Rojo: añadidos tardíos · Ámbar: debatidos'))}
      ${tg('o-parOrig', t('Columna del original en paralelo'), t('Hebreo o griego en la vista Paralelo'))}
    </div>
    <div class="setgroup">
      <div class="setrow"><label for="o-fs">${t('Tamaño de letra')}<small>${st.fs}px</small></label><input type="range" id="o-fs" min="14" max="28" value="${st.fs}" style="flex:1;max-width:50%;padding:0;border:0;background:none"></div>
      ${tg('o-tr', t('Transliteración'))}${tg('o-gl', t('Glosa'))}${tg('o-mo', t('Código morfológico'))}${tg('o-st', t('Número Strong'))}
      ${tg('o-rvInInt', t('Texto de las versiones bajo cada versículo'), t('En la vista interlineal'))}
      <div class="setrow"><label for="o-gloss">${t('Fuente de la glosa')}<small>${t('Léxica (SDBH/TAGNT) o palabra alineada de la RV1909')}</small></label>
        <select id="o-gloss"><option value="lex" ${st.gloss === 'lex' ? 'selected' : ''}>${t('Léxica')}</option><option value="rv" ${st.gloss === 'rv' ? 'selected' : ''}>RV1909</option></select></div>
      <div class="setrow"><label for="o-glossLang">${t('Idioma de la glosa')}</label>
        <select id="o-glossLang"><option value="es" ${st.glossLang === 'es' ? 'selected' : ''}>Español</option><option value="en" ${st.glossLang === 'en' ? 'selected' : ''}>English</option></select></div>
    </div>
    <div class="setgroup">
      ${tg('o-accents', t('Acentos masoréticos'), t('Cantilación (te‘amim) del hebreo'))}${tg('o-vowels', t('Vocales hebreas'), 'Niqqud')}${tg('o-morphemes', t('Separar morfemas hebreos'), t('Prefijos / raíz / sufijos'))}
      <div class="setrow"><label for="o-ed">${t('Texto griego')}</label>
        <select id="o-ed"><option value="s" ${st.ed === 's' ? 'selected' : ''}>${t('Crítico (NA28)')}</option><option value="t" ${st.ed === 't' ? 'selected' : ''}>Textus Receptus</option><option value="all" ${st.ed === 'all' ? 'selected' : ''}>${t('Todas (con variantes)')}</option></select></div>
    </div>`, t('Opciones de lectura'));
  const keepRerender = async () => {
    const keep = [...document.querySelectorAll('.scrim,.sheet')]; keep.forEach(k => k.remove());
    await rerenderKeepScroll(); document.body.append(...keep);
  };
  sh.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
    st.view = b.dataset.view; saveSettings();
    sh.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    keepRerender();
  });
  sh.querySelectorAll('input.toggle').forEach(i => i.onchange = () => { st[i.id.slice(2)] = i.checked; saveSettings(); keepRerender(); });
  sh.querySelector('#o-ver').onclick = () => openVersionSheet(() => rerenderKeepScroll());
  sh.querySelector('#o-fs').oninput = (e) => { st.fs = +e.target.value; e.target.previousElementSibling.querySelector('small').textContent = st.fs + 'px'; saveSettings(); };
  for (const k of ['gloss', 'glossLang', 'ed']) sh.querySelector('#o-' + k).onchange = (e) => { st[k] = e.target.value; saveSettings(); keepRerender(); };
}

// ------------------------------------------------------------------ búsqueda
function renderSearch() {
  const c = shell({ title: t('Buscar'), tab: 'search' });
  c.innerHTML = `<div class="wrap">
    <form class="searchbar" id="sf" role="search"><input id="sq" type="search" placeholder="${t('Referencia (Jn 3:16), palabra, frase o Strong (G26)')}" value="${esc(S.search.q)}" autocomplete="off" aria-label="${t('Buscar')}"><button class="btn" type="submit" aria-label="${t('Buscar')}">${icon('search')}</button></form>
    ${S.bibles.length ? `<div class="setrow" style="padding:0 2px 12px;min-height:0"><label for="sin">${t('Buscar en')}</label><select id="sin">${allVersions().map(x => `<option value="${x.id}" ${S.settings.searchIn === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}
    <div id="sr"><p class="hint">${t('Escribe una referencia como «Juan 3:16», «1 Co 13:4-7», «Ro 8» o «Jn 3:16; 14:6» para ver el texto en todas tus versiones. También puedes buscar palabras en el texto, lemas de los léxicos o un número Strong (H430, G26) para ver su concordancia.')}</p>
      <div class="chips">${['Juan 3:16', 'Salmo 23', '1 Co 13:4-7', 'Mr 16:9-20', 'G26', 'amor'].map(x => `<button class="qchip" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div></div></div>`;
  const run = () => { S.search = { q: $('#sq').value.trim(), page: 1, f: S.search.f || 'all' }; doSearch(); };
  $('#sf').onsubmit = (e) => { e.preventDefault(); run(); };
  c.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { $('#sq').value = b.dataset.q; run(); });
  const sin = $('#sin'); if (sin) sin.onchange = () => { S.settings.searchIn = sin.value; saveSettings(); if (S.search.q) doSearch(); };
  if (S.search.q) doSearch(); else $('#sq').focus();
}

// --- referencias: "Jn 3:16", "Juan 3:16-18", "1 Co 13", "John 3:16; 14:6", "Jn 7:53-8:11", "Sal 23.1,4"
function findBook(s) {
  let n = norm(s).replace(/\./g, ' ').replace(/\s+/g, ' ').trim().replace(/^([123])\s*(?=[a-z])/, '$1 ');
  if (!n) return null;
  const nn = (x) => norm(x).replace(/\./g, '').replace(/^([123])\s*(?=[a-z])/, '$1 ');
  // prioridad: idioma de la app y español; luego los demás idiomas (evita que «Jn» sea Jonás en portugués)
  const order = [uiLang(), 'es', ...Object.keys(ALL_BOOK_NAMES)].filter((x, i, a) => a.indexOf(x) === i);
  for (const lg of order) for (const b of S.meta.books) {
    const cands = lg === 'es' ? [b.name, b.abbr] : (ALL_BOOK_NAMES[lg] && ALL_BOOK_NAMES[lg][b.id]) || [];
    if (cands.map(nn).includes(n)) return b.id;
  }
  return matchBook(n, false) || matchBook(n, true);
}
function findBookExact(s) {
  const n = norm(s).replace(/\./g, ' ').replace(/\s+/g, ' ').trim().replace(/^([123])\s*(?=[a-z])/, '$1 ');
  if (n.length < 3) return null;
  for (const b of S.meta.books) {
    const names = [b.name, ...Object.values(ALL_BOOK_NAMES).map(L => L[b.id] && L[b.id][0]).filter(Boolean)];
    if (names.some(x => norm(x) === n)) return b.id;
  }
  return matchBook(n, false);
}
function parseRefs(q) {
  const out = []; let lastBook = null, lastCh = null;
  for (const part of q.split(';').map(x => x.trim()).filter(Boolean)) {
    const m = part.match(/^(.*?[a-zA-ZÀ-ÿ].*?)?\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?(?:\s*-\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?)?((?:\s*,\s*\d{1,3}(?:\s*-\s*\d{1,3})?)*)\s*$/);
    if (!m) return null;
    let [, bk, a, b, c2, d, more] = m;
    let book = bk ? findBook(bk) : lastBook;
    if (!book) return null;
    let ch = +a, v1 = b ? +b : null;
    // "3:16" sin libro en una lista: usar el libro anterior; "16" solo: versículo del capítulo anterior
    if (!bk && !b && lastCh && part.match(/^\d+(\s*-\s*\d+)?$/)) { v1 = ch; ch = lastCh; }
    const meta = bookById(book);
    if (!meta) return null;
    if (meta.ch === 1 && v1 == null && bk) { v1 = ch; ch = 1; }
    if (ch < 1 || ch > meta.ch) return null;
    let r = { b: book, c1: ch, v1, c2: ch, v2: v1 };
    if (c2 != null) { if (d != null) { r.c2 = +c2; r.v2 = +d; } else if (v1 != null) r.v2 = +c2; else { r.c2 = +c2; } }
    out.push(r);
    if (more) for (const x of more.split(',').map(s => s.trim()).filter(Boolean)) {
      const [p, q2] = x.split('-').map(Number);
      out.push({ b: book, c1: r.c2, v1: p, c2: r.c2, v2: q2 || p });
    }
    lastBook = book; lastCh = r.c2;
  }
  return out.length ? out : null;
}
function refRangeLabel(r) {
  if (r.v1 == null) return r.c1 === r.c2 ? refLabel(r.b, r.c1) : `${bookName(r.b)} ${r.c1}-${r.c2}`;
  if (r.c1 === r.c2) return `${bookName(r.b)} ${r.c1}:${r.v1}${r.v2 !== r.v1 ? '-' + r.v2 : ''}`;
  return `${bookName(r.b)} ${r.c1}:${r.v1}–${r.c2}:${r.v2}`;
}

async function showRefs(out, refs) {
  const texts = await activeTexts(); CUR_TEXTS = texts;
  let html = '';
  let total = 0;
  for (const r of refs) {
    const book = await getBook(r.b);
    const verses = [];
    for (const ch of book.chs) {
      if (ch.c < r.c1 || ch.c > r.c2) continue;
      for (const vs of ch.vs) {
        if (r.v1 != null && ch.c === r.c1 && vs.v < r.v1) continue;
        if (r.v1 != null && ch.c === r.c2 && vs.v > r.v2) continue;
        verses.push([ch.c, vs]);
      }
    }
    if (!verses.length) { html += `<div class="refcard"><div class="refh"><b>${esc(refRangeLabel(r))}</b></div><p class="hint">${t('Ese versículo no existe en este libro.')}</p></div>`; continue; }
    const shown = verses.slice(0, 40); total += shown.length;
    const lang = book.lang, isHeb = lang === 'hbo';
    html += `<div class="refcard"><div class="refh"><b>${esc(refRangeLabel(r))}</b><button class="btn ghost sm" data-go-ref="r-${r.b}-${shown[0][0]}-${shown[0][1].v}">${icon('open')}${t('Abrir en el lector')}</button></div>
      ${shown.map(([c, vs]) => {
        const sp = verseSpur(vs);
        const words = vs.w.filter(w => wordVisible(w, lang));
        const orig = words.length ? `<div class="origline ${isHeb ? 'heb' : ''}">${words.map(w => `<span class="${spurKind(w[6])}">${isHeb ? hebPlain(w[0]) : esc(w[0])}</span>`).join(' ')}</div>` : '';
        return `<div class="refv ${sp ? 'sp-' + sp : ''}"><button class="vnum" data-go-ref="r-${r.b}-${c}-${vs.v}">${r.c1 !== r.c2 ? c + ':' : ''}${vs.v}</button>
          ${vs.n != null && S.settings.spur ? `<button class="tnote ${sp === 'dud' ? 'dub' : 'spu'}" data-tnr="${r.b}.${c}.${vs.v}">${icon('alert')}<span>${t('Nota textual')}</span></button>` : ''}
          ${orig}${textsHTML(r.b, c, vs, true)}</div>`;
      }).join('')}
      ${verses.length > shown.length ? `<p class="hint">${t('Se muestran los primeros 40 versículos.')}</p>` : ''}</div>`;
  }
  out.innerHTML = `<p class="hint">${t('{n} versículos en {v} versiones', { n: nf(total), v: texts.length })} · <button class="linkbtn" id="ref-ver">${t('Cambiar versiones')}</button></p>${html}`;
  out.querySelectorAll('[data-go-ref]').forEach(b => b.onclick = () => go(b.dataset.goRef));
  out.querySelectorAll('[data-tnr]').forEach(b => b.onclick = () => { const [bb, c, v] = b.dataset.tnr.split('.'); openTextNote(bb, +c, +v); });
  $('#ref-ver').onclick = () => openVersionSheet(() => showRefs(out, refs));
  if (S.works.length && refs.length === 1 && refs[0].v1 != null && refs[0].c1 === refs[0].c2 && refs[0].v2 - refs[0].v1 < 3) {
    const r = refs[0]; let h = '';
    for (let v = r.v1; v <= r.v2; v++) h += await citesHTML(r.b, r.c1, v, r.v2 > r.v1);
    if (h) { const d = document.createElement('div'); d.innerHTML = h; out.append(d); bindCites(d); }
  }
}

async function doSearch() {
  const out = $('#sr'); const q = S.search.q;
  if (!q) return;
  out.innerHTML = `<div class="loading">${t('Buscando…')}</div>`;
  const PAGE = 150;
  let results = [], header = '';
  try {
    const sm = q.match(/^\s*([HGhg])\s*0*(\d{1,4})[a-zA-Z]?\s*$/);
    if (sm) {
      const key = sm[1].toUpperCase() + sm[2].padStart(4, '0');
      const [conc, rv, lex] = await Promise.all([getConc(), getRV(), getLex(key[0] === 'H' ? 'hbo' : 'grc')]);
      const refs = [...new Set(conc[key] || [])];
      const L = lexMain(lex, key);
      header = `<div class="setgroup" style="padding:14px"><div class="lemma ${key[0] === 'H' ? 'heb' : ''}" style="font-size:26px">${esc(L ? L.l : key)}</div>
        <div class="sub"><span class="chip">${key}</span>${L && L.t ? `<i>${esc(L.t)}</i>` : ''}${L && L.ge ? `<span style="color:var(--gloss)">${esc(L.ge)}</span>` : ''}<span>${nf(refs.length)} ${t('versículos')}</span></div></div>`;
      const rvMap = rvIndex(rv);
      results = refs.map(r => { const [bi, c, v] = r.split('.').map(Number); return { bi, c, v, t: rvMap.get(r) || '' }; });
      renderResults(out, header, results, PAGE, null, refs.length ? '' : t('Ese número Strong no aparece en el texto.'));
      return;
    }
    // ¿es una referencia bíblica?
    if (/\d/.test(q)) {
      const refs = parseRefs(q);
      if (refs) return showRefs(out, refs);
    }
    await wordSearch(out, q);
  } catch (e) {
    out.innerHTML = `<div class="empty">${t('No se pudo completar la búsqueda:')} ${esc(e.message)}</div>`;
  }
}
// ------------------------------------------------------------------ búsqueda de palabras
// «familia» encuentra familia, familias, familiar, familiarizarse…; entre comillas («"familia"») solo esa forma
// exacta, y varias palabras entre comillas, la frase exacta.
const DIVINE = { jehova: 'H3068', jehovah: 'H3068', yahweh: 'H3068', yahve: 'H3068', yave: 'H3068', yahveh: 'H3068', jahve: 'H3068', jahveh: 'H3068',
  yhvh: 'H3068', yhwh: 'H3068', jhvh: 'H3068', iehova: 'H3068', tetragramaton: 'H3068', jah: 'H3050', yah: 'H3050' };
function stemEs(w) {
  if (w.length <= 4) return w;
  let s = w;
  if (/[^aeiou]es$/.test(s) && s.length > 5) s = s.slice(0, -2);        // ciudades → ciudad
  else if (/s$/.test(s)) s = s.slice(0, -1);                             // familias → familia
  if (/[aeo]$/.test(s) && s.length > 4) s = s.slice(0, -1);              // familia → famili
  return s.length >= 4 ? s : w;
}
function makeMatcher(q) {
  const quoted = /^\s*["“«].*["”»]\s*$/.test(q);
  const nq = norm(q).replace(/["“”«»]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = nq.split(' ').filter(Boolean);
  if (quoted) {
    const phrase = ' ' + nq + ' ';
    const marks = [...words]; marks.exact = true;
    return { words, marks, exact: true, nq, test: (nt) => nt.includes(phrase) };
  }
  const stems = words.map(stemEs);
  const esc_ = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // «en», «el», «fe»: palabra exacta; raíces cortas («amor»): hasta 3 letras más; el resto, cualquier terminación
  const pat = (st) => esc_(st) + (st.length <= 3 ? '' : st.length < 5 ? '[\\p{L}\\p{N}]{0,3}' : '[\\p{L}\\p{N}]*');
  const tests = stems.map(st => { const re = new RegExp(' ' + pat(st) + '(?= )', 'u'); return (nt) => re.test(nt); });
  const marks = [...stems];
  marks.res = stems.filter(st => st.length > 3 || stems.length === 1).map(st => new RegExp('(?<![\\p{L}\\p{N}])' + pat(st) + '(?![\\p{L}\\p{N}])', 'gu'));
  return { words, marks, exact: false, nq, test: (nt) => tests.every(f => f(nt)) };
}
const plainNorm = (tx) => ' ' + norm(tx).replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';

const SFILTERS = [['all', 'Todo'], ['works', 'Obras de consulta'], ['dict', 'Diccionario'], ['bible', 'Biblia']];
// entrada principal de un número Strong: la variante con el lema más repetido (H3068G es «YHVH-shalom», no YHVH)
const _lexMain = new WeakMap();
function lexMain(lex, base) {
  let m = _lexMain.get(lex);
  if (!m) { m = new Map(); for (const [k, L] of Object.entries(lex)) { const b = strongBase(k); if (!m.has(b)) m.set(b, []); m.get(b).push(L); } _lexMain.set(lex, m); }
  const vs = m.get(base) || []; if (vs.length < 2) return vs[0];
  const key = (L) => norm(L.l).replace(/[^\p{L}]/gu, '');
  const cnt = new Map(); for (const L of vs) cnt.set(key(L), (cnt.get(key(L)) || 0) + 1);
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return vs.find(L => key(L) === top);
}
async function wordSearch(out, q) {
  const M = makeMatcher(q);
  if (!M.words.length) { out.innerHTML = ''; return; }
  const scope = S.settings.searchIn !== 'rv' && bibleMeta(S.settings.searchIn) ? S.settings.searchIn : 'rv';
  const [rv, heb, grk] = await Promise.all([scope === 'rv' ? getRV() : flatBible(scope), getLex('hbo'), getLex('grc')]);
  const nq = M.nq, best = [];

  // libro de la Biblia con ese nombre (en cualquier idioma)
  const onlyBook = q.trim().length >= 3 ? (findBookExact(q.replace(/["“”«»]/g, '')) || null) : null;
  if (onlyBook) best.push(`<button class="best" data-go-ref="${bookById(onlyBook).ch === 1 ? `r-${onlyBook}-1` : `c-${onlyBook}`}"><span class="bk">${icon('books')}</span><span><b>${esc(bookName(onlyBook))}</b><small>${t('Abrir el libro')}</small></span></button>`);

  // obras de consulta: artículo cuyo título coincide → «mejor coincidencia»; luego títulos parecidos y el texto
  const works = [];
  for (const w of S.works) {
    const d = await getWork(w.id); if (!d) continue;
    d.entries.forEach(([ti, tx], ei) => {
      const nt = norm(ti).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (nt === nq || nt.replace(/ (i|ii|iii|iv|v|vi|\d)$/, '') === nq || (d.heads && d.heads[ei] && d.heads[ei].includes(nq))) { works.push({ w, ei, at: null, rank: 0, ti, tx }); return; }
      const pt = ' ' + nt + ' ';
      if (M.test(pt)) { works.push({ w, ei, at: null, rank: 1, ti, tx }); return; }
      if (M.words.join('').length < 3) return;
      const ntx = plainNorm(tx);
      if (M.test(ntx)) { const at = Math.max(0, norm(tx).indexOf(M.marks[0])); works.push({ w, ei, at, rank: 2, ti, tx }); }
    });
  }
  works.sort((a, b) => a.rank - b.rank);
  for (const x of works.filter(x => x.rank === 0).slice(0, 4))
    best.push(`<button class="best wcite" data-wid="${x.w.id}" data-ei="${x.ei}" data-at=""><span class="bk">${icon('books')}</span><span><b>${esc(x.ti)}</b><small>${esc(x.w.name)} · ${esc(snippet(x.tx, 0, 140))}</small></span></button>`);

  // diccionario (léxicos con número Strong): nombre divino, lema, transliteración o glosa; luego las definiciones
  const dict = [], seen = new Set();
  const addLex = (base, lang, rank) => { if (seen.has(base)) return; seen.add(base); dict.push({ k: base, L: lexMain(lang === 'hbo' ? heb : grk, base), lang, rank }); };
  const alias = DIVINE[nq.replace(/\s/g, '')];
  for (const [lang, lex] of [['hbo', heb], ['grc', grk]]) for (const [k, L] of Object.entries(lex)) {
    const base = strongBase(k);
    if (alias && base === alias) { addLex(base, lang, 0); continue; }
    if ([L.l, L.t, L.ge, L.gn].some(x => norm(x).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === nq)) addLex(base, lang, 0);
  }
  for (const [lang, lex] of [['hbo', heb], ['grc', grk]]) for (const [k, L] of Object.entries(lex)) {
    if (dict.length >= 120) break;
    const base = strongBase(k); if (seen.has(base)) continue;
    if (M.test(plainNorm(`${L.ge} ${L.gn}`))) addLex(base, lang, 1);
    else if (M.test(plainNorm(L.se))) addLex(base, lang, 2);
  }
  dict.sort((a, b) => a.rank - b.rank);
  // la entrada principal de cada número: la variante sin letra o la primera
  for (const x of dict.filter(x => x.rank === 0).slice(0, 3))
    best.push(`<button class="best" data-strong="${esc(x.k)}"><span class="bk sg">${esc(x.k)}</span><span><b class="${x.lang === 'hbo' ? 'heb' : 'grk'}">${esc(x.L.l)}</b> <i>${esc(x.L.t || '')}</i><small>${esc(x.L.ge || x.L.gn)} · ${t('Ver su concordancia')}</small></span></button>`);

  // Biblia
  const bible = [];
  for (const [bi, c, v, tx] of rv) if (M.test(plainNorm(tx))) bible.push({ bi, c, v, t: tx });

  const counts = { works: works.length, dict: dict.length, bible: bible.length };
  counts.all = counts.works + counts.dict + counts.bible;
  let f = S.search.f || 'all'; if (f !== 'all' && !counts[f]) f = 'all';
  const chips = `<div class="sfilters" role="tablist">${SFILTERS.map(([k, l]) => `<button role="tab" data-sf="${k}" aria-selected="${f === k}" ${k !== 'all' && !counts[k] ? 'disabled' : ''}>${t(l)}<span>${nf(counts[k])}</span></button>`).join('')}</div>`;
  const how = M.exact ? t('Forma exacta. Quita las comillas para incluir las palabras de la misma familia.')
    : t('Incluye palabras de la misma familia ({w}…). Escríbela entre comillas para buscar solo esa forma.', { w: M.marks.filter(x => x.length > 3).join(', ') || M.words.join(', ') });

  const worksList = (arr) => `<div class="results">${arr.map(x => entryBtn(x.w.id, x.ei, x.at, `${x.ti} · ${x.w.name}`, x.rank === 2 ? snippet(x.tx, x.at, 200) : snippet(x.tx, 0, 160), M.marks)).join('')}</div>`;
  const dictList = (arr) => `<div class="results">${arr.map(x => `<button class="res" data-strong="${esc(x.k)}"><span class="ref">${esc(x.k)}</span><span style="font-family:${x.lang === 'hbo' ? 'var(--f-heb)' : 'var(--f-text)'}">${esc(x.L.l)}</span> <i style="color:var(--ink-3)">${esc(x.L.t || '')}</i> — <span style="color:var(--gloss)">${esc(x.L.ge || x.L.gn)}</span></button>`).join('')}</div>`;
  const more = (k, n) => `<button class="linkbtn seeall" data-sf="${k}">${t('Ver los {n}', { n: nf(n) })} ›</button>`;

  let body = '';
  if (f === 'all') {
    if (best.length) body += `<div class="h3 besth">${t('Mejor coincidencia')}</div><div class="bests">${best.join('')}</div>`;
    if (works.length) body += `<div class="h3">${t('Obras de consulta')}</div>${worksList(works.filter(x => x.rank > 0).slice(0, 5))}${works.length > 5 ? more('works', works.length) : ''}`;
    if (dict.length) body += `<div class="h3">${t('Diccionario')}</div>${dictList(dict.slice(0, 5))}${dict.length > 5 ? more('dict', dict.length) : ''}`;
    if (bible.length) body += `<div class="h3">${esc(versionMeta(scope).name)}</div>`;
  } else if (f === 'works') body = worksList(works.slice(0, 200));
  else if (f === 'dict') body = dictList(dict);
  else body = `<div class="h3" style="margin-top:4px">${esc(versionMeta(scope).name)}</div>`;

  const header = chips + `<p class="hint shint">${how}</p>` + body;
  if (f === 'all' || f === 'bible') {
    const list = f === 'all' ? bible.slice(0, 20) : bible;
    renderResults(out, header, list, f === 'all' ? 20 : 150, M.marks, counts.all || onlyBook ? '' : t('No hay resultados para «{q}».', { q }));
    if (f === 'all' && bible.length > 20) { const d = document.createElement('div'); d.innerHTML = more('bible', bible.length); out.append(d); }
    const ph = out.querySelector('p.hint:not(.shint)'); if (ph && f === 'all') ph.remove();
  } else {
    out.innerHTML = header;
    out.querySelectorAll('[data-go-ref]').forEach(b => b.onclick = () => go(b.dataset.goRef));
    out.querySelectorAll('[data-strong]').forEach(b => b.onclick = () => { S.search = { q: b.dataset.strong, page: 1 }; $('#sq').value = b.dataset.strong; doSearch(); });
  }
  out.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { S.search.f = b.dataset.sf; S.search.page = 1; doSearch(); $('#content').scrollTop = 0; });
  bindCites(out);
}
async function flatBible(id) {
  const d = await getBible(id); const rows = [];
  S.meta.books.forEach((m, bi) => { const b = d.books[m.id]; if (!b) return;
    for (const c of Object.keys(b).map(Number).sort((x, y) => x - y)) for (const v of Object.keys(b[c]).map(Number).sort((x, y) => x - y)) rows.push([bi, c, v, b[c][v]]); });
  return rows;
}
let _rvIdx = null;
function rvIndex(rv) { if (!_rvIdx) { _rvIdx = new Map(); for (const [bi, c, v, tx] of rv) _rvIdx.set(`${bi}.${c}.${v}`, tx); } return _rvIdx; }
function hilite(tx, words) {
  if (!words || !words.length) return esc(tx);
  const nt = norm(tx); const marks = [];
  const isL = (ch) => /[\p{L}\p{N}]/u.test(ch || '');
  if (words.res) for (const re of words.res) { re.lastIndex = 0; let m; while ((m = re.exec(nt))) { marks.push([m.index, m.index + m[0].length]); if (!m[0].length) re.lastIndex++; } }
  else for (const w of words) {
    if (!w) continue;
    let i = nt.indexOf(w);
    while (i >= 0) {
      if (!isL(nt[i - 1])) { let b = i + w.length; if (!words.exact) while (b < nt.length && isL(nt[b])) b++; if (!isL(nt[b])) marks.push([i, b]); }
      i = nt.indexOf(w, i + w.length);
    }
  }
  if (!marks.length) return esc(tx);
  marks.sort((a, b) => a[0] - b[0]);
  let out = '', p = 0;
  for (const [a, b] of marks) { if (a < p) continue; out += esc(tx.slice(p, a)) + '<mark>' + esc(tx.slice(a, b)) + '</mark>'; p = b; }
  return out + esc(tx.slice(p));
}
function renderResults(out, header, results, PAGE, words, emptyMsg) {
  const n = S.search.page * PAGE;
  out.innerHTML = header + (results.length ? `<p class="hint">${nf(results.length)} ${results.length === 1 ? t('versículo') : t('versículos')}</p>` : '') +
    `<div class="results">${results.slice(0, n).map(r => {
      const b = S.meta.books[r.bi];
      return `<button class="res" data-go-ref="r-${b.id}-${r.c}-${r.v}" dir="auto"><span class="ref">${esc(bookAbbr(b.id))} ${r.c}:${r.v}</span>${hilite(r.t, words)}</button>`;
    }).join('')}</div>` +
    (results.length > n ? `<div class="btnrow"><button class="btn ghost" id="more">${t('Mostrar más')}</button></div>` : '') +
    (emptyMsg ? `<div class="empty">${esc(emptyMsg)}</div>` : '');
  out.querySelectorAll('[data-go-ref]').forEach(b => b.onclick = () => go(b.dataset.goRef));
  out.querySelectorAll('[data-strong]').forEach(b => b.onclick = () => { S.search = { q: b.dataset.strong, page: 1 }; $('#sq').value = b.dataset.strong; doSearch(); });
  const more = $('#more'); if (more) more.onclick = () => { S.search.page++; renderResults(out, header, results, PAGE, words, emptyMsg); };
}

// ------------------------------------------------------------------ notas
let notesTab = 'hl';
async function renderWelcome() {
  const W = await import('./bienvenida.js');
  const again = !!lsGet('welcomed');
  app.innerHTML = W.welcomeHTML(t, icon, again);
  document.title = t('Biblia Interlineal');
  const done = (w) => {
    lsSet('welcomed', w);
    if (w === 'apk' || w === 'exe') toast(t('Descargando… Mientras tanto, puedes seguir en la web.'));
    if (again) go(''); else { history.replaceState(null, '', location.pathname + location.search); render(); }
  };
  W.fillCTA(app, t, icon, done, again);
  const pl = app.querySelector('.w-foot a'); if (pl) pl.onclick = () => lsSet('welcomed', 'web');
}

async function renderPrinciples() {
  const c = shell({ title: t('Principios de esta app'), tab: 'options', left: `<button class="ibtn" id="bk" aria-label="${t('Volver')}">${icon('back')}</button>` });
  $('#bk').onclick = () => go('opciones');
  const { PRINCIPIOS_HTML } = await import('./principios.js');
  c.innerHTML = `<article class="wrap principles" lang="es">${PRINCIPIOS_HTML}</article>`;
  c.scrollTop = 0;
}

async function renderNotes() {
  const c = shell({ title: t('Mis notas'), tab: 'notes' });
  const u = S.user;
  const tabs = { hl: [t('Destacados'), u.hl], notes: [t('Notas'), u.notes], bm: [t('Marcadores'), u.bm], arts: [t('Artículos'), u.arts] };
  const keys = notesTab === 'arts' ? [] : Object.keys(tabs[notesTab][1]).sort((a, b) => cmpRef(a, b));
  c.innerHTML = `<div class="wrap"><div class="seg" role="group" aria-label="${t('Tipo')}">
    ${Object.entries(tabs).map(([k, [l, o]]) => `<button data-nt="${k}" aria-pressed="${notesTab === k}">${l} · ${Object.keys(o).length}</button>`).join('')}</div>
    <div id="nl">${keys.length ? `<div class="loading">${t('Cargando')}…</div>` : `<div class="empty">${icon('notes')}${t('Aún no hay elementos aquí.')}<br>${t('Toca el número de un versículo en el lector para destacarlo, anotarlo o marcarlo.')}</div>`}</div>
    <div class="h3">${t('Copia de seguridad')}</div>
    <div class="btnrow" style="margin-top:0"><button class="btn ghost" id="exp">${icon('download')}${t('Exportar')}</button><button class="btn ghost" id="imp">${t('Importar')}</button></div>
    <p class="hint">${t('Tus notas se guardan solo en este dispositivo. Exporta una copia para respaldarlas o pasarlas a otro equipo.')}</p>
    <div id="bk"></div></div>`;
  c.querySelectorAll('[data-nt]').forEach(b => b.onclick = () => { notesTab = b.dataset.nt; renderNotes(); });
  $('#exp').onclick = exportBackup; $('#imp').onclick = importBackup;
  if (notesTab === 'arts') { renderArtsList(); return; }
  if (!keys.length) return;
  const rv = await getRV(); const map = rvIndex(rv);
  $('#nl').innerHTML = `<div class="results">${keys.map(k => {
    const [b, ch, v] = k.split('.'); const bi = bookIdx(b);
    const tx = map.get(`${bi}.${ch}.${v}`) || '';
    const hl = notesTab === 'hl' ? ` style="box-shadow:inset 4px 0 0 var(--hl${u.hl[k]})"` : '';
    return `<button class="res" data-go-ref="r-${b}-${ch}-${v}"${hl}><span class="ref">${esc(refLabel(b, ch, v))}</span>${esc(tx.length > 160 ? tx.slice(0, 160) + '…' : tx)}
      ${notesTab === 'notes' ? `<span class="nt">${esc(u.notes[k])}</span>` : ''}</button>`;
  }).join('')}</div>`;
  $('#nl').querySelectorAll('[data-go-ref]').forEach(b => b.onclick = () => go(b.dataset.goRef));
}
function cmpRef(a, b) {
  const [ba, ca, va] = a.split('.'), [bb, cb, vb] = b.split('.');
  return (bookIdx(ba) - bookIdx(bb)) || (ca - cb) || (va - vb);
}
function exportBackup() {
  const data = JSON.stringify({ app: 'biblia-interlineal', version: 1, fecha: new Date().toISOString(), user: S.user }, null, 1);
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `biblia-interlineal-notas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  } catch {}
  $('#bk').innerHTML = `<p class="hint">${t('Si la descarga no comenzó, copia este texto y guárdalo:')}</p><textarea class="note" readonly id="bkt">${esc(data)}</textarea>
    <div class="btnrow"><button class="btn ghost" id="bkc">${icon('copy')}${t('Copiar')}</button></div>`;
  $('#bkc').onclick = () => copyText(data);
}
function importBackup() {
  $('#bk').innerHTML = `<p class="hint">${t('Pega aquí una copia exportada o elige el archivo:')}</p>
    <input type="file" id="bkf" accept="application/json,.json" style="width:100%;margin-bottom:8px">
    <textarea class="note" id="bkt" placeholder='{"app":"biblia-interlineal", …}'></textarea>
    <div class="btnrow"><button class="btn" id="bki">${t('Importar y combinar')}</button></div>`;
  $('#bkf').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => $('#bkt').value = r.result; r.readAsText(f); };
  $('#bki').onclick = () => {
    try {
      const d = JSON.parse($('#bkt').value);
      if (!d.user) throw new Error('formato');
      for (const k of ['hl', 'notes', 'bm', 'arts']) Object.assign(S.user[k], d.user[k] || {});
      artsChanged(); saveUser(); toast(t('Notas importadas')); renderNotes();
    } catch { toast(t('El texto no es una copia válida')); }
  };
}

// ------------------------------------------------------------------ ajustes
function renderOptions() {
  const c = shell({ title: t('Ajustes'), tab: 'options' });
  const st = S.settings;
  const coffee = FLAVOR === 'play' ? '' : `<div class="coffee">${icon('coffee', 'cf')}<p>${t('Esta app es gratuita, sin publicidad ni rastreo. Si te sirve para estudiar, un café ayuda a seguir mejorándola.')}</p>
    <a class="btn" href="${KOFI}" target="_blank" rel="noopener noreferrer">${t('Invítame un café')}</a></div>`;
  const main = versionMeta(st.main) || RV_META;
  c.innerHTML = `<div class="wrap">
    ${coffee}
    <div class="sec-title">${t('Idioma y versión')}</div>
    <div class="setgroup">
      <div class="setrow"><label for="s-ui">${icon('globe', 'inl')}${t('Idioma de la app')}<small>${t('Menús y botones')}</small></label><select id="s-ui">
        ${Object.entries(LANGS).map(([k, l]) => `<option value="${k}" ${uiLang() === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="setrow"><div class="lb">${t('Versión principal')}<small>${esc(main.name)} · ${esc(langName(main.lang || 'es'))}</small></div><button class="btn ghost" id="s-ver">${t('Elegir')}</button></div>
    </div>
    <div class="setgroup">
      <div class="setrow"><label for="s-theme">${t('Tema')}</label><select id="s-theme">
        ${[['system', 'Del sistema'], ['light', 'Claro'], ['sepia', 'Sepia'], ['dark', 'Oscuro']].map(([v, l]) => `<option value="${v}" ${st.theme === v ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></div>
      <div class="setrow"><label for="s-view">${t('Vista inicial del lector')}</label><select id="s-view">
        ${Object.entries(VIEWS).map(([v, l]) => `<option value="${v}" ${st.view === v ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></div>
      <div class="setrow"><label for="s-fs">${t('Tamaño de letra')}<small id="fsv">${st.fs}px</small></label><input type="range" id="s-fs" min="14" max="28" value="${st.fs}" style="flex:1;max-width:50%;padding:0;border:0;background:none"></div>
      <div class="setrow"><label for="s-spur">${t('Marcar textos espurios')}<small>${t('Rojo: añadidos tardíos · Ámbar: debatidos')}</small></label><input type="checkbox" class="toggle" id="s-spur" ${st.spur ? 'checked' : ''}></div>
    </div>
    <div class="sec-title">${t('Biblias')}</div>
    <div class="setgroup" id="bibles">${biblesRowsHTML()}</div>
    <p class="hint" style="margin:-6px 2px 16px">${t('El EPUB o PDF se procesa en este dispositivo y no se envía a ningún servidor. Cada persona decide qué Biblias importa y es responsable de tener derecho a usarlas. No se pueden leer libros con DRM, PDF escaneados (sin texto) ni archivos cifrados como JWPUB.')}</p>
    <div id="impres"></div>
    <div class="sec-title">${t('Obras de consulta')}</div>
    <div class="setgroup" id="works">${worksRowsHTML()}</div>
    <p class="hint" style="margin:-6px 2px 16px">${t('Diccionarios, enciclopedias o comentarios en EPUB o PDF (por ejemplo, el Vine o Perspicacia). La app reconoce sus artículos, sus citas bíblicas y sus números Strong para mostrarlos al estudiar cada versículo. Se procesan solo en este dispositivo.')}</p>
    <div id="wimpres"></div>
    <div class="setgroup" id="offline">
      <div class="setrow"><div class="lb">${t('Uso sin conexión')}<small id="offs">${isNative() ? t('Todo el texto viene incluido en la app.') : t('Guarda los 66 libros, léxicos y concordancia en este navegador (≈ 65 MB).')}</small></div>
      ${isNative() ? '' : `<button class="btn ghost" id="dl">${icon('download')}${t('Descargar')}</button>`}</div>
    </div>
    <div class="setgroup"><div class="setrow" id="updrow">${updRowHTML()}</div></div>
    ${isNative() || isDesktop() ? '' : `<div class="setgroup"><div class="setrow"><div class="lb">${t('Descargar la app')}<small>${t('Android, Windows o instalarla en este dispositivo')}</small></div>
      <button class="btn ghost" id="s-dl">${icon('download')}${t('Ver opciones')}</button></div></div>`}
    <div class="setgroup"><div class="setrow"><div class="lb">${t('Principios de esta app')}<small>${t('Un solo Dios verdadero, el nombre divino y nuestra independencia')}</small></div>
      <button class="btn ghost" id="s-prin">${t('Leer')}</button></div></div>
    <div class="about">${ABOUT()}<p style="color:var(--ink-3)">${t('Versión')} ${VERSION} · ${t('Datos')} v${S.meta.version}</p></div></div>`;
  $('#s-ui').onchange = (e) => { st.ui = e.target.value; setLang(st.ui); saveSettings(); renderOptions(); };
  $('#s-ver').onclick = () => openVersionSheet(() => renderOptions());
  $('#s-theme').onchange = (e) => { st.theme = e.target.value; saveSettings(); };
  $('#s-view').onchange = (e) => { st.view = e.target.value; saveSettings(); };
  $('#s-spur').onchange = (e) => { st.spur = e.target.checked; saveSettings(); };
  $('#s-fs').oninput = (e) => { st.fs = +e.target.value; $('#fsv').textContent = st.fs + 'px'; saveSettings(); };
  const dl = $('#dl'); if (dl) dl.onclick = downloadAll;
  $('#s-prin').onclick = () => go('principios');
  const sdl = $('#s-dl'); if (sdl) sdl.onclick = () => go('bienvenida');
  bindBibles(); bindWorks(); refreshUpdRow();
}
// ------------------------------------------------------------------ Biblias importadas (EPUB)
function biblesRowsHTML() {
  return `<div class="setrow"><div class="lb">Reina-Valera 1909<small>${t('Español')} · ${t('Incluida · alineada con el hebreo y el griego')}</small></div></div>
    ${S.bibles.map(b => `<div class="setrow" data-bib="${b.id}"><div class="lb">${esc(b.name)}<small>${esc(b.abbr)} · ${esc(langName(b.lang || 'und'))} · ${t('{b} libros · {v} versículos', { b: b.books, v: nf(b.verses) })}${b.license ? ` · ${esc(licName(b.license))}${b.holder ? ' · ' + esc(b.holder) : ''}` : ''}</small></div>
      <button class="btn ghost sm" data-diag="${b.id}">${t('Ver libros')}</button><button class="btn ghost sm" data-del="${b.id}">${t('Eliminar')}</button></div>`).join('')}
    <div class="setrow"><div class="lb">${t('Biblias libres para descargar')}<small>${t('En español, inglés y portugués, de dominio público o con licencia abierta')}</small></div>
      <button class="btn" id="cat-open">${icon('books')}${t('Ver catálogo')}</button></div>
    <div class="setrow"><div class="lb">${t('Importar Biblia en EPUB o PDF')}<small>${t('En cualquier idioma; se suma a las versiones para comparar')}</small></div>
      <label class="btn" for="epf" tabindex="0">${icon('download')}${t('Elegir archivo')}</label><input type="file" id="epf" accept=".epub,.pdf,application/epub+zip,application/pdf" hidden></div>`;
}
function bindBibles() {
  const box = $('#bibles'); if (!box) return;
  const co = $('#cat-open'); if (co) co.onclick = () => openCatalog();
  box.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.del;
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = t('¿Eliminar? Toca otra vez'); btn.style.background = 'var(--hl4)'; return; }
    S.bibles = S.bibles.filter(b => b.id !== id); S.bibleData.delete(id);
    await store.set('bibles', S.bibles); await store.set('bible:' + id, null);
    S.settings.texts = (S.settings.texts || []).filter(x => x !== id);
    if (S.settings.main === id) S.settings.main = 'rv';
    if (!S.settings.texts.length) S.settings.texts = ['rv'];
    if (S.settings.searchIn === id) S.settings.searchIn = 'rv';
    saveSettings(); toast(t('Biblia eliminada')); box.innerHTML = biblesRowsHTML(); bindBibles();
  });
  box.querySelectorAll('[data-diag]').forEach(btn => btn.onclick = () => openBibleDiag(btn.dataset.diag));
  const lab = box.querySelector('label[for="epf"]');
  if (lab) lab.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#epf').click(); } };
  const inp = $('#epf');
  if (inp) inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) runImport(f); };
}
async function openBibleDiag(id) {
  const m = bibleMeta(id); const d = await getBible(id);
  const rv = await getRV().catch(() => null);
  const exp = {};
  if (rv) for (const [bi, c] of rv) { const k = S.meta.books[bi].id; (exp[k] ||= {})[c] = ((exp[k] || {})[c] || 0) + 1; }
  const rows = S.meta.books.map(b => {
    const bk = d && d.books[b.id];
    const ch = bk ? Object.keys(bk).length : 0;
    const vs = bk ? Object.values(bk).reduce((a, x) => a + Object.keys(x).length, 0) : 0;
    const ech = exp[b.id] ? Object.keys(exp[b.id]).length : b.ch;
    const ev = exp[b.id] ? Object.values(exp[b.id]).reduce((a, x) => a + x, 0) : 0;
    const st = !ch ? 'miss' : ch !== ech || (ev && Math.abs(vs - ev) > Math.max(2, ev * 0.03)) ? 'warn' : 'ok';
    return { b, ch, vs, ech, ev, st };
  });
  const nMiss = rows.filter(r => r.st === 'miss').length, nWarn = rows.filter(r => r.st === 'warn').length;
  openSheet(`<div style="font-weight:700;font-size:18px">${esc(m.name)}</div><div class="sub">${esc(m.abbr)} · ${esc(langName(m.lang || 'und'))}</div>`,
    `<p class="hint">${nMiss || nWarn ? t('{a} libros sin texto y {b} con diferencias. Si faltan muchos, elimina esta Biblia y vuelve a importarla: el importador mejoró.', { a: nMiss, b: nWarn }) : t('Todos los libros tienen texto.')}</p>
     <div style="overflow-x:auto"><table class="imptab diag"><tr><th>${t('Libro')}</th><th>${t('Capítulos')}</th><th>${t('Versículos')}</th></tr>
     ${rows.map(r => `<tr class="${r.st}"><td>${esc(bookName(r.b.id))}</td><td>${r.ch} / ${r.ech}</td><td>${nf(r.vs)}${r.ev ? ' / ' + nf(r.ev) : ''}</td></tr>`).join('')}</table></div>`, t('Ver libros'));
}
function autoAbbr(x) {
  const w = norm(x).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(y => y && !['de', 'la', 'el', 'las', 'los', 'del', 'y', 'en', 'santa', 'biblia', 'the', 'of', 'holy', 'bible', 'version', 'a', 'da', 'do', 'santas', 'escrituras', 'scriptures', 'sagradas', 'sagrada', 'escrituras'].includes(y));
  const a = w.map(y => /^\d+$/.test(y) ? y : y[0]).join('').toUpperCase().slice(0, 6);
  return a || 'MIA';
}
const IMPORT_LANGS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'ru', 'uk', 'pl', 'ro', 'el', 'he', 'ar', 'zh', 'ja', 'ko', 'tl', 'sw', 'qu', 'gn', 'ay', 'nah', 'ht', 'la'];
async function runImport(file) {
  const out = $('#impres');
  out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('Leyendo')} ${esc(file.name)}…</b><div class="hint" id="impp">${t('Abriendo el archivo')}</div></div>`;
  if (/\.jwpub$/i.test(file.name)) {
    out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('Los archivos JWPUB no se pueden importar')}</b><p class="hint">${t('Su contenido está cifrado para usarse solo en JW Library. jw.org ofrece las mismas Biblias en formato EPUB, que sí puedes importar aquí.')}</p></div>`; return;
  }
  const rvAll = await getRV().catch(() => null);
  let expected;
  if (rvAll) {
    const acc = {};
    for (const [bi, c] of rvAll) { const id = S.meta.books[bi].id; const e = acc[id] || (acc[id] = []); e[c - 1] = (e[c - 1] || 0) + 1; }
    expected = Object.fromEntries(Object.entries(acc).map(([id, vc]) => [id, { ch: vc.length, vc: [...vc].map(x => x || 0) }]));
  } else expected = Object.fromEntries(S.meta.books.map(b => [b.id, { ch: b.ch, vc: b.vc }]));
  let res;
  try {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    const prog = (i, n) => { const p = $('#impp'); if (p) p.textContent = t(isPdf ? 'Leyendo página {i} de {n}' : 'Analizando sección {i} de {n}', { i, n }); };
    res = isPdf ? await importPdfBible(file, expected, prog) : await importEpub(file, expected, prog);
  } catch (e) {
    out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('No se pudo importar')}</b><p class="hint">${esc(e.message)}</p></div>`; return;
  }
  const rp = res.report;
  if (rp.verses < 50) {
    out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('No se reconocieron libros ni versículos')}</b><p class="hint">${/\.pdf$/i.test(file.name) ? t('El PDF se abrió, pero no se encontraron números de versículo en su texto. Si es un PDF escaneado (solo imágenes), no tiene texto que se pueda leer; prueba con una edición digital o en EPUB.') : t('El EPUB se abrió, pero su estructura no permite ubicar libros, capítulos y versículos. Prueba otra edición de esa Biblia (las que traen índice por libro y números de versículo funcionan mejor).')}</p></div>`; return;
  }
  const bad = rp.rows.filter(r => r.status !== 'ok');
  let name = res.title || file.name, abbr0 = null;
  // jw.org: «Título (código-idioma)»; el código indica la edición
  const jwm = res.source === 'jw' && name.match(/^(.*?)\s*\(([a-z0-9]+)-[A-Za-z]+\)\s*$/);
  if (jwm) {
    const ed = { nwt: t('edición revisada'), nwtsty: t('edición de estudio'), bi12: t('edición con referencias'), bi7: t('edición con referencias') }[jwm[2]];
    abbr0 = autoAbbr(jwm[1]) + ({ nwt: '', nwtsty: 'e', bi12: 'r', bi7: 'r' }[jwm[2]] ?? '');
    name = ed ? `${jwm[1]} (${ed})` : jwm[1];
  }
  const detected = (res.lang || '').toLowerCase().split('-')[0];
  const langs = [...new Set([detected, ...IMPORT_LANGS].filter(Boolean))];
  out.innerHTML = `<div class="setgroup" style="padding:14px">
    <b>${t('{b} de 66 libros · {v} versículos reconocidos', { b: rp.books, v: nf(rp.verses) })}</b>
    ${res.source === 'jw' ? `<p class="hint">${t('Formato de jw.org reconocido: versículos tomados de sus marcas internas.')}</p>` : ''}
    ${res.source === 'pdf' ? `<p class="hint">${t('PDF: libros, capítulos y versículos reconocidos por la tipografía. Revisa algunos pasajes con «Ver libros» después de guardar.')}</p>` : ''}
    <p class="hint">${bad.length ? t('Revisa los libros marcados: puede que el EPUB use otra numeración o que falten partes.') : t('Todos los libros coinciden con la numeración esperada.')}${rp.omitted ? ' ' + t('Esta versión no incluye {n} versículos que se consideran espurios (por ejemplo, Marcos 16:9-20).', { n: rp.omitted }) : ''}</p>
    <div class="kv" style="grid-template-columns:auto 1fr;align-items:center">
      <dt><label for="imp-name">${t('Nombre')}</label></dt><dd><input id="imp-name" value="${esc(name)}" style="width:100%"></dd>
      <dt><label for="imp-abbr">${t('Abreviatura')}</label></dt><dd><input id="imp-abbr" value="${esc(abbr0 || autoAbbr(name))}" maxlength="8" style="width:8em"></dd>
      <dt><label for="imp-lang">${t('Idioma')}</label></dt><dd><select id="imp-lang">${langs.map(l => `<option value="${l}" ${l === (detected || 'es') ? 'selected' : ''}>${esc(langName(l))}</option>`).join('')}</select></dd>
    </div>
    ${bad.length ? `<details ${bad.length <= 8 ? 'open' : ''}><summary>${t('{n} libros con diferencias', { n: bad.length })}</summary>
      <div style="overflow-x:auto"><table class="imptab">
      <tr><th>${t('Libro')}</th><th>${t('Capítulos')}</th><th>${t('Versículos')}</th></tr>
      ${bad.map(r => `<tr><td>${esc(bookName(r.id))}</td><td>${r.status === 'missing' ? t('no encontrado') : `${r.ch} / ${r.expCh}`}</td><td>${r.status === 'missing' ? '' : `${r.vs} / ${r.expV}`}</td></tr>`).join('')}
      </table></div></details>` : ''}
    <div class="btnrow"><button class="btn" id="imp-save">${t('Guardar en este dispositivo')}</button><button class="btn ghost" id="imp-cancel">${t('Descartar')}</button></div>
  </div>`;
  $('#imp-cancel').onclick = () => { out.innerHTML = ''; };
  $('#imp-save').onclick = async () => {
    const id = 'u' + Date.now().toString(36);
    const meta = { id, name: $('#imp-name').value.trim() || name, abbr: ($('#imp-abbr').value.trim() || autoAbbr(name)).slice(0, 8),
      lang: $('#imp-lang').value, books: rp.books, verses: rp.verses, date: new Date().toLocaleDateString(uiLang()) };
    await store.set('bible:' + id, { books: res.books });
    S.bibleData.set(id, Promise.resolve({ books: res.books }));
    S.bibles.push(meta); await store.set('bibles', S.bibles);
    const tx = S.settings.texts || ['rv']; if (tx.length < 4) { tx.push(id); S.settings.texts = tx; saveSettings(); }
    out.innerHTML = '';
    $('#bibles').innerHTML = biblesRowsHTML(); bindBibles();
    toast(t('{a} agregada a las versiones para comparar', { a: meta.abbr }));
  };
}

// ------------------------------------------------------------------ lecturas alternativas (versículos debatidos) y comparación de traducciones
function lectEntry(b, c, v) { const i = S.lect && S.lect.index[refKey(b, c, v)]; return i != null ? S.lect.entries[i] : null; }
function lectSummaryHTML(b, c, v) {
  const e = lectEntry(b, c, v); if (!e) return '';
  return `<div class="h3">${t('Lecturas alternativas')}</div>
    <button class="res lectsum" id="lectopen"><span class="ref">${esc(e.title)}</span>
      ${e.readings.map(g => `<span class="lg">${esc(g.label)} <b>${g.items.length}</b></span>`).join('')}</button>`;
}
function openLecturas(b, c, v) {
  const e = lectEntry(b, c, v); if (!e) return;
  const srcLine = (it) => `${esc(it.src || '')}${it.year ? ` <span class="yr">${esc(it.year)}</span>` : ''}${it.cite != null && e.sources[it.cite] ? ` <a class="fn" href="#lsrc${it.cite}">[${it.cite + 1}]</a>` : ''}`;
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${esc(e.title)}</div><div class="sub">${t('Lecturas alternativas')}</div>`, `
    <div class="lorig" lang="${/[֐-׿]/.test(e.orig) ? 'he' : 'grc'}" dir="auto">${esc(e.orig)}</div>
    ${e.lit ? `<p class="hint" style="margin-top:4px">${esc(e.lit)}</p>` : ''}
    ${e.readings.map(g => `<div class="lgroup"><div class="lgl">${esc(g.label)}</div>
      ${g.items.map(it => `<div class="litem"><q>${esc(it.q)}</q><div class="lsrc">— ${srcLine(it)}</div></div>`).join('')}</div>`).join('')}
    <div class="h3">${t('Por qué hay distintas lecturas')}</div>
    <div class="wentry">${e.why.map(p => `<p>${RW.linkRefs(p, esc)}</p>`).join('')}</div>
    ${e.views.length ? `<div class="h3">${t('Argumentos de cada postura')}</div>
      ${e.views.map(x => `<details class="lview"><summary>${esc(x.side)}</summary><p>${RW.linkRefs(x.text, esc)}</p></details>`).join('')}` : ''}
    ${e.sources.length ? `<div class="h3">${t('Fuentes')}</div><ol class="lsrcs">${e.sources.map((x, i) => `<li id="lsrc${i}">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.t)}</a>` : esc(x.t)}</li>`).join('')}</ol>` : ''}
    <p class="hint">${t('Las citas de Biblias incluidas en la app se copiaron de su texto. Las explicaciones exponen los argumentos de cada postura sin dar un veredicto.')}</p>
    <div class="btnrow"><button class="btn ghost sm" id="lcmp">${icon('layers')}${t('Comparar traducciones')}</button></div>`, e.title);
  sh.classList.add('tall');
  sh.querySelectorAll('.bref').forEach(x => x.onclick = () => { closeSheet(); const [bb, cc, vv] = x.dataset.ref.split('-'); go(`r-${bb}-${cc}-${vv}`); });
  sh.querySelectorAll('a.fn').forEach(a => a.onclick = (ev) => { ev.preventDefault(); const el = sh.querySelector(a.getAttribute('href')); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } });
  sh.querySelector('#lcmp').onclick = () => openCompare(b, c, v);
}
// cualquier versículo: el texto en todas las versiones instaladas (RV1909, catálogo e importadas)
async function openCompare(b, c, v) {
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${esc(refLabel(b, c, v))}</div><div class="sub">${t('Comparar traducciones')}</div>`,
    `<div id="cmpbody"><div class="loading">${t('Cargando')}…</div></div>`, t('Comparar traducciones'));
  sh.classList.add('tall');
  const rows = [];
  try { const book = await getBook(b); const vs = book.chs.find(x => x.c === c).vs.find(x => x.v === v); rows.push({ abbr: RV_META.abbr, name: RV_META.name, lang: 'es', tx: (vs.rv || []).map(x => typeof x === 'string' ? x : x[0]).join('') }); } catch {}
  for (const m of S.bibles) {
    let d = null; try { d = await getBible(m.id); } catch {}
    const tx = d && d.books[b] && d.books[b][c] && d.books[b][c][v];
    rows.push({ abbr: m.abbr, name: m.name, lang: m.lang, tx: tx || '' });
  }
  const order = [uiLang(), 'es', 'en', 'pt'];
  rows.sort((a, z) => ((order.indexOf(a.lang) + 1 || 9) - (order.indexOf(z.lang) + 1 || 9)));
  const have = rows.filter(r => r.tx), miss = rows.filter(r => !r.tx);
  sh.querySelector('#cmpbody').innerHTML = `<div class="cmplist">${have.map(r => `<div class="cmprow"><div class="cmpab" title="${esc(r.name)}">${esc(r.abbr)}</div><div class="cmptx" lang="${esc(r.lang || '')}" dir="auto">${esc(r.tx)}</div></div>`).join('')}</div>
    ${miss.length ? `<p class="hint">${t('Sin este versículo')}: ${miss.map(r => esc(r.abbr)).join(', ')}</p>` : ''}
    ${S.bibles.length < 3 ? `<p class="hint">${t('Descarga más Biblias en Ajustes → Biblias → «Ver catálogo» para comparar más traducciones.')}</p>` : ''}
    ${lectEntry(b, c, v) ? `<div class="btnrow"><button class="btn sm" id="cmplect">${icon('layers')}${t('Lecturas alternativas')}</button></div>` : ''}`;
  const lb = sh.querySelector('#cmplect'); if (lb) lb.onclick = () => openLecturas(b, c, v);
}

// ------------------------------------------------------------------ artículos pegados (p. ej. «Textos bíblicos explicados» de jw.org)
// El usuario copia el texto de un artículo y lo pega (o lo comparte con la app en Android). Se guarda solo en el
// dispositivo, dentro de sus notas (entra en la copia de seguridad), y se asocia al versículo que explica y a los que cita.
let ART_IDX = null;
function artsChanged() { ART_IDX = null; }
function artIdx() {
  if (ART_IDX) return ART_IDX;
  const main = new Map(), cite = new Map();
  for (const a of Object.values(S.user.arts || {})) {
    if (a.ref) for (let v = a.ref.v; v <= (a.ref.v2 || a.ref.v); v++) { const k = refKey(a.ref.b, a.ref.c, v); (main.get(k) || main.set(k, []).get(k)).push(a.id); }
    for (const [k, si] of a.cites || []) { if (!(main.get(k) || []).includes(a.id)) (cite.get(k) || cite.set(k, []).get(k)).push([a.id, si]); }
  }
  return (ART_IDX = { main, cite });
}
const UI_NOISE = /^(compartir|compartir enlace|descargar|imprimir|favorito|leer en|escuchar|audio|ver más|ver tambi[eé]n|opciones de descarga|copiar|idioma|siguiente|anterior|inicio|share|download|print|log in|iniciar sesi[oó]n|jw\.org|copyright|©|pol[ií]tica de privacidad|condiciones de uso|configuraci[oó]n de privacidad|m[aá]s art[ií]culos|lea m[aá]s|ense[nñ]anzas b[ií]blicas|textos b[ií]blicos explicados|\d+ de \d+)\b/i;
function parseArticle(raw, title0 = '', url0 = '') {
  RW.setVerseCounts(S.meta);
  const text = String(raw || '').replace(/\r/g, '').replace(/ /g, ' ');
  const url = url0 || ((text.match(/https?:\/\/\S+/g) || []).find(u => /jw\.org/.test(u)) || (text.match(/https?:\/\/\S+/) || [])[0] || '');
  const lines = text.split('\n').map(l => l.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()).filter(l => l && !(l.length < 50 && UI_NOISE.test(l)));
  let title = (title0 || '').replace(/\s*[|—–-]\s*(JW\.ORG|Estudio de la Biblia|Biblia)\s*$/i, '').trim();
  if (!title && lines.length) title = lines.shift();
  else if (lines.length && lines[0] === title) lines.shift();
  // versículo principal: el del título o, si no, el primero del texto
  let rs = RW.findRefs(title); if (!rs.length) rs = RW.findRefs(lines.slice(0, 3).join(' '));
  const refT = rs[0] || null;          // «Proverbios 3:5, 6» → 3:5-6
  const ref = refT ? { b: refT.b, c: refT.c, v: refT.v, v2: Math.max(...rs.filter(r => r.at === refT.at && r.b === refT.b && r.c === refT.c).map(r => r.v2)) } : null;
  // subtemas: línea corta sin punto final seguida de un párrafo más largo
  const sections = [['', []]];
  const STOP = /^(temas relacionados|puede que tambi[eé]n le interese|art[ií]culos relacionados|related topics|you may also (like|be interested)|voc[eê] tamb[eé]m pode gostar|talvez tamb[eé]m se interesse|assuntos relacionados)\b/i;
  let skipping = false;
  lines.forEach((l, i) => {
    const nx = lines[i + 1] || '';
    if (STOP.test(l)) { skipping = true; return; }                 // enlaces y tarjetas del final: no son parte de la explicación
    if (skipping) {                                               // …salvo las notas al pie («*», «†», «1.»)
      if (/^([*†‡]|\(?\d{1,2}[.)]\s)/.test(l)) { if (sections[sections.length - 1][0] !== t('Notas')) sections.push([t('Notas'), []]); sections[sections.length - 1][1].push(l); }
      return;
    }
    const head = l.length <= 90 && !/[.,;:!?»”")\]…]$/.test(l) && /\p{Lu}|\d/u.test(l[0]) && nx.length > l.length && nx.length > 60;
    if (head) sections.push([l, []]); else sections[sections.length - 1][1].push(l);
  });
  const secs = sections.map(([h, ps]) => [h, ps.join('\n')]).filter(([h, tx]) => tx || h);
  const cites = []; const seen = new Set();
  secs.forEach(([h, tx], si) => { for (const r of RW.findRefs(h + '\n' + tx)) for (let v = r.v; v <= r.v2; v++) { const k = refKey(r.b, r.c, v); if (!seen.has(k)) { seen.add(k); cites.push([k, si]); } } });
  return { title: title || t('Artículo sin título'), url, ref, sections: secs, cites };
}
function artsForVerseHTML(b, c, v) {
  const key = refKey(b, c, v), I = artIdx(), A = S.user.arts;
  const main = (I.main.get(key) || []).map(id => A[id]).filter(Boolean);
  const cite = (I.cite.get(key) || []).filter(([id]) => A[id]);
  if (!main.length && !cite.length) return '';
  const item = (a, si) => { const subs = a.sections.map(s => s[0]).filter(Boolean);
    return `<button class="res artbtn" data-art="${a.id}" ${si != null ? `data-si="${si}"` : ''}><span class="ref">${esc(a.title)}</span>${subs.length ? `<span class="artsubs">${subs.slice(0, 5).map(esc).join(' · ')}</span>` : ''}</button>`; };
  return `${main.length ? `<div class="h3">${t('Tus artículos')}</div><div class="results">${main.map(a => item(a)).join('')}</div>` : ''}
    ${cite.length ? `<div class="h3">${t('Citado en tus artículos')}</div><div class="results">${cite.slice(0, 20).map(([id, si]) => item(A[id], si)).join('')}</div>` : ''}`;
}
function bindArts(el) { el.querySelectorAll('[data-art]').forEach(x => x.onclick = () => openArticle(x.dataset.art, x.dataset.si != null ? +x.dataset.si : null)); }
function openArticle(id, si = null) {
  const a = S.user.arts[id]; if (!a) return;
  const refTxt = a.ref ? refLabel(a.ref.b, a.ref.c, a.ref.v) + (a.ref.v2 > a.ref.v ? '-' + a.ref.v2 : '') : '';
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${esc(a.title)}</div>${refTxt ? `<div class="sub">${esc(refTxt)}</div>` : ''}`,
    `<div class="wentry">${a.sections.map(([h, tx], i) => `${h ? `<div class="h3 arth"${i === si ? ' id="wh"' : ''}>${esc(h)}</div>` : ''}${tx.split('\n').map(p => `<p${i === si && !h ? ' id="wh"' : ''}>${RW.linkRefs(p, esc)}</p>`).join('')}`).join('')}</div>
     ${a.url ? `<p class="hint"><a href="${esc(a.url)}" target="_blank" rel="noopener">${t('Abrir el original')} ↗</a></p>` : ''}
     <div class="btnrow">${a.ref ? `<button class="btn ghost sm" id="artgo">${icon('books')}${esc(refTxt)}</button>` : ''}
       <button class="btn ghost sm" id="arted">${t('Editar')}</button><button class="btn ghost sm" id="artdel">${t('Eliminar')}</button></div>`, a.title);
  sh.classList.add('tall');
  sh.querySelectorAll('.bref').forEach(x => x.onclick = () => { closeSheet(); const [b, c, v] = x.dataset.ref.split('-'); go(`r-${b}-${c}-${v}`); });
  const g = sh.querySelector('#artgo'); if (g) g.onclick = () => { closeSheet(); go(`r-${a.ref.b}-${a.ref.c}-${a.ref.v}`); };
  sh.querySelector('#arted').onclick = () => openArticleEditor({ edit: a });
  const del = sh.querySelector('#artdel');
  del.onclick = () => {
    if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = t('¿Eliminar? Toca otra vez'); del.style.background = 'var(--hl4)'; return; }
    delete S.user.arts[id]; artsChanged(); saveUser(); closeSheet(); toast(t('Artículo eliminado')); if (S.route.name === 'read') render(); else if (S.route.name === 'notes') renderNotes();
  };
  const h = sh.querySelector('#wh'); if (h) setTimeout(() => h.scrollIntoView({ block: 'start' }), 60);
}
function openArticleEditor({ ref = null, edit = null, text = '', title = '', url = '' } = {}) {
  const raw0 = edit ? edit.sections.map(([h, tx]) => (h ? h + '\n' : '') + tx).join('\n') : text;
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${edit ? t('Editar artículo') : t('Pegar artículo')}</div>`, `
    <p class="hint" style="margin-top:0">${t('Abre el artículo (por ejemplo, «Textos bíblicos explicados» en jw.org), selecciona todo el texto, cópialo y pégalo aquí. Se guarda solo en este dispositivo, como nota de los versículos que explica y cita.')}</p>
    <textarea class="note" id="arttx" style="min-height:180px" placeholder="${t('Pega aquí el texto del artículo')}">${esc(raw0)}</textarea>
    <div class="kv" style="grid-template-columns:auto 1fr;align-items:center;margin-top:8px">
      <dt><label for="artti">${t('Título')}</label></dt><dd><input id="artti" value="${esc(edit ? edit.title : title)}" style="width:100%"></dd>
      <dt><label for="artref">${t('Versículo')}</label></dt><dd><input id="artref" placeholder="${t('p. ej. Salmo 23:4')}" style="width:100%"></dd>
      <dt><label for="arturl">${t('Enlace')}</label></dt><dd><input id="arturl" value="${esc(edit ? edit.url : url)}" placeholder="https://www.jw.org/…" style="width:100%"></dd></div>
    <div id="artpv" class="hint"></div>
    <div class="btnrow"><button class="btn" id="artsave">${t('Guardar')}</button><button class="btn ghost" id="artpaste">${icon('copy')}${t('Pegar del portapapeles')}</button></div>`, t('Pegar artículo'));
  sh.classList.add('tall');
  const tx = sh.querySelector('#arttx'), ti = sh.querySelector('#artti'), rf = sh.querySelector('#artref'), ur = sh.querySelector('#arturl'), pv = sh.querySelector('#artpv');
  let refTouched = false, titleTouched = !!(edit || title);
  const fmtRef = (r) => r ? refLabel(r.b, r.c, r.v) + (r.v2 > r.v ? '-' + r.v2 : '') : '';
  if (edit && edit.ref) { rf.value = fmtRef(edit.ref); refTouched = true; } else if (ref) { rf.value = fmtRef(ref); refTouched = true; }
  const preview = () => {
    const A = parseArticle(tx.value, titleTouched ? ti.value : '', ur.value);
    if (!titleTouched && tx.value.trim()) ti.value = A.title;
    if (!refTouched && A.ref) rf.value = fmtRef(A.ref);
    if (!ur.value && A.url) ur.value = A.url;
    const subs = A.sections.filter(s => s[0]).length;
    const onlyUrl = !tx.value.replace(/https?:\/\/\S+/g, '').trim();
    pv.innerHTML = !tx.value.trim() ? '' : onlyUrl ? t('Solo llegó el enlace. Para guardar la explicación, abre el artículo, copia su texto y pégalo aquí; si no, se guardará solo el enlace.')
      : t('{s} subtemas · {n} versículos citados', { s: subs, n: A.cites.length }) + (subs ? ': ' + esc(A.sections.filter(s => s[0]).map(s => s[0]).slice(0, 6).join(' · ')) : '');
    return A;
  };
  tx.oninput = debounce(preview, 250); ti.oninput = () => { titleTouched = true; }; rf.oninput = () => { refTouched = true; };
  ur.oninput = debounce(preview, 250);
  preview();
  sh.querySelector('#artpaste').onclick = async () => {
    try { const c = await navigator.clipboard.readText(); if (c) { tx.value = c; preview(); } } catch { tx.focus(); toast(t('Mantén presionado el cuadro y elige «Pegar»')); }
  };
  sh.querySelector('#artsave').onclick = () => {
    const A = preview();
    let r = A.ref;
    if (rf.value.trim()) { const pr = parseRefs(rf.value); const p0 = pr && pr[0]; r = p0 && p0.v1 != null ? { b: p0.b, c: p0.c1, v: p0.v1, v2: Math.max(...pr.filter(x => x.b === p0.b && x.c1 === p0.c1 && x.v2 != null).map(x => x.c2 === p0.c1 ? x.v2 : p0.v1)) } : r; }
    if (!A.sections.length && !A.url && !ur.value) { toast(t('Pega el texto o el enlace del artículo')); return; }
    if (!r) { rf.focus(); toast(t('Indica el versículo que explica (p. ej. Salmo 23:4)')); return; }
    const id = edit ? edit.id : 'a' + Date.now().toString(36);
    S.user.arts[id] = { id, title: ti.value.trim() || A.title, url: ur.value.trim(), ref: r, sections: A.sections, cites: A.cites, date: edit ? edit.date : Date.now() };
    artsChanged(); saveUser(); closeSheet();
    toast(t('Artículo guardado en {ref}', { ref: fmtRef(r) }));
    if (S.route.name === 'read') render(); else if (S.route.name === 'notes') renderNotes();
  };
}
function renderArtsList() {
  const list = Object.values(S.user.arts).sort((a, b) => a.ref && b.ref ? cmpRef(refKey(a.ref.b, a.ref.c, a.ref.v), refKey(b.ref.b, b.ref.c, b.ref.v)) : 0);
  $('#nl').innerHTML = `<div class="btnrow" style="margin:0 0 12px"><button class="btn" id="artnew">${icon('note')}${t('Pegar artículo')}</button></div>
    ${list.length ? `<div class="results">${list.map(a => `<button class="res" data-art="${a.id}"><span class="ref">${esc(a.ref ? refLabel(a.ref.b, a.ref.c, a.ref.v) + (a.ref.v2 > a.ref.v ? '-' + a.ref.v2 : '') : '')}</span>${esc(a.title)}
      <span class="nt">${esc(a.sections.map(s => s[0]).filter(Boolean).slice(0, 5).join(' · '))}</span></button>`).join('')}</div>`
      : `<div class="empty">${icon('notes')}${t('Aún no hay artículos.')}<br>${t('Copia el texto de una explicación (por ejemplo, de jw.org) y pégalo aquí o desde la hoja de un versículo.')}</div>`}`;
  $('#artnew').onclick = () => openArticleEditor();
  bindArts($('#nl'));
}
// Android: «Compartir» desde el navegador o JW Library abre la app con el texto o el enlace
function initShareTarget() {
  const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorShareTarget;
  if (!isNative() || !P || !P.addListener) return;
  P.addListener('shareReceived', (ev) => {
    const texts = (ev && ev.texts) || [];
    openArticleEditor({ text: texts.join('\n\n'), title: (ev && ev.title) || '' });
  });
}

// ------------------------------------------------------------------ catálogo de Biblias libres (descarga a pedido)
const licName = (l) => l === 'Dominio público' ? t('Dominio público') : l;
const catalogBase = () => isNative() || !/^https?:/.test(location.protocol) ? window.APP_CATALOG_URL : new URL('data/bibles/', location.href).href;
let catalogP = null;
async function loadCatalog() {
  const tryUrl = async (base) => { const r = await fetch(base + 'catalog.json', { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return { base, list: (await r.json()).bibles || [] }; };
  catalogP ||= tryUrl(catalogBase()).catch(e => catalogBase() !== window.APP_CATALOG_URL ? tryUrl(window.APP_CATALOG_URL) : Promise.reject(e));
  return catalogP.catch(e => { catalogP = null; throw e; });
}
function catalogItemHTML(c) {
  const inst = S.bibles.find(b => b.catalog === c.id);
  const cover = c.ot && c.nt ? t('Biblia completa') : c.nt ? t('Solo Nuevo Testamento') : t('Solo Antiguo Testamento');
  const lic = c.licenseUrl ? `<a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener">${esc(licName(c.license))}</a>` : esc(licName(c.license));
  return `<div class="catitem" data-cid="${esc(c.id)}">
    <div class="lb"><b>${esc(c.name)}</b> <span class="chip">${esc(c.abbr)}</span>
      <small>${cover} · ${(c.size / 1e6).toFixed(1)} MB · ${lic}${c.holder ? ' · ' + esc(c.holder) : ''}${c.note ? ' · ' + esc(c.note) : ''}
      · <a href="${esc(c.source)}" target="_blank" rel="noopener">${t('Fuente')}</a></small></div>
    ${inst ? `<span class="catok">${icon('check')}${t('Descargada')}</span>` : `<button class="btn sm" data-get="${esc(c.id)}">${icon('download')}${t('Descargar')}</button>`}
  </div>`;
}
async function openCatalog() {
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${t('Biblias libres para descargar')}</div>`,
    `<div id="catbody"><div class="loading">${t('Cargando catálogo…')}</div></div>`, t('Biblias libres para descargar'));
  sh.classList.add('tall');
  const body = sh.querySelector('#catbody');
  let cat;
  try { cat = await loadCatalog(); }
  catch { body.innerHTML = `<p class="hint">${t('No se pudo cargar el catálogo. Revisa la conexión e inténtalo de nuevo.')}</p>`; return; }
  const order = [uiLang(), 'es', 'en', 'pt'].filter((l, i, a) => a.indexOf(l) === i);
  const render = () => {
    body.innerHTML = `<p class="hint">${t('Se descargan una vez y quedan en este dispositivo para leer sin conexión, comparar en paralelo y buscar. Textos de eBible.org y CrossWire, de dominio público o con licencia Creative Commons.')}</p>`
      + order.map(l => { const items = cat.list.filter(c => c.lang === l); return items.length ? `<div class="h3">${esc(langName(l))} <span class="chip">${items.length}</span></div><div class="catlist">${items.map(catalogItemHTML).join('')}</div>` : ''; }).join('');
    body.querySelectorAll('[data-get]').forEach(btn => btn.onclick = () => downloadCatalogBible(cat, cat.list.find(c => c.id === btn.dataset.get), btn, render));
  };
  render();
}
async function downloadCatalogBible(cat, c, btn, done) {
  btn.disabled = true; btn.textContent = t('Descargando…');
  try {
    const r = await fetch(cat.base + c.id + '.json');
    if (!r.ok) throw new Error(r.status);
    let data;
    if (r.body && r.body.getReader) {
      const rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done: d, value } = await rd.read(); if (d) break; parts.push(value); got += value.length; btn.textContent = `${Math.min(99, Math.round(got / c.size * 100))} %`; }
      const all = new Uint8Array(got); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      data = JSON.parse(new TextDecoder().decode(all));
    } else data = await r.json();
    const id = 'c' + c.id;
    await store.set('bible:' + id, { books: data.books });
    S.bibleData.set(id, Promise.resolve({ books: data.books }));
    S.bibles = S.bibles.filter(b => b.id !== id);
    S.bibles.push({ id, name: c.name, abbr: c.abbr, lang: c.lang, books: c.books, verses: c.verses, license: c.license, holder: c.holder, source: c.source, catalog: c.id, date: new Date().toLocaleDateString(uiLang()) });
    await store.set('bibles', S.bibles);
    const tx = S.settings.texts || ['rv']; if (tx.length < 4 && !tx.includes(id)) { tx.push(id); S.settings.texts = tx; saveSettings(); }
    toast(t('{a} agregada a las versiones para comparar', { a: c.abbr }));
    done();
    const bx = $('#bibles'); if (bx) { bx.innerHTML = biblesRowsHTML(); bindBibles(); }
  } catch (e) {
    btn.disabled = false; btn.textContent = t('Reintentar');
    toast(t('No se pudo descargar. Revisa la conexión.'));
  }
}

// ------------------------------------------------------------------ obras de consulta (EPUB / PDF)
async function getWork(id) {
  if (!S.workData.has(id)) S.workData.set(id, store.get('work:' + id, null).then(d => {
    if (d) { d.heads = d.entries.map(e => norm(e[0]).split(/\s*[,;/]\s*|\s+[yo]\s+/).map(x => x.replace(/\(.*?\)/g, '').replace(/[^a-z0-9ñ ]/g, '').trim())); }
    return d;
  }));
  return S.workData.get(id);
}
const workMeta = (id) => S.works.find(w => w.id === id);
function snippet(tx, at, len = 220) {
  const a = Math.max(0, tx.lastIndexOf(' ', Math.max(0, at - len / 2)));
  const z = Math.min(tx.length, tx.indexOf(' ', at + len / 2) > 0 ? tx.indexOf(' ', at + len / 2) : tx.length);
  return (a > 0 ? '…' : '') + tx.slice(a, z).replace(/\n/g, ' ').trim() + (z < tx.length ? '…' : '');
}
function entryBtn(wid, ei, at, title, snip, mark) {
  return `<button class="res wcite" data-wid="${wid}" data-ei="${ei}" data-at="${at ?? ''}"><span class="ref">${esc(title)}</span>${snip ? (mark ? hilite(snip, mark) : esc(snip)) : ''}</button>`;
}
// citas de un versículo en todas las obras
async function citesHTML(b, c, v, withRef = false) {
  const key = refKey(b, c, v); let html = '';
  for (const w of S.works) {
    const d = await getWork(w.id); if (!d) continue;
    const hits = d.vidx[key] || []; if (!hits.length) continue;
    html += `<div class="wgroup"><div class="wtitle">${icon('books', 'inl')}${esc(w.name)} <span class="chip">${hits.length}</span></div>
      <div class="results">${hits.slice(0, 30).map(([ei, at]) => entryBtn(w.id, ei, at, d.entries[ei][0], snippet(d.entries[ei][1], at))).join('')}</div>
      ${hits.length > 30 ? `<p class="hint">${t('Se muestran 30 de {n} artículos.', { n: hits.length })}</p>` : ''}</div>`;
  }
  return html ? `<div class="h3">${t('En tus obras de consulta')}${withRef ? ' · ' + esc(refLabel(b, c, v)) : ''}</div>${html}`
    : withRef ? '' : `<div class="h3">${t('En tus obras de consulta')}</div><p class="hint">${t('Ninguna de tus obras cita este versículo.')}</p>`;
}
// artículos de diccionario para una palabra: por número Strong y, si no hay, por el título del artículo
async function dictHTML(strong, glosses) {
  let html = '';
  const words = glosses.filter(Boolean).flatMap(g => norm(g).replace(/[^a-z0-9ñ/ ]/g, ' ').split(/[\/ ]+/)).filter(x => x.length > 2 && !['los', 'las', 'del', 'que', 'por', 'con', 'una', 'para'].includes(x));
  for (const w of S.works) {
    const d = await getWork(w.id); if (!d) continue;
    let hits = (d.sidx[strong] || []).map(ei => [ei, 'S']);
    if (!hits.length && words.length) d.heads.forEach((hs, ei) => { if (hits.length < 6 && hs.some(h => words.includes(h))) hits.push([ei, '']); });
    if (!hits.length) continue;
    html += `<div class="wgroup"><div class="wtitle">${icon('books', 'inl')}${esc(w.name)}</div><div class="results">${hits.slice(0, 8).map(([ei, k]) => {
      const tx = d.entries[ei][1]; const at = k === 'S' ? Math.max(0, tx.search(new RegExp(`\\b${+strong.slice(1)}\\b`))) : 0;
      return entryBtn(w.id, ei, at, d.entries[ei][0], snippet(tx, at, 180));
    }).join('')}</div></div>`;
  }
  return html ? `<div class="h3">${t('Diccionario')}</div>${html}` : '';
}
async function worksSearchHTML(q) {
  const nq = norm(q).trim(); if (nq.length < 3) return '';
  const words = nq.replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean);
  let html = '';
  for (const w of S.works) {
    const d = await getWork(w.id); if (!d) continue;
    const titles = [], body = [];
    d.entries.forEach(([ti, tx], ei) => {
      const nt = norm(ti);
      if (nt === nq || d.heads[ei].includes(nq)) titles.unshift([ei, 0]);
      else if (nt.startsWith(nq)) titles.push([ei, 0]);
      else if (body.length < 40) { const ntx = norm(tx); const i = ntx.indexOf(words[0]); if (i >= 0 && words.every(x => ntx.includes(x))) body.push([ei, i]); }
    });
    const all = [...titles.slice(0, 10), ...body]; if (!all.length) continue;
    html += `<div class="wgroup"><div class="wtitle">${icon('books', 'inl')}${esc(w.name)} <span class="chip">${body.length >= 40 ? '40+' : all.length}</span></div><div class="results">${all.slice(0, 25).map(([ei, at]) =>
      entryBtn(w.id, ei, at, d.entries[ei][0], snippet(d.entries[ei][1], at, 200), words)).join('')}</div></div>`;
  }
  return html ? `<div class="h3">${t('Obras de consulta')}</div>${html}` : '';
}
function bindCites(el) {
  el.querySelectorAll('.wcite').forEach(btn => btn.onclick = () => openEntry(btn.dataset.wid, +btn.dataset.ei, btn.dataset.at === '' ? null : +btn.dataset.at));
}
async function openEntry(wid, ei, at) {
  const w = workMeta(wid), d = await getWork(wid); if (!d) return;
  const [title, tx] = d.entries[ei];
  const paras = []; let p = 0, target = -1;
  for (const para of tx.split('\n')) { if (at != null && target < 0 && at >= p && at <= p + para.length) target = paras.length; paras.push(para); p += para.length + 1; }
  const sh = openSheet(`<div style="font-weight:700;font-size:18px">${esc(title)}</div><div class="sub">${esc(w.name)}</div>`,
    `<div class="wentry">${paras.map((x, i) => `<p${i === target ? ' class="here" id="wh"' : ''}>${RW.linkRefs(x, esc)}</p>`).join('')}</div>
     <div class="btnrow">${ei > 0 ? `<button class="btn ghost sm" id="wprev">‹ ${esc(d.entries[ei - 1][0].slice(0, 28))}</button>` : ''}${ei < d.entries.length - 1 ? `<button class="btn ghost sm" id="wnext">${esc(d.entries[ei + 1][0].slice(0, 28))} ›</button>` : ''}
     <button class="btn ghost sm" id="wcp">${icon('copy')}${t('Copiar')}</button></div>`, title);
  sh.classList.add('tall');
  sh.querySelectorAll('.bref').forEach(a => a.onclick = () => { closeSheet(); const [b, c, v] = a.dataset.ref.split('-'); go(`r-${b}-${c}-${v}`); });
  const pv = sh.querySelector('#wprev'); if (pv) pv.onclick = () => openEntry(wid, ei - 1, null);
  const nx = sh.querySelector('#wnext'); if (nx) nx.onclick = () => openEntry(wid, ei + 1, null);
  sh.querySelector('#wcp').onclick = () => copyText(`${title}\n\n${tx}\n\n— ${w.name}`);
  const h = sh.querySelector('#wh'); if (h) setTimeout(() => h.scrollIntoView({ block: 'center' }), 60);
}
function worksRowsHTML() {
  return `${S.works.map(w => `<div class="setrow"><div class="lb">${esc(w.name)}<small>${w.kind.toUpperCase()} · ${t('{e} artículos · {v} versículos citados', { e: nf(w.entries), v: nf(w.verses) })}${w.strongs ? ' · ' + t('{s} números Strong', { s: nf(w.strongs) }) : ''}</small></div>
      <button class="btn ghost sm" data-wdel="${w.id}">${t('Eliminar')}</button></div>`).join('')}
    <div class="setrow"><div class="lb">${t('Importar obra en EPUB o PDF')}<small>${t('Diccionario, enciclopedia o comentario')}</small></div>
      <label class="btn" for="wkf" tabindex="0">${icon('download')}${t('Elegir archivo')}</label><input type="file" id="wkf" accept=".epub,.pdf,application/epub+zip,application/pdf" hidden></div>`;
}
function bindWorks() {
  const box = $('#works'); if (!box) return;
  box.querySelectorAll('[data-wdel]').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.wdel;
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = t('¿Eliminar? Toca otra vez'); btn.style.background = 'var(--hl4)'; return; }
    S.works = S.works.filter(w => w.id !== id); S.workData.delete(id);
    await store.set('works', S.works); await store.set('work:' + id, null);
    toast(t('Obra eliminada')); box.innerHTML = worksRowsHTML(); bindWorks();
  });
  const lab = box.querySelector('label[for="wkf"]');
  if (lab) lab.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#wkf').click(); } };
  const inp = $('#wkf');
  if (inp) inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) runWorkImport(f); };
}
async function runWorkImport(file) {
  const out = $('#wimpres');
  out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('Leyendo')} ${esc(file.name)}…</b><div class="hint" id="wimpp">${t('Abriendo el archivo')}</div></div>`;
  RW.setVerseCounts(S.meta);
  const isPdf = /\.pdf$/i.test(file.name);
  let w;
  try {
    w = await RW.importWork(file, (i, n) => { const p = $('#wimpp'); if (p) p.textContent = t(isPdf ? 'Leyendo página {i} de {n}' : 'Analizando sección {i} de {n}', { i, n }); });
  } catch (e) {
    out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('No se pudo importar')}</b><p class="hint">${esc(e.message || String(e))}</p>${/password|encrypt/i.test(String(e && e.name) + e.message) ? `<p class="hint">${t('El archivo está protegido con contraseña o DRM.')}</p>` : ''}</div>`; return;
  }
  const verses = Object.keys(w.vidx).length;
  if (w.entries.length < 3) {
    out.innerHTML = `<div class="setgroup" style="padding:14px"><b>${t('No se encontró texto en el archivo')}</b><p class="hint">${t('Si el PDF es una imagen escaneada, no tiene texto que se pueda leer. Prueba con una edición digital.')}</p></div>`; return;
  }
  out.innerHTML = `<div class="setgroup" style="padding:14px">
    <b>${t('{e} artículos · {v} versículos citados', { e: nf(w.entries.length), v: nf(verses) })}${w.stats.strongs ? ' · ' + t('{s} números Strong', { s: nf(w.stats.strongs) }) : ''}</b>
    <p class="hint">${t('Primeros artículos:')} ${esc(w.entries.slice(0, 12).map(e => e[0]).join(' · '))}</p>
    <div class="kv" style="grid-template-columns:auto 1fr;align-items:center">
      <dt><label for="wimp-name">${t('Nombre')}</label></dt><dd><input id="wimp-name" value="${esc(w.title)}" style="width:100%"></dd></div>
    <div class="btnrow"><button class="btn" id="wimp-save">${t('Guardar en este dispositivo')}</button><button class="btn ghost" id="wimp-cancel">${t('Descartar')}</button></div></div>`;
  $('#wimp-cancel').onclick = () => { out.innerHTML = ''; };
  $('#wimp-save').onclick = async () => {
    const id = 'w' + Date.now().toString(36);
    const data = { entries: w.entries, vidx: w.vidx, sidx: w.sidx };
    await store.set('work:' + id, data);
    S.workData.delete(id);
    S.works.push({ id, name: $('#wimp-name').value.trim() || w.title, kind: w.kind, entries: w.entries.length, verses, strongs: w.stats.strongs, date: new Date().toLocaleDateString(uiLang()) });
    await store.set('works', S.works);
    out.innerHTML = ''; $('#works').innerHTML = worksRowsHTML(); bindWorks();
    toast(t('Obra guardada: aparecerá al tocar un versículo'));
  };
}

// ------------------------------------------------------------------ actualizaciones automáticas
// Tres caminos, según dónde corre la app:
//  · APK (Android, descarga directa): version.json en el repositorio público → aviso con novedades → el plugin
//    nativo AppUpdater descarga solo por https, verifica el SHA-256 y abre el instalador. No va en Google Play.
//  · Contenido (Android): los cambios pequeños llegan solos con Capgo (paquete web), sin reinstalar.
//  · Web: web-version.txt sin caché; si cambió, la página se recarga sola cuando nadie está escribiendo.
const Updater = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
const ApkUpd = () => FLAVOR !== 'play' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdater;
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ssGet = (k, d) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };
const CHECK_EVERY = 30 * 60e3, SNOOZE = 24 * 3600e3, WEB_EVERY = 10 * 60e3;
let updState = { st: 'idle' };
function updBar(html) {
  document.querySelectorAll('.updbar').forEach(x => x.remove());
  if (!html) return;
  const d = document.createElement('div'); d.className = 'updbar'; d.setAttribute('role', 'status'); d.innerHTML = html; document.body.append(d);
  const x = d.querySelector('[data-x]'); if (x) x.onclick = () => d.remove();
  return d;
}
const fmtMB = (n) => (n / 1048576).toLocaleString(uiLang(), { maximumFractionDigits: 1 }) + ' MB';

// ---- APK
function validVersionJson(V) {
  return V && Number.isInteger(+V.versionCode) && +V.versionCode > 0 && /^https:\/\//.test(V.url || '') && /^[0-9a-f]{64}$/i.test(V.sha256 || '');
}
async function checkApk({ manual = false } = {}) {
  const P = ApkUpd(); if (!isNative() || !P || !window.APP_UPDATE_JSON) return null;
  if (!manual && Date.now() - (lsGet('apkChecked', 0)) < CHECK_EVERY) return null;
  lsSet('apkChecked', Date.now());
  let info, V;
  try {
    info = await P.getInfo();
    const r = await fetch(window.APP_UPDATE_JSON + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    V = await r.json();
  } catch { if (manual) toast(t('No se pudo buscar actualizaciones. Revisa la conexión.')); return 'err'; }
  if (!validVersionJson(V)) return 'err';
  const cur = +info.versionCode;
  if (+V.versionCode <= cur) return 'ok';
  const mandatory = cur < +(V.minVersionCode || 0);
  const sn = lsGet('apkSnooze', null);
  if (!manual && !mandatory && sn && sn.code === +V.versionCode && sn.until > Date.now()) return 'snoozed';
  updState = { st: 'apk', v: V.versionName }; refreshUpdRow();
  showApkPrompt(V, info, mandatory);
  return 'new';
}
function apkModal(html) {
  let m = document.querySelector('.updmodal');
  if (!m) { m = document.createElement('div'); m.className = 'updmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.append(m); }
  m.innerHTML = `<div class="updcard">${html}</div>`;
  return m;
}
function closeApkModal() { document.querySelectorAll('.updmodal').forEach(x => x.remove()); }
function showApkPrompt(V, info, mandatory) {
  const notes = String(V.notes || '').trim();
  const m = apkModal(`<div class="updt">${t('Nueva versión {v}', { v: esc(V.versionName || V.versionCode) })}</div>
    <div class="upds">${t('Tienes la {v}', { v: esc(info.versionName || info.versionCode) })}${V.size ? ' · ' + fmtMB(V.size) : ''}</div>
    ${mandatory ? `<p class="updmust">${t('Esta actualización es necesaria para seguir usando la app.')}</p>` : ''}
    ${notes ? `<div class="h3">${t('Novedades')}</div><div class="updnotes">${notes.split('\n').map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
    <div id="updmsg" class="hint"></div>
    <div class="updprog" hidden><div class="bar"><i style="width:0"></i></div><span class="pct"></span></div>
    <div class="btnrow updbtns"><button class="btn" id="apk-go">${icon('download')}${t('Actualizar')}</button>
      ${mandatory ? '' : `<button class="btn ghost" id="apk-later">${t('Más tarde')}</button>`}</div>`);
  m.querySelector('#apk-go').onclick = () => runApkUpdate(V, mandatory);
  const later = m.querySelector('#apk-later');
  if (later) later.onclick = () => { lsSet('apkSnooze', { code: +V.versionCode, until: Date.now() + SNOOZE }); closeApkModal(); };
}
async function runApkUpdate(V, mandatory) {
  const P = ApkUpd(); const m = document.querySelector('.updmodal'); if (!P || !m) return;
  const msg = m.querySelector('#updmsg'), btns = m.querySelector('.updbtns'), go = m.querySelector('#apk-go');
  const setBusy = (b) => { go.disabled = b; const l = m.querySelector('#apk-later'); if (l) l.disabled = b; };
  setBusy(true); msg.textContent = '';
  try {
    // 1) permiso «instalar apps desconocidas»: se explica, se abre el ajuste y se continúa solo al volver
    let { granted } = await P.canInstall();
    if (!granted) {
      msg.innerHTML = t('Para instalar la actualización, Android necesita que permitas a esta app «instalar apps desconocidas». Se abrirá ese ajuste: activa el interruptor y vuelve atrás.');
      go.innerHTML = `${icon('gear')}${t('Abrir ajustes')}`; setBusy(false);
      go.onclick = async () => {
        setBusy(true);
        let r = { granted: false };
        try { r = await P.openInstallSettings(); } catch {}
        if (r.granted) { go.innerHTML = `${icon('download')}${t('Actualizar')}`; go.onclick = () => runApkUpdate(V, mandatory); runApkUpdate(V, mandatory); }
        else { msg.textContent = t('No se activó el permiso. Sin él no se puede instalar la actualización.'); setBusy(false); }
      };
      return;
    }
    // 2) descarga (solo https) con progreso y verificación de la huella SHA-256 en el plugin nativo
    const pr = m.querySelector('.updprog'), bar = pr.querySelector('i'), pct = pr.querySelector('.pct');
    pr.hidden = false; msg.textContent = t('Descargando…');
    const h = await P.addListener('downloadProgress', (e) => { const tot = e.total || V.size || 0; const p = tot ? Math.min(100, Math.round(e.downloaded / tot * 100)) : 0; bar.style.width = p + '%'; pct.textContent = tot ? `${p} % · ${fmtMB(e.downloaded)} / ${fmtMB(tot)}` : fmtMB(e.downloaded); });
    let res;
    try { res = await P.download({ url: V.url, sha256: V.sha256, size: V.size || -1 }); } finally { try { h.remove(); } catch {} }
    // 3) instalador de Android
    msg.textContent = t('Abriendo el instalador…');
    await P.install({ path: res.path, sha256: V.sha256 });
    msg.textContent = t('Confirma la instalación en la ventana de Android. La app se reiniciará con la nueva versión.');
    setBusy(false);
  } catch (e) {
    const code = e && (e.code || (e.data && e.data.code));
    msg.textContent = code === 'SHA_MISMATCH' ? t('El archivo descargado no coincide con la huella publicada. Por seguridad no se instaló. Inténtalo más tarde.')
      : code === 'NO_PERMISSION' ? t('Falta el permiso para instalar apps. Vuelve a intentarlo para abrir el ajuste.')
      : code === 'NOT_HTTPS' ? t('La actualización no se ofrece por una conexión segura y se canceló.')
      : t('No se pudo descargar la actualización. Revisa la conexión e inténtalo de nuevo.');
    const pr = m.querySelector('.updprog'); if (pr) pr.hidden = true;
    setBusy(false);
  }
}

// ---- contenido (Capgo)
async function checkBundle(manual = false) {
  const U = Updater(); if (!isNative() || !U || !window.APP_UPDATE_URL) return null;
  if (updState.st === 'busy') return null;
  updState = { st: 'busy' }; refreshUpdRow();
  try {
    const L = await (await fetch(window.APP_UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' })).json();
    const nat = (await U.getBuiltinVersion()).version || '0';
    const natN = +String(nat).split('.').pop() || 0;
    if (L.minNative && natN < L.minNative) {        // el cambio necesita un APK nuevo
      if (ApkUpd()) { updState = { st: 'idle' }; await checkApk({ manual: true }); return 'apk'; }
      updState = { st: 'apk', v: L.version };          // APK antiguo sin actualizador: enlace de descarga
      updBar(`<span>${t('Hay una nueva versión de la app para instalar')}</span><a class="btn sm" href="${esc(L.apk)}" target="_blank" rel="noopener">${t('Descargar')}</a><button class="ibtn" data-x aria-label="${t('Cerrar')}">${icon('close')}</button>`);
      return 'apk';
    }
    if (cmpVer(L.version, VERSION) <= 0) { updState = { st: 'ok' }; return 'ok'; }
    const conn = navigator.connection;
    if (!manual && conn && conn.saveData) { updState = { st: 'wait', v: L.version }; return 'wait'; }
    const { bundles } = await U.list();
    let bi = bundles.find(b => b.version === L.version && b.status !== 'error');
    if (!bi) bi = await U.download({ url: L.url, version: L.version });
    await U.next({ id: bi.id });                          // por si se cierra antes: se aplica al volver a abrir
    updState = { st: 'ready', v: L.version, id: bi.id };
    // igual que la web: aplicar en cuanto el usuario no esté escribiendo (una sola vez por versión, sin bucles)
    if (lsGet('bundleTried') !== L.version) { lsSet('bundleTried', L.version); applyBundleWhenIdle(U, bi.id); }
    const bar = updBar(`<span>${t('Hay una actualización lista')} · ${esc(L.version)}</span><button class="btn sm" data-restart>${t('Reiniciar')}</button><button class="ibtn" data-x aria-label="${t('Cerrar')}">${icon('close')}</button>`);
    bar.querySelector('[data-restart]').onclick = () => U.set({ id: bi.id });
    return 'ready';
  } catch {
    updState = { st: 'err' }; return 'err';
  } finally { refreshUpdRow(); }
}

function applyBundleWhenIdle(U, id) {
  if (isTyping() || document.querySelector('.sheet textarea, .sheet input[type=text]') || document.visibilityState !== 'visible') { setTimeout(() => applyBundleWhenIdle(U, id), 4000); return; }
  U.set({ id }).catch(() => {});
}

// ---- web
let webLoaded = null, webPending = null, lastTyping = 0;
const isTyping = () => { const a = document.activeElement; return (a && a.matches && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select, [contenteditable=""], [contenteditable="true"]')) || Date.now() - lastTyping < 3000; };
async function fetchWebVersion() {
  const r = await fetch('web-version.txt?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  return (await r.text()).trim();
}
async function checkWeb({ manual = false } = {}) {
  if (isNative()) return null;
  let v;
  try { v = await fetchWebVersion(); } catch { if (manual) toast(t('No se pudo buscar actualizaciones. Revisa la conexión.')); return 'err'; }
  if (!v || !/^[\w.+-]{1,40}$/.test(v)) return 'err';
  webLoaded ||= VERSION;
  if (v === webLoaded) { updState = { st: 'ok' }; refreshUpdRow(); return 'ok'; }
  webPending = v; updState = { st: 'web', v }; refreshUpdRow();
  if (manual) return 'new';                                   // en Ajustes: el botón «Actualizar ahora»
  const g = ssGet('webReload', null);                         // evita bucles: si ya se recargó por esta versión hace poco, no insistir
  if (g && g.v === v && Date.now() - g.t < WEB_EVERY) return 'stuck';
  reloadWhenIdle(v);
  return 'new';
}
function reloadWhenIdle(v) {
  if (isTyping()) { setTimeout(() => reloadWhenIdle(v), 4000); return; }
  if (document.querySelector('.sheet textarea, .sheet input[type=text]') && document.querySelector('.sheet')) { setTimeout(() => reloadWhenIdle(v), 4000); return; }
  doWebReload(v);
}
async function doWebReload(v) {
  ssSet('webReload', { v, t: Date.now() });
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch {}
  try { if (window.caches) for (const k of await caches.keys()) if (k.startsWith('il-shell')) await caches.delete(k); } catch {}
  location.reload();
}

// ---- Ajustes
function updRowHTML() {
  const st = updState.st;
  const msg = st === 'busy' ? t('Buscando…') : st === 'ready' ? t('Versión {v} lista: se aplicará al reiniciar', { v: updState.v }) : st === 'wait' ? t('Versión {v} disponible: se descargará con wifi', { v: updState.v })
    : st === 'apk' ? t('Hay una nueva versión de la app para instalar') : st === 'exe' ? t('Hay una nueva versión del programa para Windows') : st === 'web' ? t('Hay una versión nueva: {v}', { v: updState.v }) : st === 'ok' ? t('Tienes la versión más reciente')
    : isNative() || isDesktop() ? t('Se actualiza sola al abrirla con conexión') : t('La página se actualiza sola');
  const btn = st === 'ready' ? `<button class="btn sm" id="upd-go">${t('Reiniciar')}</button>`
    : st === 'web' ? `<button class="btn sm" id="upd-web">${t('Actualizar ahora')}</button>`
    : `<button class="btn ghost sm" id="upd-chk" ${st === 'busy' ? 'disabled' : ''}>${t('Buscar actualizaciones')}</button>`;
  return `<div class="lb">${t('Actualizaciones')}<small>${t('Versión')} ${esc(VERSION)} · ${msg}</small></div>${btn}`;
}
function refreshUpdRow() {
  const r = $('#updrow'); if (!r) return;
  r.innerHTML = updRowHTML();
  const c = $('#upd-chk'); if (c) c.onclick = () => checkAllUpdates(true);
  const g = $('#upd-go'); if (g) g.onclick = () => { if (isDesktop()) { doWebReload(updState.v); return; } const U = Updater(); if (U) U.set({ id: updState.id }); };
  const w = $('#upd-web'); if (w) w.onclick = () => doWebReload(updState.v);
}
// ---- escritorio (Windows portable): el contenido se actualiza solo; el .exe avisa cuando hay uno nuevo
async function checkDesktop({ manual = false } = {}) {
  const D = window.desktop; if (!D) return null;
  updState = { st: 'busy' }; refreshUpdRow();
  try {
    const r = await D.checkContent();
    let exe = null;
    try {
      const j = await (await fetch(window.APP_DESKTOP_JSON + '?t=' + Date.now(), { cache: 'no-store' })).json();
      const mine = +String((await D.version()).app).split('.').pop() || 0;
      if (j && j.url && +j.versionCode > mine) exe = j;
    } catch {}
    if (exe) {
      updState = { st: 'exe', v: exe.versionName };
      const bar = updBar(`<span>${t('Hay una nueva versión del programa para Windows')} · ${esc(exe.versionName)}</span><button class="btn sm" data-exe>${t('Descargar')}</button><button class="ibtn" data-x aria-label="${t('Cerrar')}">${icon('close')}</button>`);
      bar.querySelector('[data-exe]').onclick = () => D.openExternal(exe.url);
      return 'exe';
    }
    updState = { st: r && r.st === 'ready' ? 'ready' : r && r.st === 'err' ? 'err' : 'ok', v: r && r.v };
    return updState.st;
  } finally { refreshUpdRow(); }
}
async function checkAllUpdates(manual = false) {
  if (isDesktop()) { const r = await checkDesktop({ manual }); if (manual && r === 'ok') toast(t('Tienes la versión más reciente')); if (manual && r === 'err') toast(t('No se pudo buscar actualizaciones. Revisa la conexión.')); return; }
  if (!isNative()) { const r = await checkWeb({ manual }); if (manual && r === 'ok') toast(t('Tienes la versión más reciente')); return; }
  const a = await checkApk({ manual });
  if (a === 'new') return;
  const b = await checkBundle(manual);
  if (manual && (a === 'ok' || a === null) && b === 'ok') toast(t('Tienes la versión más reciente'));
  if (manual && a === 'err' && b === 'err') toast(t('No se pudo buscar actualizaciones. Revisa la conexión.'));
}
async function initUpdates() {
  document.addEventListener('keydown', () => { lastTyping = Date.now(); }, true);
  document.addEventListener('input', () => { lastTyping = Date.now(); }, true);
  if (isNative()) {
    const U = Updater(); if (U) { try { await U.notifyAppReady(); } catch {} }   // confirma que esta versión arrancó bien
    setTimeout(() => checkAllUpdates(false), 3000);
    let last = Date.now(), lastB = Date.now();
    const again = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last > CHECK_EVERY) { last = lastB = Date.now(); checkAllUpdates(false); }
      else if (Date.now() - lastB > WEB_EVERY) { lastB = Date.now(); checkBundle(false); }   // contenido: al mismo ritmo que la web
    };
    document.addEventListener('visibilitychange', again);
    setInterval(again, 60 * 1000);
    return;
  }
  if (isDesktop()) {
    window.desktop.onContentReady((v) => { if (v !== VERSION && lsGet('deskTried') !== v) { lsSet('deskTried', v); reloadWhenIdle(v); } });
    setTimeout(() => checkDesktop(), 3000);
    setInterval(() => { if (document.visibilityState === 'visible') checkDesktop(); }, WEB_EVERY);
    return;
  }
  webLoaded = VERSION;
  setTimeout(() => checkWeb(), 5000);
  setInterval(() => { if (document.visibilityState === 'visible') checkWeb(); }, WEB_EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkWeb(); });
}

const isDesktop = () => !!window.desktop;
function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
async function downloadAll() {
  const offs = $('#offs'), dl = $('#dl');
  if (!('caches' in window)) { offs.textContent = t('Este navegador no permite guardar datos sin conexión.'); return; }
  dl.disabled = true;
  const files = ['data/meta.json', 'data/notes.json', 'data/lex/heb.json', 'data/lex/grk.json', 'data/conc.json', 'data/rv.json', ...S.meta.books.map(b => `data/books/${b.id}.json`)];
  try {
    const cache = await caches.open('il-data-v2');
    let n = 0;
    for (const f of files) {
      if (!(await cache.match(f))) await cache.add(f);
      n++; offs.textContent = t('Descargando… {n} de {m}', { n, m: files.length });
    }
    offs.textContent = t('Listo: la Biblia completa está disponible sin conexión.');
  } catch (e) { offs.textContent = t('La descarga se interrumpió. Vuelve a intentarlo con conexión.'); dl.disabled = false; }
}

// ------------------------------------------------------------------ inicio
async function boot() {
  S.settings = { ...DEF_SETTINGS, ...(await store.get('settings', {})) };
  if (!S.settings.main) S.settings.main = 'rv';
  if (S.settings.texts && !S.settings.texts.includes(S.settings.main)) S.settings.texts.unshift(S.settings.main);
  setLang(S.settings.ui || (navigator.language || 'es').slice(0, 2));
  S.user = { hl: {}, notes: {}, bm: {}, arts: {}, last: null, ...(await store.get('user', {})) };
  S.user.arts ||= {};
  S.bibles = (await store.get('bibles', [])) || [];
  S.works = (await store.get('works', [])) || [];
  try { S.lect = await (await fetch('lecturas.json')).json(); } catch { S.lect = null; }
  applyTheme();
  try { S.meta = await loadJSON('data/meta.json'); }
  catch (e) { app.innerHTML = `<div class="empty">${t('No se encontraron los datos bíblicos.')}<br>${esc(e.message)}</div>`; return; }
  window.addEventListener('hashchange', render);
  // la app Android abre donde se quedó la lectura; en la web, la dirección sin «#…» muestra el inicio (con «Seguir leyendo»)
  if (!location.hash && S.user.last && isNative()) history.replaceState(null, '', `#r-${S.user.last.b}-${S.user.last.c}`);
  // la web muestra la bienvenida en la primera visita (solo al entrar por la portada, no por un enlace a un versículo)
  if (!isNative() && !isDesktop() && !location.hash && !lsGet('welcomed') && !matchMedia('(display-mode: standalone)').matches) history.replaceState(null, '', '#bienvenida');
  render();
  initUpdates();
  initShareTarget();
  if ('serviceWorker' in navigator && !isNative() && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
