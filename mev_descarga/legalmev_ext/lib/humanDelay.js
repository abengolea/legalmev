/**
 * HumanDelay — Delays aleatorios con distribución no uniforme.
 * Simula tiempos de lectura humanos para evitar detección de patrones de bot.
 */
(function () {
  'use strict';

  const RANGES = {
    DOM_READ: { min: 100, max: 400 },
    FETCH_HTML: { min: 800, max: 1800 },
    FETCH_PDF: { min: 1500, max: 3500 },
    BETWEEN_PAGES: { min: 2000, max: 5000 }
  };

  const JITTER = 0.2;
  let _lastDelay = 0;

  /** Genera número aleatorio con distribución no uniforme (centrada, tipo campana).
   * Promedio de 3 randoms da una campana suave; evita valores extremos frecuentes.
   */
  function randomNatural() {
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    return (r1 + r2 + r3) / 3;
  }

  /** Genera delay en ms con jitter ±20% y evita que sea igual al anterior. */
  function computeDelay(type) {
    const range = RANGES[type] || RANGES.FETCH_HTML;
    const t = randomNatural();
    let base = Math.round(range.min + t * (range.max - range.min));
    const jitterFactor = 1 + (Math.random() * 2 - 1) * JITTER;
    base = Math.round(base * jitterFactor);
    base = Math.max(range.min, Math.min(range.max, base));
    if (base === _lastDelay) {
      base = base + (Math.random() > 0.5 ? 1 : -1) * Math.max(50, Math.round(base * 0.05));
    }
    _lastDelay = base;
    return base;
  }

  async function humanDelay(type) {
    const ms = computeDelay(type);
    return new Promise((r) => setTimeout(r, ms));
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevHumanDelay = { humanDelay, computeDelay, RANGES };
  }
})();
