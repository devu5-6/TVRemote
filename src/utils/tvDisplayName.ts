/**
 * Friendly TV label for UI — never include the IP (security / privacy).
 */

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** Decode DNS-SD escaped labels (e.g. Hall\\032TV → Hall TV). */
export function decodeDnsSdLabel(value: string): string {
  return value
    .replace(/\\([0-7]{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1')
    .trim();
}

export function isGenericTvName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return !n || n === 'tv' || n === 'android tv' || n === 'google tv' || n.startsWith('tv (');
}

export function sanitizeTvDisplayName(name: string | null | undefined, host?: string): string {
  let cleaned = decodeDnsSdLabel((name ?? '').trim());

  // "TV (192.168.1.10)" / "TV(192.168.1.10)"
  cleaned = cleaned.replace(/^TV\s*\(\s*(?:\d{1,3}\.){3}\d{1,3}\s*\)$/i, 'TV');

  // Any parenthetical IPv4, e.g. "Hall TV (192.168.1.10)"
  cleaned = cleaned.replace(/\(\s*(?:\d{1,3}\.){3}\d{1,3}\s*\)/g, '');

  // Trailing / embedded bare IPv4
  cleaned = cleaned.replace(/(?:^|[\s\-–—])(?:\d{1,3}\.){3}\d{1,3}(?=$|[\s\-–—])/g, ' ');

  // Whole name is just an IP
  if (IPV4.test(cleaned.trim())) {
    cleaned = 'TV';
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  const hostLeaf = host?.replace(/\.local\.?$/i, '').trim();
  if (hostLeaf && (cleaned === host || cleaned === hostLeaf || IPV4.test(hostLeaf) && cleaned === hostLeaf)) {
    return 'TV';
  }

  if (host && (cleaned === host || cleaned.length === 0)) {
    return 'TV';
  }

  return cleaned || 'TV';
}

/**
 * Pick the best human-readable name the TV advertised over mDNS.
 */
export function nameFromDiscoveredService(service: {
  name?: string;
  host?: string;
  fullName?: string;
  addresses?: string[];
  txt?: Record<string, string | undefined>;
}): string {
  const host = service.addresses?.[0] ?? service.host;
  const txt = service.txt ?? {};

  const fromFullName = service.fullName?.includes('._')
    ? service.fullName.split('._')[0]
    : undefined;

  const candidates = [
    service.name,
    txt.fn,
    txt.friendlyname,
    txt.friendlyName,
    txt.name,
    txt.md,
    txt.dn,
    txt.n,
    fromFullName,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = sanitizeTvDisplayName(String(candidate), host);
    if (!isGenericTvName(cleaned) && !IPV4.test(cleaned)) {
      return cleaned;
    }
  }

  return sanitizeTvDisplayName(service.name || 'TV', host);
}
