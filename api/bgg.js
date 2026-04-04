export default async function handler(req, res) {
  const { path, ...query } = req.query;

  if (!path) {
    return res.status(400).send("Missing path");
  }

  const url = new URL(`https://boardgamegeek.com/xmlapi2/${path}`);

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (response.status === 200) return response;

      if (response.status === 202) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      return response;
    }
  }

  const response = await fetchWithRetry(url.toString());
  const text = await response.text();

  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(response.status).send(text);
}