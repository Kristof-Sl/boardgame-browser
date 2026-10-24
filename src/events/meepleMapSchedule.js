import { compactSchedule } from './eventData.js'

function normalizePlayerName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function similarity(left, right) {
  if (!left || !right) return 0
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = previous[0]
    previous[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const above = previous[rightIndex]
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      )
      diagonal = above
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length)
}

export function getMeepleMapPlayerNames(payload) {
  if (!Array.isArray(payload?.schedule)) throw new Error('MeepleMap JSON must contain a schedule array.')
  const names = new Set()
  payload.schedule.forEach((slot, index) => {
    if (!Array.isArray(slot?.players)) throw new Error(`MeepleMap schedule item ${index + 1} needs a players array.`)
    slot.players.forEach(player => {
      if (typeof player !== 'string' || !player.trim()) throw new Error(`MeepleMap schedule item ${index + 1} contains an invalid player name.`)
      names.add(player.trim())
    })
  })
  return [...names]
}

export function suggestMeepleMapPlayerLinks(names, participants) {
  return Object.fromEntries(names.map(name => {
    const normalizedName = normalizePlayerName(name)
    const ranked = participants
      .map(participant => ({ participant, score: similarity(normalizedName, normalizePlayerName(participant.name)) }))
      .sort((left, right) => right.score - left.score)
    const best = ranked[0]
    const next = ranked[1]
    const confident = best && best.score >= 0.72 && (!next || best.score > next.score)
    return [name, confident ? String(best.participant.id) : '']
  }))
}

export function convertMeepleMapSchedule(payload, playerLinks, eventGames, participants) {
  const playerNames = getMeepleMapPlayerNames(payload)
  const gameById = new Map(eventGames.map(game => [String(game.game_id ?? game.id), game]))
  const participantIds = new Set(participants.map(participant => String(participant.id)))

  const converted = payload.schedule.map((slot, index) => {
    if (!slot.date || typeof slot.slot !== 'string' || !slot.game?.id) {
      throw new Error(`MeepleMap schedule item ${index + 1} needs date, slot, and game.id.`)
    }
    const part = slot.slot.trim().toLowerCase()
    if (!['morning', 'afternoon', 'evening'].includes(part)) {
      throw new Error(`MeepleMap schedule item ${index + 1} has an unsupported slot: ${slot.slot}.`)
    }

    const gameId = String(slot.game.id)
    const game = gameById.get(gameId)
    if (!game) throw new Error(`Game ${gameId} is not selected for this event.`)

    const playerIds = (slot.players || []).map(name => {
      const participantId = String(playerLinks[name] || '')
      if (!participantIds.has(participantId)) throw new Error(`Link "${name}" to an event participant before importing.`)
      return participantId
    })

    return {
      date: slot.date,
      part,
      gameId,
      gameDuration: Number(game.game_data?.maxPlaytime) || 90,
      players: playerIds,
    }
  })

  return compactSchedule(converted)
}