// Decodificador morfológico en español
// Hebreo/arameo: códigos OpenScriptures (OSHB) adaptados por STEPBible (ETCBC), p. ej. HVqp3ms, HR/Ncfsa
// Griego: códigos Robinson extendidos por STEPBible (TAGNT), p. ej. V-AAI-3S, N-GSM-P

const G = { m: 'masculino', f: 'femenino', b: 'ambos géneros', c: 'común', n: 'neutro' };
const N = { s: 'singular', p: 'plural', d: 'dual' };
const ST = { a: 'absoluto', c: 'constructo', d: 'determinado' };
const P = { 1: '1.ª persona', 2: '2.ª persona', 3: '3.ª persona' };

const HEB_STEM = {
  q: 'Qal', N: 'Nifal', p: 'Piel', P: 'Pual', h: 'Hifil', H: 'Hofal', t: 'Hitpael', o: 'Polel', O: 'Polal',
  r: 'Hitpolel', m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal pasivo', l: 'Pilpel', L: 'Polpal',
  f: 'Hitpalpel', D: 'Nitpael', j: 'Pealal', i: 'Pilel', u: 'Hotpaal', c: 'Tifil', v: 'Hishtafel',
  w: 'Nitpalel', y: 'Nitpoel', z: 'Hitpoel'
};
const ARC_STEM = {
  q: 'Peal', Q: 'Peil', u: 'Hitpeel', p: 'Pael', P: 'Itpaal', M: 'Hitpaal', a: 'Afel', h: 'Hafel', s: 'Safel',
  e: 'Shafel', H: 'Hofal', i: 'Itpeel', t: 'Hishtafel', v: 'Ishtafel', w: 'Hitafel', o: 'Polel', z: 'Itpoel',
  r: 'Hitpolel', f: 'Hitpalpel', b: 'Hefal', c: 'Tifel', m: 'Poel', l: 'Palpel', L: 'Itpalpel', O: 'Itpolel', G: 'Itafal'
};
const HEB_VTYPE = {
  p: 'perfecto (qatal)', q: 'perfecto consecutivo (weqatal)', i: 'imperfecto (yiqtol)',
  w: 'imperfecto consecutivo (wayyiqtol)', h: 'cohortativo', j: 'yusivo', v: 'imperativo',
  r: 'participio activo', s: 'participio pasivo', a: 'infinitivo absoluto', c: 'infinitivo constructo'
};
const HEB_POS = {
  A: ['adjetivo', { a: 'adjetivo', c: 'numeral cardinal', g: 'gentilicio', o: 'numeral ordinal' }],
  C: ['conjunción', {}],
  D: ['adverbio', {}],
  N: ['sustantivo', { c: 'común', g: 'gentilicio', p: 'propio', t: 'título' }],
  P: ['pronombre', { d: 'demostrativo', f: 'indefinido', i: 'interrogativo', p: 'personal', r: 'relativo' }],
  R: ['preposición', { d: 'con artículo' }],
  S: ['sufijo', { d: 'direccional (he locativa)', h: 'he paragógica', n: 'nun paragógica', p: 'pronominal' }],
  T: ['partícula', { a: 'afirmativa', d: 'artículo definido', e: 'exhortativa', i: 'interrogativa', j: 'interjección',
    m: 'demostrativa', n: 'negativa', o: 'marcador de objeto directo', r: 'relativa', c: 'condicional' }],
  V: ['verbo', {}],
};

function decodeHebSeg(seg, aram) {
  if (!seg) return null;
  const pos = seg[0], rest = seg.slice(1);
  const def = HEB_POS[pos];
  if (!def) return { pos: seg, feats: [] };
  const feats = [];
  if (pos === 'V') {
    const stem = (aram ? ARC_STEM : HEB_STEM)[rest[0]] || rest[0];
    const type = rest[1];
    feats.push(stem, HEB_VTYPE[type] || type);
    const r = rest.slice(2);
    if (type === 'r' || type === 's') { // participio: género número estado
      if (G[r[0]]) feats.push(G[r[0]]); if (N[r[1]]) feats.push(N[r[1]]); if (ST[r[2]]) feats.push(ST[r[2]]);
    } else if (type !== 'a' && type !== 'c') {
      if (P[r[0]]) feats.push(P[r[0]]); if (G[r[1]]) feats.push(G[r[1]]); if (N[r[2]]) feats.push(N[r[2]]);
    }
    return { pos: 'verbo', feats };
  }
  const sub = def[1][rest[0]];
  let r = rest.slice(sub ? 1 : 0);
  if (sub) feats.push(sub);
  if ((pos === 'P' && rest[0] === 'p') || (pos === 'S' && rest[0] === 'p')) {
    if (P[r[0]]) feats.push(P[r[0]]); if (G[r[1]]) feats.push(G[r[1]]); if (N[r[2]]) feats.push(N[r[2]]);
  } else if (pos === 'N' && rest[0] === 'p') {
    const pm = { m: 'persona (m.)', f: 'persona (f.)', l: 'lugar', t: 'título' };
    if (pm[r[0]]) feats.push(pm[r[0]]);
  } else if (pos === 'N' || pos === 'A' || pos === 'P') {
    if (G[r[0]]) feats.push(G[r[0]]); if (N[r[1]]) feats.push(N[r[1]]); if (ST[r[2]]) feats.push(ST[r[2]]);
  }
  return { pos: def[0], feats };
}

export function decodeHeb(code) {
  if (!code) return [];
  const lang = code[0];
  const aram = lang === 'A';
  return code.slice(1).split('/').map(s => decodeHebSeg(s, aram)).filter(Boolean)
    .map(d => ({ ...d, lang: aram ? 'arameo' : 'hebreo' }));
}

// ------------------------------------------------------------------ griego
const GPOS = {
  N: 'sustantivo', A: 'adjetivo', T: 'artículo', V: 'verbo', P: 'pronombre personal', R: 'pronombre relativo',
  C: 'pronombre recíproco', D: 'pronombre demostrativo', K: 'pronombre correlativo', I: 'pronombre interrogativo',
  X: 'pronombre indefinido', Q: 'pronombre correlativo/interrogativo', F: 'pronombre reflexivo', S: 'pronombre posesivo',
  ADV: 'adverbio', CONJ: 'conjunción', COND: 'conjunción condicional', PRT: 'partícula', PREP: 'preposición',
  INJ: 'interjección', ARAM: 'palabra aramea', HEB: 'palabra hebrea', LET: 'letra'
};
const CASE = { N: 'nominativo', G: 'genitivo', D: 'dativo', A: 'acusativo', V: 'vocativo' };
const GN = { S: 'singular', P: 'plural' };
const GG = { M: 'masculino', F: 'femenino', N: 'neutro' };
const TENSE = { P: 'presente', I: 'imperfecto', F: 'futuro', A: 'aoristo', R: 'perfecto', L: 'pluscuamperfecto', X: 'sin tiempo' };
const VOICE = { A: 'activa', M: 'media', P: 'pasiva', E: 'media o pasiva', D: 'media deponente', O: 'pasiva deponente',
  N: 'media/pasiva deponente', Q: 'activa impersonal', X: 'sin voz' };
const MOOD = { I: 'indicativo', S: 'subjuntivo', O: 'optativo', M: 'imperativo', N: 'infinitivo', P: 'participio', R: 'participio imperativo' };
const SUFFIX = { P: 'nombre propio', T: 'título', L: 'lugar', G: 'gentilicio', C: 'comparativo', S: 'superlativo',
  I: 'interrogativo', N: 'negativo', K: 'crasis', ATT: 'forma ática', ABB: 'abreviado', NUI: 'numeral indeclinable',
  PRI: 'propio indeclinable', OI: 'otro indeclinable', LI: 'letra indeclinable', ARAM: 'arameo', HEB: 'hebreo' };

function cng(s, feats) {
  if (!s) return;
  const m = s.match(/^([NGDAV])([SP])([MFN])?$/);
  if (m) { feats.push(CASE[m[1]]); feats.push(GN[m[2]]); if (m[3]) feats.push(GG[m[3]]); return true; }
  return false;
}

export function decodeGrk(code) {
  if (!code) return [];
  const parts = code.split('-');
  const head = parts[0];
  const pos = GPOS[head] || head;
  const feats = [];
  if (head === 'V') {
    const tvm = parts[1] || '';
    const m = tvm.match(/^(2?)([PIFARLX])([AMPEDONQX])([ISOMNPR])$/);
    if (m) {
      feats.push((m[1] ? '2.º ' : '') + TENSE[m[2]], 'voz ' + VOICE[m[3]], MOOD[m[4]]);
      const pn = parts[2];
      if (pn) {
        const p2 = pn.match(/^([123])([SP])$/);
        if (p2) feats.push(P[p2[1]], GN[p2[2]]); else cng(pn, feats);
      }
      parts.slice(3).forEach(s => SUFFIX[s] && feats.push(SUFFIX[s]));
    } else feats.push(tvm);
    return [{ pos, feats, lang: 'griego' }];
  }
  let rest = parts.slice(1);
  if (['P', 'F', 'S'].includes(head) && rest[0] && /^[123]/.test(rest[0])) {
    const r = rest[0];
    feats.push(P[r[0]]);
    if (head === 'S' && /^[123][SP]/.test(r)) { feats.push('poseedor ' + GN[r[1]]); cng(r.slice(2), feats); }
    else if (!cng(r.slice(1), feats) && r.length > 1) cng(r.slice(1), feats);
    rest = rest.slice(1);
  } else if (rest[0] && cng(rest[0], feats)) {
    rest = rest.slice(1);
  }
  rest.forEach(s => SUFFIX[s] && feats.push(SUFFIX[s]));
  return [{ pos, feats, lang: 'griego' }];
}

export function decode(code, lang) {
  return lang === 'hbo' ? decodeHeb(code) : decodeGrk(code);
}

export function morphShort(code, lang) {
  // forma compacta para la línea interlineal
  if (!code) return '';
  return lang === 'hbo' ? code.slice(1) : code;
}
