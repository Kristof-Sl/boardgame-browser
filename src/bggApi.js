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

function makePlayerRange(players) {
  if (!players || players.length === 0) return null
  const sorted = players.slice().sort((a, b) => a - b)
  return { min: sorted[0], max: sorted[sorted.length - 1] }
}

function buildPlayerPollRangeMap(resultsByPlayer) {
  const good = []
  const recommended = []
  const best = []

  Object.keys(resultsByPlayer).map(Number).sort((a, b) => a - b).forEach(player => {
    const votes = resultsByPlayer[player]
    if ((votes.recommended || 0) > 0 || (votes.best || 0) > 0) good.push(player)
    if ((votes.recommended || 0) > 0) recommended.push(player)
    if ((votes.best || 0) > 0) best.push(player)
  })

  return {
    good: makePlayerRange(good),
    recommended: makePlayerRange(recommended),
    best: makePlayerRange(best),
  }
}

export function parsePlayerCountPollsFromXmlText(xmlText) {
  const itemRegex = /<item\s+[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g
  const polls = {}

  for (const match of xmlText.matchAll(itemRegex)) {
    const id = match[1]
    const itemXml = match[2]
    const pollRegex = /<poll\s+name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/g
    const pollMatch = itemXml.match(pollRegex)
    if (!pollMatch) continue

    const pollXml = pollMatch.join('')
    const resultsByPlayer = {}
    const resultsRegex = /<results\s+numplayers="(\d+)"[^>]*>([\s\S]*?)<\/results>/g

    for (const resultMatch of pollXml.matchAll(resultsRegex)) {
      const player = parseInt(resultMatch[1], 10)
      if (!player) continue

      const resultXml = resultMatch[2]
      const votes = {}
      const voteRegex = /<result\s+value="([^"]+)"\s+numvotes="(\d+)"\s*\/>/g

      for (const voteMatch of resultXml.matchAll(voteRegex)) {
        const value = voteMatch[1].trim().toLowerCase()
        const numvotes = parseInt(voteMatch[2], 10)
        if (value === 'recommended' || value === 'best' || value === 'not recommended') {
          votes[value] = numvotes
        }
      }

      if (Object.keys(votes).length > 0) {
        resultsByPlayer[player] = votes
      }
    }

    if (Object.keys(resultsByPlayer).length === 0) continue
    polls[id] = buildPlayerPollRangeMap(resultsByPlayer)
  }

  return polls
}

function parsePlayerCountPollsFromDoc(doc) {
  const map = {}
  const items = Array.from(doc.querySelectorAll('item'))

  items.forEach(item => {
    const id = item.getAttribute('id') || item.getAttribute('objectid')
    if (!id) return

    const poll = item.querySelector('poll[name="suggested_numplayers"]')
    if (!poll) return

    const resultsByPlayer = {}
    Array.from(poll.querySelectorAll('results')).forEach(results => {
      const player = parseInt(results.getAttribute('numplayers') || '0', 10)
      if (!player) return

      const votes = {}
      Array.from(results.querySelectorAll('result')).forEach(result => {
        const value = (result.getAttribute('value') || '').trim().toLowerCase()
        const votesValue = parseInt(result.getAttribute('numvotes') || '0', 10)
        if (value === 'recommended' || value === 'best' || value === 'not recommended') {
          votes[value] = votesValue
        }
      })

      if (Object.keys(votes).length > 0) {
        resultsByPlayer[player] = votes
      }
    })

    if (Object.keys(resultsByPlayer).length === 0) return
    map[id] = buildPlayerPollRangeMap(resultsByPlayer)
  })

  return map
}

async function enrichGamesWithPlayerCountPolls(games) {
  if (!games.length) return games

  const ids = Array.from(new Set(games.map(game => String(game.id))))
  const chunks = []
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50))
  }

  for (const chunk of chunks) {
    try {
      const doc = await fetchXML('thing', { id: chunk.join(','), stats: '1', type: 'boardgame' })
      const polls = parsePlayerCountPollsFromDoc(doc)
      games.forEach(game => {
        if (polls[game.id]) {
          game.playerCountPolls = polls[game.id]
        }
      })
    } catch (err) {
      console.warn('Failed to enrich player count polls:', err)
    }
  }

  return games
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

    const games = Array.from(items).map(function(item) { return parseCollectionItem(item, username) })
    return await enrichGamesWithPlayerCountPolls(games)
  }

  throw new Error('Could not load collection for "' + username + '" after several attempts. Try again shortly.')
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
    playerCountPolls: null,
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