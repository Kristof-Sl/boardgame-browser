export default async function handler(req, res) {
  const { path, ...params } = req.query

  if (!path) {
    return res.status(400).send('Missing ?path= parameter')
  }

  const token = process.env.BGG_TOKEN
  if (!token) {
    return res.status(500).send('BGG_TOKEN environment variable is not set in Vercel.')
  }

  const query = new URLSearchParams(params).toString()
  const url = `https://boardgamegeek.com/xmlapi2/${path}${query ? '?' + query : ''}`

  try {
    const bggRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/xml, text/xml, */*',
      },
    })

    const xml = await bggRes.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 's-maxage=60')
    res.status(bggRes.status).send(xml)
  } catch (err) {
    res.status(502).send(`Proxy error: ${err.message}`)
  }
}
