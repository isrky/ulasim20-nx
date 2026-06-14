// Cloudflare Pages Function: Proxy to Backend Worker
// Development'ta localhost:8787'ye, production'da backend worker'a yönlendirir

interface Env {
  BACKEND?: Fetcher
  BACKEND_URL?: string
}

export async function onRequest({ request, env }: { request: Request; env: Env }) {
  const url = new URL(request.url)
  const targetUrl = new URL(
    url.pathname + url.search,
    env.BACKEND_URL || 'https://api.ulasim20.com'
  )
  
  // Preflight handling
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  try {
    // Forward the request to backend
    const headers = new Headers(request.headers)
    headers.delete('host')

    const backendRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text() 
        : undefined,
      redirect: 'follow',
    })

    const response = env.BACKEND
      ? await env.BACKEND.fetch(backendRequest)
      : await fetch(backendRequest)
    
    // Clone response and add CORS headers
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    newResponse.headers.append('Vary', 'Origin')
    
    return newResponse
  } catch (error) {
    console.error('Backend proxy error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Backend unavailable',
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
