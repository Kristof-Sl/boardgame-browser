// Cloudflare Worker — BGG API proxy
// Deploy this at https://workers.cloudflare.com (free, no credit card needed)
// Then set VITE_BGG_PROXY_URL in your Vercel environment variables to your worker URL.

export default {
  async fetch(request) {
    const url = new URL(request.url)

    // Allow requests from any origin (your Vercel app)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const path = url.searchParams.get('path')
    if (!path) {
      return new Response('Missing ?path= parameter', { status: 400, headers: corsHeaders })
    }

    // Forward all query params except 'path' to BGG
    const bggParams = new URLSearchParams()
    for (const [key, value] of url.searchParams) {
      if (key !== 'path') bggParams.set(key, value)
    }

    const bggUrl = `https://boardgamegeek.com/xmlapi2/${path}?${bggParams.toString()}`

    try {
      const bggRes = await fetch(bggUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://boardgamegeek.com/',
        },
      })

      const xml = await bggRes.text()

      return new Response(xml, {
        status: bggRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        },
      })
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, {
        status: 502,
        headers: corsHeaders,
      })
    }
  },
}
