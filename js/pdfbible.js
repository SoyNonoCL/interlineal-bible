// Importador de Biblias en PDF. Un PDF no tiene etiquetas: se reconstruye la estructura por la tipografía
// (títulos de libro, números de capítulo grandes, números de versículo pequeños o elevados, «Capítulo 3»,
// «3:16») y se valida contra el conteo real de capítulos y versículos de cada libro.
// Todo ocurre en el dispositivo. Devuelve lo mismo que importEpub: { title, lang, books, report, source }.
import { matchBook, chapterNum, report, BOOK_IDS } from './epub.js';
import { pdfjs, compose } from './refworks.js';

const DIGITS = /^\d{1,3}$/;
const NOTE_ONLY = /^\[[^\]]{1,4}\]$/;
const NOTE_MARK = /\[(?:\d{1,3}|[A-Za-z]{1,2})\]/g;
const N = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// idioma aproximado por palabras frecuentes
const STOP = {
  es: ['y', 'de', 'que', 'el', 'la', 'los', 'en', 'a', 'les', 'dijo', 'para', 'con', 'su', 'por'],
  en: ['the', 'and', 'of', 'to', 'that', 'in', 'he', 'shall', 'unto', 'for', 'his', 'they', 'with'],
  pt: ['e', 'de', 'que', 'o', 'a', 'os', 'em', 'para', 'com', 'disse', 'nao', 'seu', 'ao', 'do'],
  fr: ['et', 'de', 'la', 'le', 'les', 'il', 'que', 'des', 'qui', 'dans', 'pour', 'a', 'est', 'en'],
  de: ['und', 'die', 'der', 'das', 'zu', 'er', 'sie', 'nicht', 'den', 'ich', 'mit', 'sprach', 'ist'],
  it: ['e', 'di', 'che', 'il', 'la', 'a', 'i', 'non', 'per', 'le', 'gli', 'disse', 'con', 'del'],
};
function guessLang(sample) {
  const w = N(sample).split(/[^a-z]+/).filter(Boolean); const cnt = {};
  for (const [l, list] of Object.entries(STOP)) { const set = new Set(list); cnt[l] = w.filter(x => set.has(x)).length; }
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > w.length * 0.08 ? best[0] : '';
}

export async function importPdfBible(file, expected, onProgress = () => {}) {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({ data, cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true, isEvalSupported: false });
  let doc;
  try { doc = await task.promise; }
  catch (e) { throw new Error(/password/i.test(e && e.name + e.message) ? 'El PDF está protegido con contraseña.' : 'No se pudo abrir el PDF: ' + (e.message || e)); }
  let title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
  let lang = '';
  try { const md = await doc.getMetadata(); if (md && md.info) { if (md.info.Title && md.info.Title.trim().length > 3 && !/^\(?(anonymous|untitled|sin t[ií]tulo)\)?$/i.test(md.info.Title.trim())) title = md.info.Title.trim(); if (md.info.Language) lang = md.info.Language; } } catch {}

  // ---- 1. tipografía del cuerpo: tamaño y fuente más frecuentes en una muestra de páginas
  const P = doc.numPages;
  const sizes = new Map(), fonts = new Map(); let sampleText = '';
  for (const n of [...new Set([0.2, 0.35, 0.5, 0.65, 0.8].map(f => Math.max(1, Math.round(P * f))))]) {
    const tc = await (await doc.getPage(n)).getTextContent();
    for (const it of tc.items) {
      const t = it.str && it.str.trim(); if (!t || DIGITS.test(t)) continue;
      const sz = Math.round(Math.hypot(it.transform[0], it.transform[1]) * 2) / 2;
      sizes.set(sz, (sizes.get(sz) || 0) + t.length); fonts.set(it.fontName, (fonts.get(it.fontName) || 0) + t.length);
      if (sampleText.length < 6000) sampleText += ' ' + t;
    }
  }
  const body = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  const bodyFont0 = [...fonts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!lang) lang = guessLang(sampleText);

  // ---- 2. recorrer el PDF y convertirlo en una secuencia de eventos
  const ev = []; let stop = false;
  const push = (e) => ev.push(e);
  for (let n = 1; n <= P && !stop; n++) {
    onProgress(n, P);
    const page = await doc.getPage(n);
    const H = page.view[3] - page.view[1];
    const tc = await page.getTextContent();
    const lines = []; let line = null;
    for (const it of tc.items) {
      if (!it.str) continue;
      const sz = Math.hypot(it.transform[0], it.transform[1]), y = it.transform[5];
      const small = sz < body * 0.9;
      const tol = small ? body * 0.8 : Math.max(sz, body) * 0.55;
      if (!line || Math.abs(y - line.y) > tol || (it.transform[4] < line.lastX - body * 4 && Math.abs(y - line.y) > 1)) {
        line = { y: small ? y - body * 0.3 : y, items: [], lastX: 0 }; lines.push(line);
      } else if (!small && line.items.every(i => i.sz < body * 0.9)) line.y = y;   // la línea empezó con un número elevado
      line.items.push({ s: it.str, sz, y, font: it.fontName });
      line.lastX = it.transform[4] + (it.width || 0);
    }
    // fuente del cuerpo en esta página (los identificadores de fuente cambian a lo largo del PDF)
    let bodyFont = bodyFont0;
    { const fc = new Map(); let tot = 0;
      for (const ln of lines) for (const i of ln.items) { const t = i.s.trim(); if (t && !DIGITS.test(t) && Math.abs(i.sz - body) < body * 0.06) { fc.set(i.font, (fc.get(i.font) || 0) + t.length); tot += t.length; } }
      if (tot > 200) bodyFont = [...fc.entries()].sort((a, b) => b[1] - a[1])[0][0]; }
    // títulos que ocupan varias líneas («LAMENTAÇÕES DE» / «JEREMIAS.») se juntan antes de reconocerlos
    const hb = [];
    const flushTitle = () => {
      if (!hb.length) return;
      const big = (h) => h.maxSz >= body * 1.4;
      // el tramo de líneas consecutivas más largo que forma un nombre de libro (el subtítulo de debajo no cuenta)
      let id = null, at = 0;
      for (let len = Math.min(hb.length, 4); len >= 1 && !id; len--) for (let a = 0; a + len <= hb.length && !id; a++) {
        const part = hb.slice(a, a + len);
        if (part.slice(0, -1).some(h => /[.!?;:]$/.test(h.text))) continue;           // un título no tiene un punto en medio
        const txt = part.map(h => h.text).join(' ').replace(/\s\d{1,3}$/, '');
        if (txt.length <= 120) { id = matchBook(txt, part.some(big)); at = a; }
      }
      // líneas en mayúsculas antes del título son texto («JEHOVÁ-SHAMMA.» al final de Ezequiel)
      const before = id ? hb.slice(0, at) : hb;
      for (const h of before) { if (h.allBig) push({ t: 'br' }); else content(h); }
      if (id) push({ t: 'book', id });
      hb.length = 0;
    };
    const content = (L) => {
      const { ln, text, allOtherFont, hasDigit, maxSz, words } = L;
      // «Capítulo 3», «CHAPTER 3», «Salmo 23» como línea propia
      if (!DIGITS.test(text) && text.length <= 20) {
        const cn = chapterNum(text);
        if (cn) { push({ t: 'chap', n: cn, strong: true }); return; }
      }
      // subtítulo de sección (otra fuente, sin números, línea corta)
      if (allOtherFont && !hasDigit && text.length < 70 && maxSz < body * 1.4 && words.every(i => i.sz >= body * 0.88)) { push({ t: 'br' }); return; }
      for (const it of ln.items) {
        const s = compose(it.s).replace(NOTE_MARK, ''); const tr = s.trim();
        if (!tr) { push({ t: 'tx', s }); continue; }
        if (NOTE_ONLY.test(tr)) continue;                                        // llamadas de nota «[14]», «[D]»
        const raised = it.y - ln.y > body * 0.2;
        if (DIGITS.test(tr)) {
          const n0 = +tr;
          if (it.sz >= body * 1.3) push({ t: 'chap', n: n0, strong: true });
          else if (it.sz < body * 0.9 || raised || it.font !== bodyFont) push({ t: 'vs', n: n0, strong: true });
          else push({ t: 'vs', n: n0, strong: false });
          continue;
        }
        // llamadas de nota («a», «*», «†»); pero no las versalitas pegadas a una letra («S» + «ENHOR»)
        const prevS = (ln.items[ln.items.indexOf(it) - 1] || {}).s || '';
        if (it.sz < body * 0.8 && tr.length <= 3 && !(/^\p{Lu}+[.,;:]?$/u.test(tr) && /\p{L}$/u.test(prevS))) continue;
        // números dentro del texto: «3:16 Porque…», «16 Porque…»
        const re = /(^|\s)(?:(\d{1,3}):(\d{1,3})|(\d{1,3}))(?=\s|$|[«“"¶(]?\p{L})/gu;
        let p = 0, m;
        while ((m = re.exec(s))) {
          const at = m.index + m[1].length;
          if (at > p) push({ t: 'tx', s: s.slice(p, at) });
          if (m[2]) push({ t: 'cv', c: +m[2], n: +m[3] }); else push({ t: 'vs', n: +m[4], strong: false, inl: true });
          p = at + m[0].length - m[1].length;
        }
        if (p < s.length) push({ t: 'tx', s: s.slice(p) });
      }
      push({ t: 'nl' });
    };
    for (const ln of lines) {
      const text = compose(ln.items.map(i => i.s).join('')).replace(NOTE_MARK, ' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(text)) { stop = true; break; }
      // cabeceras y pies de página (título corrido, número de página)
      if (ln.y > H * 0.95 || ln.y < H * 0.045) continue;
      const words = ln.items.filter(i => i.s.trim() && !DIGITS.test(i.s.trim()));
      const chars = words.reduce((a, i) => a + i.s.trim().length, 0);
      const smallChars = words.filter(i => i.sz < body * 0.93).reduce((a, i) => a + i.s.trim().length, 0);
      const maxSz = Math.max(...ln.items.map(i => i.sz));
      const allOtherFont = words.length > 0 && words.every(i => i.font !== bodyFont);
      const caps = /\p{L}/u.test(text) && text === text.toUpperCase();
      const hasDigit = /\d/.test(text);
      // notas al pie, referencias cruzadas: líneas en letra pequeña
      if (chars && smallChars / chars > 0.6) continue;
      const L = { ln, text, words, maxSz, allOtherFont, hasDigit, allBig: words.length > 0 && words.every(i => i.sz >= body * 1.1) };
      if (!DIGITS.test(text) && text.length <= 90 && (maxSz >= body * 1.15 || caps || allOtherFont) && !(text.length <= 20 && chapterNum(text))) { hb.push(L); continue; }
      flushTitle();
      content(L);
    }
    flushTitle();
    page.cleanup();
    if (n % 8 === 0) await new Promise(r => setTimeout(r));
  }
  await task.destroy();

  // ---- 3. máquina de estados guiada por el conteo esperado de capítulos y versículos
  const books = {};
  let cur = null, c = 0, v = 0, pending = null, buf = '', orphan = 0;
  const expCh = (id) => (expected[id] || {}).ch || 0;
  const expV = (id, ch) => ((expected[id] || {}).vc || [])[ch - 1] || 0;
  const nextBook = () => { const i = cur ? BOOK_IDS.indexOf(cur) + 1 : 0; return BOOK_IDS[i] || null; };
  const flush = () => {
    const t = buf.replace(/\s+/g, ' ').replace(/\s+([,.;:!?»”)])/g, '$1').trim(); buf = '';
    if (!t) return;
    if (!cur || !c || !v) { orphan += t.length; return; }
    const ch = ((books[cur] ||= {})[c] ||= {});
    ch[v] = ch[v] ? ch[v] + ' ' + t : t;
  };
  const start = (id, ch = 1, vv = 1) => { flush(); cur = id; c = ch; v = vv; pending = null; };
  const vEmpty = () => !buf.trim() && !(books[cur] && books[cur][c] && books[cur][c][v]);

  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.t === 'tx') { if (cur && c) { if (/\p{L}-$/u.test(buf) && /^\p{Ll}/u.test(e.s)) buf = buf.slice(0, -1) + e.s; else buf += e.s; } continue; }
    if (e.t === 'nl') { if (!/-$/.test(buf)) buf += ' '; continue; }
    if (e.t === 'br') { buf += ' '; continue; }
    if (e.t === 'book') {
      if (cur && c === 1 && v <= 1 && !buf.trim() && !(books[cur] && books[cur][1])) { cur = e.id; pending = null; }   // «1» grande antes del título
      else if (!cur || c >= expCh(cur) || (e.id === cur && c <= 2)) { if (e.id === cur) { delete books[cur]; buf = ''; } start(e.id, 1, 1); }   // el título abre el libro
      else if (e.id !== cur) pending = e.id;
      continue;
    }
    if (e.t === 'chap') {
      const n = e.n;
      if (cur && n === c && v <= 1 && vEmpty()) continue;                     // «Capítulo 1» justo después del título
      if (pending && n === 1) start(pending, 1, 1);
      else if (cur && n === c + 1 && n <= expCh(cur)) { flush(); c = n; v = 1; }
      else if (n === 1 && (!cur || c >= expCh(cur))) { const nb = nextBook(); if (nb) start(nb, 1, 1); }
      else if (!e.strong) buf += ` ${n} `;
      continue;
    }
    if (e.t === 'cv') {
      const n = e.n;
      if (cur && e.c === c && n > v && n <= v + 4) { flush(); v = n; }
      else if (cur && e.c === c && n === 1 && v === 1) {}
      else if (cur && e.c === c + 1 && n === 1 && c < expCh(cur) && !pending) { flush(); c = e.c; v = 1; }
      else if (e.c === 1 && n === 1 && (pending || !cur || c >= expCh(cur))) { const nb = pending || nextBook(); if (nb) start(nb, 1, 1); }
      else buf += ` ${e.c}:${n} `;
      continue;
    }
    if (e.t === 'vs') {
      const n = e.n;
      // los números en el mismo tipo de letra que el texto solo cuentan si siguen la secuencia y no parecen parte de una frase
      const weak = !e.strong;
      if (!cur || !c) {
        if (n === 1 && (pending || !weak)) { const nb = pending || nextBook(); if (nb) start(nb, 1, 1); continue; }
        if (!weak && n === 2 && pending) { start(pending, 1, 2); continue; }
        continue;
      }
      const ev0 = expV(cur, c);
      if (n === v + 1 && (!weak || n <= ev0 + 2)) {
        if (weak && e.inl && ev[i - 1] && ev[i - 1].t === 'tx' && /\p{L}\s*$/u.test(ev[i - 1].s) && /\b(de|y|los|las|el|of|and|the|e|os|as|do|da|en|in|a)\s*$/i.test(ev[i - 1].s)) { buf += ` ${n} `; continue; }
        flush(); v = n; continue;
      }
      if (!weak && n > v + 1 && n <= v + 4 && n <= ev0) { flush(); v = n; continue; }
      if (n === 1 && v === 1 && vEmpty()) continue;
      if (pending && (n === 1 || (!weak && n === 2))) { start(pending, 1, n); continue; }
      if ((n === 1 || (!weak && n === 2)) && v >= Math.max(1, ev0 * (weak ? 0.9 : 0.7)) && (!weak || /[.!?»”"')\]]\s*$/.test(buf))) {
        if (c < expCh(cur)) { flush(); c++; v = n; }
        else { const nb = nextBook(); if (nb) start(nb, 1, n); }
        continue;
      }
      if (weak) buf += ` ${n} `;                                               // número que es parte del texto
      continue;
    }
  }
  flush();
  // quitar versículos vacíos
  for (const b of Object.values(books)) for (const ch of Object.values(b)) for (const k of Object.keys(ch)) if (!ch[k].trim()) delete ch[k];
  return { title, lang, books, source: 'pdf', report: report(books, expected, orphan) };
}
