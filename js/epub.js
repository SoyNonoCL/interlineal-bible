// Importador de Biblias en EPUB — todo ocurre en el dispositivo; el archivo nunca sale de él.
// 1) descomprime el EPUB (ZIP) con DecompressionStream, sin librerías
// 2) sigue el orden de lectura (spine) y el índice (nav/NCX)
// 3) detecta libros, capítulos y versículos con heurísticas robustas a distintos formatos
// Resultado: { title, lang, books: { GEN: { 1: { 1: "texto" } } }, report }

// ------------------------------------------------------------------ ZIP
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un EPUB válido (no es un ZIP).');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const loff = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    entries.set(name, { method, csize, loff });
    p += 46 + nlen + elen + clen;
  }
  return {
    names: [...entries.keys()],
    has: (n) => entries.has(n),
    async bytes(name) {
      const e = entries.get(name);
      if (!e) return null;
      const lnl = dv.getUint16(e.loff + 26, true), lel = dv.getUint16(e.loff + 28, true);
      const start = e.loff + 30 + lnl + lel;
      const data = u8.subarray(start, start + e.csize);
      if (e.method === 0) return data;
      if (e.method === 8) return inflateRaw(data);
      throw new Error('Compresión no soportada en ' + name);
    },
    async text(name) { const b = await this.bytes(name); return b ? new TextDecoder('utf-8').decode(b) : null; },
  };
}

// ------------------------------------------------------------------ nombres de libros
const N = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[.,;:()\[\]«»"'’¡!¿?]/g, ' ').replace(/\s+/g, ' ').trim();

const NAMES = {
  GEN: ['genesis', 'gen', 'gn'], EXO: ['exodo', 'exodus', 'ex', 'exo'], LEV: ['levitico', 'leviticus', 'lv', 'lev'],
  NUM: ['numeros', 'numbers', 'nm', 'num'], DEU: ['deuteronomio', 'deuteronomy', 'dt', 'deut'],
  JOS: ['josue', 'joshua', 'jos'], JDG: ['jueces', 'judges', 'jue', 'jdg'], RUT: ['rut', 'ruth', 'rt'],
  '1SA': ['1 samuel', '1 sam', '1 s', '1 sm'], '2SA': ['2 samuel', '2 sam', '2 s', '2 sm'],
  '1KI': ['1 reyes', '1 kings', '1 r', '1 re', '1 rey'], '2KI': ['2 reyes', '2 kings', '2 r', '2 re', '2 rey'],
  '1CH': ['1 cronicas', '1 chronicles', '1 cr', '1 cro', '1 paralipomenos'], '2CH': ['2 cronicas', '2 chronicles', '2 cr', '2 cro', '2 paralipomenos'],
  EZR: ['esdras', 'ezra', 'esd'], NEH: ['nehemias', 'nehemiah', 'neh'], EST: ['ester', 'esther', 'est'],
  JOB: ['job'], PSA: ['salmos', 'salmo', 'psalms', 'psalm', 'sal', 'ps'], PRO: ['proverbios', 'proverbs', 'pr', 'prov'],
  ECC: ['eclesiastes', 'ecclesiastes', 'qohelet', 'ec', 'ecl'], SNG: ['cantares', 'cantar de los cantares', 'cantico de los canticos', 'song of solomon', 'song of songs', 'canticles', 'cnt', 'cant'],
  ISA: ['isaias', 'isaiah', 'is', 'isa'], JER: ['jeremias', 'jeremiah', 'jer'], LAM: ['lamentaciones', 'lamentations', 'lm', 'lam'],
  EZK: ['ezequiel', 'ezekiel', 'ez', 'eze'], DAN: ['daniel', 'dn', 'dan'], HOS: ['oseas', 'hosea', 'os'], JOL: ['joel', 'jl'],
  AMO: ['amos', 'am'], OBA: ['abdias', 'obadiah', 'abd'], JON: ['jonas', 'jonah', 'jon'], MIC: ['miqueas', 'micah', 'mi', 'miq'],
  NAM: ['nahum', 'nah'], HAB: ['habacuc', 'habakkuk', 'hab'], ZEP: ['sofonias', 'zephaniah', 'sof'], HAG: ['hageo', 'ageo', 'haggai', 'hag'],
  ZEC: ['zacarias', 'zechariah', 'zac'], MAL: ['malaquias', 'malachi', 'mal'],
  MAT: ['mateo', 'matthew', 'mt', 'mat'], MRK: ['marcos', 'mark', 'mr', 'mc', 'mar'], LUK: ['lucas', 'luke', 'lc', 'luc'],
  JHN: ['juan', 'john', 'jn'], ACT: ['hechos', 'hechos de los apostoles', 'acts', 'hch', 'hech'], ROM: ['romanos', 'romans', 'ro', 'rom'],
  '1CO': ['1 corintios', '1 corinthians', '1 co', '1 cor'], '2CO': ['2 corintios', '2 corinthians', '2 co', '2 cor'],
  GAL: ['galatas', 'galatians', 'ga', 'gal'], EPH: ['efesios', 'ephesians', 'ef', 'efe'], PHP: ['filipenses', 'philippians', 'flp', 'fil'],
  COL: ['colosenses', 'colossians', 'col'], '1TH': ['1 tesalonicenses', '1 thessalonians', '1 ts', '1 tes'], '2TH': ['2 tesalonicenses', '2 thessalonians', '2 ts', '2 tes'],
  '1TI': ['1 timoteo', '1 timothy', '1 ti', '1 tim'], '2TI': ['2 timoteo', '2 timothy', '2 ti', '2 tim'], TIT: ['tito', 'titus', 'tit'],
  PHM: ['filemon', 'philemon', 'flm'], HEB: ['hebreos', 'hebrews', 'he', 'heb'], JAS: ['santiago', 'james', 'stg', 'sant'],
  '1PE': ['1 pedro', '1 peter', '1 p', '1 pe', '1 ped'], '2PE': ['2 pedro', '2 peter', '2 p', '2 pe', '2 ped'],
  '1JN': ['1 juan', '1 john', '1 jn'], '2JN': ['2 juan', '2 john', '2 jn'], '3JN': ['3 juan', '3 john', '3 jn'],
  JUD: ['judas', 'jude', 'jud'], REV: ['apocalipsis', 'revelacion', 'revelation', 'ap', 'apoc', 'rev'],
};
// otros idiomas (sin tildes): portugués, francés, italiano, alemán
const MORE = {
  GEN: 'genese genesi 1 mose', EXO: 'exodo exode esodo 2 mose', LEV: 'levitique 3 mose', NUM: 'nombres numeri 4 mose', DEU: 'deuteronome 5 mose',
  JOS: 'giosue josua', JDG: 'juizes juges giudici richter', RUT: 'rute', '1SA': '1 samuele', '2SA': '2 samuele',
  '1KI': '1 reis 1 rois 1 re 1 konige 1 koenige', '2KI': '2 reis 2 rois 2 re 2 konige 2 koenige',
  '1CH': '1 cronicas 1 chronicas 1 chroniques 1 cronache 1 chronik', '2CH': '2 cronicas 2 chronicas 2 chroniques 2 cronache 2 chronik',
  EZR: 'esdra esra', NEH: 'neemias nehemie neemia nehemia', JOB: 'jo giobbe hiob', PSA: 'psaumes salmi psalmen psalmos',
  PRO: 'proverbes proverbi spruche sprueche', ECC: 'ecclesiaste ecclesiastes qoelet prediger', SNG: 'canticos cantico dos canticos cantares de salomao cantique des cantiques cantico dei cantici hoheslied',
  ISA: 'esaie isaia jesaja', JER: 'jeremie geremia jeremia', LAM: 'lamentacoes lamentazioni klagelieder', EZK: 'ezechiel ezechiele hesekiel',
  DAN: 'daniele', HOS: 'oseias osee osea hosea', JOL: 'gioele', OBA: 'obadias abdia obadja', JON: 'giona jona', MIC: 'miqueias michee michea micha',
  NAM: 'naum', HAB: 'habacuque abacuc habakuk', ZEP: 'sophonie sofonia zefanja', HAG: 'ageu agee aggeo', ZEC: 'zacharie zaccaria sacharja', MAL: 'malachie malachia maleachi',
  MAT: 'mateus mattheus matthieu matteo matthaus matthaeus', MRK: 'marc marco markus', LUK: 'luc luca lukas', JHN: 'joao jean giovanni johannes',
  ACT: 'atos actos atos dos apostolos actes atti apostelgeschichte', ROM: 'romains romani romer roemer', '1CO': '1 corinthiens 1 corinzi 1 korinther', '2CO': '2 corinthiens 2 corinzi 2 korinther',
  GAL: 'galates galati galater', EPH: 'ephesiens efesini epheser', PHP: 'philippiens filippesi philipper', COL: 'colossenses colossiens colossesi kolosser',
  '1TH': '1 tessalonicenses 1 thessaloniciens 1 tessalonicesi 1 thessalonicher', '2TH': '2 tessalonicenses 2 thessaloniciens 2 tessalonicesi 2 thessalonicher',
  '1TI': '1 timothee 1 timotheus', '2TI': '2 timothee 2 timotheus', TIT: 'tite', PHM: 'filemom filemone', HEB: 'hebreus hebreux ebrei hebraer',
  JAS: 'tiago jacques giacomo jakobus', '1PE': '1 pierre 1 pietro 1 petrus', '2PE': '2 pierre 2 pietro 2 petrus',
  '1JN': '1 joao 1 jean 1 giovanni 1 johannes', '2JN': '2 joao 2 jean 2 giovanni 2 johannes', '3JN': '3 joao 3 jean 3 giovanni 3 johannes',
  JUD: 'jude giuda', REV: 'apocalipse apocalypse apocalisse offenbarung',
};
for (const [id, str] of Object.entries(MORE)) {
  // separa nombres de una o varias palabras (los que empiezan con dígito llevan dos tokens)
  const toks = str.split(' '); const names = [];
  for (let i = 0; i < toks.length; i++) {
    if (/^\d$/.test(toks[i])) { names.push(toks[i] + ' ' + toks[++i]); continue; }
    names.push(toks[i]);
  }
  NAMES[id].push(...names);
}
for (const [id, multi] of Object.entries({ SNG: ['cantico dos canticos', 'cantares de salomao', 'cantique des cantiques', 'cantico dei cantici'], ACT: ['atos dos apostolos'] })) NAMES[id].push(...multi);
// nombres completos (≥ 4 letras) para buscar dentro de un título largo; abreviaturas solo con coincidencia exacta
const FULL = [], ABBR = new Map();
for (const [id, list] of Object.entries(NAMES)) for (const n0 of list) {
  const n = ordinals(n0) || n0;            // misma normalización que los títulos («song of solomon» → «song solomon»)
  if (n.replace(/^\d /, '').length >= 4) FULL.push([n, id]); else if (!ABBR.has(n)) ABBR.set(n, id);
}
FULL.sort((a, b) => b[0].length - a[0].length);

function ordinals(s) {
  // «segundo» = «según» en portugués: «Evangelho segundo S. João» no es 2 Juan
  if (/evangel/.test(s)) s = s.replace(/\bsegundo\b/g, ' ');
  s = s.replace(/\bsegundo (?=(s|sao|san|santo|saint) )/g, ' ');
  return s
    .replace(/\b(primera|primero|primeira|primeiro|premier|premiere|primo|prima|erste|erster|1a|1ra|1er|1era|1o|1e|i|first)\b(?= )/g, '1')
    .replace(/\b(segunda|segundo|deuxieme|seconde|secondo|seconda|zweite|zweiter|2a|2da|2o|2e|ii|second)\b(?= )/g, '2')
    .replace(/\b(tercera|tercero|terceira|terceiro|troisieme|terzo|terza|dritte|dritter|3a|3ra|3o|3e|iii|third)\b(?= )/g, '3')
    .replace(/\b(\d)\.(?= )/g, '$1')
    .replace(/\b(de|del|la|el|los|las|a|al|of|the|epistola|carta|libro|book|evangelio|santo|segun|san|apostol|pablo|universal|general|profeta|according|to|gospel|letter|epistle|paul|saint|st|do|da|dos|das|livro|evangelho|sao|o|aos|ao|le|du|des|livre|evangile|selon|lettre|epitre|il|dello|della|di|lettera|vangelo|secondo|das|buch|des|evangelium|nach|brief|an|die|der|moses|moyses|called|commonly|apostle|apostles|apostolo|apostol|chamado|llamado|appele|s|prophet|propheta|profeta|divine|fourth|fifth|or|ou)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function matchBook(text, loose = true) {
  const raw = N(text);
  if (!raw || raw.length > 80) return null;
  // títulos de la obra («The King James Bible», «Nuevo Testamento») no son libros
  if (/\b(biblia|bible|bibel|bibbia|bijbel|version|versao|traduccion|traducao|translation|testament|testamento|escrituras|scriptures)\b/.test(raw)) return null;
  const s = ordinals(raw);
  const stripped = s.replace(/\s\d{1,3}$/, '');
  if (ABBR.has(stripped)) return ABBR.get(stripped);
  for (const [n, id] of FULL) {
    if (stripped === n) return id;
  }
  if (!loose) return null;
  for (const [n, id] of FULL) {
    const re = new RegExp(`(^| )${n.replace(/ /g, ' ')}( |$)`);
    if (re.test(s)) {
      // el nombre debe ser casi todo el título: "Jesús y Juan el Bautista" no es el libro de Juan
      const rest = s.replace(re, ' ').split(' ').filter(w => w && !/^\d+$/.test(w));
      if (rest.length <= 2) return id;
    }
  }
  return null;
}

function roman(s) {
  const m = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let t = 0, prev = 0;
  for (const ch of s.toLowerCase().split('').reverse()) { const v = m[ch]; if (!v) return NaN; t += v < prev ? -v : v; prev = Math.max(prev, v); }
  return t;
}
export function chapterNum(text) {
  const s = N(text);
  let m = s.match(/^(?:capitulo|cap|chapter|ch|salmo|psalm|ps|sal)?\s*(\d{1,3})$/);
  if (m) return +m[1];
  m = s.match(/^(?:capitulo|cap|chapter|salmo|psalm)\s+([ivxlc]{1,8})$/);
  if (m) { const r = roman(m[1]); if (r > 0) return r; }
  return null;
}

// ------------------------------------------------------------------ análisis del EPUB
// textos de licencia/encabezado de Project Gutenberg y similares
const BOILER = /(^|\s)(pg-(header|footer|boilerplate|machine-header|start-separator|end-separator)|project-gutenberg-license|pg-end-line)/i;
const SKIP_TAGS = new Set(['script', 'style', 'head', 'title', 'svg', 'math', 'img', 'figure', 'nav', 'audio', 'video']);
const NOTE_CLASS = /(foot|note|nota|xref|crossref|cross-ref|referencia|refs?\b|apparatus|glosario|glossary)/i;
const VERSE_CLASS = /(^|[\s_-])(v|vs|verse|verso|vers|versiculo|versenum|verse-num|vn|vnum|vno)([\s_-]|$)|verse/i;
const CHAPTER_CLASS = /(^|[\s_-])(c|ch|chap|chapter|cap|capitulo|chapternum|drop|dropcap|initial)([\s_-]|$)|chapter|capitulo/i;
const HEAD_CLASS = /(^|[\s_-])(mt\d?|ms\d?|s\d?|sp|title|titulo|heading|head|book|libro|subtitle|section)([\s_-]|$)/i;

function resolve(base, href) {
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const parts = (dir + href).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
  return out.join('/');
}
function parseXML(text, type = 'application/xhtml+xml') {
  let doc = new DOMParser().parseFromString(text, type);
  if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(text, 'text/html');
  return doc;
}
const byTag = (el, tag) => [...el.getElementsByTagName('*')].filter(e => (e.localName || e.nodeName).toLowerCase() === tag);

export async function importEpub(file, expected, onProgress = () => {}) {
  if (!('DecompressionStream' in window)) throw new Error('Este navegador no puede leer EPUB. Actualiza Chrome o el WebView de Android.');
  const zip = await unzip(await file.arrayBuffer());
  // DRM
  const enc = await zip.text('META-INF/encryption.xml');
  if (enc && !/fontobfuscation|font-obfuscation|obfuscation/i.test(enc) && /EncryptedData/.test(enc)) {
    throw new Error('Este EPUB está protegido con DRM y no se puede leer. Usa una copia sin protección.');
  }
  const container = await zip.text('META-INF/container.xml');
  if (!container) throw new Error('Falta META-INF/container.xml: el archivo no es un EPUB válido.');
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  const opf = parseXML(await zip.text(opfPath), 'application/xml');
  const title = (byTag(opf, 'title')[0] || {}).textContent || file.name.replace(/\.epub$/i, '');
  const lang = ((byTag(opf, 'language')[0] || {}).textContent || '').trim();
  const manifest = new Map();
  for (const it of byTag(opf, 'item')) manifest.set(it.getAttribute('id'), { href: resolve(opfPath, decodeURIComponent(it.getAttribute('href'))), type: it.getAttribute('media-type'), props: it.getAttribute('properties') || '' });
  const spine = byTag(opf, 'itemref').map(r => manifest.get(r.getAttribute('idref'))).filter(x => x && /html/.test(x.type));

  // EPUB con un identificador por versículo (jw.org: chapterN_verseM; Gutenberg: «Luc22-1»…), en cualquier idioma
  const pat = await detectAnchors(zip, spine);
  if (pat) {
    const books = await importAnchored(zip, spine, expected, onProgress, pat);
    const rp = report(books, expected, 0);
    if (rp.books >= 20) return { title: title.trim(), lang, books, source: pat.name === 'jw' ? 'jw' : 'anchors', report: rp };
  }

  // índice: destino (archivo#ancla) → libro / capítulo
  const targets = new Map();
  const addTarget = (href, label) => {
    const book = matchBook(label); const ch = chapterNum(label);
    const tail = N(label).match(/ (\d{1,3})$/);
    if (!book && !ch) return;
    const v = { book, ch: ch || (book && tail ? +tail[1] : null) };
    if (!targets.has(href)) targets.set(href, v);
  };
  // árbol del índice: [{label, href, kids:[…]}]
  let tree = [];
  const navItem = [...manifest.values()].find(m => /\bnav\b/.test(m.props));
  if (navItem) {
    const nav = parseXML(await zip.text(navItem.href));
    const tocNav = byTag(nav, 'nav').find(n => /toc/.test(n.getAttribute('epub:type') || n.getAttribute('type') || '')) || byTag(nav, 'nav')[0] || nav;
    const fromOl = (ol) => [...ol.children].filter(li => (li.localName || '').toLowerCase() === 'li').map(li => {
      const a = [...li.children].find(x => /^(a|span)$/i.test(x.localName || '')) || byTag(li, 'a')[0];
      const sub = [...li.children].find(x => /^(ol|ul)$/i.test(x.localName || ''));
      const h = a && a.getAttribute('href');
      return { label: a ? a.textContent : '', href: h ? resolve(navItem.href, decodeURIComponent(h)) : null, kids: sub ? fromOl(sub) : [] };
    });
    const ol = byTag(tocNav, 'ol')[0] || byTag(tocNav, 'ul')[0];
    if (ol) tree = fromOl(ol);
  }
  const ncxItem = [...manifest.values()].find(m => /ncx/.test(m.type || ''));
  if (ncxItem && !tree.length) {
    const ncx = parseXML(await zip.text(ncxItem.href), 'application/xml');
    const fromNP = (el) => [...el.children].filter(x => (x.localName || '') === 'navPoint').map(np => {
      const lab = byTag(np, 'text')[0], ct = byTag(np, 'content')[0];
      return { label: lab ? lab.textContent : '', href: ct ? resolve(ncxItem.href, decodeURIComponent(ct.getAttribute('src'))) : null, kids: fromNP(np) };
    });
    const map = byTag(ncx, 'navMap')[0]; if (map) tree = fromNP(map);
  }
  const walkTree = (nodes, fn) => nodes.forEach(n => { fn(n); walkTree(n.kids, fn); });
  walkTree(tree, n => n.href && addTarget(n.href, n.label));
  // si los nombres no bastan (otro idioma), alinear el índice por número de capítulos de cada libro
  const named = new Set([...targets.values()].map(x => x.book).filter(Boolean));
  if (named.size < 60) alignTocByChapters(tree, expected, targets);

  // recorrido
  const books = {};
  const st = { book: null, ch: 0, v: 0, sinceCh: true, orphan: 0 };
  // marcas «4:1» o «40:004:001» dentro del texto
  const RE_CV = /(^|\s)(?:\d{1,3}:)?(\d{1,3}):(\d{1,3})\s+(?=\S)/g;
  const putText = (txt) => {
    if (!txt || !st.book || !/\d:\d/.test(txt)) return put(txt);
    let last = 0, m;
    RE_CV.lastIndex = 0;
    while ((m = RE_CV.exec(txt))) {
      const c = +m[2], v = +m[3];
      const okC = !st.ch || c === st.ch || c === st.ch + 1;
      const okV = c !== st.ch ? v === 1 : (v === st.v + 1 || (!st.v && v <= 2));
      if (!okC || !okV) continue;
      put(txt.slice(last, m.index + m[1].length));
      if (c !== st.ch) setCh(c);
      setV(v); last = m.index + m[0].length;
    }
    put(txt.slice(last));
  };
  const put = (txt) => {
    if (!txt) return;
    if (!st.book) { st.orphan += txt.trim().length; return; }
    if (!st.ch) { if (!txt.trim()) return; st.ch = 1; }
    if (!st.v) { if (!txt.trim()) return; st.v = 1; }
    const b = books[st.book] || (books[st.book] = {});
    const c = b[st.ch] || (b[st.ch] = {});
    c[st.v] = (c[st.v] || '') + txt;
  };
  const setBook = (id, fromToc) => {
    if (!id || id === st.book) return;
    if (!fromToc && books[id]) return; // un título suelto no puede volver a un libro ya leído
    st.book = id; st.ch = 0; st.v = 0;
  };
  const setCh = (n) => {
    if (!st.book || !n) return;
    const max = expected[st.book] ? expected[st.book].ch : 200;
    if (n > max + 1) return;
    st.ch = n; st.v = 0; st.sinceCh = true;
  };
  const setV = (n) => {
    if (!st.book) return;
    if (!st.ch) st.ch = 1;
    // si el versículo vuelve a 1 sin título de capítulo, es un capítulo nuevo
    if (n === 1 && st.v > 1 && !st.sinceCh) st.ch += 1;
    if (n < st.v && n !== 1 && st.v - n > 5) return; // número ajeno (nota, referencia)
    st.v = n; st.sinceCh = false;
  };

  const isNoteLink = (el) => {
    const a = el.closest ? el.closest('a[href]') : null;
    if (!a) return false;
    const h = a.getAttribute('href') || '';
    return /note|nota|fn|foot|#n\d|ref/i.test(h) || /noteref|footnote/.test(a.getAttribute('epub:type') || '') || (!h.startsWith('#') && h.includes('#'));
  };

  function walk(node, file) {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) { if (/\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(ch.nodeValue)) { st.book = null; return; } putText(ch.nodeValue); continue; }
      if (ch.nodeType !== 1) continue;
      const tag = (ch.localName || ch.nodeName).toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (BOILER.test((ch.getAttribute('id') || '') + ' ' + (ch.getAttribute('class') || ''))) continue;
      const cls = (ch.getAttribute('class') || '') + ' ' + (ch.getAttribute('epub:type') || '');
      const id = ch.getAttribute('id');
      if (id && targets.has(`${file}#${id}`)) { const t = targets.get(`${file}#${id}`); if (t.book) setBook(t.book, true); if (t.ch) setCh(t.ch); }
      if (tag === 'aside' || NOTE_CLASS.test(cls)) continue;
      const text = (ch.textContent || '').replace(/ /g, ' ').trim();
      // títulos: nunca entran al texto del versículo
      if (/^h[1-6]$/.test(tag) || (HEAD_CLASS.test(cls) && text.length < 90 && !/\d{1,3}\s+\S+.*\d{1,3}\s/.test(text) && ['p', 'div'].includes(tag))) {
        const loose = /^h[1-3]$/.test(tag) || /(^|[\s_-])(mt\d?|book|libro|title|titulo)([\s_-]|$)/i.test(cls);
        const bk = matchBook(text, loose), cn = chapterNum(text);
        if (bk) { setBook(bk); const t = N(text).match(/ (\d{1,3})$/); if (t) setCh(+t[1]); }
        else if (cn) setCh(cn);
        continue;
      }
      // llamadas de nota (números, letras o signos enlazados a notas)
      if (['a', 'sup', 'span'].includes(tag) && text.length <= 6 && isNoteLink(ch) && !VERSE_CLASS.test(cls)) continue;
      // marcas de capítulo y versículo
      if (/^\d{1,3}[a-z]?$/i.test(text) && ['sup', 'span', 'b', 'strong', 'a', 'small', 'em', 'i', 'big', 'font', 'sub', 'p', 'div'].includes(tag)) {
        const n = parseInt(text, 10);
        if (isNoteLink(ch) && !VERSE_CLASS.test(cls)) continue;
        if (CHAPTER_CLASS.test(cls) && !VERSE_CLASS.test(cls)) { setCh(n); continue; }
        if (tag === 'p' || tag === 'div') { if (CHAPTER_CLASS.test(cls) || text.length <= 3) { setCh(n); continue; } }
        setV(n); continue;
      }
      if (['sup', 'a'].includes(tag) && text.length <= 3 && /^[a-z*†‡§¶]+$/i.test(text)) continue; // llamada de nota
      if (['p', 'div', 'br', 'li', 'tr', 'blockquote'].includes(tag)) put(' ');
      walk(ch, file);
      if (['p', 'div', 'li', 'blockquote'].includes(tag)) put(' ');
    }
  }

  for (let i = 0; i < spine.length; i++) {
    const it = spine[i];
    onProgress(i + 1, spine.length);
    const html = await zip.text(it.href);
    if (!html) continue;
    const doc = parseXML(html);
    if (targets.has(it.href)) { const t = targets.get(it.href); if (t.book) setBook(t.book, true); if (t.ch) setCh(t.ch); }
    const body = doc.body || byTag(doc, 'body')[0];
    if (body) walk(body, it.href);
    if (i % 8 === 0) await new Promise(r => setTimeout(r));
  }

  // limpieza y división de versículos en texto plano ("1 En el principio… 2 Y la tierra…")
  const out = {};
  for (const [b, chs] of Object.entries(books)) {
    out[b] = {};
    for (const [c, vs] of Object.entries(chs)) {
      let entries = Object.entries(vs).map(([v, t]) => [+v, t.replace(/\s+/g, ' ').trim()]).filter(([, t]) => t);
      if (entries.length === 1 && /\s2\s+\S/.test(entries[0][1]) && (entries[0][1].length > 250 || /^1\s+\S/.test(entries[0][1]))) entries = splitPlain(entries[0][1]);
      if (!entries.length) continue;
      out[b][c] = Object.fromEntries(entries);
    }
    if (!Object.keys(out[b]).length) delete out[b];
  }
  return { title: title.trim(), lang, books: out, report: report(out, expected, st.orphan) };
}

// Alinea las entradas del índice con los libros por su número de capítulos (sirve en cualquier idioma).
// Busca el nivel del índice donde las entradas tienen hijos = capítulos y empareja en orden canónico.
function alignTocByChapters(tree, expected, targets) {
  const levels = [];
  const collect = (nodes, d) => { if (!nodes.length) return; (levels[d] ||= []).push(...nodes); nodes.forEach(n => collect(n.kids, d + 1)); };
  collect(tree, 0);
  const ids = Object.keys(expected);
  let best = null;
  for (const lv of levels) {
    const cand = lv.filter(n => n.kids.length > 0);
    if (cand.length < 20) continue;
    const pairs = []; let j = 0;
    for (const id of ids) {
      const want = expected[id].ch;
      let k = j;
      while (k < cand.length && Math.abs(cand[k].kids.length - want) > (want > 2 ? 1 : 0)) k++;
      if (k < cand.length && k - j <= 8) { pairs.push([id, cand[k]]); j = k + 1; }
    }
    if (!best || pairs.length > best.length) best = pairs;
  }
  // sin capítulos en el índice: si hay exactamente 66, 39 o 27 entradas en un nivel, usar el orden
  if (!best || best.length < 20) {
    for (const lv of levels) {
      const ents = lv.filter(n => n.href);
      const off = ents.length === 27 ? 39 : (ents.length === 66 || ents.length === 39) ? 0 : -1;
      if (off >= 0) { best = ents.map((n, i) => [ids[i + off], n]).filter(p => p[0]); break; }
    }
  }
  if (!best || best.length < 20) return;
  for (const [id, n] of best) {
    if (n.href) targets.set(n.href, { book: id, ch: null });
    n.kids.forEach((k, i) => { if (k.href) targets.set(k.href, { book: id, ch: i + 1 }); });
  }
}

// ------------------------------------------------------------------ modo jw.org
export const BOOK_IDS = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL',
  'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'];
// Patrones de identificador por versículo dentro del HTML
//  jw.org: id="chapter3_verse16" · Gutenberg/otros: id="Luc22-1", "Gen1.1", "IIReis3-4" · id="c3v16", "v3_16"
const ANCHOR_PATTERNS = [
  { name: 'jw', any: /id="chapter\d+_verse\d+"/g, re: /^chapter(\d+)_verse(\d+)$/, prefix: false },
  { name: 'pref', any: /id="[A-Za-z]{2,}\.?\d{1,3}[-_.:]\d{1,3}"/g, re: /^([A-Za-z]{2,}?)\.?(\d{1,3})[-_.:](\d{1,3})$/, prefix: true },
  { name: 'cv', any: /id="[cC]\d{1,3}[-_.]?[vV]\d{1,3}"/g, re: /^[cC](\d{1,3})[-_.]?[vV](\d{1,3})$/, prefix: false },
];
const RE_VID = /id="chapter(\d+)_verse(\d+)"/;

async function detectAnchors(zip, spine) {
  const hits = ANCHOR_PATTERNS.map(() => 0);
  for (const it of spine) {
    const html = await zip.text(it.href);
    if (!html) continue;
    ANCHOR_PATTERNS.forEach((p, i) => { hits[i] += (html.match(p.any) || []).length; });
  }
  let best = -1;
  hits.forEach((h, i) => { if (h >= 400 && (best < 0 || h > hits[best])) best = i; });
  return best >= 0 ? ANCHOR_PATTERNS[best] : null;
}

// clases de párrafo de jw.org que no son texto bíblico
const JW_SKIP_P = /(^|\s)(biblebookname|w_navigation|st|ss|sx|sd|sc|se|groupFootnote|groupExt|bodyTxt|footnotes?|notes?)(\s|$)/;
const JW_SUPERSCRIPTION = /(^|\s)sw(\s|$)/;

// Empareja grupos (libros sin identificar) con los 66 libros por su número de capítulos
function alignGroups(groups, expected) {
  const ids = Object.keys(expected);
  const map = new Map(); let j = 0;
  for (const id of ids) {
    const want = expected[id].ch;
    let k = j;
    while (k < groups.length && Math.abs(groups[k].maxC - want) > (want > 2 ? 1 : 0)) k++;
    if (k < groups.length && k - j <= 8) { map.set(groups[k].key, id); j = k + 1; }
  }
  return map;
}

async function importAnchored(zip, spine, expected, onProgress, pat) {
  const raw = [];             // [{key, num, c, v, text}]
  let ord = -1, curNum = null, cur = null, pre = '';
  const seen = new Set();
  const put = (t) => { if (cur && t) cur.text += t; };
  const newVerse = (key, c, v) => {
    const k = `${curNum != null ? 'n' + curNum : key}.${c}.${v}`;
    if (seen.has(k)) return null;
    seen.add(k);
    const r = { key, num: curNum, c, v, text: v === 1 && pre ? pre + ' ' : '' };
    pre = ''; raw.push(r); return r;
  };
  function walk(node) {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) { if (/\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(ch.nodeValue)) { cur = null; continue; } put(ch.nodeValue); continue; }
      if (ch.nodeType !== 1) continue;
      const tag = (ch.localName || ch.nodeName).toLowerCase();
      const cls = ch.getAttribute('class') || '';
      const id = ch.getAttribute('id') || '';
      if (BOILER.test(id + ' ' + cls)) { cur = null; continue; }
      const m = id.match(pat.re);
      if (m) {
        let key, c, v;
        if (pat.prefix) { key = 'p:' + m[1]; c = +m[2]; v = +m[3]; }
        else { c = +m[1]; v = +m[2]; if (c === 1 && v === 1 && curNum == null) ord++; key = 'o:' + ord; }
        const own = (ch.textContent || '').trim();
        if (own.length > 1 && !['a', 'span'].includes(tag) || own.length > 12) {
          // el elemento contiene el versículo completo (p. ej. <p id="Luc22-1">)
          cur = newVerse(key, c, v);
          if (cur) { walk(ch); cur.block = true; }
          cur = null;
        } else {
          cur = newVerse(key, c, v);       // marcador vacío: el texto sigue después
        }
        continue;
      }
      if (['script', 'style', 'head', 'aside', 'header', 'figure', 'img', 'table', 'nav', 'sup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) continue;
      if (tag === 'a' && ch.getAttribute('href')) continue;                       // llamadas de nota y enlaces
      if (/(^|\s)(pageNum|w_ch|ch|footnoteref|groupFootnote|groupExt|fnanchor|footnote)(\s|$)/i.test(cls) || /^(Footnote|FNanchor)/.test(id)) continue;
      if (tag === 'p' || tag === 'div') {
        if (JW_SKIP_P.test(cls)) { cur = null; continue; }   // encabezados y apéndices cortan el versículo en curso
        if (JW_SUPERSCRIPTION.test(cls)) { pre = (pre + ' ' + (ch.textContent || '')).trim(); continue; }
        put(' '); walk(ch); put(' '); continue;
      }
      walk(ch);
    }
  }
  for (let i = 0; i < spine.length; i++) {
    onProgress(i + 1, spine.length);
    const html = await zip.text(spine[i].href);
    if (!html || !(html.match(pat.any) || []).length) continue;
    if (pat.name === 'jw') {
      const nav = html.match(/biblechapternav(\d+)\.x?html/) || html.match(/bibleversenav(\d+)_\d+\.x?html/);
      if (nav) curNum = +nav[1];
    }
    cur = null; pre = '';
    const doc = parseXML(html);
    const body = doc.body || byTag(doc, 'body')[0];
    if (body) walk(body);
    if (i % 10 === 0) await new Promise(r => setTimeout(r));
  }
  // asignar libros
  const groups = []; const gi = new Map();
  for (const r of raw) if (r.num == null) {
    if (!gi.has(r.key)) { gi.set(r.key, groups.length); groups.push({ key: r.key, maxC: 0, n: 0 }); }
    const g = groups[gi.get(r.key)]; g.maxC = Math.max(g.maxC, r.c); g.n++;
  }
  let gmap = alignGroups(groups, expected);
  if (gmap.size < groups.length * 0.8 && [66, 39, 27].includes(groups.length)) {
    const off = groups.length === 27 ? 39 : 0;
    gmap = new Map(groups.map((g, i) => [g.key, BOOK_IDS[i + off]]));
  }
  // prefijos reconocibles por nombre («Gen», «Mat») completan lo que falte
  for (const g of groups) if (!gmap.has(g.key) && g.key.startsWith('p:')) {
    const id = matchBook(g.key.slice(2).replace(/^(III|II|I)(?=[A-Z])/, m => ({ I: '1 ', II: '2 ', III: '3 ' })[m]), false);
    if (id) gmap.set(g.key, id);
  }
  const out = {};
  for (const r of raw) {
    const id = r.num != null ? BOOK_IDS[r.num - 1] : gmap.get(r.key);
    if (!id) continue;
    let text = r.text.replace(/[ \s]+/g, ' ')
      .replace(/\s?\b(HS|Gr|Lat|Sy|Vg|LXX|Sam|TM)-?(?=[\s,.;:—])/g, '')   // siglas de aparato crítico (ed. con referencias)
      .replace(/\s+([,.;:!?»”)])/g, '$1').replace(/([,;:])(?=\p{L})/gu, '$1 ').replace(/\s{2,}/g, ' ').trim();
    // número de capítulo o versículo impreso al inicio del texto
    const lead = text.match(/^(\d{1,3})\s+(?=\S)/);
    if (lead && (+lead[1] === r.v || +lead[1] === r.c)) text = text.slice(lead[0].length);
    if (!/\p{L}/u.test(text)) continue;                              // versículos omitidos (solo guiones)
    ((out[id] ||= {})[r.c] ||= {})[r.v] = text;
  }
  return out;
}

function splitPlain(t) {
  const parts = t.replace(/^1\s+/, '').split(/(?:^|\s)(\d{1,3})\s+(?=\S)/);
  const res = []; let expect = 1;
  if (parts[0].trim()) res.push([1, parts[0].trim()]), expect = 2;
  for (let i = 1; i < parts.length; i += 2) {
    const n = +parts[i], txt = (parts[i + 1] || '').trim();
    if (n === expect || (n === 1 && !res.length)) { res.push([n, txt]); expect = n + 1; }
    else if (res.length) res[res.length - 1][1] += ` ${parts[i]} ${txt}`;
  }
  return res;
}

// versículos que muchas traducciones modernas omiten por ser espurios (no cuentan como error al importar)
const KNOWN_OMITTED = {
  MAT: ['17:21', '18:11', '23:14'], MRK: ['7:16', '9:44', '9:46', '11:26', '15:28', '16:9', '16:10', '16:11', '16:12', '16:13', '16:14', '16:15', '16:16', '16:17', '16:18', '16:19', '16:20'],
  LUK: ['17:36', '23:17'], JHN: ['5:4', '7:53', '8:1', '8:2', '8:3', '8:4', '8:5', '8:6', '8:7', '8:8', '8:9', '8:10', '8:11'],
  ACT: ['8:37', '15:34', '24:7', '28:29'], ROM: ['16:24'],
};
export function report(books, expected, orphan) {
  const rows = []; let verses = 0;
  for (const [id, exp] of Object.entries(expected)) {
    const b = books[id];
    const ch = b ? Object.keys(b).length : 0;
    const vs = b ? Object.values(b).reduce((s, c) => s + Object.keys(c).length, 0) : 0;
    verses += vs;
    const expV = exp.vc.reduce((a, x) => a + x, 0);
    const omitted = b ? (KNOWN_OMITTED[id] || []).filter(r => { const [c, v] = r.split(':'); return !(b[c] && b[c][v]); }).length : 0;
    const ok = ch === exp.ch && Math.abs(vs + omitted - expV) <= Math.max(2, expV * 0.02);
    rows.push({ id, ch, vs, expCh: exp.ch, expV, omitted, status: !b ? 'missing' : ok ? 'ok' : 'warn' });
  }
  return { rows, verses, books: rows.filter(r => r.status !== 'missing').length, orphan, omitted: rows.reduce((a, r) => a + (r.omitted || 0), 0) };
}
