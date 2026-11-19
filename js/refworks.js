// Obras de consulta (diccionarios, enciclopedias, comentarios) importadas por el usuario en EPUB o PDF.
// Todo se procesa en el dispositivo. Resultado:
//   { title, kind, entries: [[título, texto], …], vidx: {"JHN.3.16": [[entrada, posición], …]}, sidx: {"G0026": [entrada, …]} }
import { unzip } from './epub.js';

// ------------------------------------------------------------------ citas bíblicas
const NORM = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.\s]/g, '');
const ABBR = {
  GEN: 'gn gen gé ge genesis génesis gênesis genese', EXO: 'ex éx exo exod exodo éxodo exodus êxodo', LEV: 'lv le lev levitico levítico leviticus',
  NUM: 'nm nú nu num numeros números numbers', DEU: 'dt deut deuteronomio deuteronomy deuteronômio',
  JOS: 'jos josue josué joshua josh', JDG: 'jue jc jueces judges judg jz juízes juizes', RUT: 'rt rut ruth rute',
  '1SA': '1s 1sa 1sam 1samuel', '2SA': '2s 2sa 2sam 2samuel', '1KI': '1r 1re 1rey 1reyes 1kgs 1ki 1kings 1rs 1reis', '2KI': '2r 2re 2rey 2reyes 2kgs 2ki 2kings 2rs 2reis',
  '1CH': '1cr 1cro 1cron 1cronicas 1crónicas 1chr 1chron 1chronicles', '2CH': '2cr 2cro 2cron 2cronicas 2crónicas 2chr 2chron 2chronicles',
  EZR: 'esd esdras ezr ezra ed', NEH: 'neh ne nehemias nehemías nehemiah', EST: 'est ester esther et', JOB: 'job jb jó',
  PSA: 'sal sl salmo salmos ps psa psalm psalms', PRO: 'pr prov proverbios proverbs pv', ECC: 'ec ecl eclesiastes ecclesiastes eccl qo',
  SNG: 'cnt can cant cantares song ct', ISA: 'is isa isaias isaías isaiah', JER: 'jer jr jeremias jeremías jeremiah', LAM: 'lm lam lamentaciones lamentations',
  EZK: 'ez eze ezeq ezequiel ezek ezekiel', DAN: 'dn da dan daniel', HOS: 'os oseas hos hosea', JOL: 'jl joe joel', AMO: 'am amos amós',
  OBA: 'abd abdias abdías obad obadiah ob', JON: 'jon jonas jonás jonah', MIC: 'mi miq miqueas mic micah mq', NAM: 'nah na nahum nahúm',
  HAB: 'hab habacuc habakkuk hc', ZEP: 'sof sofonias sofonías zeph zephaniah sf', HAG: 'hag ag hageo haggai', ZEC: 'zac zacarias zacarías zech zechariah zc',
  MAL: 'mal malaquias malaquías malachi ml',
  MAT: 'mt mat mateo matt matthew', MRK: 'mr mc mar marcos mark mk', LUK: 'lc lu luc lucas luke lk', JHN: 'jn juan john jo joão',
  ACT: 'hch hech hechos act acts at atos', ROM: 'ro rom romanos romans rm', '1CO': '1co 1cor 1corintios 1corinthians', '2CO': '2co 2cor 2corintios 2corinthians',
  GAL: 'gá gal ga galatas gálatas galatians gl', EPH: 'ef efe efesios eph ephesians', PHP: 'flp fil filipenses phil philippians fp',
  COL: 'col colosenses colossians cl', '1TH': '1ts 1te 1tes 1tesalonicenses 1thess 1th', '2TH': '2ts 2te 2tes 2tesalonicenses 2thess 2th',
  '1TI': '1ti 1tim 1timoteo 1timothy 1tm', '2TI': '2ti 2tim 2timoteo 2timothy 2tm', TIT: 'tit tito titus tt', PHM: 'flm filemon filemón phlm philemon fm',
  HEB: 'heb he hebreos hebrews hb', JAS: 'stg snt sant santiago jas james tg', '1PE': '1p 1pe 1ped 1pedro 1pet 1peter', '2PE': '2p 2pe 2ped 2pedro 2pet 2peter',
  '1JN': '1jn 1juan 1john 1jo', '2JN': '2jn 2juan 2john 2jo', '3JN': '3jn 3juan 3john 3jo', JUD: 'jud judas jude jd',
  REV: 'ap apoc apocalipsis rev revelacion revelación revelation apocalipse',
};
const BOOKMAP = new Map();
for (const [id, s] of Object.entries(ABBR)) for (const a of s.split(' ')) BOOKMAP.set(NORM(a), id);
const SINGLE = new Set(['OBA', 'PHM', '2JN', '3JN', 'JUD']);

let VC = null; // conteo de versículos por libro/capítulo para validar citas
export function setVerseCounts(meta) { VC = Object.fromEntries(meta.books.map(b => [b.id, b.vc])); }
const valid = (b, c, v) => !VC || (VC[b] && c >= 1 && c <= VC[b].length && v >= 1 && v <= (VC[b][c - 1] || 0) + 1);

// «Gn 1.20», «Éx 27.1–8», «1 S 16.14», «Mt 21.18; 27.1», «Le 2:4, 5, 7», «Jud 14»
const RE_REF = /(?:((?:[1-3]\s?)?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñüê]{0,13}\.?)\s{0,2})?(\d{1,3})\s?[:.]\s?(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?|((?:[23]\s?)?(?:Jud|Judas|Abd|Flm|Jn|Jude|Phlm|Obad)\.?)\s(\d{1,3})(?![\d:.])/g;
const RE_SENT = /[.!?]\s+[A-ZÁÉÍÓÚ¿¡«“"]/;

export function findRefs(text) {
  const out = [];
  let carry = null, lastEnd = -999;
  RE_REF.lastIndex = 0;
  let m;
  while ((m = RE_REF.exec(text))) {
    let b = null, c, v, v2;
    if (m[5]) {                                             // libro de un solo capítulo + versículo
      const id = BOOKMAP.get(NORM(m[5]));
      if (!id || !SINGLE.has(id)) continue;
      b = id; c = 1; v = +m[6]; v2 = v;
    } else {
      c = +m[2]; v = +m[3]; v2 = m[4] ? +m[4] : v;
      if (m[1]) {
        b = BOOKMAP.get(NORM(m[1]));
        if (!b) { carry = null; continue; }                  // palabra desconocida antes del número: no es cita bíblica
      } else {
        const gap = text.slice(lastEnd, m.index);
        if (!carry || m.index - lastEnd > 160 || RE_SENT.test(gap)) continue;
        b = carry;
      }
    }
    if (!valid(b, c, v)) { continue; }
    if (v2 < v || v2 - v > 30) v2 = v;
    out.push({ b, c, v, v2, at: m.index, len: m[0].length });
    carry = b; lastEnd = m.index + m[0].length;
    // «, 5, 7» o «, 5-7» a continuación: más versículos del mismo capítulo
    const rest = text.slice(lastEnd, lastEnd + 40);
    const mm = rest.match(/^((?:\s?,\s?\d{1,3}(?:\s?[-–]\s?\d{1,3})?(?![\d:.]))+)/);
    if (mm) {
      for (const x of mm[1].split(',').map(s => s.trim()).filter(Boolean)) {
        const [a, z] = x.split(/[-–]/).map(Number);
        if (valid(b, c, a)) out.push({ b, c, v: a, v2: z && z >= a && z - a <= 30 ? z : a, at: m.index, len: m[0].length });
      }
      lastEnd += mm[0].length; RE_REF.lastIndex = lastEnd;
    }
  }
  return out;
}

// ------------------------------------------------------------------ números Strong (diccionarios como el Vine)
// «nepesh (5315 ,נֶפֶש)», «proia (πρωΐα, 4405)»
const RE_STRONG = /\(([^()]{0,60}?)\)/g;
function findStrongs(text) {
  const out = [];
  RE_STRONG.lastIndex = 0; let m;
  while ((m = RE_STRONG.exec(text))) {
    const inner = m[1]; const n = inner.match(/\b(\d{1,4})\b/);
    if (!n) continue;
    if (/[֐-׿]/.test(inner)) out.push('H' + n[1].padStart(4, '0'));
    else if (/[Ͱ-Ͽἀ-῿]/.test(inner)) out.push('G' + n[1].padStart(4, '0'));
  }
  return out;
}

// ------------------------------------------------------------------ índices
function buildIndex(entries) {
  const vidx = {}, sidx = {};
  let refs = 0;
  entries.forEach(([, text], ei) => {
    const seen = new Set();
    for (const r of findRefs(text)) {
      for (let v = r.v; v <= r.v2; v++) {
        const k = `${r.b}.${r.c}.${v}`;
        if (seen.has(k)) continue; seen.add(k);
        (vidx[k] ||= []).push([ei, r.at]); refs++;
      }
    }
    const ss = new Set(findStrongs(text.slice(0, 4000)));
    for (const s of ss) (sidx[s] ||= []).push(ei);
  });
  return { vidx, sidx, refs };
}

// ------------------------------------------------------------------ EPUB
function parseXML(text) {
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(text, 'text/html');
  return doc;
}
const byTag = (el, tag) => [...el.getElementsByTagName('*')].filter(e => (e.localName || e.nodeName).toLowerCase() === tag);
function resolve(base, href) {
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const out = []; for (const p of (dir + href).split('/')) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
  return out.join('/');
}

async function epubEntries(file, onProgress) {
  const zip = await unzip(await file.arrayBuffer());
  const container = await zip.text('META-INF/container.xml');
  if (!container) throw new Error('El archivo no es un EPUB válido.');
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  const opf = parseXML(await zip.text(opfPath));
  const title = ((byTag(opf, 'title')[0] || {}).textContent || file.name).trim();
  const manifest = new Map();
  for (const it of byTag(opf, 'item')) manifest.set(it.getAttribute('id'), { href: resolve(opfPath, decodeURIComponent(it.getAttribute('href'))), type: it.getAttribute('media-type'), props: it.getAttribute('properties') || '' });
  const spine = byTag(opf, 'itemref').map(r => manifest.get(r.getAttribute('idref'))).filter(x => x && /html/.test(x.type) && !/\bnav\b/.test(x.props));
  const entries = []; let cur = null;
  const flushPara = (t) => { t = t.replace(/\s+/g, ' ').trim(); if (t && cur) cur[1] += (cur[1] ? '\n' : '') + t; };
  for (let i = 0; i < spine.length; i++) {
    onProgress(i + 1, spine.length);
    const html = await zip.text(spine[i].href); if (!html) continue;
    const doc = parseXML(html); const body = doc.body || byTag(doc, 'body')[0]; if (!body) continue;
    const blocks = byTag(body, '*').filter(el => /^(h[1-4]|p|li|blockquote|dd|dt)$/.test((el.localName || '').toLowerCase()) && !el.closest('nav, aside[epub\\:type="footnote"]'));
    for (const el of blocks) {
      const tag = el.localName.toLowerCase();
      if (el.parentElement && el.parentElement.closest('p, li, blockquote, dd, dt')) continue;
      const tx = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!tx) continue;
      if (/^h[1-4]$/.test(tag) && tx.length <= 120) { cur = [tx, '']; entries.push(cur); continue; }
      if (!cur) { cur = [title, '']; entries.push(cur); }
      flushPara(tx);
    }
    if (i % 10 === 0) await new Promise(r => setTimeout(r));
  }
  return { title, entries: entries.filter(e => e[1].length > 20) };
}

// ------------------------------------------------------------------ PDF (pdf.js incluido en vendor/)
let pdfjsP = null;
export async function pdfjs() {
  if (!pdfjsP) pdfjsP = import(new URL('../vendor/pdfjs/pdf.min.mjs', import.meta.url).href).then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return m;
  });
  return pdfjsP;
}
// algunos PDF (p. ej. los de LaTeX) guardan el acento como glifo aparte: «Jos ´ e», «se ˜ nal», «per ´ıodo»
const ACC = { '´': '́', '`': '̀', '˜': '̃', '¨': '̈', 'ˆ': '̂' };
export const compose = (s) => s.replace(/[\u0000-\u0008\u000e-\u001f]/g, '')
  .replace(/\s?([´`˜¨ˆ])\s?([A-Za-zı])/g, (_, a, l) => (l === 'ı' ? 'i' : l) + ACC[a]).normalize('NFC');
const isUpperHead = (s) => { const L = s.replace(/[^\p{L}]/gu, ''); return L.length >= 2 && L === L.toUpperCase() && L !== L.toLowerCase(); };

async function pdfEntries(file, onProgress) {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({ data, cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true, isEvalSupported: false });
  const doc = await task.promise;
  let title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/^\p{Ll}/u, c => c.toUpperCase());
  try { const md = await doc.getMetadata(); if (md && md.info && md.info.Title && md.info.Title.length > 3) title = md.info.Title; } catch {}
  // tamaño de letra del cuerpo: el más frecuente en una muestra de páginas
  const sizes = new Map();
  const sample = [...new Set([Math.floor(doc.numPages / 3), Math.floor(doc.numPages / 2), Math.floor(doc.numPages * 2 / 3)])].filter(n => n >= 1);
  for (const n of sample) {
    const tc = await (await doc.getPage(n)).getTextContent();
    for (const it of tc.items) if (it.str && it.str.trim()) { const sz = Math.round(Math.hypot(it.transform[0], it.transform[1]) * 10) / 10; sizes.set(sz, (sizes.get(sz) || 0) + it.str.length); }
  }
  const body = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  const entries = []; let cur = null, para = '';
  const pushPara = () => { const t = para.replace(/\s+/g, ' ').trim(); para = ''; if (!t) return; if (!cur) { cur = [title, '']; entries.push(cur); } cur[1] += (cur[1] ? '\n' : '') + t; };
  const addText = (t) => {
    if (!t) return;
    if (/[\p{L}]-$/u.test(para) && /^\p{Ll}/u.test(t)) para = para.slice(0, -1) + t;      // guion de fin de línea
    else para += (para && !/\s$/.test(para) ? ' ' : '') + t;
  };
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(n, doc.numPages);
    const page = await doc.getPage(n);
    const H = page.view[3] - page.view[1];
    const tc = await page.getTextContent();
    // agrupar en líneas (pdf.js entrega los textos en orden de lectura)
    const lines = []; let line = null;
    for (const it of tc.items) {
      const y = it.transform[5], x = it.transform[4], sz = Math.hypot(it.transform[0], it.transform[1]);
      if (!it.str) continue;
      const acc = /^[´`˜¨ˆ]$/.test(it.str);                                // acento suelto (va algo más alto)
      if (!line || (!acc && Math.abs(y - line.y) > sz * 0.6)) { line = { y, x, items: [] }; lines.push(line); }
      line.items.push({ s: it.str, sz, x });
    }
    let prevY = null;
    for (const ln of lines) {
      const text = compose(ln.items.map(i => i.s).join('')).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (ln.y > H * 0.955 || ln.y < H * 0.035) continue;                 // cabecera y número de página
      if (/^\d{1,4}$/.test(text)) continue;
      // título de artículo: primeras piezas de la línea, más grandes que el cuerpo y en MAYÚSCULAS
      const lead = []; for (const it of ln.items) { if (it.sz >= body * 1.05 || (/^[\s´`˜¨ˆ\u0000-\u001f]*$/.test(it.s) && lead.length)) lead.push(it); else break; }
      let head = compose(lead.map(i => i.s).join('')).replace(/\s+/g, ' ').trim();
      if (lead.length && !text.startsWith(head)) head = '';
      if (head && isUpperHead(head) && head.length <= 90) {
        pushPara();
        const ht = head.replace(/[.:,]\s*$/, '');
        if (!(cur && cur[0] === ht)) { cur = [ht, '']; entries.push(cur); }   // mismo título repetido: sigue el mismo artículo
        const restTxt = text.slice(head.length).trim();
        if (restTxt) addText(restTxt);
        prevY = ln.y; continue;
      }
      if (prevY != null && prevY - ln.y > body * 2.2) pushPara();            // espacio grande: nuevo párrafo
      addText(text);
      prevY = ln.y;
    }
    pushPara();
    page.cleanup();
    if (n % 5 === 0) await new Promise(r => setTimeout(r));
  }
  await task.destroy();
  return { title, entries: entries.filter(e => e[1].length > 20) };
}

// ------------------------------------------------------------------ API
export async function importWork(file, onProgress = () => {}) {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const { title, entries } = isPdf ? await pdfEntries(file, onProgress) : await epubEntries(file, onProgress);
  const { vidx, sidx, refs } = buildIndex(entries);
  return { title, kind: isPdf ? 'pdf' : 'epub', entries, vidx, sidx, stats: { entries: entries.length, refs, strongs: Object.keys(sidx).length } };
}

// texto con citas convertidas en enlaces (para el lector de artículos)
export function linkRefs(text, esc) {
  const refs = findRefs(text).filter((r, i, a) => i === 0 || a[i - 1].at !== r.at);
  let out = '', p = 0;
  for (const r of refs) {
    if (r.at < p) continue;
    out += esc(text.slice(p, r.at)) + `<a class="bref" data-ref="${r.b}-${r.c}-${r.v}">${esc(text.slice(r.at, r.at + r.len))}</a>`;
    p = r.at + r.len;
  }
  return out + esc(text.slice(p));
}
