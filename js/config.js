// Sabor de distribución: 'direct' (web y APK directo) o 'play' (Google Play: sin enlace externo de donación).
window.APP_FLAVOR = 'direct';
// Versión de esta compilación (la escribe GitHub Actions: 0.5.<número de commits>).
window.APP_VERSION = '0.5.24';
// Actualización del APK (solo descarga directa; la versión de Google Play no la usa): version.json del repositorio público.
window.APP_UPDATE_JSON = 'https://raw.githubusercontent.com/SoyNonoCL/interlineal-bible/main/version.json';
// Programa portable para Windows (lo publica el flujo «Escritorio»).
window.APP_DESKTOP_JSON = 'https://raw.githubusercontent.com/SoyNonoCL/interlineal-bible/main/escritorio.json';
// Actualización del contenido de la app Android (paquete web de Capgo).
window.APP_UPDATE_URL = 'https://raw.githubusercontent.com/SoyNonoCL/interlineal-bible/main/update/latest.json';
// Catálogo de Biblias libres para descargar (la app Android lo lee directo del repositorio público).
window.APP_CATALOG_URL = 'https://raw.githubusercontent.com/SoyNonoCL/interlineal-bible/main/data/bibles/';
