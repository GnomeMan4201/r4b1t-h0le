import {
  PolicyError,
  assertPublicDnsAnswers,
  isAllowedOrigin,
  parseAllowedOrigins,
  resolvePublicHost,
  resolveRedirectTarget,
  validateTargetUrl
} from './policy.mjs';

const DEFAULT_MAX_PROXY_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_OG_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_REDIRECTS = 4;
const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function textResponse(body, status, origin, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin),
      ...extra
    }
  });
}

function jsonResponse(value, status, origin, method = 'GET', extra = {}) {
  const body = method === 'HEAD' ? null : JSON.stringify(value);
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin),
      ...extra
    }
  });
}

function numberSetting(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

async function enforceRateLimit(request, env) {
  if (String(env.REQUIRE_RATE_LIMIT || 'true') === 'false') return null;
  if (!env.R4B1T_RATE_LIMITER || typeof env.R4B1T_RATE_LIMITER.limit !== 'function') {
    return new Response('rate limiter unavailable', { status: 503 });
  }

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (!clientIp) return new Response('rate limiter identity unavailable', { status: 503 });

  const result = await env.R4B1T_RATE_LIMITER.limit({ key: clientIp });
  if (!result || result.success !== true) return new Response('rate limit exceeded', { status: 429 });
  return null;
}

function timeoutController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('upstream timeout')), timeoutMs);
  return { controller, clear: () => clearTimeout(timer) };
}

async function readBoundedBody(response, maxBytes) {
  const declared = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(declared) && declared > maxBytes) throw new PolicyError('upstream response size exceeds limit');

  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('response size limit exceeded');
        throw new PolicyError('upstream response size exceeds limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

export async function fetchBounded(rawTarget, platform = {}, options = {}) {
  const fetchImpl = platform.fetch || fetch;
  const resolveHost = platform.resolveHost ||
    ((hostname) => resolvePublicHost(hostname, fetchImpl, { timeoutMs: options.dnsTimeoutMs || 2500 }));

  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_PROXY_BYTES);
  const maxRedirects = Number(options.maxRedirects ?? DEFAULT_MAX_REDIRECTS);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const method = options.method === 'HEAD' ? 'HEAD' : 'GET';
  const accept = options.accept || '*/*';

  let current = validateTargetUrl(rawTarget);

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const answers = await resolveHost(current.hostname);
    assertPublicDnsAnswers(answers);

    const timer = timeoutController(timeoutMs);
    let response;
    try {
      response = await fetchImpl(current.href, {
        method,
        redirect: 'manual',
        headers: { Accept: accept },
        signal: timer.controller.signal
      });
    } catch {
      throw new PolicyError('upstream request failed or timed out');
    } finally {
      timer.clear();
    }

    if (isRedirect(response.status)) {
      if (redirects >= maxRedirects) throw new PolicyError('redirect limit exceeded');
      current = resolveRedirectTarget(current.href, response.headers.get('location'));
      continue;
    }

    const body = method === 'HEAD' ? new Uint8Array() : await readBoundedBody(response, maxBytes);
    return { response, body, finalUrl: current };
  }

  throw new PolicyError('redirect limit exceeded');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseMetaTags(html) {
  const result = new Map();
  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = match[0];
    const attrs = {};
    for (const attr of tag.matchAll(/([:\w-]+)\s*=\s*(['"])(.*?)\2/gi)) {
      attrs[attr[1].toLowerCase()] = decodeHtml(attr[3]);
    }
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !result.has(key)) result.set(key, attrs.content);
  }
  return result;
}

function extractMetadata(html, finalUrl) {
  const meta = parseMetaTags(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = meta.get('og:title') || (titleMatch ? decodeHtml(titleMatch[1].trim()) : null);
  const desc = meta.get('og:description') || meta.get('description') || null;
  const siteName = meta.get('og:site_name') || null;
  const keywords = meta.get('keywords') || null;

  let image = meta.get('og:image') || meta.get('twitter:image') || null;
  if (image) {
    try {
      image = validateTargetUrl(new URL(image, finalUrl).href).href;
    } catch {
      image = null;
    }
  }

  return {
    title: title || null,
    desc,
    image,
    site_name: siteName,
    keywords
  };
}

function proxyContentTypeAllowed(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return type.startsWith('image/') ||
    type === 'application/json' ||
    type === 'text/plain' ||
    type === 'application/xml' ||
    type === 'text/xml';
}

async function handleProxy(request, env, platform, origin, target) {
  const maxBytes = numberSetting(env.MAX_PROXY_BYTES, DEFAULT_MAX_PROXY_BYTES, 1024, 10 * 1024 * 1024);
  const result = await fetchBounded(target, platform, {
    method: request.method,
    maxBytes,
    maxRedirects: numberSetting(env.MAX_REDIRECTS, DEFAULT_MAX_REDIRECTS, 0, 8),
    timeoutMs: numberSetting(env.UPSTREAM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 500, 15000)
  });

  const contentType = result.response.headers.get('content-type') || 'application/octet-stream';
  if (!proxyContentTypeAllowed(contentType)) throw new PolicyError('upstream content type is not allowed on proxy route');

  return new Response(request.method === 'HEAD' ? null : result.body, {
    status: result.response.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=900',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin)
    }
  });
}

async function handleOg(request, env, platform, origin, target) {
  const maxBytes = numberSetting(env.MAX_OG_BYTES, DEFAULT_MAX_OG_BYTES, 4096, 2 * 1024 * 1024);
  const result = await fetchBounded(target, platform, {
    method: request.method,
    accept: 'text/html,application/xhtml+xml;q=0.9',
    maxBytes,
    maxRedirects: numberSetting(env.MAX_REDIRECTS, DEFAULT_MAX_REDIRECTS, 0, 8),
    timeoutMs: numberSetting(env.UPSTREAM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 500, 15000)
  });

  if (request.method === 'HEAD') {
    return jsonResponse({}, result.response.status, origin, 'HEAD', { 'Cache-Control': 'public, max-age=3600' });
  }

  const contentType = String(result.response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new PolicyError('metadata route requires HTML content');
  }

  const html = new TextDecoder().decode(result.body);
  const metadata = extractMetadata(html, result.finalUrl.href);
  return jsonResponse(metadata, result.response.status, origin, request.method, {
    'Cache-Control': 'public, max-age=3600'
  });
}

export async function handleRequest(request, env = {}, platform = {}) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  if (!isAllowedOrigin(origin, allowedOrigins)) return new Response('forbidden', { status: 403 });

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    return textResponse('method not allowed', 405, origin, { Allow: ALLOWED_METHODS });
  }

  const rateLimitResponse = await enforceRateLimit(request, env);
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(request.url);
  if (url.pathname === '/api') {
    return jsonResponse({ type: 'disabled', message: 'API route disabled' }, 200, origin, request.method, {
      'Cache-Control': 'no-store'
    });
  }

  if (!['/proxy', '/og'].includes(url.pathname)) {
    return textResponse('not found', 404, origin);
  }

  const target = url.searchParams.get('url');
  if (!target) return textResponse('missing url parameter', 400, origin);

  try {
    validateTargetUrl(target);
    if (url.pathname === '/proxy') return await handleProxy(request, env, platform, origin, target);
    return await handleOg(request, env, platform, origin, target);
  } catch (error) {
    if (error instanceof PolicyError) return textResponse(error.message, 403, origin);
    return textResponse('upstream error', 502, origin);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
