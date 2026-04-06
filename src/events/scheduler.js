// Schedule optimizer
// Generates a balanced schedule for a board game event

const PART_ORDER = { morning: 0, afternoon: 1, evening: 2 }
const PARTS = ['morning', 'afternoon', 'evening']

// Get all time slots (day + part) between two dates/parts
export function getSlots(startDate, endDate) {
  const slots = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const cur = new Date(start)
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0]
    for (const part of PARTS) {
      slots.push({ date: dateStr, part })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return slots
}

// Which slots is a participant available for?
export function getParticipantSlots(participant, allSlots) {
  return allSlots.filter(slot => {
    const arriveDate = participant.arrive_date || allSlots[0]?.date
    const departDate = participant.depart_date || allSlots[allSlots.length - 1]?.date
    const arrivePart = participant.arrive_part || 'morning'
    const departPart = participant.depart_part || 'evening'

    if (slot.date < arriveDate || slot.date > departDate) return false
    if (slot.date === arriveDate && PART_ORDER[slot.part] < PART_ORDER[arrivePart]) return false
    if (slot.date === departDate && PART_ORDER[slot.part] > PART_ORDER[departPart]) return false
    return true
  })
}

// Score a game for a group of participants given their preferences
function scoreGame(game, participants, preferences, playedGames, params) {
  let score = 0
  const gameId = game.game_id

  // Preference scores
  for (const p of participants) {
    const pref = preferences[p.id]?.[gameId]
    if (pref === 'really_want') score += 10
    else if (pref === 'want') score += 5
    else if (pref === 'neutral') score += 1
    else if (pref === 'dont_want') score -= 8
  }

  // Penalize replaying a game
  const timesPlayed = playedGames[gameId] || 0
  if (timesPlayed > 0) score -= 20 * timesPlayed

  // Weight by params
  score *= (params.prioritizePreferences || 1)
  return score
}

// Score social diversity: how many unique pairings does this group create?
function socialScore(group, socialMatrix) {
  let score = 0
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const key = [group[i].id, group[j].id].sort().join('-')
      const interactions = socialMatrix[key] || 0
      score += Math.max(0, 3 - interactions) // diminishing returns for repeated pairs
    }
  }
  return score
}

export function generateSchedule(event, participants, games, preferences, params) {
  const {
    hoursPerPart = 3,          // hours available per morning/afternoon/evening block
    durationMultiplier = 1.5,  // multiply BGG duration by this (experience factor)
    prioritizePreferences = 1, // 0-2 weight
    prioritizeSocial = 1,      // 0-2 weight
    minPlayersPerGame = 2,
    maxParallelGames = 2,
  } = params

  const minutesPerPart = hoursPerPart * 60
  const allSlots = getSlots(event.start_date, event.end_date)

  // Map: participantId -> Set of slot keys they're available
  const participantSlots = {}
  for (const p of participants) {
    const slots = getParticipantSlots(p, allSlots)
    participantSlots[p.id] = new Set(slots.map(s => `${s.date}_${s.part}`))
  }

  // Preference map: participantId -> gameId -> preference
  const prefMap = {}
  for (const [pid, gamePrefs] of Object.entries(preferences)) {
    prefMap[pid] = gamePrefs
  }

  const schedule = []         // final schedule entries
  const playedGames = {}      // gameId -> times played
  const socialMatrix = {}     // "p1id-p2id" -> interactions count
  const playerGameCount = {}  // participantId -> games played

  for (const p of participants) playerGameCount[p.id] = 0

  // Process each slot
  for (const slot of allSlots) {
    const slotKey = `${slot.date}_${slot.part}`
    const availableNow = participants.filter(p => participantSlots[p.id]?.has(slotKey))
    if (availableNow.length < minPlayersPerGame) continue

    const slotGames = []
    let remainingMinutes = minutesPerPart
    const assignedInSlot = new Set()

    // Try to fill the slot with games
    let iterations = 0
    while (remainingMinutes > 30 && iterations < 20) {
      iterations++

      // Who's still unassigned in this slot?
      const unassigned = availableNow.filter(p => !assignedInSlot.has(p.id))
      if (unassigned.length < minPlayersPerGame) break

      // Try each game, pick the best scoring one that fits
      let bestGame = null
      let bestGroup = null
      let bestScore = -Infinity

      for (const game of games) {
        const gameData = game.game_data || {}
        const maxPlayers = gameData.maxPlayers || 6
        const minPlayers = gameData.minPlayers || 2
        const baseDuration = gameData.maxPlaytime || 60
        const duration = Math.ceil(baseDuration * durationMultiplier)

        if (duration > remainingMinutes) continue
        if (unassigned.length < minPlayers) continue

        // Build optimal group for this game
        const groupSize = Math.min(maxPlayers, unassigned.length)
        if (groupSize < minPlayers) continue

        // Score each participant for this game
        const scored = unassigned.map(p => ({
          p,
          gameScore: (prefMap[p.id]?.[game.game_id] === 'really_want' ? 10
            : prefMap[p.id]?.[game.game_id] === 'want' ? 5
            : prefMap[p.id]?.[game.game_id] === 'neutral' ? 1
            : prefMap[p.id]?.[game.game_id] === 'dont_want' ? -8 : 1),
          playsLeast: playerGameCount[p.id] || 0,
        }))

        // Sort: prefer those who want the game and have played least
        scored.sort((a, b) => (b.gameScore - a.gameScore) || (a.playsLeast - b.playsLeast))
        const group = scored.slice(0, groupSize).map(s => s.p)

        const gameScore = scoreGame(game, group, prefMap, playedGames, { prioritizePreferences })
        const social = socialScore(group.map(p => p), socialMatrix) * prioritizeSocial
        const total = gameScore + social

        if (total > bestScore) {
          bestScore = total
          bestGame = game
          bestGroup = group
        }
      }

      if (!bestGame || !bestGroup) break

      // Commit this game to the slot
      const gameData = bestGame.game_data || {}
      const duration = Math.ceil((gameData.maxPlaytime || 60) * durationMultiplier)

      slotGames.push({
        date: slot.date,
        part: slot.part,
        gameId: bestGame.game_id,
        gameName: bestGame.game_name,
        gameDuration: duration,
        players: bestGroup.map(p => ({ id: p.id, name: p.name })),
        thumbnail: gameData.thumbnail || null,
        rating: gameData.rating || null,
      })

      // Update tracking
      playedGames[bestGame.game_id] = (playedGames[bestGame.game_id] || 0) + 1
      for (const p of bestGroup) {
        assignedInSlot.add(p.id)
        playerGameCount[p.id] = (playerGameCount[p.id] || 0) + 1
        for (const p2 of bestGroup) {
          if (p.id !== p2.id) {
            const key = [p.id, p2.id].sort().join('-')
            socialMatrix[key] = (socialMatrix[key] || 0) + 1
          }
        }
      }

      remainingMinutes -= duration

      // Stop if we've hit max parallel games
      if (slotGames.length >= maxParallelGames) break
    }

    schedule.push(...slotGames)
  }

  return schedule
}

// Compute stats about the generated schedule
export function scheduleStats(schedule, participants, preferences) {
  const stats = {
    totalGames: schedule.length,
    uniqueGames: new Set(schedule.map(s => s.gameId)).size,
    playerStats: {},
    satisfactionScore: 0,
  }

  for (const p of participants) {
    const mySlots = schedule.filter(s => s.players.some(pl => pl.id === p.id))
    const prefs = preferences[p.id] || {}

    let prefScore = 0
    for (const slot of mySlots) {
      const pref = prefs[slot.gameId]
      if (pref === 'really_want') prefScore += 2
      else if (pref === 'want') prefScore += 1
      else if (pref === 'dont_want') prefScore -= 2
    }

    stats.playerStats[p.id] = {
      name: p.name,
      gamesPlayed: mySlots.length,
      preferenceScore: prefScore,
    }
    stats.satisfactionScore += prefScore
  }

  return stats
}
