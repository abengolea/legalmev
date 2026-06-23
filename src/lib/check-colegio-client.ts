/** Dispara la verificación de convenio colegio (no bloquea la UI si falla). */
export async function fetchCheckColegio(token: string): Promise<void> {
  try {
    await fetch('/api/user/check-colegio', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // No bloquear login/registro si falla la red
  }
}
