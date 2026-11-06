// Página de bienvenida (solo en la web): se muestra en la primera visita y desde Ajustes → «Descargar la app».
// Ofrece el APK en Android, instalar la web (o el programa portable) en el computador, o seguir en la web.

let bip = null;                                    // evento «beforeinstallprompt» (Chrome/Edge: instalar la web)
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); bip = e; });

const ua = navigator.userAgent || '';
export const platform = () => /Android/i.test(ua) ? 'android'
  : /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
  : /Windows/i.test(ua) ? 'windows' : 'desktop';
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function getJSON(url) {
  try { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}
const mb = (n) => n ? ` · ${Math.round(n / 1048576)} MB` : '';

export function welcomeHTML(t, icon, again) {
  const f = (ic, h, p) => `<li><span class="wf-ic">${icon(ic)}</span><div><b>${t(h)}</b><p>${t(p)}</p></div></li>`;
  return `<div class="welcome">
  <header class="w-hero">
    <img src="icons/icon-192.png" alt="" width="72" height="72">
    <h1>${t('Biblia Interlineal')}</h1>
    <p>${t('Las Escrituras en hebreo y griego, palabra por palabra, con su significado en español.')}</p>
  </header>

  <section class="w-preview" aria-label="${t('Vista previa')}">
    <div class="w-ref">${t('Génesis')} 1:1</div>
    <div class="w-words" dir="rtl">
      <span><b>בְּרֵאשִׁית</b><i>bereshit</i><em>${t('en el principio')}</em></span>
      <span><b>בָּרָא</b><i>bara</i><em>${t('creó')}</em></span>
      <span><b>אֱלֹהִים</b><i>elohim</i><em>${t('Dios')}</em></span>
      <span><b>אֵת</b><i>et</i><em>—</em></span>
      <span><b>הַשָּׁמַיִם</b><i>hashamayim</i><em>${t('los cielos')}</em></span>
    </div>
    <p class="w-rv">EN el principio crió Dios los cielos y la tierra.</p>
  </section>

  <section class="w-cta" id="w-cta" aria-live="polite"></section>

  <ul class="w-feats">
    ${f('books', 'Hebreo y griego, palabra por palabra', 'Transliteración, glosa y morfología explicada en español.')}
    ${f('search', 'Léxicos y concordancia Strong', 'Toca una palabra para ver su significado y dónde más aparece.')}
    ${f('cols', 'Compara traducciones', '28 Biblias libres en español, inglés y portugués, en columnas paralelas.')}
    ${f('layers', 'Tus obras de consulta', 'Importa diccionarios y enciclopedias en PDF o EPUB y conéctalos con cada versículo.')}
    ${f('alert', 'El nombre divino, siempre', 'Y notas claras sobre los textos añadidos o debatidos.')}
    ${f('download', 'Sin conexión y sin publicidad', 'Gratis, sin rastreo: tus notas quedan solo en tu dispositivo.')}
  </ul>
  <p class="w-foot"><a href="#principios">${t('Principios de esta app')}</a></p>
  ${again ? '' : `<button class="w-skip linkbtn" data-w="web">${t('Continuar en la web')} ›</button>`}
</div>`;
}

// rellena los botones según el dispositivo; onDone(elección) cuando la persona decide
export async function fillCTA(root, t, icon, onDone, again) {
  const box = root.querySelector('#w-cta'); if (!box) return;
  const p = platform();
  const web = `<button class="w-btn ghost" data-w="web">${icon('books')}<span>${again ? t('Volver a la Biblia') : t('Continuar en la web')}<small>${t('Acceso completo, sin instalar nada')}</small></span></button>`;
  const install = (label, sub) => `<button class="w-btn" data-w="pwa">${icon('download')}<span>${t(label)}<small>${t(sub)}</small></span></button>`;
  box.innerHTML = `<div class="w-load">${t('Buscando la última versión…')}</div>`;
  let html = '';
  if (p === 'android') {
    const v = await getJSON(window.APP_UPDATE_JSON || '');
    if (v && v.url) html += `<a class="w-btn" data-w="apk" href="${v.url}" rel="noopener">${icon('download')}<span>${t('Descargar para Android')}<small>${t('Versión {v}', { v: v.versionName })}${mb(v.size)} · APK</small></span></a>
      <p class="w-note">${t('Al abrir el archivo, Android puede pedirte permitir la instalación desde el navegador. La app se actualiza sola después.')}</p>`;
  } else if (p === 'ios') {
    html += `<p class="w-note">${t('En iPhone y iPad: toca Compartir y luego «Agregar a pantalla de inicio» para tenerla como app, también sin conexión.')}</p>`;
  } else {
    if (bip && !standalone()) html += install('Instalar en este computador', 'Se abre en su propia ventana y funciona sin conexión');
    const d = p === 'windows' || again ? await getJSON(window.APP_DESKTOP_JSON || '') : null;
    if (d && d.url) html += `<a class="w-btn ${bip ? 'ghost' : ''}" data-w="exe" href="${d.url}" rel="noopener">${icon('download')}<span>${t('Descargar para Windows')}<small>${t('Programa portable, sin instalar')} · ${t('Versión {v}', { v: d.versionName })}${mb(d.size)}</small></span></a>`;
    if (!bip && !standalone() && !(d && d.url)) html += `<p class="w-note">${t('Para instalarla como programa, usa Chrome o Edge y elige «Instalar» en la barra de direcciones.')}</p>`;
  }
  box.innerHTML = html + web;
  root.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', async (e) => {
    const w = b.dataset.w;
    if (w === 'pwa' && bip) { e.preventDefault(); bip.prompt(); try { await bip.userChoice; } catch {} bip = null; }
    onDone(w);
  }));
}
