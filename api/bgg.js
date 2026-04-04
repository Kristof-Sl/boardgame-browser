// Vercel serverless function — proxies requests to BGG API to avoid CORS issues
export default async function handler(req, res) {
  const { path, ...params } = req.query

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' })
  }

  const query = new URLSearchParams(params).toString()
  const url = `https://boardgamegeek.com/xmlapi2/${path}${query ? '?' + query : ''}`

  try {
    const bggRes = await fetch(url, {
      headers: { 'User-Agent': 'BoardGameBrowser/1.0' },
    })

    const xml = await bggRes.text()

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(bggRes.status).send(xml)
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach BoardGameGeek', detail: err.message })
  }
}
