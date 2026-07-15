/**
 * Content script LegalMev - corre en páginas de MEV para extraer
 * información del expediente y actuaciones con reporte de progreso.
 * Extracción limpia según estructura HTML de proveido.asp.
 */
(function () {
'use strict';
// Evitar redeclaración cuando el script se inyecta 2 veces (manifest + executeScript)
if (window.__MEV_EXPORTER_LOADED__) return;
window.__MEV_EXPORTER_LOADED__ = true;

const PROVEIDO_REGEX = /^https:\/\/mev\.scba\.gov\.ar\/proveido\.asp\?/i;
const SEPARADOR_REGEX = /-{5,}\s*Para copiar y pegar/i;

let cancelarExportacion = false;

function textoLimpio(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function extraerMovimientosDesdeTabla() {
  const movimientos = [];
  const vistos = new Set();

  for (const link of document.querySelectorAll("a[href]")) {
    if (!link || vistos.has(link.href)) continue;
    if (!PROVEIDO_REGEX.test(link.href)) continue;

    const row = link.closest("tr");
    if (!row) continue;

    const cells = Array.from(row.children).filter((el) => /^(TD|TH)$/i.test(el.tagName));
    const textos = cells.map(textoLimpio);
    const fechaCell = textos.find((txt) => /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(txt)) || "";
    const fecha = fechaCell.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)?.[0] || "";
    const hora = fechaCell.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] || "";
    const descripcion =
      textoLimpio(link) ||
      textos
        .slice()
        .reverse()
        .find((txt) => txt && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(txt) && !/^\d{1,2}:\d{2}/.test(txt)) ||
      "";

    vistos.add(link.href);
    movimientos.push({
      url: link.href,
      fecha,
      hora,
      descripcion
    });
  }

  return movimientos;
}

function extraerLinksProveidoEnOrdenDom() {
  const links = [];
  const vistos = new Set();
  for (const a of document.querySelectorAll("a[href]")) {
    if (!PROVEIDO_REGEX.test(a.href) || vistos.has(a.href)) continue;
    vistos.add(a.href);
    links.push(a.href);
  }
  return links;
}

/** MEV: mismo origen con sesión; delays largos por request hacen exportaciones grandes muy lentas en 0 %. */
function delayEntreProveidosMev() {
  const ms = 300 + Math.floor(Math.random() * 500);
  return new Promise((r) => setTimeout(r, ms));
}

const PROVEIDO_FETCH_MS = 120000;

/**
 * MEV: fetch directo (sin LegalMevScheduler/cola/riesgo). PJN ya usa el mismo criterio en content-pjn.js.
 * El scheduler en la misma pestaña podía dejar la exportación “congelada” en la 1.ª actuación.
 */
async function fetchProveidoMevHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVEIDO_FETCH_MS);
  try {
    const resp = await fetch(url, {
      credentials: "include",
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9"
      }
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return await resp.text();
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error(`Tiempo de espera agotado (${PROVEIDO_FETCH_MS / 1000}s) al cargar el proveído`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function esCaratulaValida(texto) {
  if (!texto || texto.length < 5) return false;
  if (/usuario\s*mev|usuario\s+apto\s+para\s+solicitar|autorizaciones\s+de\s+causas|mesa\s+de\s+entradas\s+virtual/i.test(texto)) return false;
  if (/^nombre\s*$/i.test(texto.trim())) return false;
  return true;
}

function extractCaratula() {
  const selectors = [
    "td[headers*='caratula']",
    "td[headers*='carátula']",
    ".caratula",
    "table.marco td",
    "[id*='caratula']",
    "[id*='carátula']"
  ];
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      const txt = el?.textContent?.trim();
      if (txt && txt.length > 3 && esCaratulaValida(txt)) {
        return txt;
      }
    } catch (_) {}
  }
  const title = (document.title || "").trim();
  const parts = title.split(/[\-\–\—|]/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.length > 10 && esCaratulaValida(p) && /c\/|vs\.|contra/i.test(p)) return p;
    if (p.length > 15 && esCaratulaValida(p) && !/^\d+[\/\-]?\d*$/.test(p)) return p;
  }
  for (const p of parts.reverse()) {
    if (p.length > 5 && !/^\d+$/.test(p) && !/^expediente$/i.test(p) && !/^mev$/i.test(p) && esCaratulaValida(p)) {
      return p;
    }
  }
  return "";
}

function getExpedienteInfo() {
  const movimientos = extraerMovimientosDesdeTabla();
  const links = movimientos.length
    ? movimientos.map((m) => m.url)
    : extraerLinksProveidoEnOrdenDom();
  const movimientosConFallback = movimientos.length
    ? movimientos
    : links.map((url) => ({ url, fecha: "", hora: "", descripcion: "" }));

  let nroExpediente =
    buscarValorPorEtiqueta(document, "Nº de Expediente") ||
    buscarValorPorEtiqueta(document, "N° de Expediente") ||
    buscarValorPorEtiqueta(document, "Nro. de Expediente") ||
    "";
  if (!nroExpediente) {
    const body = document.body?.innerText || "";
    const m =
      body.match(/N[º°]\s*de\s*Expediente\s*:?\s*([^\n]{3,60})/i) ||
      body.match(/\b(\d{1,7}\/\d{2,4})\b/);
    if (m) nroExpediente = m[1].replace(/\s+/g, " ").trim();
  }
  if (!nroExpediente) {
    try {
      const u = new URL(location.href);
      nroExpediente =
        u.searchParams.get("nroExpediente") ||
        u.searchParams.get("numero") ||
        u.searchParams.get("idExpediente") ||
        "";
    } catch (_) {}
  }
  nroExpediente = String(nroExpediente || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  if (/mesa\s+de\s+entradas|^mev$/i.test(nroExpediente)) nroExpediente = "";

  let caratula = extractCaratula();
  if (!esCaratulaValida(caratula)) caratula = "";

  return {
    pageTitle: document.title || "",
    pageUrl: location.href,
    count: links.length,
    urls: links,
    movimientos: movimientosConFallback,
    caratula,
    nroExpediente,
    juzgado:
      buscarValorPorEtiqueta(document, "Juzgado") ||
      buscarValorPorEtiqueta(document, "Departamento") ||
      ""
  };
}

/**
 * Busca en celdas td el valor asociado a una etiqueta (ej: "Carátula", "Nº de Expediente").
 * En tablas MEV: <tr><td>Etiqueta</td><td>Valor</td></tr> o <td>Etiqueta:</td><td>Valor</td>
 */
function buscarValorPorEtiqueta(doc, etiqueta) {
  const etiqNorm = (etiqueta || "").replace(/:+\s*$/, "").trim();
  const allCells = doc.querySelectorAll("td");
  for (const td of allCells) {
    const txt = (td.textContent || "").trim();
    const txtSinColon = txt.replace(/:+\s*$/, "").trim();
    if (txt === etiqueta || txtSinColon === etiqNorm || txt.toLowerCase().startsWith(etiqNorm.toLowerCase() + ":") || txt.toLowerCase().startsWith(etiqNorm.toLowerCase() + " ")) {
      const row = td.closest("tr");
      if (row) {
        const cells = row.querySelectorAll("td");
        const idx = Array.from(cells).indexOf(td);
        if (idx >= 0 && cells[idx + 1]) {
          return (cells[idx + 1].textContent || "").trim();
        }
      }
      const next = td.nextElementSibling;
      if (next) return (next.textContent || "").trim();
      if (txt.includes(":")) {
        const afterColon = txt.replace(/^[^:]+:\s*/, "").trim();
        if (afterColon) return afterColon;
      }
      return "";
    }
  }
  return "";
}

/**
 * Extrae el texto limpio del proveído.
 * Estrategia 1: Buscar celda "Texto del Proveído" y tomar el contenido siguiente.
 * Estrategia 2: Buscar separador "------- Para copiar y pegar..." y tomar todo lo posterior.
 */
function extraerTextoProveido(doc) {
  const body = doc.body || doc;
  let textoCompleto = "";

  // Estrategia A: Celda "Texto del Proveído"
  const allCells = doc.querySelectorAll("td");
  for (const td of allCells) {
    if ((td.textContent || "").trim() === "Texto del Proveído") {
      const next = td.closest("table")?.nextElementSibling || td.closest("tr")?.nextElementSibling;
      if (next) {
        textoCompleto = (next.textContent || "").trim();
      }
      break;
    }
  }

  // Estrategia B: Separador "------- Para copiar y pegar..." en el texto plano
  if (!textoCompleto && body.innerText) {
    const full = body.innerText;
    const m = full.match(SEPARADOR_REGEX);
    if (m) {
      const idx = full.indexOf(m[0]);
      const despuesSeparador = full.slice(idx);
      const finLinea = despuesSeparador.indexOf("\n");
      textoCompleto = finLinea >= 0 ? despuesSeparador.slice(finLinea + 1).trim() : despuesSeparador.trim();
    }
  }

  // Fallback: todo el body
  if (!textoCompleto) {
    textoCompleto = (body.innerText || body.textContent || "").trim();
  }

  // Limpiar: quitar línea del separador, trim, preservar párrafos
  textoCompleto = textoCompleto.replace(SEPARADOR_REGEX, "").trim();
  // Quitar navegación y ruido conocido
  const ruido = [
    /^\s*Anterior\s*\|\s*Siguiente\s*\|\s*Volver\s*$/gm,
    /^\s*Anterior\s*$/gm,
    /^\s*Siguiente\s*$/gm,
    /^\s*Volver\s*$/gm,
    /UsuarioMEV/i,
    /Datos del Expediente/i,
    /Pasos procesales/i,
    /REFERENCIAS/i,
    /DATOS DE PRESENTACIÓN/i,
    /Texto del Proveído/i
  ];
  for (const r of ruido) {
    textoCompleto = textoCompleto.replace(r, "");
  }
  textoCompleto = textoCompleto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l)
    .join("\n\n");

  return textoCompleto;
}

/**
 * Extrae header de actuación: "DD/MM/YYYY HH:MM:SS - TIPO - ACCION"
 * (texto entre Anterior y Siguiente).
 */
function extraerHeaderActuacion(doc) {
  const links = doc.querySelectorAll("a[href]");
  let anteriorEl = null;
  let siguienteEl = null;
  for (const a of links) {
    const t = (a.textContent || "").trim();
    if (/^Anterior$/i.test(t)) anteriorEl = a;
    if (/^Siguiente$/i.test(t)) siguienteEl = a;
  }
  if (!anteriorEl || !siguienteEl) {
    const title = (doc.title || "").trim();
    const m = title.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}:\d{2}:\d{2})?\s*[-–—]?\s*(.+)/);
    if (m) {
      return {
        fecha: `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`,
        hora: m[4] || "",
        tipo: (m[5] || "").trim()
      };
    }
    return { fecha: "", hora: "", tipo: "" };
  }
  let textoHeader = "";
  let n = anteriorEl.nextSibling;
  while (n && n !== siguienteEl) {
    if (n.nodeType === Node.TEXT_NODE) {
      textoHeader += n.textContent || "";
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      textoHeader += (n.textContent || "").trim() + " ";
    }
    n = n.nextSibling;
  }
  textoHeader = textoHeader.replace(/\s+/g, " ").trim();
  const m = textoHeader.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}:\d{2}:\d{2})?\s*[-–—]\s*(.+)$/);
  if (m) {
    return {
      fecha: `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`,
      hora: (m[4] || "").trim(),
      tipo: (m[5] || "").trim()
    };
  }
  const m2 = textoHeader.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) {
    return {
      fecha: `${m2[1].padStart(2, "0")}/${m2[2].padStart(2, "0")}/${m2[3]}`,
      hora: "",
      tipo: textoHeader.replace(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*/, "").trim()
    };
  }
  return { fecha: "", hora: "", tipo: textoHeader };
}

/**
 * Extrae adjuntos tipo "VER ADJUNTO" con nombre de archivo.
 */
function extraerAdjuntos(doc, baseUrl) {
  const adjuntos = [];
  const anchors = doc.querySelectorAll("a[href]");
  for (const a of anchors) {
    const text = (a.textContent || "").trim();
    if (!/VER ADJUNTO/i.test(text)) continue;
    const href = a.getAttribute("href");
    if (!href) continue;
    try {
      const url = new URL(href, baseUrl).href;
      const nombre = text.replace(/VER ADJUNTO/i, "").trim() || (href.split("/").pop() || "adjunto.pdf");
      adjuntos.push({ nombre: nombre || "adjunto.pdf", url });
    } catch (_) {}
  }
  return adjuntos;
}

/**
 * Extrae datos de "REFERENCIAS" y "DATOS DE PRESENTACIÓN".
 */
function extraerReferencias(doc, baseUrl) {
  const titulo = buscarValorPorEtiqueta(doc, "Observación") || buscarValorPorEtiqueta(doc, "observación");
  const firmante = buscarValorPorEtiqueta(doc, "Firmado por") || buscarValorPorEtiqueta(doc, "Firmante");
  const adjuntos = extraerAdjuntos(doc, baseUrl);
  const header = extraerHeaderActuacion(doc);
  return { titulo, firmante, adjuntos, ...header };
}

/**
 * Extrae "Datos del Expediente": caratula, nroExpediente, juzgado.
 * Fallback: regex sobre innerText por si la tabla tiene estructura distinta.
 */
function extraerDatosExpediente(doc) {
  let caratula = buscarValorPorEtiqueta(doc, "Carátula") || buscarValorPorEtiqueta(doc, "Caratula") || buscarValorPorEtiqueta(doc, "Carátula:");
  let nroExpediente = buscarValorPorEtiqueta(doc, "Nº de Expediente") || buscarValorPorEtiqueta(doc, "N° de Expediente");
  if (!caratula && doc.body) {
    const m = (doc.body.innerText || "").match(/Car[áa]tula\s*:?\s*([^\n]+)/i);
    if (m) caratula = m[1].trim();
  }
  if (!nroExpediente && doc.body) {
    const m = (doc.body.innerText || "").match(/N[º°]\s*de\s*Expediente\s*:?\s*([^\n]+)/i);
    if (m) nroExpediente = m[1].replace(/\s+/g, " ").trim();
  }
  let juzgado = "";
  const tables = doc.querySelectorAll("table.marco, table");
  for (const t of tables) {
    const h = t.querySelector("th, td[class*='header'], .header");
    if (h) {
      const txt = (h.textContent || "").trim();
      if (txt && /Juzgado/i.test(txt) && txt.length < 80) {
        juzgado = txt;
        break;
      }
    }
  }
  if (!juzgado && doc.title) {
    const m = doc.title.match(/Juzgado[^|]+/i);
    if (m) juzgado = m[0].trim();
  }
  return { caratula, nroExpediente, juzgado };
}

/**
 * Extrae una actuación completa de un documento proveido.asp.
 */
function extraerActuacionCompleta(doc, url, numero, esPrimera, meta = {}) {
  const contenido = extraerTextoProveido(doc);
  const refs = extraerReferencias(doc, url);
  const datosExp = esPrimera ? extraerDatosExpediente(doc) : {};

  const act = {
    numero,
    fecha: meta.fecha || refs.fecha || "",
    hora: meta.hora || refs.hora || "",
    tipo: meta.descripcion || refs.tipo || "",
    titulo: refs.titulo || meta.descripcion || "",
    firmante: refs.firmante || "",
    contenido,
    adjuntos: refs.adjuntos || [],
    url
  };
  if (esPrimera && (datosExp.caratula || datosExp.nroExpediente || datosExp.juzgado)) {
    act.caratula = datosExp.caratula || "";
    act.nroExpediente = datosExp.nroExpediente || "";
    act.juzgado = datosExp.juzgado || "";
  }
  return act;
}

/**
 * Construye lista de anexos global (para compatibilidad con el servidor).
 */
function construirAnexosGlobales(actuaciones, baseUrl) {
  const todos = [];
  for (let i = 0; i < actuaciones.length; i++) {
    const act = actuaciones[i];
    const adj = act.adjuntos || [];
    for (const a of adj) {
      todos.push({
        url: a.url,
        title: a.nombre || "Anexo.pdf",
        actuacionIndex: i + 1
      });
    }
  }
  return todos;
}

async function collectActuacionesWithProgress(movimientos, sendProgress) {
  const actuaciones = [];
  let datosExpediente = { caratula: "", nroExpediente: "", juzgado: "" };

  if (sendProgress) {
    sendProgress({ current: 0, total: movimientos.length, mensaje: "Conectando con MEV..." });
  }

  for (let i = 0; i < movimientos.length; i++) {
    if (cancelarExportacion) {
      return null;
    }

    const movimiento = typeof movimientos[i] === "string" ? { url: movimientos[i] } : movimientos[i];
    const url = movimiento.url;
    if (i > 0) await delayEntreProveidosMev();
    if (sendProgress) {
      const total = movimientos.length;
      // Mientras esperamos el fetch, current sigue = completadas; sin progreso parcial el UI queda en 0 % varios segundos.
      const progresoEnCurso =
        total > 0 ? Math.min(99, Math.round((100 * (i + 0.4)) / total)) : 0;
      sendProgress({
        current: i,
        total,
        progreso: progresoEnCurso,
        mensaje: `Descargando actuación ${i + 1} de ${total}…`
      });
    }
    try {
      const html = await fetchProveidoMevHtml(url);

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const esPrimera = i === 0;
      const act = extraerActuacionCompleta(doc, url, i + 1, esPrimera, movimiento);

      if (esPrimera && act.caratula && esCaratulaValida(act.caratula)) datosExpediente.caratula = act.caratula;
      if (esPrimera && act.nroExpediente) {
        const nro = (act.nroExpediente || "").replace(/\s+/g, "").replace(/\s*[-\|]\s*\/?\s*$/, "").trim().slice(0, 30);
        if (nro) datosExpediente.nroExpediente = nro;
      }
      if (esPrimera && act.juzgado) datosExpediente.juzgado = act.juzgado;

      actuaciones.push(act);

      if (i === 0) {
        console.log("[LegalMev] Extracción de la primera actuación (validación):", act);
      }
    } catch (e) {
      actuaciones.push({
        numero: i + 1,
        fecha: movimiento.fecha || "",
        hora: movimiento.hora || "",
        tipo: movimiento.descripcion || "",
        titulo: movimiento.descripcion || "",
        firmante: "",
        contenido: `(Error al leer esta actuación: ${e.message})`,
        adjuntos: [],
        url
      });
    }

    if (sendProgress) {
      sendProgress({
        current: i + 1,
        total: movimientos.length,
        mensaje: `Procesando actuación ${i + 1} de ${movimientos.length}...`
      });
    }
  }

  const anexos = construirAnexosGlobales(actuaciones, movimientos[0]?.url || movimientos[0] || "");
  return { actuaciones, anexos, datosExpediente };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "getExpedienteInfo") {
    try {
      const info = getExpedienteInfo();
      sendResponse({ ok: true, ...info });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }

  if (msg.action === "cancelExport") {
    cancelarExportacion = true;
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === "collectActuaciones") {
    cancelarExportacion = false;
    globalThis.LegalMevBackoffController?.reset?.();
    globalThis.LegalMevRiskDetector?.reset?.();
    try {
      globalThis.LegalMevTaskQueue?.getInstance?.()?.cancelAll?.();
    } catch (_) {}
    const ultimosN = msg.ultimosN ? parseInt(msg.ultimosN, 10) : null;
    let info;
    try {
      info = getExpedienteInfo();
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || "Error al leer el expediente" });
      return true;
    }
    if (!info || !Array.isArray(info.urls) || !info.urls.length) {
      sendResponse({ ok: false, error: "No se encontraron actuaciones" });
      return true;
    }
    let movimientos = Array.isArray(info.movimientos) && info.movimientos.length
      ? info.movimientos
      : info.urls.map((url) => ({ url, fecha: "", hora: "", descripcion: "" }));
    if (ultimosN && ultimosN > 0 && ultimosN < movimientos.length) {
      movimientos = movimientos.slice(0, ultimosN);
    }

    const sendProgress = (data) => {
      chrome.runtime.sendMessage({ type: "exportProgress", ...data }).catch(() => {});
    };

    let responded = false;
    const safeSend = (obj) => {
      if (responded) return;
      responded = true;
      try {
        sendResponse(obj);
      } catch (e) {
        console.warn("[LegalMev] sendResponse falló:", e);
      }
    };

    collectActuacionesWithProgress(movimientos, sendProgress)
      .then((result) => {
        try {
          if (result === null) {
            safeSend({ ok: false, error: "Cancelado por el usuario" });
            return;
          }
          const datos = result.datosExpediente && typeof result.datosExpediente === "object" ? result.datosExpediente : {};
          const acts = Array.isArray(result.actuaciones) ? result.actuaciones : [];
          // Sanitizar actuaciones para evitar DataCloneError (solo campos serializables)
          const actuacionesSafe = acts.map((a) => {
            if (!a || typeof a !== "object") return null;
            return {
              numero: a.numero,
              url: String(a.url || ""),
              titulo: String(a.titulo || ""),
              tipo: String(a.tipo || ""),
              fecha: String(a.fecha || ""),
              hora: String(a.hora || ""),
              firmante: String(a.firmante || ""),
              contenido: String(a.contenido || ""),
              adjuntos: Array.isArray(a.adjuntos) ? a.adjuntos.map((x) => ({ nombre: String(x.nombre || ""), url: String(x.url || "") })) : [],
              caratula: a.caratula ? String(a.caratula) : undefined,
              nroExpediente: a.nroExpediente ? String(a.nroExpediente) : undefined,
              juzgado: a.juzgado ? String(a.juzgado) : undefined
            };
          }).filter(Boolean);
          const anexosSafe = Array.isArray(result.anexos)
            ? result.anexos.map((x) => ({ url: String(x?.url || ""), title: String(x?.title || ""), actuacionIndex: x?.actuacionIndex }))
            : [];
          const caratulaEnvio = datos.caratula || (esCaratulaValida(info?.caratula || "") ? info.caratula : "");
          safeSend({
            ok: true,
            actuaciones: actuacionesSafe,
            anexos: anexosSafe,
            pageTitle: String(info?.pageTitle ?? ""),
            pageUrl: String(info?.pageUrl ?? ""),
            count: acts.length,
            caratula: String(caratulaEnvio || ""),
            nroExpediente: String(datos.nroExpediente ?? ""),
            juzgado: String(datos.juzgado ?? "")
          });
        } catch (err) {
          safeSend({ ok: false, error: err?.message || "Error al preparar la respuesta" });
        }
      })
      .catch((e) => {
        safeSend({ ok: false, error: e?.message || "Error al recolectar actuaciones" });
      });

    return true;
  }
});
})();
