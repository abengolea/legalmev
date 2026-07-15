/**
 * Content script inyectado en /extension-connect.
 * Escucha postMessage de la página y reenvía el token al background.
 */
(function () {
  const LEGALMEV_MSG_TYPE = 'LEGALMEV_AUTH_TOKEN';

  function handleMessage(event) {
    if (event.source !== window) return;
    if (event.data?.type !== LEGALMEV_MSG_TYPE || typeof event.data.token !== 'string') return;
    if (event.origin !== window.location.origin) return;

    const token = event.data.token.trim();
    if (!token) return;
    const baseUrl = event.data.baseUrl || window.location.origin;
    const nombre = (event.data.nombre || '').trim();
    const deviceId = (event.data.deviceId || '').trim();

    chrome.runtime.sendMessage({ action: 'AUTH_TOKEN_RECEIVED', token, baseUrl, nombre, deviceId }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[LegalMev] No se pudo enviar token:', chrome.runtime.lastError.message);
      }
    });
  }

  window.addEventListener('message', handleMessage);
})();
