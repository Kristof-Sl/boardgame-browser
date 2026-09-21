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

function parseThingItem(item) {
  function getText(selector) {
    var el = item.querySelector(selector)
    return el ? el.textContent.trim() : ''
  }

  function getAttr(el, attr) {
    return el ? (el.getAttribute(attr) || '') : ''
  }

  var id = item.getAttribute('id')
  var names = Array.from(item.querySelectorAll('name[type="primary"]'))
  var primaryName = names[0] ? getAttr(names[0], 'value') : getText('name')
  var stats = item.querySelector('statistics ratings')
  var rating = stats ? parseFloat(getAttr(stats.querySelector('average'), 'value')) || 0 : 0
  var averageWeight = stats ? parseFloat(getAttr(stats.querySelector('averageweight'), 'value')) || 0 : 0
  var themes = Array.from(item.querySelectorAll('link[type="boardgamecategory"]')).map(function(link) { return getAttr(link, 'value') }).filter(Boolean)
  var mechanics = Array.from(item.querySelectorAll('link[type="boardgamemechanic"]')).map(function(link) { return getAttr(link, 'value') }).filter(Boolean)
  var rank = stats ? stats.querySelector('ranks rank[name="boardgame"]') : null
  var suggested = { best: [], recommended: [], notRecommended: [] }
  var poll = item.querySelector('poll[name="suggested_numplayers"]')

  if (poll) {
    Array.from(poll.querySelectorAll('results')).forEach(function(results) {
      var players = getAttr(results, 'numplayers')
      if (!players) return

      var counts = {}
      Array.from(results.querySelectorAll('result')).forEach(function(result) {
        counts[getAttr(result, 'value').toLowerCase().replace(/\s+/g, '')] = parseInt(getAttr(result, 'numvotes')) || 0
      })

      var entry = {
        players: players,
        bestVotes: counts.best || 0,
        recommendedVotes: counts.recommended || 0,
        notRecommendedVotes: counts.notrecommended || 0,
      }
      if (entry.bestVotes > entry.recommendedVotes && entry.bestVotes > entry.notRecommendedVotes) {
        suggested.best.push(entry)
      }
      if (entry.recommendedVotes > entry.bestVotes && entry.recommendedVotes > entry.notRecommendedVotes) {
        suggested.recommended.push(entry)
      }
      if (entry.notRecommendedVotes > entry.bestVotes && entry.notRecommendedVotes > entry.recommendedVotes) {
        suggested.notRecommended.push(entry)
      }
    })
  }

  return {
    id: id,
    name: primaryName,
    yearPublished: parseInt(getText('yearpublished')) || null,
    description: getText('description'),
    thumbnail: getText('thumbnail') || null,
    image: getText('image') || null,
    minPlayers: parseInt(getText('minplayers')) || 0,
    maxPlayers: parseInt(getText('maxplayers')) || 0,
    minPlaytime: parseInt(getText('minplaytime')) || 0,
    maxPlaytime: parseInt(getText('maxplaytime')) || 0,
    minAge: parseInt(getText('minage')) || 0,
    rating: Math.round(rating * 10) / 10,
    averageweight: averageWeight,
    themes: themes,
    mechanics: mechanics,
    theme: themes[0] || 'Unknown',
    mechanic: mechanics[0] || 'Unknown',
    bggRank: rank && getAttr(rank, 'value') !== 'Not Ranked' ? parseInt(getAttr(rank, 'value')) : null,
    suggestedPlayerCounts: suggested,
    bggUrl: 'https://boardgamegeek.com/boardgame/' + id,
  }
}

export async function fetchGameDetails(gameIds) {
  var uniqueIds = Array.from(new Set(gameIds.map(String).filter(Boolean)))
  var details = []
  var batchSize = 20

  for (var start = 0; start < uniqueIds.length; start += batchSize) {
    var batch = uniqueIds.slice(start, start + batchSize)
    var doc = await fetchXML('thing', { id: batch.join(','), stats: '1' })
    var errorEl = doc.querySelector('error')
    if (errorEl) {
      var message = errorEl.querySelector('message')
      throw new Error(message ? message.textContent.trim() : 'BGG returned an error while loading game details.')
    }
    details = details.concat(Array.from(doc.querySelectorAll('item')).map(parseThingItem))
  }

  return details
}

function parseCollectionItem(item, username) {

  function getAttrFrom(el, attr) {
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

  var stats = item.querySelector('stats')
  var rating = stats ? stats.querySelector('rating') : null

  // ✅ Correct: attributes on <stats>
  var minPlayers = parseInt(getAttrFrom(stats, 'minplayers')) || 0
  var maxPlayers = parseInt(getAttrFrom(stats, 'maxplayers')) || 0
  var minPlaytime = parseInt(getAttrFrom(stats, 'minplaytime')) || 0
  var maxPlaytime = parseInt(getAttrFrom(stats, 'maxplaytime')) || 0
  var minAge = parseInt(getAttrFrom(stats, 'minage')) || 0

  // ✅ Correct: inside <rating>
  var ratingValue = parseFloat(getAttrFrom(rating?.querySelector('average'), 'value')) || 0
  var averageWeight = parseFloat(getAttrFrom(rating?.querySelector('averageweight'), 'value')) || 0
  var numRatings = parseInt(getAttrFrom(rating?.querySelector('usersrated'), 'value')) || 0

  // ✅ Rank
  var rankEl = item.querySelector('stats rating ranks rank[name="boardgame"]')
  var bggRankRaw = rankEl ? rankEl.getAttribute('value') : null
  var bggRank = bggRankRaw && bggRankRaw !== 'Not Ranked' ? parseInt(bggRankRaw) : null

  // ✅ Your rating (value attribute on <rating>)
  var userRatingRaw = parseFloat(getAttrFrom(rating, 'value'))
  var userRating = !isNaN(userRatingRaw) && userRatingRaw > 0
    ? Math.round(userRatingRaw * 10) / 10
    : null

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
    averageweight: averageWeight,
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
        // Track per-user status details
        existing.ownerStatuses[username] = {
          owned: game.owned,
          wishlist: game.wishlist,
          wantToPlay: game.wantToPlay,
          prevOwned: game.prevOwned,
          numPlays: game.numPlays,
          userRating: game.userRating,
        }
        if (!existing.owners.includes(username)) existing.owners.push(username)
        if (game.owned && !existing.actualOwners.includes(username)) existing.actualOwners.push(username)
        // Aggregate flags for filter compatibility
        existing.owned = existing.owned || game.owned
        existing.wishlist = existing.wishlist || game.wishlist
        existing.wantToPlay = existing.wantToPlay || game.wantToPlay
        existing.prevOwned = existing.prevOwned || game.prevOwned
      } else {
        var entry = Object.assign({}, game)
        entry.ownerStatuses = {}
        entry.ownerStatuses[username] = {
          owned: game.owned,
          wishlist: game.wishlist,
          wantToPlay: game.wantToPlay,
          prevOwned: game.prevOwned,
          numPlays: game.numPlays,
          userRating: game.userRating,
        }
        entry.actualOwners = game.owned ? [username] : []
        merged.set(game.id, entry)
      }
    }
  }
  return Array.from(merged.values())
}

export function parseCombinedXml(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML file.')
  }

  const items = doc.querySelectorAll('item')
  if (items.length === 0) {
    throw new Error('No games found in this combined XML file.')
  }

  const gamesByOwner = {}

  Array.from(items).forEach(item => {
    // Read the custom <owners> block generated by the Python script
    const ownerEls = item.querySelectorAll('owners owner')
    const owners = Array.from(ownerEls).map(el => el.textContent.trim())

    if (owners.length === 0) return

    // Parse the game's rich stats (images, playtime, etc.) using the existing parser
    const gameObj = parseCollectionItem(item, owners[0])

    // Distribute the parsed game into each owner's separate array
    owners.forEach(owner => {
      if (!gamesByOwner[owner]) gamesByOwner[owner] = []
      // We pass only this owner so the App merges them smoothly later
      gamesByOwner[owner].push({ ...gameObj, owners: [owner] })
    })
  })

  return gamesByOwner
}