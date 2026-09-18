const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

export class PolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PolicyError';
  }
}

function normalizeHost(hostname) {
  let host = String(hostname || '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  while (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

function parseIPv4(address) {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : NaN;
  });
  return octets.every(Number.isFinite) ? octets : null;
}

function isPublicIPv4(address) {
  const octets = parseIPv4(address);
  if (!octets) return false;
  const [a, b] = octets;

  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 192 && b === 0 && octets[2] === 2) return false;
  if (a === 198 && b === 51 && octets[2] === 100) return false;
  if (a === 203 && b === 0 && octets[2] === 113) return false;
  if (a >= 224) return false;

  return true;
}

function expandIPv6(address) {
  let input = address.toLowerCase();
  if (input.includes('%')) return null;

  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4 = parseIPv4(input.slice(lastColon + 1));
    if (!ipv4) return null;
    const hi = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const lo = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    input = input.slice(0, lastColon + 1) + hi + ':' + lo;
  }

  const halves = input.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  if (halves.length === 1 && left.length !== 8) return null;
  if (left.length + right.length > 8) return null;

  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  const parts = [...left, ...Array(fill).fill('0'), ...right];
  if (parts.length !== 8) return null;

  const values = parts.map((part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return NaN;
    return Number.parseInt(part, 16);
  });
  return values.every(Number.isFinite) ? values : null;
}

function isPublicIPv6(address) {
  const p = expandIPv6(address);
  if (!p) return false;

  const [a, b, c, d, e, f, g, h] = p;
  if (p.every((value) => value === 0)) return false;
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0 && g === 0 && h === 1) return false;

  // IPv4-compatible and IPv4-mapped forms are blocked to avoid alternate encodings.
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0) return false;
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff) return false;

  if ((a & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((a & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((a & 0xffc0) === 0xfec0) return false; // fec0::/10 deprecated site-local
  if ((a & 0xff00) === 0xff00) return false; // multicast
  if (a === 0x0064 && b === 0xff9b) return false; // NAT64 well-known prefix
  if (a === 0x0100 && b === 0 && c === 0 && d === 0) return false; // discard-only prefix
  if (a === 0x2001 && b === 0x0db8) return false; // documentation
  if (a === 0x2001 && ((b >= 0x0010 && b <= 0x001f) || (b >= 0x0020 && b <= 0x002f))) return false;

  return true;
}

export function isPublicIp(address) {
  const host = normalizeHost(address);
  if (parseIPv4(host)) return isPublicIPv4(host);
  if (host.includes(':')) return isPublicIPv6(host);
  return false;
}

export function validateTargetUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new PolicyError('target URL is required');

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new PolicyError('invalid target URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new PolicyError('blocked target scheme');
  if (url.username || url.password) throw new PolicyError('target credentials are not allowed');
  if (url.port) throw new PolicyError('custom target ports are not allowed');

  const host = normalizeHost(url.hostname);
  if (!host) throw new PolicyError('target hostname is required');
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new PolicyError('blocked local hostname');
  }

  if (parseIPv4(host) || host.includes(':')) {
    if (!isPublicIp(host)) throw new PolicyError('blocked private or reserved IP target');
  }

  url.hash = '';
  return url;
}

export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin || origin === 'null') return false;
  return allowedOrigins instanceof Set && allowedOrigins.has(origin);
}

export function parseAllowedOrigins(value) {
  const raw = String(value || 'https://gnomeman4201.github.io');
  return new Set(raw.split(',').map((item) => item.trim()).filter(Boolean));
}

export function assertPublicDnsAnswers(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new PolicyError('DNS resolution returned no public address answers');
  }
  for (const answer of answers) {
    if (!isPublicIp(answer)) throw new PolicyError('DNS resolution included a blocked private or reserved address');
  }
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('DNS timeout')), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function queryDns(hostname, type, fetchImpl, timeoutMs) {
  const timer = timeoutSignal(timeoutMs);
  try {
    const endpoint = 'https://cloudflare-dns.com/dns-query?name=' +
      encodeURIComponent(hostname) + '&type=' + encodeURIComponent(type);
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      redirect: 'error',
      signal: timer.signal
    });
    if (!response.ok) throw new PolicyError('DNS lookup failed');
    const data = await response.json();
    if (data.Status !== 0) throw new PolicyError('DNS lookup returned an error status');
    return (data.Answer || [])
      .filter((answer) => answer && (answer.type === 1 || answer.type === 28))
      .map((answer) => String(answer.data || '').trim())
      .filter(Boolean);
  } catch (error) {
    if (error instanceof PolicyError) throw error;
    throw new PolicyError('DNS lookup failed');
  } finally {
    timer.clear();
  }
}

export async function resolvePublicHost(hostname, fetchImpl = fetch, options = {}) {
  const host = normalizeHost(hostname);
  if (!host) throw new PolicyError('DNS hostname is required');

  if (parseIPv4(host) || host.includes(':')) {
    assertPublicDnsAnswers([host]);
    return [host];
  }

  const timeoutMs = Number(options.timeoutMs || 2500);
  const [a, aaaa] = await Promise.all([
    queryDns(host, 'A', fetchImpl, timeoutMs),
    queryDns(host, 'AAAA', fetchImpl, timeoutMs)
  ]);
  const answers = [...a, ...aaaa];
  assertPublicDnsAnswers(answers);
  return answers;
}

export function resolveRedirectTarget(currentUrl, location) {
  if (!location) throw new PolicyError('redirect location is missing');
  let next;
  try {
    next = new URL(location, currentUrl);
  } catch {
    throw new PolicyError('invalid redirect target');
  }
  return validateTargetUrl(next.href);
}
