/**
 * Bóveda de credenciales LegalMev (SPEC-03).
 * AES-GCM-256 + PBKDF2-SHA-256. Secretos solo locales.
 */
(function (root) {
  'use strict';

  const VAULT_KEY = 'legalmev_boveda_v1';
  const SESSION_KEY = 'legalmev_boveda_sesion';
  const ITERATIONS = 310_000;

  function bufToB64(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function b64ToBuf(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out.buffer;
  }

  async function deriveKey(pin, saltBuf) {
    const pinBytes = new TextEncoder().encode(String(pin));
    const base = await crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(plainObj, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(plainObj));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { iv: bufToB64(iv), ciphertext: bufToB64(ciphertext), algorithm: 'AES-GCM' };
  }

  async function decrypt(blob, key) {
    const iv = new Uint8Array(b64ToBuf(blob.iv));
    const data = b64ToBuf(blob.ciphertext);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function loadVault() {
    const result = await chrome.storage.local.get(VAULT_KEY);
    return result[VAULT_KEY] ?? null;
  }

  async function saveVault(vault) {
    await chrome.storage.local.set({ [VAULT_KEY]: vault });
  }

  async function saveSessionKey(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    await chrome.storage.session.set({ [SESSION_KEY]: bufToB64(raw) });
  }

  async function loadSessionKey() {
    const row = await chrome.storage.session.get(SESSION_KEY);
    if (!row[SESSION_KEY]) return null;
    return crypto.subtle.importKey(
      'raw',
      b64ToBuf(row[SESSION_KEY]),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function clearSession() {
    await chrome.storage.session.remove(SESSION_KEY);
  }

  async function isSetup() {
    return (await loadVault()) !== null;
  }

  async function isUnlocked() {
    return !!(await loadSessionKey());
  }

  async function setup(pin) {
    if (await loadVault()) throw new Error('La bóveda ya está configurada');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pin, salt.buffer);
    const vault = { salt: bufToB64(salt), credentials: {}, version: 1 };
    await saveVault(vault);
    await saveSessionKey(key);
  }

  async function unlock(pin) {
    const vault = await loadVault();
    if (!vault) return { success: false, error: 'La bóveda no fue configurada' };
    let key;
    try {
      key = await deriveKey(pin, b64ToBuf(vault.salt));
    } catch {
      return { success: false, error: 'PIN inválido' };
    }
    const portals = Object.keys(vault.credentials || {});
    if (portals.length) {
      try {
        await decrypt(vault.credentials[portals[0]], key);
      } catch {
        return { success: false, error: 'PIN incorrecto' };
      }
    }
    await saveSessionKey(key);
    return { success: true };
  }

  async function lock() {
    await clearSession();
  }

  async function getCredentials(portal) {
    const key = await loadSessionKey();
    if (!key) return null;
    const vault = await loadVault();
    if (!vault?.credentials?.[portal]) return null;
    return decrypt(vault.credentials[portal], key);
  }

  async function saveCredentials(portal, creds) {
    const key = await loadSessionKey();
    if (!key) throw new Error('La bóveda está bloqueada');
    const vault = await loadVault();
    if (!vault) throw new Error('La bóveda no fue configurada');
    const now = new Date().toISOString();
    vault.credentials[portal] = {
      ...(await encrypt(creds, key)),
      updatedAt: now,
      createdAt: vault.credentials[portal]?.createdAt ?? now,
    };
    await saveVault(vault);
  }

  async function deleteCredentials(portal) {
    const vault = await loadVault();
    if (!vault) return;
    delete vault.credentials[portal];
    await saveVault(vault);
  }

  async function changePin(currentPin, newPin) {
    const vault = await loadVault();
    if (!vault) return { success: false, error: 'La bóveda no fue configurada' };
    let oldKey;
    try {
      oldKey = await deriveKey(currentPin, b64ToBuf(vault.salt));
    } catch {
      return { success: false, error: 'PIN actual incorrecto' };
    }
    const decrypted = {};
    for (const portal of Object.keys(vault.credentials || {})) {
      try {
        decrypted[portal] = await decrypt(vault.credentials[portal], oldKey);
      } catch {
        return { success: false, error: 'PIN actual incorrecto' };
      }
    }
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKey = await deriveKey(newPin, newSalt.buffer);
    vault.salt = bufToB64(newSalt);
    for (const portal of Object.keys(decrypted)) {
      vault.credentials[portal] = {
        ...(await encrypt(decrypted[portal], newKey)),
        createdAt: vault.credentials[portal].createdAt,
        updatedAt: new Date().toISOString(),
      };
    }
    await saveVault(vault);
    await saveSessionKey(newKey);
    return { success: true };
  }

  async function reset() {
    await chrome.storage.local.remove(VAULT_KEY);
    await clearSession();
  }

  const LegalMevVault = {
    isSetup,
    isUnlocked,
    setup,
    unlock,
    lock,
    getCredentials,
    saveCredentials,
    deleteCredentials,
    changePin,
    reset,
  };

  root.LegalMevVault = LegalMevVault;
  if (typeof window !== 'undefined') window.LegalMevVault = LegalMevVault;
})(typeof self !== 'undefined' ? self : window);
