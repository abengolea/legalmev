/**
 * LegalMev Popup - Máquina de estados con 6 estados (0=no auth, 1-5=flujo export).
 * API_BASE: se guarda al conectar en /extension-connect (según origen). Fallback: producción.
 */
const API_BASE_DEFAULT = 'https://www.legalmev.com.ar';
let API_BASE = API_BASE_DEFAULT;
let EXTENSION_CONNECT_URL = `${API_BASE_DEFAULT}/extension-connect`;

async function updateApiBase() {
  const { apiBase } = await chrome.storage.local.get('apiBase');
  API_BASE = (apiBase && typeof apiBase === 'string') ? apiBase : API_BASE_DEFAULT;
  EXTENSION_CONNECT_URL = `${API_BASE}/extension-connect`;
}
const STATES = { NO_AUTH: 0, INACTIVO: 1, DETECTADO: 2, PROCESANDO: 3, COMPLETADO: 4, ERROR: 5 };

let currentTab = null;
let expedienteInfo = null;
let authToken = null;

function showState(n) {
  document.querySelectorAll(".state").forEach((el) => el.classList.remove("active"));
  const el = document.getElementById("state" + n);
  if (el) el.classList.add("active");
}

/** Obtiene el token guardado en storage. */
async function getStoredToken() {
  const { authToken: t } = await chrome.storage.local.get("authToken");
  return t || null;
}

/** Headers con Authorization y X-Device-Id para requests al backend. */
async function authHeaders() {
  const h = { "Content-Type": "application/json" };
  if (authToken) h["Authorization"] = "Bearer " + authToken;
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (deviceId) h["X-Device-Id"] = deviceId;
  return h;
}

/** Borra el token y vuelve a estado no autenticado. */
async function clearAuthAndShowConnect() {
  authToken = null;
  const SM = window.LegalMevSessionManager;
  if (SM) await SM.clearExtensionSession();
  else await chrome.storage.local.remove("authToken");
  showState(STATES.NO_AUTH);
}

function formatTimeEstimate(seconds) {
  if (!seconds || seconds < 60) return `~${Math.max(30, seconds)} seg`;
  const min = Math.ceil(seconds / 60);
  return min <= 1 ? "~1 min" : `~${min} min`;
}

function timeHintFromJob(job) {
  const sec = job?.estimatedSeconds;
  if (!sec) return "";
  const portal = job?.portal;
  if (portal === "mpba") return `Modo seguro: ${formatTimeEstimate(sec)} estimados`;
  if (portal === "pjn") return `Tiempo orientativo: ${formatTimeEstimate(sec)} (PJN y PDFs)`;
  if (portal === "salta") return `Tiempo orientativo: ${formatTimeEstimate(sec)} (Salta y PDFs)`;
  if (portal === "entrerios") return `Tiempo orientativo: ${formatTimeEstimate(sec)} (Entre Ríos y PDFs)`;
  if (portal === "tucuman") return `Tiempo orientativo: ${formatTimeEstimate(sec)} (SAE Tucumán)`;
  return `Tiempo orientativo: ${formatTimeEstimate(sec)} estimados`;
}

function setState(n, data = {}) {
  showState(n);
  toggleSettingsBlock(n === STATES.INACTIVO || n === STATES.DETECTADO);
  if (n === STATES.DETECTADO && data) {
    document.getElementById("expedienteName").textContent =
      data.pageTitle || "Expediente";
    document.getElementById("actuacionesCount").textContent =
      `${data.count || 0} actuaciones encontradas`;
    const exportBtn = document.getElementById("exportBtn");
    const exportOpts = document.querySelector("#state2 .export-options");
    const pickerPortal = usesDownloadPicker(currentTab?.url) || data.pickerReady;
    if (exportOpts) exportOpts.style.display = pickerPortal ? "none" : "";
    if (exportBtn) {
      exportBtn.textContent = "Bajar en PDF";
    }
    const ultimosInput = document.getElementById("ultimosN");
    if (ultimosInput) {
      ultimosInput.max = Math.max(1, data.count || 999);
      ultimosInput.placeholder = String(Math.min(10, data.count || 10));
    }
    if (pickerPortal) {
      const countEl = document.getElementById("actuacionesCount");
      if (countEl) {
        countEl.textContent = `${data.count || 0} actuaciones · usá el botón para bajar en PDF`;
      }
    }
  }
  if (n === STATES.PROCESANDO && (data.current != null || data.progreso != null)) {
    const rawPct = data.progreso != null ? data.progreso : (data.total ? Math.round((100 * data.current) / data.total) : 0);
    const pct = Math.round(Number(rawPct));
    const current = data.current ?? 0;
    document.getElementById("progressText").textContent =
      data.mensaje || `Procesando actuación ${current} de ${data.total || 0}...`;
    document.getElementById("progressFill").style.width = pct + "%";
    const pctEl = document.getElementById("progressPct");
    if (pctEl) pctEl.textContent = pct + "%";
    const subEl = document.getElementById("progressSubtext");
    if (subEl) subEl.textContent = data.subtext || "";
    const timeHint = document.getElementById("progressTimeHint");
    if (timeHint) {
      timeHint.textContent = data.timeHint || "";
    }
    const bar = document.getElementById("progressBar");
    if (bar) {
      const tieneAvanceParcial = data.progreso != null && data.progreso > 0;
      const indeterminado =
        (current || 0) === 0 && (data.total || 0) > 0 && !tieneAvanceParcial;
      if (indeterminado) {
        bar.classList.add("indeterminate");
      } else {
        bar.classList.remove("indeterminate");
      }
    }
  }
  if (n === STATES.COMPLETADO) {
    if (data.total != null && data.filename) {
      document.getElementById("completedText").textContent =
        `TXT descargado — ${data.total} trámites`;
    } else if (data.pages != null) {
      document.getElementById("completedText").textContent =
        `PDF generado — ${data.pages} páginas`;
    }
  }
  if (n === STATES.ERROR && data.message) {
    document.getElementById("errorText").textContent = data.message;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs?.length) return null;
  return tabs[0];
}

function isSaltaUrl(url) {
  return /plataforma\.justiciasalta\.gov\.ar\/iol-ui\/p\//i.test((url || "").toLowerCase());
}

function isEntreRiosUrl(url) {
  return /mesavirtual\.jusentrerios\.gov\.ar/i.test((url || "").toLowerCase());
}

function isTucumanUrl(url) {
  return /consultaexpedientes\.justucuman\.gov\.ar/i.test((url || "").toLowerCase());
}

function isTucumanHistoriaUrl(url) {
  return /consultaexpedientes\.justucuman\.gov\.ar\/[^/]+\/expediente\/[^/]+\/historia/i.test(
    url || ""
  );
}

function toggleSaltaInstructivo(show, modo = "lista") {
  const box = document.getElementById("saltaInstructivo");
  const defaultSub = document.getElementById("inactivoSubtitle");
  const intro = document.getElementById("saltaGuideIntro");
  const steps = document.getElementById("saltaGuideSteps");
  const note = document.getElementById("saltaGuideNote");
  if (!box) return;
  if (!show) {
    box.style.display = "none";
    if (
      defaultSub &&
      document.getElementById("entreriosInstructivo")?.style.display !== "block" &&
      document.getElementById("tucumanInstructivo")?.style.display !== "block"
    ) {
      defaultSub.style.display = "";
    }
    return;
  }
  toggleEntreRiosInstructivo(false);
  toggleTucumanInstructivo(false);
  box.style.display = "block";
  if (defaultSub) defaultSub.style.display = "none";
  if (modo === "abierto_sin_datos") {
    if (intro) {
      intro.innerHTML =
        "Ya abriste un expediente. Para exportar, mostrá la pestaña <strong>Actuaciones</strong> y recargá la página (F5).";
    }
    if (steps) steps.style.display = "none";
    if (note) note.textContent = "Luego volvé a abrir LegalMev.";
  } else {
    if (intro) {
      intro.innerHTML =
        "En la lista hay muchas causas. LegalMev necesita que abras <strong>un solo expediente</strong>:";
    }
    if (steps) steps.style.display = "";
    if (note) {
      note.textContent =
        "El ícono ↗ está a la derecha del cartel EN TRÁMITE, en cada fila de la lista.";
    }
  }
}

function isEntreRiosExpedienteUrl(url) {
  return /mesavirtual\.jusentrerios\.gov\.ar\/expedientes\/[a-f0-9]{24}/i.test(url || "");
}

function toggleEntreRiosInstructivo(show, modo = "lista") {
  const box = document.getElementById("entreriosInstructivo");
  const defaultSub = document.getElementById("inactivoSubtitle");
  if (!box) return;
  if (!show) {
    box.style.display = "none";
    if (
      defaultSub &&
      document.getElementById("saltaInstructivo")?.style.display !== "block" &&
      document.getElementById("tucumanInstructivo")?.style.display !== "block"
    ) {
      defaultSub.style.display = "";
    }
    return;
  }
  const saltaBox = document.getElementById("saltaInstructivo");
  if (saltaBox) saltaBox.style.display = "none";
  const tucBox = document.getElementById("tucumanInstructivo");
  if (tucBox) tucBox.style.display = "none";
  box.style.display = "block";
  if (defaultSub) defaultSub.style.display = "none";
  const intro = document.getElementById("erGuideIntro");
  const steps = document.getElementById("erGuideSteps");
  const note = document.getElementById("erGuideNote");
  if (modo === "sin_sesion") {
    if (intro) {
      intro.innerHTML =
        "Estás en el expediente, pero LegalMev no pudo leer la <strong>sesión</strong> de Mesa Virtual.";
    }
    if (steps) steps.style.display = "none";
    if (note) {
      note.textContent =
        "Recargá la página (F5) con la extensión activa y volvé a abrir LegalMev. Tiene que haber sesión iniciada.";
    }
  } else if (modo === "lista") {
    if (intro) {
      intro.innerHTML =
        "Estás en el listado. LegalMev necesita la <strong>ficha de un expediente</strong>:";
    }
    if (steps) steps.style.display = "";
    if (note) note.textContent = "URL típica: mesavirtual.jusentrerios.gov.ar/expedientes/{id}";
  } else {
    if (intro) {
      intro.innerHTML =
        "Expediente abierto pero sin movimientos detectados. Recargá (F5) o verificá permisos.";
    }
    if (steps) steps.style.display = "none";
    if (note) note.textContent = "Si el expediente es ajeno a tu usuario, Mesa Virtual puede denegar el acceso.";
  }
}

function toggleTucumanInstructivo(show, modo = "inicio") {
  const box = document.getElementById("tucumanInstructivo");
  const defaultSub = document.getElementById("inactivoSubtitle");
  if (!box) return;
  if (!show) {
    box.style.display = "none";
    if (
      defaultSub &&
      document.getElementById("saltaInstructivo")?.style.display !== "block" &&
      document.getElementById("entreriosInstructivo")?.style.display !== "block"
    ) {
      defaultSub.style.display = "";
    }
    return;
  }
  toggleSaltaInstructivo(false);
  toggleEntreRiosInstructivo(false);
  box.style.display = "block";
  if (defaultSub) defaultSub.style.display = "none";
  const intro = document.getElementById("tucGuideIntro");
  const steps = document.getElementById("tucGuideSteps");
  const note = document.getElementById("tucGuideNote");
  if (modo === "sin_cache") {
    if (intro) {
      intro.innerHTML =
        "Estás en la <strong>Historia</strong>, pero LegalMev no capturó los movimientos. Recargá la página.";
    }
    if (steps) steps.style.display = "none";
    if (note) {
      note.textContent =
        "Con LegalMev activo, dale F5 en la página Historia y volvé a abrir la extensión.";
    }
  } else if (modo === "login") {
    if (intro) {
      intro.innerHTML = "Iniciá sesión en el Portal del SAE y después entrá al expediente.";
    }
    if (steps) steps.style.display = "none";
    if (note) note.textContent = "URL de consulta: consultaexpedientes.justucuman.gov.ar";
  } else {
    if (intro) {
      intro.innerHTML =
        "Elegí el centro judicial y el fuero, abrí el expediente y entrá a <strong>Historia</strong>:";
    }
    if (steps) steps.style.display = "";
    if (note) {
      note.textContent =
        "URL típica: …/civil/expediente/3659%2F95/historia (con los movimientos listados).";
    }
  }
}

function isExpedienteUrl(url) {
  const u = (url || "").toLowerCase();
  if (/mev\.scba\.gov\.ar\/procesales\.asp/i.test(u)) return true;
  if (/scw\.pjn\.gov\.ar.*expediente\.seam/i.test(u)) return true;
  if (/portalpjn\.pjn\.gov\.ar.*expediente/i.test(u)) return true;
  if (/portalpjn\.pjn\.gov\.ar.*seam.*cid=/i.test(u)) return true;
  if (/m[vi]\.mpba\.gov\.ar\/Web\/Proceso\/VerProceso/i.test(u)) return true;
  return false;
}

function isMPBAUrl(url) {
  return /m[vi]\.mpba\.gov\.ar\/Web\/Proceso\/VerProceso/i.test((url || "").toLowerCase());
}

function usesDownloadPicker(url) {
  const u = (url || "").toLowerCase();
  if (/mev\.scba\.gov\.ar\/procesales\.asp/i.test(u)) return true;
  if (/scw\.pjn\.gov\.ar.*expediente\.seam/i.test(u)) return true;
  if (/portalpjn\.pjn\.gov\.ar/i.test(u)) return true;
  if (isMPBAUrl(u)) return true;
  if (isSaltaUrl(u)) return true;
  if (isEntreRiosUrl(u)) return true;
  if (isTucumanUrl(u)) return true;
  return false;
}

/** MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán NUNCA se mezclan: cada portal tiene su content script. */
function getContentScriptForUrl(url) {
  const u = (url || "").toLowerCase();
  if (isTucumanUrl(u)) return "content-tucuman.js";
  if (isEntreRiosUrl(u)) return "content-entrerios.js";
  if (isSaltaUrl(u)) return "content-salta.js";
  if (/scw\.pjn\.gov\.ar.*expediente\.seam/i.test(u) || /portalpjn\.pjn\.gov\.ar/i.test(u)) {
    return "content-pjn.js"; // SCW PJN
  }
  if (isMPBAUrl(u)) {
    return "content-mpba.js"; // Mesa Virtual MPBA
  }
  return "content.js"; // MEV SCBA
}

async function getExpedienteInfoFromContentScript(tabId) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { action: "getExpedienteInfo" });
    return resp?.ok ? resp : null;
  } catch {
    return null;
  }
}

/** Inyecta SOLO el content script correcto según la URL (MEV o PJN, nunca ambos).
 * NO inyecta content-pjn.js: ya se inyecta automáticamente via manifest en expediente.seam.
 * La doble inyección causaba "Identifier 'extraerViaIframePost' has already been declared".
 */
async function ensureContentScript(tabId, url) {
  const script = getContentScriptForUrl(url);
  if (script === "content-entrerios.js") {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["page-hook-entrerios.js"],
        world: "MAIN"
      });
    } catch (_) {}
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "lib/pdf.min.js",
          "exportacion/nombres.js",
          "exportacion/categorias.js",
          "lib/download-ui.js",
          "lib/jspdf.min.js",
          "exportacion/texto-pdf.js",
          "lib/jszip.min.js",
          "exportacion/empaquetar.js",
          "content-entrerios.js",
          "content-entrerios-picker.js",
        ]
      });
    } catch (_) {}
    return true;
  }
  if (script === "content-tucuman.js") {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["page-hook-tucuman.js"],
        world: "MAIN"
      });
    } catch (_) {}
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "lib/pdf.min.js",
          "lib/pdf-lib.min.js",
          "exportacion/nombres.js",
          "exportacion/categorias.js",
          "lib/download-ui.js",
          "lib/jspdf.min.js",
          "exportacion/texto-pdf.js",
          "exportacion/merge-pdfs.js",
          "lib/jszip.min.js",
          "exportacion/empaquetar.js",
          "content-tucuman.js",
          "content-tucuman-picker.js",
        ]
      });
    } catch (_) {}
    return true;
  }
  if (script === "content-pjn.js" || script === "content-mpba.js" || script === "content-salta.js") return true; // Manifest los inyecta
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [script]
    });
    return true;
  } catch {
    return false;
  }
}

async function getExpedienteInfo(tabId, url) {
  const delays = [0, 200, 450]; // Reintentos para dar tiempo al content script tras F5
  for (const d of delays) {
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    let info = await getExpedienteInfoFromContentScript(tabId);
    if (info) return info;
    const ok = await ensureContentScript(tabId, url);
    if (ok && d < delays[delays.length - 1]) continue; // Siguiente iteración reintentará sendMessage
  }
  info = await getExpedienteInfoFromContentScript(tabId);
  if (info && info.count > 0) return info;
  if (info && (isSaltaUrl(url) || isEntreRiosUrl(url) || isTucumanUrl(url))) return info;

  // Fallback MEV: extracción inline
  if (/mev\.scba\.gov\.ar\/procesales\.asp/i.test(url || "")) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => {
        const r = /^https:\/\/mev\.scba\.gov\.ar\/proveido\.asp\?/i;
        const uniq = [];
        const seen = new Set();
        for (const a of document.querySelectorAll("a[href]")) {
          if (!r.test(a.href) || seen.has(a.href)) continue;
          seen.add(a.href);
          uniq.push(a.href);
        }
        const title = (document.title || "").trim();
        const parts = title.split(/[\-\–\—]/).map((p) => p.trim()).filter(Boolean);
        let caratula = "";
        for (const p of [...parts].reverse()) {
          if (p.length > 5 && !/^\d+$/.test(p) && !/^expediente$/i.test(p) && !/^mev$/i.test(p)) {
            caratula = p;
            break;
          }
        }
        if (!caratula) caratula = title;
        return { pageTitle: title, pageUrl: location.href, count: uniq.length, urls: uniq, caratula };
      }
    });
    const fallback = results?.[0]?.result;
    if (fallback && fallback.count > 0) return { ok: true, ...fallback };
  }

  // Fallback PJN: extracción inline cuando el content script no responde
  if (/scw\.pjn\.gov\.ar.*expediente\.seam|portalpjn\.pjn\.gov\.ar/i.test(url || "")) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => {
        const viewerRe = /viewer\.seam/i;
        const urls = [];
        const filas = [];
        for (const a of document.querySelectorAll("a[href]")) {
          const h = (a.getAttribute("href") || "").trim();
          if (viewerRe.test(h)) {
            try {
              const u = new URL(h, location.origin).href;
              if (!urls.includes(u)) urls.push(u);
            } catch (_) {}
          }
        }
        for (const t of document.querySelectorAll("table")) {
          const rows = t.querySelectorAll("tbody tr, tr");
          let conFechas = 0;
          for (const row of rows) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 2) continue;
            const txt = Array.from(cells).map((c) => (c.textContent || "").trim());
            if (txt.some((s) => /^(OFICINA|FECHA|TIPO|DESCRIPCIÓN?)$/i.test(s))) continue;
            const hasFecha = txt.some((s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s));
            if (hasFecha) conFechas++;
          }
          if (conFechas < 1) continue;
          for (const row of rows) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 2) continue;
            const txt = Array.from(cells).map((c) => (c.textContent || "").trim());
            const fecha = txt.find((s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) || txt[1] || "";
            const tipo = txt[2] || "";
            const desc = txt[3] || txt[2] || txt.join(" ") || "";
            if (!fecha && !tipo && !desc) continue;
            if (/^(FECHA|OFICINA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test((tipo || fecha || "").trim())) continue;
            if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test(tipo || fecha)) continue;
            if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test((fecha || tipo || "").trim())) continue;
            if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test(fecha)) continue; // skip header row
            if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test(txt[0] || txt[1])) continue;
            if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test((tipo || txt[0] || "").trim())) continue; // saltar fila encabezado
            if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test((txt[0]||"").trim())) continue;
            const link = row.querySelector("a[href*='viewer.seam']");
            if (link && link.href && !urls.includes(link.href)) urls.push(link.href);
            filas.push({ fecha, tipo, descripcion: desc });
          }
          break;
        }
        let exp = "", cat = "";
        for (const el of document.querySelectorAll("td, span, div, label")) {
          const t = (el.textContent || "").trim();
          if (/^Expediente\s*:/i.test(t)) {
            const n = el.nextElementSibling;
            if (n) exp = (n.textContent || "").trim();
            else exp = t.replace(/^Expediente\s*:?\s*/i, "").trim();
          }
          if (/^Car[áa]tula\s*:/i.test(t)) {
            const n = el.nextElementSibling;
            if (n) cat = (n.textContent || "").trim();
            else cat = t.replace(/^Car[áa]tula\s*:?\s*/i, "").trim();
          }
        }
        const count = Math.max(urls.length, filas.length);
        const actuacionesDesdeTabla = filas.map((f, i) => ({
          numero: i + 1,
          fecha: f.fecha,
          tipo: f.tipo,
          contenido: f.descripcion,
          url: location.href
        }));
        return {
          pageTitle: document.title || "",
          pageUrl: location.href,
          count,
          urls,
          actuacionesDesdeTabla,
          caratula: cat,
          nroExpediente: exp,
          juzgado: ""
        };
      }
    });
    const fallback = results?.[0]?.result;
    if (fallback && fallback.count > 0) return { ok: true, ...fallback };
  }
  return info;
}

function isConnectionError(err) {
  const m = err?.message || String(err);
  return (
    m.includes("Receiving end does not exist") ||
    m.includes("Could not establish connection") ||
    m.includes("Extension context invalidated") ||
    m.includes("message port closed") ||
    m.includes("message channel closed") ||
    m.includes("asynchronous response by returning true")
  );
}

/** Reemplaza mensajes técnicos de Chrome por texto útil en español. */
function userFacingExtensionError(err) {
  if (typeof LegalMevHumanizeError === "function") {
    return LegalMevHumanizeError(err);
  }
  const m = typeof err === "string" ? err : err?.message || String(err || "");
  if (!m) return "Ocurrió un error inesperado.";
  if (isConnectionError({ message: m })) {
    return "No pudimos enlazar con la página del expediente. Recargá la pestaña con F5, esperá a que cargue por completo y volvé a exportar. Si sigue igual, desactivá y volvé a activar LegalMev en chrome://extensions.";
  }
  return m;
}

async function collectActuacionesWithProgress(tabId, url, onProgress, expedienteInfoFromFallback) {
  const unlisten = (handler) => {
    chrome.runtime.onMessage.removeListener(handler);
  };
  const handler = (msg) => {
    if (msg.type === "exportProgress") onProgress(msg);
    if (msg.action === "progressMPBA") {
      onProgress({
        progreso: msg.progreso,
        mensaje: msg.mensaje,
        current: msg.progreso != null ? Math.round((msg.progreso / 100) * (expedienteInfo?.count || 100)) : msg.current,
        total: expedienteInfo?.count || 100,
        subtext: msg.mensaje
      });
    }
  };
  chrome.runtime.onMessage.addListener(handler);

  const delays = [400, 700, 1200];
  let lastErr = null;

  for (let i = 0; i < delays.length; i++) {
    try {
      await ensureContentScript(tabId, url);
      await new Promise((r) => setTimeout(r, delays[i]));
      const opts = getExportOptions();
      const resp = await chrome.tabs.sendMessage(tabId, { action: "collectActuaciones", ultimosN: opts.ultimosN });
      return resp;
    } catch (e) {
      lastErr = e;
      if (!isConnectionError(e)) break;
      if (i === delays.length - 1) break;
    }
  }

  unlisten(handler);
  if (expedienteInfoFromFallback?.actuacionesDesdeTabla?.length > 0 && /scw\.pjn\.gov\.ar|portalpjn\.pjn\.gov\.ar/i.test(url || "")) {
    let actuaciones = expedienteInfoFromFallback.actuacionesDesdeTabla;
    const opts = getExportOptions();
    if (opts.ultimosN && opts.ultimosN > 0 && opts.ultimosN < actuaciones.length) {
      const fechaMs = (fecha) => {
        const m = String(fecha || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() : 0;
      };
      actuaciones = actuaciones
        .map((a, i) => ({ ...a, __order: i }))
        .sort((a, b) => (fechaMs(b.fecha) - fechaMs(a.fecha)) || a.__order - b.__order)
        .slice(0, opts.ultimosN)
        .map(({ __order, ...a }) => a);
    }
    onProgress({ current: actuaciones.length, total: actuaciones.length });
    return {
      ok: true,
      actuaciones,
      anexos: [],
      pageTitle: expedienteInfoFromFallback.pageTitle,
      pageUrl: expedienteInfoFromFallback.pageUrl,
      count: actuaciones.length,
      caratula: expedienteInfoFromFallback.caratula,
      nroExpediente: expedienteInfoFromFallback.nroExpediente,
      juzgado: expedienteInfoFromFallback.juzgado
    };
  }
  if (lastErr && isConnectionError(lastErr)) {
    throw new Error(userFacingExtensionError(lastErr));
  }
  throw lastErr;
}

async function exportMPBAWithProgress(tabId, onProgress) {
  const unlisten = (handler) => chrome.runtime.onMessage.removeListener(handler);
  const handler = (msg) => {
    if (msg.action === "progressMPBA") {
      onProgress({
        progreso: msg.progreso ?? 0,
        mensaje: msg.mensaje || "",
        subtext: msg.mensaje
      });
    }
  };
  chrome.runtime.onMessage.addListener(handler);
  try {
    const opts = getExportOptions();
    const resp = await chrome.tabs.sendMessage(tabId, { action: "exportMPBA", ultimosN: opts.ultimosN });
    return resp;
  } finally {
    unlisten(handler);
  }
}

function setupConnectButton() {
  const btn = document.getElementById("connectBtn");
  if (btn) {
    // Siempre abrir legalmev.com.ar para iniciar sesión (coherente con el texto del botón)
    const loginUrl = 'https://www.legalmev.com.ar/extension-connect';
    btn.onclick = () => chrome.tabs.create({ url: loginUrl });
  }
}

/** Carga y configura la opción "cerrar pestaña al conectar". */
function setupSettingsBlock() {
  const checkboxes = [document.getElementById("closeTabAfterConnect"), document.getElementById("closeTabAfterConnect2")];

  const updateCheckboxes = (checked) => {
    checkboxes.forEach((cb) => { if (cb) cb.checked = checked; });
  };

  chrome.storage.local.get(["closeTabAfterConnect"], (r) => {
    const checked = r.closeTabAfterConnect === true;
    updateCheckboxes(checked);
  });

  const saveAndSync = (checked) => {
    chrome.storage.local.set({ closeTabAfterConnect: checked });
    updateCheckboxes(checked);
  };

  checkboxes.forEach((cb) => {
    if (!cb) return;
    cb.onchange = () => saveAndSync(cb.checked);
  });
}

/** Muestra u oculta el bloque de opciones según el estado (1 o 2 = visible). */
function toggleSettingsBlock(visible) {
  ["settingsBlock", "settingsBlock2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? "block" : "none";
  });
}

/** Actualiza el saludo en INACTIVO y DETECTADO. Nombre = "¡Hola, X!". Sin nombre = "Cuenta conectada" (el usuario sabe que está logueado). */
function updateGreeting(nombre) {
  const texto = nombre ? `¡Hola, ${nombre}!` : "Cuenta conectada";
  const g1 = document.getElementById("greetingInactivo");
  const g2 = document.getElementById("greetingDetectado");
  if (g1) g1.textContent = texto;
  if (g2) g2.textContent = texto;
}

function escapeHtmlPopup(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function portalLabelGestor(p) {
  const u = String(p || "").toUpperCase();
  if (u === "ENTRERIOS" || u === "ENTRE RIOS") return "Entre Ríos";
  if (u === "MPBA") return "MPBA";
  if (u === "SALTA") return "Salta";
  if (u === "TUCUMAN" || u === "TUCUMÁN") return "Tucumán";
  if (u === "PJN") return "PJN";
  if (u === "MEV") return "MEV";
  return u || "Otros";
}

async function loadGestorList() {
  const listEl = document.getElementById("gestorList");
  const sumEl = document.getElementById("gestorSummary");
  if (!listEl || !sumEl) return;
  sumEl.textContent = "Cargando causas…";
  const resp = await new Promise((r) => {
    chrome.runtime.sendMessage({ type: "MONITOR_LIST" }, (res) => r(res || {}));
  });
  if (!resp.ok) {
    sumEl.textContent = resp.error || "No se pudo cargar el seguimiento";
    listEl.innerHTML = "";
    return;
  }
  const cases = resp.cases || [];
  const order = ["MEV", "PJN", "MPBA", "SALTA", "ENTRERIOS", "TUCUMAN"];
  const groups = {};
  for (const c of cases) {
    const p = String(c.portal || "OTRO").toUpperCase().replace(/\s+/g, "");
    const key = p === "ENTRERIOS" || p === "ENTRERÍOS" ? "ENTRERIOS" : p === "TUCUMÁN" ? "TUCUMAN" : p;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  sumEl.innerHTML = `<strong>${cases.length}</strong> causa(s) seguidas · <strong>${
    resp.noveltyCaseCount || 0
  }</strong> con novedades`;

  if (!cases.length) {
    listEl.innerHTML = `<div class="gestor-empty">Todavía no seguís ninguna causa.<br/>Abrí un expediente en MEV, PJN, MPBA, Salta, Entre Ríos o Tucumán y tocá <strong>Seguir causa</strong>.</div>`;
    return;
  }

  const portals = [
    ...order.filter((p) => groups[p]?.length),
    ...Object.keys(groups).filter((p) => !order.includes(p)),
  ];
  listEl.innerHTML = portals
    .map((p) => {
      const rows = groups[p]
        .map((c) => {
          const badge = c.status === "paused"
            ? '<span class="badge-paused">PAUSADO</span>'
            : c.hasNovelty
              ? '<span class="badge-nov">NOVEDAD</span>'
              : '<span class="badge-ok">AL DÍA</span>';
          const pauseAction = c.status === "paused"
            ? `<button type="button" data-act="resume">Reanudar avisos</button>`
            : `<button type="button" data-act="pause">Pausar avisos</button>`;
          return `<div class="causa-row" data-id="${escapeHtmlPopup(c.id || "")}" data-url="${escapeHtmlPopup(c.url || "")}">
            <div class="cr-top">
              <span class="cr-nro">${escapeHtmlPopup(c.nroExpediente || c.portal)}</span>
              <div class="cr-right">
                ${badge}
                <button type="button" class="causa-menu-btn" data-act="menu" title="Más opciones" aria-label="Más opciones" aria-haspopup="true">⋮</button>
              </div>
            </div>
            <div class="cr-car">${escapeHtmlPopup(c.caratula || "Sin carátula")}</div>
            <div class="causa-menu" role="menu">
              <button type="button" data-act="open">Abrir en el portal</button>
              <button type="button" data-act="scan">Escanear ahora</button>
              ${pauseAction}
              <button type="button" class="danger" data-act="remove">Eliminar</button>
            </div>
          </div>`;
        })
        .join("");
      return `<div class="portal-group"><h2>${escapeHtmlPopup(portalLabelGestor(p))} (${
        groups[p].length
      })</h2>${rows}</div>`;
    })
    .join("");

  const closeAllMenus = () => {
    listEl.querySelectorAll(".causa-row.menu-open").forEach((el) => el.classList.remove("menu-open"));
  };

  listEl.querySelectorAll(".causa-row").forEach((row) => {
    const id = row.getAttribute("data-id");
    const url = row.getAttribute("data-url");

    row.addEventListener("click", (e) => {
      if (e.target.closest(".causa-menu-btn") || e.target.closest(".causa-menu")) return;
      closeAllMenus();
      if (url) chrome.tabs.create({ url, active: true });
    });

    row.querySelector('[data-act="menu"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = row.classList.contains("menu-open");
      closeAllMenus();
      if (!wasOpen) row.classList.add("menu-open");
    });

    row.querySelectorAll(".causa-menu [data-act]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");
        closeAllMenus();
        if (act === "open") {
          if (url) chrome.tabs.create({ url, active: true });
          return;
        }
        if (act === "scan") {
          btn.disabled = true;
          await new Promise((r) => {
            chrome.runtime.sendMessage({ type: "MONITOR_SCAN_NOW", id }, () => r());
          });
          await loadGestorList();
          return;
        }
        if (act === "pause") {
          await new Promise((r) => {
            chrome.runtime.sendMessage({ type: "MONITOR_PAUSE", id }, () => r());
          });
          await loadGestorList();
          return;
        }
        if (act === "resume") {
          await new Promise((r) => {
            chrome.runtime.sendMessage({ type: "MONITOR_RESUME", id }, () => r());
          });
          await loadGestorList();
          return;
        }
        if (act === "remove") {
          if (!confirm("¿Dejar de seguir esta causa? Se borran también sus alertas.")) return;
          await new Promise((r) => {
            chrome.runtime.sendMessage({ type: "MONITOR_REMOVE", id }, () => r());
          });
          await loadGestorList();
        }
      });
    });
  });

  if (!listEl._gestorMenuOutside) {
    listEl._gestorMenuOutside = true;
    document.addEventListener("click", (e) => {
      if (!e.target.closest?.(".causa-row")) closeAllMenus();
    });
  }
}

function showTabBanner(info) {
  const ban = document.getElementById("tabBanner");
  if (!ban) return;
  if (!info || (!(info.count > 0) && !info.nroExpediente && !info.expId)) {
    ban.classList.remove("show");
    return;
  }
  expedienteInfo = info;
  const title = document.getElementById("tabBannerTitle");
  const meta = document.getElementById("tabBannerMeta");
  if (title) title.textContent = info.nroExpediente || info.pageTitle || "Expediente en esta pestaña";
  if (meta) {
    meta.textContent = [
      info.count != null ? `${info.count} actuaciones` : null,
      (info.caratula || "").slice(0, 90) || null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  ban.classList.add("show");
}

async function detectTabForGestor() {
  document.getElementById("tabBanner")?.classList.remove("show");
  toggleSaltaInstructivo(false);
  toggleEntreRiosInstructivo(false);
  toggleTucumanInstructivo(false);
  if (!currentTab?.url) return;

  try {
    if (isSaltaUrl(currentTab.url)) {
      await ensureContentScript(currentTab.id, currentTab.url);
      expedienteInfo = await getExpedienteInfo(currentTab.id, currentTab.url);
      if (expedienteInfo && expedienteInfo.count > 0) {
        showTabBanner({ ...expedienteInfo, portal: "salta" });
        return;
      }
      const modo =
        expedienteInfo?.saltaEstado === "abierto_sin_datos" ? "abierto_sin_datos" : "lista";
      toggleSaltaInstructivo(true, modo);
      return;
    }
    if (isEntreRiosUrl(currentTab.url)) {
      const enFicha = isEntreRiosExpedienteUrl(currentTab.url);
      await ensureContentScript(currentTab.id, currentTab.url);
      expedienteInfo = await getExpedienteInfo(currentTab.id, currentTab.url);
      if (expedienteInfo && expedienteInfo.count > 0) {
        showTabBanner({ ...expedienteInfo, portal: "entrerios" });
        return;
      }
      const er = expedienteInfo?.erEstado;
      let modo = "lista";
      if (er === "sin_sesion") modo = "sin_sesion";
      else if (er === "abierto_sin_datos" || er === "error") modo = "abierto_sin_datos";
      else if (enFicha) modo = "sin_sesion";
      toggleEntreRiosInstructivo(true, modo);
      return;
    }
    if (isTucumanUrl(currentTab.url)) {
      await ensureContentScript(currentTab.id, currentTab.url);
      expedienteInfo = await getExpedienteInfo(currentTab.id, currentTab.url);
      if (expedienteInfo && expedienteInfo.count > 0 && expedienteInfo.tucumanEstado === "listo") {
        showTabBanner({ ...expedienteInfo, portal: "tucuman" });
        return;
      }
      if (expedienteInfo && expedienteInfo.count > 0 && isTucumanHistoriaUrl(currentTab.url)) {
        showTabBanner({ ...expedienteInfo, portal: "tucuman" });
        return;
      }
      const tu = expedienteInfo?.tucumanEstado;
      let modo = "inicio";
      if (tu === "login") modo = "login";
      else if (tu === "sin_cache" || (isTucumanHistoriaUrl(currentTab.url) && !(expedienteInfo?.count > 0))) {
        modo = "sin_cache";
      } else if (tu === "abierto_sin_datos") modo = "sin_cache";
      toggleTucumanInstructivo(true, modo);
      return;
    }
    if (!isExpedienteUrl(currentTab.url) && !isMPBAUrl(currentTab.url)) return;
    await ensureContentScript(currentTab.id, currentTab.url);
    expedienteInfo = await getExpedienteInfo(currentTab.id, currentTab.url);
    if (expedienteInfo && (expedienteInfo.count > 0 || expedienteInfo.nroExpediente)) {
      showTabBanner(expedienteInfo);
    }
  } catch (_) {}
}

async function showGestorHome() {
  setState(STATES.INACTIVO);
  await loadGestorList();
  await detectTabForGestor();
}

async function followCurrentTabCase() {
  if (!currentTab?.id) {
    alert("No hay pestaña activa.");
    return;
  }
  const info = expedienteInfo || {};
  const portal = isMPBAUrl(currentTab.url)
    ? "MPBA"
    : isSaltaUrl(currentTab.url)
      ? "SALTA"
      : isEntreRiosUrl(currentTab.url)
        ? "ENTRERIOS"
        : isTucumanUrl(currentTab.url)
          ? "TUCUMAN"
          : /pjn\.gov\.ar/i.test(currentTab.url)
            ? "PJN"
            : "MEV";

  // En MEV pedimos metadatos al content (evita guardar "Mesa de Entradas Virtual")
  let meta = {
    nroExpediente: info.nroExpediente || "",
    caratula: info.caratula || "",
    juzgado: info.juzgado || "",
  };
  if (portal === "MEV") {
    try {
      const metaResp = await chrome.tabs.sendMessage(currentTab.id, { type: "MONITOR_CASE_META" });
      if (metaResp?.ok && metaResp.meta) {
        meta = {
          nroExpediente: metaResp.meta.nroExpediente || meta.nroExpediente,
          caratula: metaResp.meta.caratula || meta.caratula,
          juzgado: metaResp.meta.juzgado || meta.juzgado,
        };
      }
    } catch (_) {}
  }
  if (/mesa\s+de\s+entradas|^mev$/i.test(meta.caratula || "")) meta.caratula = "";
  if (/mesa\s+de\s+entradas|^mev$/i.test(meta.nroExpediente || "")) meta.nroExpediente = "";

  const resp = await new Promise((r) => {
    chrome.runtime.sendMessage(
      {
        type: "MONITOR_ACTIVATE",
        payload: {
          portal,
          nroExpediente: meta.nroExpediente || "",
          caratula: meta.caratula || "",
          juzgado: meta.juzgado || "",
          url: currentTab.url,
          portalRefs: { expId: info.expId || "" },
          tabId: currentTab.id,
        },
      },
      (res) => r(res || {})
    );
  });
  if (resp.ok) {
    const label = resp.case?.nroExpediente || meta.nroExpediente || "causa";
    alert(
      resp.case?.baselineReady
        ? `Causa guardada: ${label}.`
        : `Causa guardada: ${label}.`
    );
    await loadGestorList();
  } else {
    alert(resp.error || "No se pudo seguir la causa");
  }
}

async function init() {
  await updateApiBase();
  const SM = window.LegalMevSessionManager;
  if (SM) {
    SM.initSessionManager({
      apiBaseUrl: API_BASE,
      getAuthToken: getStoredToken
    });
  }

  const session = SM
    ? await SM.getFreshSession()
    : await (async () => {
        authToken = await getStoredToken();
        if (!authToken) return { authenticated: false };
        try {
          const r = await fetch(`${API_BASE}/api/extension/me`, { headers: await authHeaders() });
          if (r.status === 401) return { authenticated: false };
          const data = await r.json();
          return {
            authenticated: !!data?.ok,
            userId: data?.user?.id ?? '',
            email: data?.user?.email ?? '',
            plan: data?.user?.plan ?? 'free',
            remainingQueries: null
          };
        } catch {
          return { authenticated: false };
        }
      })();

  authToken = await getStoredToken();
  if (!session.authenticated || !authToken) {
    showState(STATES.NO_AUTH);
    setupConnectButton();
    return;
  }

  setupSettingsBlock();

  try {
    const nombre = session.email?.split('@')[0] || null;
    const { userNombre } = await chrome.storage.local.get('userNombre');
    if (userNombre && typeof userNombre === 'string' && userNombre.trim()) {
      updateGreeting(userNombre.trim());
    } else if (nombre) {
      updateGreeting(nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase());
    } else {
      updateGreeting(null);
    }
  } catch {
    updateGreeting(null);
  }
  currentTab = await getActiveTab();

  const job = await new Promise((r) => {
    chrome.runtime.sendMessage({ action: "getJobState" }, (res) => r(res || null));
  });
  if (job) {
    if (job.status === "running" || job.status === "uploading") {
      setState(STATES.PROCESANDO, {
        current: job.current,
        total: job.total,
        progreso: job.progress,
        mensaje: job.mensaje || `Procesando ${job.current || 0} de ${job.total || 0}...`,
        subtext: job.subtext,
        timeHint: timeHintFromJob(job)
      });
      return;
    }
    if (job.status === "completed" && job.result) {
      if (job.result.filename) {
        setState(STATES.COMPLETADO, { total: job.result.total, filename: job.result.filename });
      } else {
        setState(STATES.COMPLETADO, { pages: job.result.pages });
      }
      chrome.storage.local.remove("legalmev_export_job");
      return;
    }
    if (job.status === "failed" || job.status === "interrupted") {
      setState(STATES.ERROR, {
        message: userFacingExtensionError(
          job.error ||
            (job.status === "interrupted" ? "Procesamiento interrumpido (cerraste la pestaña o navegaste)." : "Ocurrió un error.")
        )
      });
      chrome.storage.local.remove("legalmev_export_job");
      return;
    }
    if (job.status === "cancelled") {
      chrome.storage.local.remove("legalmev_export_job");
    }
  }

  try {
    const r = await fetch(`${API_BASE}/api/health`);
    const txt = r.ok ? "Servidor conectado" : `Servidor: error ${r.status}`;
    const el = document.getElementById("serverStatus");
    if (el) el.textContent = txt;
    const el2 = document.getElementById("serverStatus2");
    if (el2) el2.textContent = txt;
  } catch (e) {
    const txt = "No se pudo conectar con LegalMev. Verificá tu conexión e iniciá sesión nuevamente.";
    const el = document.getElementById("serverStatus");
    if (el) { el.textContent = txt; el.style.color = "#dc2626"; }
    const el2 = document.getElementById("serverStatus2");
    if (el2) { el2.textContent = txt; el2.style.color = "#dc2626"; }
  }

  if (!currentTab) {
    toggleSaltaInstructivo(false);
    toggleEntreRiosInstructivo(false);
    toggleTucumanInstructivo(false);
    await showGestorHome();
    return;
  }

  await showGestorHome();
}

async function exportar() {
  if (!currentTab || !expedienteInfo) return;

  const SM = window.LegalMevSessionManager;
  if (SM) {
    const session = await SM.getFreshSession(true);
    if (!session.authenticated) {
      await clearAuthAndShowConnect();
      setupConnectButton();
      return;
    }
  }

  // Todos los portales: modal de selección + PDF local en la página
  if (usesDownloadPicker(currentTab.url)) {
    try {
      const resp = await chrome.tabs.sendMessage(currentTab.id, {
        type: "START_DOWNLOAD_PICKER",
      });
      if (resp && resp.ok === false) {
        setState(STATES.ERROR, {
          message: resp.error || "No se pudo abrir el selector en la página",
        });
        return;
      }
      window.close();
    } catch (e) {
      setState(STATES.ERROR, {
        message:
          "Recargá la página del expediente (F5) y probá de nuevo. Si seguís en Tucumán, Entre Ríos o Salta, asegurate de tener LegalMev 1.7.8+.",
      });
    }
    return;
  }

  const portal = isMPBAUrl(currentTab.url)
    ? "mpba"
    : isSaltaUrl(currentTab.url)
      ? "salta"
      : isEntreRiosUrl(currentTab.url)
        ? "entrerios"
        : isTucumanUrl(currentTab.url)
          ? "tucuman"
          : /pjn\.gov\.ar/i.test(currentTab.url)
            ? "pjn"
            : "mev";
  const totalExpediente = expedienteInfo.count || 0;
  const opts = getExportOptions();
  const effectiveCount = opts.ultimosN && opts.ultimosN > 0 ? Math.min(opts.ultimosN, totalExpediente) : totalExpediente;
  const estimatedSec =
    portal === "mpba"
      ? Math.max(180, effectiveCount * 30)
      : portal === "pjn"
        ? Math.max(120, Math.ceil(effectiveCount * 6))
        : portal === "salta" || portal === "entrerios" || portal === "tucuman"
          ? Math.max(90, Math.ceil(effectiveCount * 4))
          : Math.max(20, Math.ceil(effectiveCount * 1.5));

  const timeHintProcesando =
    portal === "mpba"
      ? `Modo seguro: ${formatTimeEstimate(estimatedSec)} estimados`
      : portal === "pjn"
        ? `Tiempo orientativo: ${formatTimeEstimate(estimatedSec)} (depende de PDFs y del PJN)`
        : portal === "salta"
          ? `Tiempo orientativo: ${formatTimeEstimate(estimatedSec)} (PDFs del portal de Salta)`
          : portal === "entrerios"
            ? `Tiempo orientativo: ${formatTimeEstimate(estimatedSec)} (Mesa Virtual Entre Ríos)`
            : portal === "tucuman"
              ? `Tiempo orientativo: ${formatTimeEstimate(estimatedSec)} (movimientos SAE Tucumán)`
              : `Tiempo orientativo: ${formatTimeEstimate(estimatedSec)} (según respuesta del MEV)`;

  setState(STATES.PROCESANDO, {
    current: 0,
    total: effectiveCount,
    progreso: 0,
    mensaje: portal === "mpba" ? "Iniciando exportación..." : "Iniciando...",
    subtext: portal === "mpba"
      ? `Exportando ${effectiveCount} trámites con OCR — puede tardar 10-15 min. Podés cerrar esta ventana.`
      : "",
    timeHint: timeHintProcesando
  });

  chrome.runtime.sendMessage(
    {
      action: "startExport",
      payload: {
        tabId: currentTab.id,
        url: currentTab.url,
        portal,
        count: effectiveCount,
        ultimosN: opts.ultimosN,
        expedienteInfo
      }
    },
    (res) => {
      const lastErr = chrome.runtime.lastError?.message;
      if (lastErr) {
        setState(STATES.ERROR, { message: userFacingExtensionError(lastErr) });
        return;
      }
      if (res && !res.ok && res.error) {
        setState(STATES.ERROR, { message: userFacingExtensionError(res.error) });
      }
    }
  );
}

function cancelar() {
  chrome.runtime.sendMessage({ action: "cancelJob" }, () => {});
  expedienteInfo = null;
  setTimeout(() => init(), 150);
}

document.querySelectorAll('input[name="exportScope"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const ultimosInput = document.getElementById("ultimosN");
    if (ultimosInput) ultimosInput.disabled = document.querySelector('input[name="exportScope"]:checked')?.value !== "last";
  });
});
document.getElementById("ultimosN")?.addEventListener("focus", () => {
  document.querySelector('input[name="exportScope"][value="last"]')?.click();
});

function getExportOptions() {
  const scope = document.querySelector('input[name="exportScope"]:checked')?.value;
  const ultimosInput = document.getElementById("ultimosN");
  const n = scope === "last" && ultimosInput ? parseInt(ultimosInput.value, 10) : null;
  const max = expedienteInfo?.count || 999;
  return { ultimosN: n && n > 0 && n <= max ? n : null };
}

document.getElementById("exportBtn")?.addEventListener("click", exportar);
document.getElementById("cancelBtn")?.addEventListener("click", cancelar);
document.getElementById("openMonitorBtn")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_MONITOR_PANEL" });
});
document.getElementById("gestorOpenFull")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_MONITOR_PANEL" });
});
document.getElementById("gestorRefresh")?.addEventListener("click", () => loadGestorList());
document.getElementById("gestorScanAll")?.addEventListener("click", async () => {
  const btn = document.getElementById("gestorScanAll");
  if (btn) btn.disabled = true;
  await new Promise((r) => {
    chrome.runtime.sendMessage({ type: "MONITOR_SCAN_ALL" }, () => r());
  });
  if (btn) btn.disabled = false;
  await loadGestorList();
});
document.getElementById("tabExportBtn")?.addEventListener("click", () => {
  if (!expedienteInfo) {
    init();
    return;
  }
  exportar();
});
document.getElementById("tabFollowBtn")?.addEventListener("click", () => followCurrentTabCase());
document.getElementById("backToGestor")?.addEventListener("click", () => showGestorHome());
document.getElementById("followFromExport")?.addEventListener("click", () => followCurrentTabCase());
document.getElementById("downloadOtherBtn")?.addEventListener("click", () => {
  expedienteInfo = null;
  init();
});
document.getElementById("retryBtn")?.addEventListener("click", () => init());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.authToken) {
    authToken = changes.authToken.newValue || null;
    if (authToken) init();
  }
  if (area === "local" && changes.legalmev_export_job) {
    const job = changes.legalmev_export_job.newValue;
    if (!job) return;
    if (job.status === "running" || job.status === "uploading") {
      setState(STATES.PROCESANDO, {
        current: job.current,
        total: job.total,
        progreso: job.progress,
        mensaje: job.mensaje || `Procesando ${job.current || 0} de ${job.total || 0}...`,
        subtext: job.subtext,
        timeHint: timeHintFromJob(job)
      });
    } else if (job.status === "completed" && job.result) {
      if (job.result.filename) {
        setState(STATES.COMPLETADO, { total: job.result.total, filename: job.result.filename });
      } else {
        setState(STATES.COMPLETADO, { pages: job.result.pages });
      }
      chrome.storage.local.remove("legalmev_export_job");
    } else if (job.status === "failed" || job.status === "interrupted") {
      setState(STATES.ERROR, {
        message: userFacingExtensionError(
          job.error || (job.status === "interrupted" ? "Procesamiento interrumpido." : "Ocurrió un error.")
        )
      });
      chrome.storage.local.remove("legalmev_export_job");
    } else if (job.status === "cancelled") {
      chrome.storage.local.remove("legalmev_export_job");
      init();
    }
  }
});

init();
