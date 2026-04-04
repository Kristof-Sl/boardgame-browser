// BoardGameGeek XML API v2
// In production (Vercel), requests go through /api/bgg (serverless function).
// Locally, Vite proxies /api/bgg directly to BGG.

async function fetchXML(path, params = {}) {
  const query = new URLSearchParams({ path, ...params }).toString()
  const url = `/api/bgg?${query}`

  const res = await fetch(url)
  const text = await res.text()

  if (!res.ok) {
    throw new Error(`BGG request failed (HTTP ${res.status}): ${text.slice(0, 400)}`)
  }
  if (!text || text.trim() === '') {
    throw new Error('BGG returned an empty response. Try again in a moment.')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error(`Could not parse BGG response: ${text.slice(0, 200)}`)
  }

  return doc
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function fetchCollection(username) {
  const params = {
    username,
    stats: '1',
    excludesubtype: 'boardgameexpansion',
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    let doc
    try {
      doc = await fetchXML('collection', params)
    } catch (err) {
      if (attempt < 5) {
        await wait(2000 + attempt * 1000)
        continue
      }
      throw err
    }

    const errorEl = doc.querySelector('error')
    if (errorEl) {
      const msg = errorEl.querySelector('message')?.textContent || 'Unknown BGG error'
      if (msg.toLowerCase().includes('invalid')) {
        throw new Error(`User "${username}" not found on BGG`)
      }
      throw new Error(`BGG error: ${msg}`)
    }

    const messageEl = doc.querySelector('message')
    if (messageEl) {
      const msg = messageEl.textContent?.toLowerCase() || ''
      if (msg.includes('queue') || msg.includes('request')) {
        await wait(3000 + attempt * 1500)
        continue
      }
    }

    const items = doc.querySelectorAll('item')
    if (items.length === 0 && attempt < 5) {
      await wait(2000)
      continue
    }

    return Array.from(items).map(item => parseCollectionItem(item, username))
  }

  throw new Error(`Could not load collection for "${username}" after several attempts. BGG may be slow — try again shortly.`)
}

function parseCollectionItem(item, username) {
  const getText = (selector) => item.querySelector(selector)?.textContent?.trim() || ''
  const getAttr = (selector, attr) => item.querySelector(selector)?.getAttribute(attr) || ''

  const id = item.getAttribute('objectid')
  const name = getText('name')
  const yearPublished = getText('yearpublished')
  const thumbnail = getText('thumbnail')
  const image = getText('image')

  const minPlayers = parseInt(getText('stats minplayers')) || 0
  const maxPlayers = parseInt(getText('stats maxplayers')) || 0
  const minPlaytime = parseInt(getText('stats minplaytime')) || 0
  const maxPlaytime = parseInt(getText('stats maxplaytime')) || 0
  const minAge = parseInt(getText('stats minage')) || 0

  const ratingValue = parseFloat(getAttr('stats ratings average', 'value')) || 0
  const numRatings = parseInt(getAttr('stats ratings usersrated', 'value')) || 0

  const rankEl = item.querySelector('stats ratings ranks rank[name="boardgame"]')
  const bggRankRaw = rankEl?.getAttribute('value')
  const bggRank = bggRankRaw && bggRankRaw !== 'Not Ranked' ? parseInt(bggRankRaw) : null

  const userRatingRaw = parseFloat(getAttr('stats ratings userrated', 'value'))
  const userRating = !isNaN(userRatingRaw) && userRatingRaw > 0 ? Math.round(userRatingRaw * 10) / 10 : null

  const status = item.querySelector('status')
  const owned = status?.getAttribute('own') === '1'
  const wishlist = status?.getAttribute('wishlist') === '1'
  const wantToPlay = status?.getAttribute('wanttoplay') === '1'
  const prevOwned = status?.getAttribute('prevowned') === '1'
  const numPlays = parseInt(getText('numplays')) || 0

  const fixUrl = (u) => {
    if (!u) return null
    if (u.startsWith('//')) return `https:${u}`
    if (u.startsWith('http')) return u
    return null
  }

  return {
    id,
    name,
    yearPublished: parseInt(yearPublished) || null,
    thumbnail: fixUrl(thumbnail),
    image: fixUrl(image),
    minPlayers,
    maxPlayers,
    minPlaytime,
    maxPlaytime,
    minAge,
    rating: Math.round(ratingValue * 10) / 10,
    numRatings,
    bggRank,
    userRating,
    owned,
    wishlist,
    wantToPlay,
    prevOwned,
    numPlays,
    owners: [username],
    bggUrl: `https://boardgamegeek.com/boardgame/${id}`,
  }
}

export function mergeCollections(collectionsMap) {
  const merged = new Map()

  for (const [username, games] of Object.entries(collectionsMap)) {
    for (const game of games) {
      if (merged.has(game.id)) {
        const existing = merged.get(game.id)
        if (!existing.owners.includes(username)) {
          existing.owners.push(username)
        }
        existing.owned = existing.owned || game.owned
        existing.wishlist = existing.wishlist || game.wishlist
        existing.wantToPlay = existing.wantToPlay || game.wantToPlay
      } else {
        merged.set(game.id, { ...game })
      }
    }
  }

  return Array.from(merged.values())
}
