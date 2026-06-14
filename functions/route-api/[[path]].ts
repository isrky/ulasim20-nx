// Cloudflare Pages Function: Proxy to Route API (ulasimapi.isrky.dev)
// Not: İstekleri aynı origin üzerinden proxyleyerek CORS sorunlarını ortadan kaldırır.

const UPSTREAM = 'https://ulasimapi.isrky.dev'

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

  // /route-api/... -> https://ulasimapi.isrky.dev/...
  const upstreamUrl = new URL(UPSTREAM)
  const rewrittenPath = incomingUrl.pathname.replace(/^\/route-api/, '') || '/'
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

  try {
    // Upstream'den yanıtı al
    const upstreamResponse = await fetch(proxiedRequest)

    // Yanıtı kopyala ve CORS başlıklarını ekle
    const res = new Response(upstreamResponse.body, upstreamResponse)
    const cors = buildCorsHeaders(request)
    Object.entries(cors).forEach(([k, v]) => res.headers.set(k, String(v)))

    // Bazı hop-by-hop başlıklarını temiz tut (isteğe bağlı)
    res.headers.delete('Content-Security-Policy-Report-Only')

    return res
  } catch (error) {
    console.error('Route API proxy error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Route API unavailable',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
}
