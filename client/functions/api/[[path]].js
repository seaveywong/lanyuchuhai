const API_ORIGIN = 'https://lanyu888888.com';

const PASS_HEADERS = new Set([
  'content-type',
  'content-length',
  'etag',
  'last-modified',
]);

export async function onRequest({ request, params }) {
  const incoming = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const upstream = new URL(`/api/${path}`, API_ORIGIN);
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.set('Host', 'lanyu888888.com');
  headers.delete('cookie');

  const method = request.method.toUpperCase();
  const init = { method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(method)) init.body = request.body;

  const response = await fetch(upstream.toString(), init);
  const outHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (PASS_HEADERS.has(key.toLowerCase())) outHeaders.set(key, value);
  });
  outHeaders.set('cache-control', 'no-store');
  outHeaders.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
}
