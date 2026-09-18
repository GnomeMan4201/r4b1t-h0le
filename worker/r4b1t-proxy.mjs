import dns from 'node:dns';

const ALLOWED_CALLER_ORIGINS = new Set([
  'https://gnomeman4201.github.io',
  'https://r4b1t.badbananaresearch.com',
]);

const MAX_REDIRECTS = 4;
const OUTBOUND_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_JSON_BYTES = 1_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const CACHE_SECONDS = 3_600;

class BoundaryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'BoundaryError';
    this.status = status;
  }
}

function stripIpv6Brackets(hostname) {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function normalizeHostname(hostname) {
  return stripIpv6Brackets(String(hostname || '').trim().toLowerCase().replace(/\.$/, ''));
}

function parseIpv4(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return NaN;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : NaN;
  });
  return octets.every(Number.isFinite) ? octets : null;
}

function ipv4IsPublic(octets) {
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a >= 224) return false;
  if (a === 192 && b === 0 && octets[2] === 2) return false;
  if (a === 198 && b === 51 && octets[2] === 100) return false;
  if (a === 203 && b === 0 && octets[2] === 113) return false;
  return true;
}

function parseIpv6(hostname) {
  const host = normalizeHostname(hostname).split('%')[0];
  if (!host.includes(':')) return null;

  let left = [];
  let right = [];
  if (host.includes('::')) {
    if (host.indexOf('::') !== host.lastIndexOf('::')) return null;
    const split = host.split('::');
    left = split[0] ? split[0].split(':') : [];
    right = split[1] ? split[1].split(':') : [];
  } else {
    left = host.split(':');
  }

  function normalizePart(part) {
    if (part.includes('.')) {
      const v4 = parseIpv4(part);
      if (!v4) return null;
      return [((v4[0] << 8) | v4[1]).toString(16), ((v4[2] << 8) | v4[3]).toString(16)];
    }
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
    return [part];
  }

  const leftParts = left.flatMap((part) => normalizePart(part) || ['!']);
  const rightParts = right.flatMap((part) => normalizePart(part) || ['!']);
  if (leftParts.includes('!') || rightParts.includes('!')) return null;

  let groups;
  if (host.includes('::')) {
    const zeros = 8 - leftParts.length - rightParts.length;
    if (zeros < 1) return null;
    groups = [...leftParts, ...Array(zeros).fill('0'), ...rightParts];
  } else {
    groups = leftParts;
  }
  if (groups.length !== 8) return null;
  const values = groups.map((part) => Number.parseInt(part, 16));
  return values.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff)
    ? values
    : null;
}

function ipv6IsPublic(groups) {
  const allZero = groups.every((value) => value === 0);
  const loopback = groups.slice(0, 7).every((value) => value === 0) && groups[7] === 1;
  if (allZero || loopback) return false;

  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (first === 0x2001 && groups[1] === 0x0db8) return false; // documentation

  const mapped = groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
    groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff;
  if (mapped) {
    const v4 = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff,
    ];
    return ipv4IsPublic(v4);
  }

  // Block deprecated IPv4-compatible IPv6 (::/96) rather than allowing
  // alternate IPv4 spellings to bypass the IPv4 policy.
  if (groups.slice(0, 6).every((value) => value === 0)) return false;

  // Block IPv4/IPv6 translation prefixes. A translated address can encode
  // a private IPv4 destination even though the outer IPv6 prefix is global.
  const nat64WellKnown = groups[0] === 0x0064 && groups[1] === 0xff9b &&
    groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0;
  const nat64LocalUse = groups[0] === 0x0064 && groups[1] === 0xff9b && groups[2] === 1;
  if (nat64WellKnown || nat64LocalUse) return false;

  return true;
}

export function isPublicIp(hostname) {
  const host = normalizeHostname(hostname);
  const v4 = parseIpv4(host);
  if (v4) return ipv4IsPublic(v4);
  const v6 = parseIpv6(host);
  if (v6) return ipv6IsPublic(v6);
  return null;
}

export function callerOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin;
  const referer = request.headers.get('Referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function isAllowedCaller(request) {
  const origin = callerOrigin(request);
  return origin !== null && ALLOWED_CALLER_ORIGINS.has(origin);
}

function securityHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

function jsonResponse(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: securityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    }),
  });
}

function textResponse(value, status = 200) {
  return new Response(value, {
    status,
    headers: securityHeaders({
      'Content-Type': 'text/plain; charset=utf-8',
      ...(status >= 400 ? { 'Cache-Control': 'no-store' } : {}),
    }),
  });
}

async function enforceRateLimit(request, env) {
  if (String(env.REQUIRE_RATE_LIMIT || 'false') !== 'true') return null;

  const limiter = env.R4B1T_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== 'function') {
    return textResponse('rate limiter unavailable', 503);
  }

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (!clientIp) {
    return textResponse('rate limiter identity unavailable', 503);
  }

  const result = await limiter.limit({ key: clientIp });
  if (!result || result.success !== true) {
    return textResponse('rate limit exceeded', 429);
  }

  return null;
}

export function canonicalizeTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BoundaryError('invalid target URL', 400);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BoundaryError('unsupported target scheme', 400);
  }
  if (url.username || url.password) {
    throw new BoundaryError('target credentials are not allowed', 400);
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new BoundaryError('non-web target port is not allowed', 400);
  }
  url.hash = '';
  const host = normalizeHostname(url.hostname);
  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    throw new BoundaryError('local target is not allowed', 403);
  }
  const literalPublic = isPublicIp(host);
  if (literalPublic === false) {
    throw new BoundaryError('non-public target address is not allowed', 403);
  }
  return url;
}

export async function resolvePublicHost(hostname, dnsApi = dns.promises) {
  const host = normalizeHostname(hostname);
  const literalPublic = isPublicIp(host);
  if (literalPublic !== null) {
    if (!literalPublic) throw new BoundaryError('non-public target address is not allowed', 403);
    return [host];
  }

  const lookups = await Promise.all([
    dnsApi.resolve4(host).catch(() => []),
    dnsApi.resolve6(host).catch(() => []),
  ]);

  const addresses = lookups.flat().map((address) => String(address));
  if (!addresses.length) throw new BoundaryError('target host did not resolve publicly', 502);
  if (addresses.some((address) => isPublicIp(address) !== true)) {
    throw new BoundaryError('target DNS includes a non-public address', 403);
  }
  return addresses;
}

export async function validateTarget(rawUrl, { resolver = resolvePublicHost } = {}) {
  const url = canonicalizeTarget(rawUrl);
  await resolver(url.hostname);
  return url;
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

export async function safeFetch(rawUrl, {
  fetchImpl = fetch,
  resolver = (host) => resolvePublicHost(host),
  accept = '*/*',
  maxRedirects = MAX_REDIRECTS,
  timeoutMs = OUTBOUND_TIMEOUT_MS,
} = {}) {
  let current = await validateTarget(rawUrl, { resolver });

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current.toString(), {
        method: 'GET',
        headers: {
          Accept: accept,
          'User-Agent': 'r4b1t-proxy/1.0',
        },
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!isRedirect(response.status)) return { response, finalUrl: current };
    if (redirects === maxRedirects) {
      throw new BoundaryError('too many redirects', 502);
    }
    const location = response.headers.get('Location');
    if (!location) throw new BoundaryError('redirect missing location', 502);
    current = await validateTarget(new URL(location, current).toString(), { resolver });
  }
  throw new BoundaryError('redirect limit reached', 502);
}

async function readLimited(response, limit) {
  const length = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > limit) {
    throw new BoundaryError('upstream response is too large', 413);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BoundaryError('upstream response is too large', 413);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function mediaType(response) {
  return (response.headers.get('Content-Type') || '').split(';', 1)[0].trim().toLowerCase();
}

function isJsonType(type) {
  return type === 'application/json' || type === 'text/json' || type.endsWith('+json');
}

function isImageType(type) {
  return type.startsWith('image/');
}

function decodeHtml(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function extractAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function extractMeta(html, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = extractAttributes(match[0]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (wanted.has(key) && attrs.content) return decodeEntities(attrs.content);
  }
  return '';
}

export function parseOpenGraph(html, baseUrl) {
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = extractMeta(html, ['og:title', 'twitter:title']) || decodeEntities(titleTag?.[1] || '');
  const desc = extractMeta(html, ['og:description', 'description', 'twitter:description']);
  const site_name = extractMeta(html, ['og:site_name']);
  const keywords = extractMeta(html, ['keywords']);
  const rawImage = extractMeta(html, ['og:image', 'twitter:image']);
  let image = '';
  if (rawImage) {
    try {
      image = new URL(rawImage, baseUrl).toString();
    } catch {
      image = '';
    }
  }
  return {
    title: title.slice(0, 300),
    desc: desc.slice(0, 1_000),
    image,
    keywords: keywords.slice(0, 1_000),
    site_name: site_name.slice(0, 300),
  };
}

async function proxyRoute(target, deps) {
  const { response } = await safeFetch(target, deps);
  if (!response.ok) throw new BoundaryError('upstream request failed', 502);
  const type = mediaType(response);
  if (!isJsonType(type) && !isImageType(type)) {
    throw new BoundaryError('upstream content type is not permitted', 415);
  }
  const limit = isImageType(type) ? MAX_IMAGE_BYTES : MAX_JSON_BYTES;
  const body = await readLimited(response, limit);
  return new Response(body, {
    status: 200,
    headers: securityHeaders({ 'Content-Type': type || 'application/octet-stream' }),
  });
}

async function ogRoute(target, deps) {
  const { response, finalUrl } = await safeFetch(target, {
    ...deps,
    accept: 'text/html,application/xhtml+xml;q=0.9',
  });
  if (!response.ok) throw new BoundaryError('upstream request failed', 502);
  const type = mediaType(response);
  if (type !== 'text/html' && type !== 'application/xhtml+xml') {
    throw new BoundaryError('upstream content is not HTML', 415);
  }
  const body = await readLimited(response, MAX_HTML_BYTES);
  return jsonResponse(parseOpenGraph(decodeHtml(body), finalUrl));
}

async function maybeCached(request, ctx, build) {
  const cache = globalThis.caches?.default;
  if (!cache || request.method !== 'GET') return build();
  const key = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await build();
  if (response.ok) {
    const put = cache.put(key, response.clone());
    if (ctx?.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return response;
}

export async function handleRequest(request, env = {}, ctx = {}, deps = {}) {
  if (request.method === 'OPTIONS') {
    if (!isAllowedCaller(request)) return textResponse('forbidden', 403);
    return new Response(null, {
      status: 204,
      headers: securityHeaders({ 'Cache-Control': 'no-store' }),
    });
  }
  if (!['GET', 'HEAD'].includes(request.method)) return textResponse('method not allowed', 405);
  if (!isAllowedCaller(request)) return textResponse('forbidden', 403);

  const rateLimitResponse = await enforceRateLimit(request, env);
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(request.url);
  if (url.pathname === '/api') {
    const response = textResponse('legacy route removed', 410);
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }
  if (!['/proxy', '/og'].includes(url.pathname)) return textResponse('not found', 404);

  const target = url.searchParams.get('url');
  if (!target) return textResponse('missing url', 400);

  try {
    const response = await maybeCached(request, ctx, () => (
      url.pathname === '/proxy'
        ? proxyRoute(target, deps)
        : ogRoute(target, deps)
    ));
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  } catch (error) {
    const response = error instanceof BoundaryError
      ? textResponse(error.message, error.status)
      : textResponse('upstream request failed', 502);
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }
}

export { BoundaryError };

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};
