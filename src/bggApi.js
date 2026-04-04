// BoardGameGeek XML API v2
// We use allorigins.win as a CORS proxy since BGG doesn't allow direct browser requests

const PROXY = 'https://api.allorigins.win/get?url='
const BGG_BASE = 'https://boardgamegeek.com/xmlapi2'

function proxyUrl(url) {
  return `${PROXY}${encodeURIComponent(url)}`
}

async function fetchXML(url) {
  const res = await fetch(proxyUrl(url))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const parser = new DOMParser()
  return parser.parseFromString(json.contents, 'text/xml')
}

// Fetch a user's collection with retry (BGG queues requests)
export async function fetchCollection(username) {
  const url = `${BGG_BASE}/collection?username=${encodeURIComponent(username)}&stats=1&excludesubtype=boardgameexpansion`

  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await fetchXML(url)
    const error = doc.querySelector('error')
    if (error) {
      const msg = error.querySelector('message')?.textContent || 'Unknown error'
      if (msg.toLowerCase().includes('invalid')) throw new Error(`User "${username}" not found`)
      throw new Error(msg)
    }

    const message = doc.querySelector('message')
    if (message && message.textContent.toLowerCase().includes('queued')) {
      // BGG is still preparing the data, wait and retry
      await new Promise(r => setTimeout(r, 3000 + attempt * 1000))
      continue
    }

    const items = doc.querySelectorAll('item')
    if (items.length === 0 && attempt < 4) {
      await new Promise(r => setTimeout(r, 2000))
      continue
    }

    return Array.from(items).map(item => parseCollectionItem(item, username))
  }

  throw new Error(`Could not load collection for "${username}" after retries`)
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
  const bggRank = parseInt(getAttr('stats ratings ranks rank[name="boardgame"]', 'value')) || null

  const userRating = parseFloat(getAttr('stats ratings userrated', 'value')) || null
  const owned = item.querySelector('status')?.getAttribute('own') === '1'
  const wishlist = item.querySelector('status')?.getAttribute('wishlist') === '1'
  const wantToPlay = item.querySelector('status')?.getAttribute('wanttoplay') === '1'
  const prevOwned = item.querySelector('status')?.getAttribute('prevowned') === '1'
  const numPlays = parseInt(getText('numplays')) || 0

  return {
    id,
    name,
    yearPublished: parseInt(yearPublished) || null,
    thumbnail: thumbnail ? `https:${thumbnail}` : null,
    image: image ? `https:${image}` : null,
    minPlayers,
    maxPlayers,
    minPlaytime,
    maxPlaytime,
    minAge,
    rating: Math.round(ratingValue * 10) / 10,
    numRatings,
    bggRank: isNaN(bggRank) ? null : bggRank,
    userRating: userRating && !isNaN(userRating) ? Math.round(userRating * 10) / 10 : null,
    owned,
    wishlist,
    wantToPlay,
    prevOwned,
    numPlays,
    owners: [username],
    bggUrl: `https://boardgamegeek.com/boardgame/${id}`,
  }
}

// Merge collections from multiple users, combining ownership info
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
