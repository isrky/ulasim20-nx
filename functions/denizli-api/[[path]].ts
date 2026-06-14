// Cloudflare Pages Function: Proxy to Denizli Ulaşım API to avoid CORS issues in the browser
// Not: İstekleri aynı origin üzerinden proxyleyerek CORS sorunlarını ortadan kaldırır.

const UPSTREAM = 'https://ulasim.denizli.bel.tr'

function buildCorsHeaders(req: Request): HeadersInit {
  const reqHeaders = new Headers(req.headers)
  const acrh = reqHeaders.get('Access-Control-Request-Headers') || 'Content-Type, Authorization'
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': acrh,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function onRequest({ request }: { request: Request }) {
  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request) })
  }

  const incomingUrl = new URL(request.url)

  // /denizli-api/... -> https://ulasim.denizli.bel.tr/...
  const upstreamUrl = new URL(UPSTREAM)
  const rewrittenPath = incomingUrl.pathname.replace(/^\/denizli-api/, '') || '/'
  upstreamUrl.pathname = rewrittenPath
  upstreamUrl.search = incomingUrl.search

  // Orijinal isteği klonlayarak URL'yi değiştir
  const headers = new Headers(request.headers)
  headers.delete('host')

  const proxiedRequest = new Request(upstreamUrl.toString(), {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' 
      ? await request.text() 
      : undefined,
    redirect: 'follow',
  })

  // Upstream'den yanıtı al
  const upstreamResponse = await fetch(proxiedRequest)

  // Yanıtı kopyala ve CORS başlıklarını ekle
  const res = new Response(upstreamResponse.body, upstreamResponse)
  const cors = buildCorsHeaders(request)
  Object.entries(cors).forEach(([k, v]) => res.headers.set(k, String(v)))

  // Bazı hop-by-hop başlıklarını temiz tut (isteğe bağlı)
  res.headers.delete('Content-Security-Policy-Report-Only')

  return res
}
