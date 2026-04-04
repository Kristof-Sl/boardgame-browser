// Vercel serverless proxy for BGG XML API.
// BGG blocks requests with no User-Agent or with cloud datacenter headers,
// so we spoof a real browser User-Agent and add appropriate headers.

export default async function handler(req, res) {
  const { path, ...params } = req.query

  if (!path) {
    return res.status(400).send('Missing ?path= parameter')
  }

  const query = new URLSearchParams(params).toString()
  const url = `https://boardgamegeek.com/xmlapi2/${path}${query ? '?' + query : ''}`

  try {
    const bggRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://boardgamegeek.com/',
      },
    })

    const xml = await bggRes.text()

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
    res.status(bggRes.status).send(xml)
  } catch (err) {
    res.status(502).send(`Proxy error: ${err.message}`)
  }
}
