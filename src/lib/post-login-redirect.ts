/** Destino post-login según rol (responsable de colegio → Mi colegio). */
export async function resolvePostLoginPath(
  token: string,
  redirectTo?: string | null
): Promise<string> {
  if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
    return redirectTo;
  }
  try {
    const res = await fetch('/api/user/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json?.ok && json.user?.isColegioAdmin && !json.user?.isPlatformAdmin) {
      return '/dashboard/colegio';
    }
  } catch {
    // fallback
  }
  return '/dashboard';
}
