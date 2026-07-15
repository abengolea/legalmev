(function () {
  'use strict';

  const wizard = document.getElementById('wizard');
  const TOTAL  = 5;

  const state = {
    step:        0,
    mevCreds:    null,  // { username, password, departamento? } | null si se omitió
    pjnCreds:    null,  // { cuit, password } | null si se omitió
    vaultExists: false, // true si la bóveda ya fue configurada antes
  };

  // ─── Helpers ────────────────────────────────────────────────────────────

  function dots() {
    return '<div class="steps">' +
      Array.from({ length: TOTAL }, (_, i) => {
        const cls = i < state.step ? 'done' : i === state.step ? 'active' : '';
        return `<div class="step-dot ${cls}"></div>`;
      }).join('') +
    '</div>';
  }

  function logoHtml() {
    return `<div class="logo">
      <div class="logo-mark">LM</div>
      <div class="logo-text">
        <h1>LegalMev</h1>
        <p>Exportación y monitoreo de expedientes</p>
      </div>
    </div>`;
  }

  function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || '';
  }

  function clearPasswords() {
    if (state.mevCreds) state.mevCreds.password = '';
    if (state.pjnCreds) state.pjnCreds.password = '';
  }

  function goTo(step) {
    state.step = step;
    render();
  }

  /**
   * Transición hacia el paso PIN. Chequea el estado de la bóveda:
   *  - Ya desbloqueada → guarda credenciales y salta al paso final
   *  - Existe pero bloqueada → muestra "Desbloquear"
   *  - No existe → muestra "Crear"
   */
  async function goToPin() {
    const vaultSetup   = await LegalMevVault.isSetup();
    const vaultUnlocked = vaultSetup && (await LegalMevVault.isUnlocked());

    if (vaultUnlocked) {
      // La bóveda ya está abierta en esta sesión: guardar directo y terminar
      try {
        if (state.mevCreds) await LegalMevVault.saveCredentials('mev', state.mevCreds);
        if (state.pjnCreds) await LegalMevVault.saveCredentials('pjn', state.pjnCreds);
      } catch (_) {}
      await chrome.storage.local.set({ legalmev_onboarding_done: true });
      clearPasswords();
      goTo(4);
      return;
    }

    state.vaultExists = vaultSetup;
    goTo(3);
  }

  // ─── Step templates ─────────────────────────────────────────────────────

  function stepWelcome() {
    return `
      ${dots()}
      ${logoHtml()}
      <h2>Bienvenido</h2>
      <p class="subtitle">Configuremos tu extensión en menos de 2 minutos.</p>
      <ul class="features">
        <li>
          <div class="feat-icon">🔐</div>
          <div><strong>Bóveda cifrada</strong>Tus credenciales se guardan localmente con cifrado AES-256. Nunca salen de tu PC.</div>
        </li>
        <li>
          <div class="feat-icon">⚡</div>
          <div><strong>Sesión automática</strong>Iniciá sesión en MEV y PJN con un click desde el panel de la extensión.</div>
        </li>
        <li>
          <div class="feat-icon">📦</div>
          <div><strong>Descarga ZIP</strong>Exportá expedientes completos con actuaciones y adjuntos en un solo archivo.</div>
        </li>
      </ul>
      <div class="actions">
        <button class="btn btn-primary" id="btnWelcomeNext">Comenzar configuración</button>
      </div>`;
  }

  function stepMev() {
    const saved = state.mevCreds || {};
    return `
      ${dots()}
      <h2>Acceso a MEV</h2>
      <p class="subtitle">Credenciales para Mesa de Entradas Virtual (SCBA). Solo se guardan en tu PC, cifradas.</p>
      <div class="field">
        <label for="mevUser">Usuario MEV</label>
        <input type="text" id="mevUser" value="${esc(saved.username || '')}" placeholder="tu.usuario" autocomplete="off" />
      </div>
      <div class="field">
        <label for="mevPass">Contraseña</label>
        <input type="password" id="mevPass" placeholder="••••••••" autocomplete="new-password" />
      </div>
      <div class="field">
        <label for="mevDept">Departamento judicial <span class="badge-opt">opcional</span></label>
        <input type="text" id="mevDept" value="${esc(saved.departamento || '')}" placeholder="Ej: San Nicolás" autocomplete="off" />
        <p class="field-note">Completá este campo si MEV te pide elegir departamento al ingresar.</p>
      </div>
      <p class="error-msg" id="mevError"></p>
      <div class="actions">
        <button class="btn btn-primary" id="btnMevNext">Guardar y continuar</button>
        <button class="btn btn-ghost"   id="btnMevSkip">Omitir por ahora</button>
      </div>`;
  }

  function stepPjn() {
    const saved = state.pjnCreds || {};
    return `
      ${dots()}
      <h2>Acceso a PJN</h2>
      <p class="subtitle">Credenciales para el Portal Judicial de la Nación (SCW). Solo se guardan en tu PC, cifradas.</p>
      <div class="field">
        <label for="pjnCuit">CUIT</label>
        <input type="text" id="pjnCuit" value="${esc(saved.cuit || '')}" placeholder="20-12345678-9" autocomplete="off" />
      </div>
      <div class="field">
        <label for="pjnPass">Contraseña</label>
        <input type="password" id="pjnPass" placeholder="••••••••" autocomplete="new-password" />
      </div>
      <p class="error-msg" id="pjnError"></p>
      <div class="actions">
        <button class="btn btn-primary" id="btnPjnNext">Guardar y continuar</button>
        <button class="btn btn-ghost"   id="btnPjnSkip">Omitir por ahora</button>
      </div>`;
  }

  function stepPin() {
    if (state.vaultExists) {
      // Bóveda ya existe: pedir PIN para desbloquear
      return `
        ${dots()}
        <h2>Desbloquear bóveda</h2>
        <p class="subtitle">Ya tenés una bóveda configurada. Ingresá tu PIN para guardar las credenciales y continuar.</p>
        <div class="field">
          <label for="pinA">Tu PIN</label>
          <input type="password" id="pinA" placeholder="••••••" autocomplete="current-password" />
        </div>
        <p class="error-msg" id="pinError"></p>
        <div class="actions">
          <button class="btn btn-primary" id="btnPinFinish">Desbloquear</button>
        </div>`;
    }

    // Bóveda nueva: crear PIN
    return `
      ${dots()}
      <h2>Crear PIN de acceso</h2>
      <p class="subtitle">El PIN cifra tus credenciales localmente. <strong>No hay recuperación</strong> — guardalo en un lugar seguro.</p>
      <div class="field">
        <label for="pinA">Nuevo PIN</label>
        <input type="password" id="pinA" placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
      </div>
      <div class="field">
        <label for="pinB">Confirmar PIN</label>
        <input type="password" id="pinB" placeholder="Repetí el PIN" autocomplete="new-password" />
      </div>
      <p class="error-msg" id="pinError"></p>
      <div class="actions">
        <button class="btn btn-primary" id="btnPinFinish">Crear bóveda</button>
      </div>`;
  }

  function stepDone() {
    return `
      ${dots()}
      <div class="success-wrap">
        <div class="success-icon">✓</div>
        <h2>¡Todo listo!</h2>
        <p class="subtitle">Tu bóveda está configurada y tus credenciales están protegidas.</p>
        ${state.mevCreds ? '<p class="cred-saved">✓ Credenciales MEV guardadas</p>' : ''}
        ${state.pjnCreds ? '<p class="cred-saved">✓ Credenciales PJN guardadas</p>' : ''}
        <p class="done-note">Podés editar tus credenciales y cambiar el PIN desde la extensión en cualquier momento.</p>
      </div>
      <div class="actions" style="margin-top:28px">
        <button class="btn btn-primary" id="btnClose">Cerrar y usar la extensión</button>
      </div>`;
  }

  // ─── Render + handlers ──────────────────────────────────────────────────

  const STEPS = [stepWelcome, stepMev, stepPjn, stepPin, stepDone];

  function render() {
    wizard.innerHTML = STEPS[state.step]();

    switch (state.step) {
      case 0: attachWelcome(); break;
      case 1: attachMev();     break;
      case 2: attachPjn();     break;
      case 3: attachPin();     break;
      case 4: attachDone();    break;
    }

    const first = wizard.querySelector('input[type=text],input[type=password]');
    if (first) first.focus();
  }

  function attachWelcome() {
    document.getElementById('btnWelcomeNext').addEventListener('click', () => goTo(1));
  }

  function attachMev() {
    document.getElementById('btnMevSkip').addEventListener('click', async () => {
      state.mevCreds = null;
      await goToPin();
    });

    document.getElementById('btnMevNext').addEventListener('click', async () => {
      const username     = document.getElementById('mevUser').value.trim();
      const password     = document.getElementById('mevPass').value;
      const departamento = document.getElementById('mevDept').value.trim();

      if (!username) return setError('mevError', 'Ingresá el usuario de MEV.');
      if (!password) return setError('mevError', 'Ingresá la contraseña.');

      state.mevCreds = { username, password };
      if (departamento) state.mevCreds.departamento = departamento;
      setError('mevError', '');
      // Saltar PJN si van a MEV y omitir el resto
      goTo(2);
    });
  }

  function attachPjn() {
    document.getElementById('btnPjnSkip').addEventListener('click', async () => {
      state.pjnCreds = null;
      await goToPin();
    });

    document.getElementById('btnPjnNext').addEventListener('click', async () => {
      const cuit     = document.getElementById('pjnCuit').value.trim();
      const password = document.getElementById('pjnPass').value;

      if (!cuit)     return setError('pjnError', 'Ingresá el CUIT.');
      if (!password) return setError('pjnError', 'Ingresá la contraseña.');

      state.pjnCreds = { cuit, password };
      setError('pjnError', '');
      await goToPin();
    });
  }

  function attachPin() {
    const btn = document.getElementById('btnPinFinish');

    btn.addEventListener('click', async () => {
      const pinA = document.getElementById('pinA').value;
      btn.disabled = true;
      setError('pinError', '');

      try {
        if (state.vaultExists) {
          // ── Desbloquear bóveda existente ──
          btn.textContent = 'Desbloqueando…';
          const result = await LegalMevVault.unlock(pinA);
          if (!result.success) throw new Error(result.error || 'PIN incorrecto');
        } else {
          // ── Crear bóveda nueva ──
          const pinB = document.getElementById('pinB').value;
          if (pinA.length < 6) throw new Error('El PIN debe tener al menos 6 caracteres.');
          if (pinA !== pinB)   throw new Error('Los PINs no coinciden. Revisalos.');
          btn.textContent = 'Creando bóveda…';
          await LegalMevVault.setup(pinA); // lanza en error, undefined en éxito
        }

        // Guardar credenciales (bóveda desbloqueada en ambos caminos)
        if (state.mevCreds) await LegalMevVault.saveCredentials('mev', state.mevCreds);
        if (state.pjnCreds) await LegalMevVault.saveCredentials('pjn', state.pjnCreds);

        await chrome.storage.local.set({ legalmev_onboarding_done: true });
        clearPasswords();
        goTo(4);
      } catch (e) {
        setError('pinError', e.message || 'Error inesperado. Intentá de nuevo.');
        btn.disabled    = false;
        btn.textContent = state.vaultExists ? 'Desbloquear' : 'Crear bóveda';
      }
    });
  }

  function attachDone() {
    document.getElementById('btnClose').addEventListener('click', () => window.close());
  }

  // ─── Util ────────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ─── Arrancar ─────────────────────────────────────────────────────────────

  chrome.storage.local.get('legalmev_onboarding_done', ({ legalmev_onboarding_done }) => {
    if (legalmev_onboarding_done) {
      state.step = 4;
    }
    render();
  });
})();
