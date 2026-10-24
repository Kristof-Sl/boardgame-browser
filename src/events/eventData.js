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