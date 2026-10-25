import { db } from './events/supabase'
import { fetchCollection, fetchGameDetails } from './bggApi'

export async function loadDatabaseSnapshot() {
  const [accountRows, libraryRows] = await Promise.all([
    db.select('game_collection', { order: 'username.asc' }),
    db.selectAll('game_library'),
  ])

  const collections = {}
  const accounts = accountRows.map(row => {
    const games = (row.games || []).map(game => ({
      ...game,
      ...game.ownerStatuses?.[row.username],
      owners: [row.username],
      actualOwners: game.ownerStatuses?.[row.username]?.owned ? [row.username] : [],
      ownerStatuses: game.ownerStatuses?.[row.username]
        ? { [row.username]: game.ownerStatuses[row.username] }
        : game.ownerStatuses || {},
    }))
    collections[row.username] = games
    return {
      username: row.username,
      count: games.length,
      loading: false,
      error: null,
      source: 'database',
    }
  })

  const gameDetails = Object.fromEntries(
    libraryRows.map(row => [String(row.game_id), row.game_data || {}])
  )

  return { accounts, collections, gameDetails }
}

export async function saveGameLibrary(games) {
  const rows = games.filter(game => game?.id != null).map(game => ({
    game_id: String(game.id),
    game_data: game,
    updated_at: new Date().toISOString(),
  }))
  for (let start = 0; start < rows.length; start += 50) {
    await db.upsert('game_library', rows.slice(start, start + 50), 'game_id')
  }
}

export async function refreshDatabaseCollections() {
  const accountRows = await db.select('game_collection', { order: 'username.asc' })
  await Promise.all(accountRows.map(async account => {
    const games = await fetchCollection(account.username)
    await db.update('game_collection', {
      games,
      updated_at: new Date().toISOString(),
    }, `username=eq.${encodeURIComponent(account.username)}`)
  }))
  return loadDatabaseSnapshot()
}

export async function updateGameLibrary(gameIds, onProgress) {
  const games = await fetchGameDetails(gameIds, onProgress)
  await saveGameLibrary(games)
  return games
}

export async function loadEventGames(eventId, localCollection = []) {
  const [rows, votes] = await Promise.all([
    db.select('event_games', { filter: `event_id=eq.${encodeURIComponent(eventId)}` }),
    db.select('game_votes', { filter: `event_id=eq.${encodeURIComponent(eventId)}` }),
  ])
  const ids = rows.map(row => String(row.game_id))
  const libraryRows = ids.length
    ? await db.select('game_library', { filter: `game_id=in.(${ids.join(',')})` })
    : []
  const libraryById = Object.fromEntries(libraryRows.map(row => [String(row.game_id), row.game_data || {}]))
  const localById = Object.fromEntries((localCollection || []).map(game => [String(game.id), game]))
  const voteById = Object.fromEntries(votes.map(vote => [String(vote.game_id), vote]))

  return rows.map(row => {
    const id = String(row.game_id)
    const localGame = localById[id] || {}
    const vote = voteById[id]
    const details = libraryById[id] || localGame.details || vote?.game_data || {}
    const game = { ...details, ...localGame, id, name: libraryById[id]?.name || localGame.name || vote?.game_name || id, details }
    return { ...row, game_name: game.name, game_data: game }
  })
}

export async function loadEventCollection(gameIds, localCollection = []) {
  const ids = (gameIds || []).map(entry => String(typeof entry === 'object' ? entry.id : entry)).filter(Boolean)
  const libraryRows = ids.length
    ? await db.select('game_library', { filter: `game_id=in.(${ids.join(',')})` })
    : []
  const libraryById = Object.fromEntries(libraryRows.map(row => [String(row.game_id), row.game_data || {}]))
  const localById = Object.fromEntries((localCollection || []).map(game => [String(game.id), game]))

  return ids.map(id => {
    const libraryGame = libraryById[id] || {}
    const localGame = localById[id] || {}
    return { ...localGame, ...libraryGame, id, details: libraryGame }
  })
}