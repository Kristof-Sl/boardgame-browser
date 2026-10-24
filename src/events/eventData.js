export function compactSchedule(schedule) {
  return (schedule || []).map(slot => ({
    date: slot.date,
    part: slot.part,
    gameId: String(slot.gameId),
    gameDuration: Number(slot.gameDuration) || 90,
    players: (slot.players || slot.playerIds || [])
      .map(player => String(typeof player === 'object' ? player.id : player))
      .filter(Boolean),
  }))
}

export function createScheduleExport(eventId, schedule) {
  return {
    format: 'boardgame-browser-event-schedule',
    version: 1,
    eventId,
    schedule: compactSchedule(schedule),
  }
}

export function validateImportedSchedule(payload, eventId, games, participants) {
  const schedule = Array.isArray(payload) ? payload : payload?.schedule
  if (!Array.isArray(schedule)) throw new Error('The file must contain a schedule array.')
  if (payload?.eventId && payload.eventId !== eventId) {
    throw new Error(`This schedule belongs to event ${payload.eventId}, not ${eventId}.`)
  }

  const gameIds = new Set((games || []).map(game => String(game.game_id ?? game.id)))
  const participantIds = new Set((participants || []).map(participant => String(participant.id)))
  schedule.forEach((slot, index) => {
    if (!slot || !slot.date || !slot.part || slot.gameId == null || slot.gameId === '') {
      throw new Error(`Schedule slot ${index + 1} needs date, part, and gameId.`)
    }
    if (!['morning', 'afternoon', 'evening'].includes(slot.part)) {
      throw new Error(`Schedule slot ${index + 1} has an invalid part.`)
    }
    if (!gameIds.has(String(slot.gameId))) {
      throw new Error(`Schedule slot ${index + 1} references a game that is not selected for this event.`)
    }
    if (!Array.isArray(slot.players)) throw new Error(`Schedule slot ${index + 1} needs a players array.`)
    for (const player of slot.players) {
      const participantId = player && typeof player === 'object' ? player.id : player
      if (participantId == null || !participantIds.has(String(participantId))) {
        throw new Error(`Schedule slot ${index + 1} references a participant who is not in this event.`)
      }
    }
  })

  return compactSchedule(schedule)
}

export function expandSchedule(schedule, games, participants) {
  const gameById = new Map((games || []).map(game => [String(game.game_id ?? game.id), game]))
  const participantById = new Map((participants || []).map(participant => [String(participant.id), participant]))

  return (schedule || []).map(slot => {
    const game = gameById.get(String(slot.gameId)) || {}
    return {
      ...slot,
      gameName: game.game_name || game.name || String(slot.gameId),
      thumbnail: game.game_data?.thumbnail || game.thumbnail || null,
      players: (slot.players || []).map(player => {
        if (typeof player === 'object') return player
        const participant = participantById.get(String(player))
        return participant ? { id: participant.id, name: participant.name } : { id: String(player), name: 'Participant' }
      }),
    }
  })
}