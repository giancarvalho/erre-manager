/**
 * Post-login destination inside the app (equivalent of the legacy callbackUrl). Only internal paths:
 * absolute URLs, protocol-relative paths and backslash tricks fall back to "/".
 */
export function safeAppPath(target: string | null | undefined): string {
  if (typeof target !== 'string') return '/';
  const raw = target.trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  try {
    const parsed = new URL(raw, 'http://local.invalid');
    if (parsed.origin !== 'http://local.invalid') return '/';
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/';
  }
}
