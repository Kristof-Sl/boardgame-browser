// BoardGameGeek XML API v2
// Requests go through /api/bgg (Vercel serverless function in api/bgg.js)
// which adds the BGG_TOKEN authorization header server-side.

const PROXY_BASE = '/api/bgg'

async function fetchXML(path, params) {
  const query = new URLSearchParams(Object.assign({ path }, params)).toString()
  const url = PROXY_BASE + '?' + query

  let res, text
  try {
    res = await fetch(url)
    text = await res.text()
  } catch (err) {
    throw new Error('Network error reaching proxy at ' + url + '\n' + String(err))
  }

  if (!res.ok) {
    throw new Error(
      'Proxy returned HTTP ' + res.status + '\n' +
      'Proxy URL: ' + url + '\n' +
      'Full response:\n' + text
    )
  }

  if (!text || text.trim() === '') {
    throw new Error('BGG returned empty response. Try again.')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML from BGG:\n' + text.slice(0, 500))
  }

  return doc
}

function wait(ms) {
  return new Promise(function(r) { setTimeout(r, ms) })
}

export async function fetchCollection(username) {
  const params = {
    username: username,
    stats: '1',
    excludesubtype: 'boardgameexpansion',
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    let doc
    try {
      doc = await fetchXML('collection', params)
    } catch (err) {
      if (attempt < 5) { await wait(2000 + attempt * 1000); continue }
      throw err
    }

    const errorEl = doc.querySelector('error')
    if (errorEl) {
      const msg = errorEl.querySelector('message') ? errorEl.querySelector('message').textContent : 'Unknown BGG error'
      if (msg.toLowerCase().includes('invalid')) throw new Error('User "' + username + '" not found on BGG')
      throw new Error('BGG error: ' + msg)
    }

    const messageEl = doc.querySelector('message')
    if (messageEl) {
      const msg = messageEl.textContent ? messageEl.textContent.toLowerCase() : ''
      if (msg.includes('queue') || msg.includes('request')) { await wait(3000 + attempt * 1500); continue }
    }

    const items = doc.querySelectorAll('item')
    if (items.length === 0 && attempt < 5) { await wait(2000); continue }

    return Array.from(items).map(function(item) { return parseCollectionItem(item, username) })
  }

  throw new Error('Could not load collection for "' + username + '" after several attempts. Try again shortly.')
}

function parseCollectionItem(item, username) {
  // BGG XML uses both attribute-based values AND text content depending on the element.
  // e.g. <minplayers value="2">2</minplayers> — we prefer the 'value' attribute when present.
  function getVal(selector) {
    var el = item.querySelector(selector)
    if (!el) return ''
    return el.getAttribute('value') || el.textContent.trim() || ''
  }
  function getAttr(selector, attr) {
    var el = item.querySelector(selector)
    return el ? (el.getAttribute(attr) || '') : ''
  }
  function getText(selector) {
    var el = item.querySelector(selector)
    return el ? el.textContent.trim() : ''
  }

  var id = item.getAttribute('objectid')
  var name = getText('name')
  var yearPublished = getText('yearpublished')
  var thumbnail = getText('thumbnail')
  var image = getText('image')

  // Stats fields use value= attributes
  var minPlayers = parseInt(getVal('stats minplayers')) || 0
  var maxPlayers = parseInt(getVal('stats maxplayers')) || 0
  var minPlaytime = parseInt(getVal('stats minplaytime')) || 0
  var maxPlaytime = parseInt(getVal('stats maxplaytime')) || 0
  var minAge = parseInt(getVal('stats minage')) || 0

  var ratingValue = parseFloat(getAttr('stats ratings average', 'value')) || 0
  var numRatings = parseInt(getAttr('stats ratings usersrated', 'value')) || 0

  var rankEl = item.querySelector('stats ratings ranks rank[name="boardgame"]')
  var bggRankRaw = rankEl ? rankEl.getAttribute('value') : null
  var bggRank = bggRankRaw && bggRankRaw !== 'Not Ranked' ? parseInt(bggRankRaw) : null

  var userRatingRaw = parseFloat(getAttr('stats ratings userrated', 'value'))
  var userRating = !isNaN(userRatingRaw) && userRatingRaw > 0 ? Math.round(userRatingRaw * 10) / 10 : null

  var status = item.querySelector('status')
  var owned = status ? status.getAttribute('own') === '1' : false
  var wishlist = status ? status.getAttribute('wishlist') === '1' : false
  var wantToPlay = status ? status.getAttribute('wanttoplay') === '1' : false
  var prevOwned = status ? status.getAttribute('prevowned') === '1' : false
  var numPlays = parseInt(getText('numplays')) || 0

  function fixUrl(u) {
    if (!u) return null
    if (u.startsWith('//')) return 'https:' + u
    if (u.startsWith('http')) return u
    return null
  }

  return {
    id: id,
    name: name,
    yearPublished: parseInt(yearPublished) || null,
    thumbnail: fixUrl(thumbnail),
    image: fixUrl(image),
    minPlayers: minPlayers,
    maxPlayers: maxPlayers,
    minPlaytime: minPlaytime,
    maxPlaytime: maxPlaytime,
    minAge: minAge,
    rating: Math.round(ratingValue * 10) / 10,
    numRatings: numRatings,
    bggRank: bggRank,
    userRating: userRating,
    owned: owned,
    wishlist: wishlist,
    wantToPlay: wantToPlay,
    prevOwned: prevOwned,
    numPlays: numPlays,
    owners: [username],
    bggUrl: 'https://boardgamegeek.com/boardgame/' + id,
  }
}

// Parse a BGG collection XML string directly (for manual file uploads)
export function parseCollectionXml(xmlText, username) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML file. Make sure you saved the raw XML from the BGG API URL.')
  }

  const errorEl = doc.querySelector('error')
  if (errorEl) {
    const msg = errorEl.querySelector('message') ? errorEl.querySelector('message').textContent : 'Unknown error'
    throw new Error('BGG error in file: ' + msg)
  }

  const messageEl = doc.querySelector('message')
  if (messageEl) {
    throw new Error('This XML file contains a queued/pending message rather than collection data. Open the URL again in a minute and re-save it.\n\nMessage: ' + messageEl.textContent)
  }

  const items = doc.querySelectorAll('item')
  if (items.length === 0) {
    throw new Error('No games found in this XML file. Make sure you are using the correct URL and that the collection is not empty.')
  }

  return Array.from(items).map(function(item) { return parseCollectionItem(item, username) })
}

export function mergeCollections(collectionsMap) {
  var merged = new Map()
  for (var username in collectionsMap) {
    var games = collectionsMap[username]
    for (var i = 0; i < games.length; i++) {
      var game = games[i]
      if (merged.has(game.id)) {
        var existing = merged.get(game.id)
        if (!existing.owners.includes(username)) existing.owners.push(username)
        existing.owned = existing.owned || game.owned
        existing.wishlist = existing.wishlist || game.wishlist
        existing.wantToPlay = existing.wantToPlay || game.wantToPlay
      } else {
        merged.set(game.id, Object.assign({}, game))
      }
    }
  }
  return Array.from(merged.values())
}
