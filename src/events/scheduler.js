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

function createLogger(enabled) {
  const entries = []
  return {
    log: (message) => {
      if (!enabled) return
      entries.push(`[${new Date().toISOString()}] ${message}`)
    },
    entries,
  }
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

function getGroupSizeRange(unassignedCount, remainingGroups, minPlayers, maxPlayers) {
  const minTotal = minPlayers * remainingGroups
  const maxTotal = maxPlayers * remainingGroups
  if (unassignedCount < minTotal || unassignedCount > maxTotal) return null
  return {
    minSize: Math.max(minPlayers, unassignedCount - (remainingGroups - 1) * maxPlayers),
    maxSize: Math.min(maxPlayers, unassignedCount - (remainingGroups - 1) * minPlayers),
  }
}

function getGameDuration(game, durationMultiplier) {
  const baseDuration = (game.game_data?.maxPlaytime || 60)
  return Math.ceil(baseDuration * durationMultiplier)
}

function getCapacityBounds(games) {
  const minPlayers = Math.min(...games.map(game => game.game_data?.minPlayers || 2))
  const maxPlayers = Math.max(...games.map(game => game.game_data?.maxPlayers || 6))
  return { minPlayers, maxPlayers }
}

function canCoverWithGroups(totalPlayers, groups, minPlayers, maxPlayers) {
  for (let k = 1; k <= groups; k++) {
    if (totalPlayers >= k * minPlayers && totalPlayers <= k * maxPlayers) return true
  }
  return false
}

export function validateScheduleCoverage(event, participants, games, params) {
  const {
    minPlayersPerGame = 2,
    maxParallelGames = 2,
  } = params

  const allSlots = getSlots(event.start_date, event.end_date)
  const minPlayers = Math.max(minPlayersPerGame, getCapacityBounds(games).minPlayers)
  const maxPlayers = getCapacityBounds(games).maxPlayers
  const participantSlots = {}
  for (const p of participants) {
    participantSlots[p.id] = new Set(getParticipantSlots(p, allSlots).map(s => `${s.date}_${s.part}`))
  }

  const warnings = []
  for (const slot of allSlots) {
    const slotKey = `${slot.date}_${slot.part}`
    const available = participants.filter(p => participantSlots[p.id].has(slotKey))
    const count = available.length
    if (count === 0) continue
    if (count < minPlayers) {
      warnings.push(`Slot ${slot.date} ${slot.part}: only ${count} participant${count === 1 ? '' : 's'} present, below the required ${minPlayers} to run a game.`)
      continue
    }
    if (count > maxParallelGames * maxPlayers) {
      warnings.push(`Slot ${slot.date} ${slot.part}: ${count} participants are present but the event can only support ${maxParallelGames} parallel games with at most ${maxPlayers} players each.`)
      continue
    }
    if (!canCoverWithGroups(count, maxParallelGames, minPlayers, maxPlayers)) {
      warnings.push(`Slot ${slot.date} ${slot.part}: ${count} participants present cannot be split into at most ${maxParallelGames} valid game groups.`)
    }
  }
  return warnings
}

function buildScoredParticipants(unassigned, gameId, prefMap, playerGameCount) {
  return unassigned.map(p => ({
    p,
    gameScore: prefMap[p.id]?.[gameId] === 'really_want' ? 10
      : prefMap[p.id]?.[gameId] === 'want' ? 5
      : prefMap[p.id]?.[gameId] === 'neutral' ? 1
      : prefMap[p.id]?.[gameId] === 'dont_want' ? -8 : 1,
    playsLeast: playerGameCount[p.id] || 0,
  })).sort((a, b) => (b.gameScore - a.gameScore) || (a.playsLeast - b.playsLeast))
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
  const logger = createLogger(params.logSteps)
  logger.log(`Starting schedule generation for event ${event.id} from ${event.start_date} to ${event.end_date}`)

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

  const maxGamePlayers = Math.max(6, ...games.map(game => (game.game_data?.maxPlayers || 6)))
  const schedule = []         // final schedule entries
  const playedGames = {}      // gameId -> times played
  const socialMatrix = {}     // "p1id-p2id" -> interactions count
  const playerGameCount = {}  // participantId -> games played

  for (const p of participants) playerGameCount[p.id] = 0

  // Process each slot
  for (const slot of allSlots) {
    const slotKey = `${slot.date}_${slot.part}`
    const availableNow = participants.filter(p => participantSlots[p.id]?.has(slotKey))
    logger.log(`Processing slot ${slot.date} ${slot.part}: ${availableNow.length} available participants`)
    if (availableNow.length < minPlayersPerGame) {
      logger.log(`Skipping slot ${slot.date} ${slot.part}: fewer than ${minPlayersPerGame} participants available`)
      continue
    }

    const slotGames = []
    let remainingMinutes = minutesPerPart
    const assignedInSlot = new Set()
    const usedGameIds = new Set()

    // Try to fill the slot with games while keeping every present participant assigned
    let iterations = 0
    while (remainingMinutes > 30 && iterations < 20) {
      iterations++

      // Who's still unassigned in this slot?
      const unassigned = availableNow.filter(p => !assignedInSlot.has(p.id))
      if (unassigned.length === 0) break
      if (unassigned.length < minPlayersPerGame) break

      const remainingGroups = maxParallelGames - slotGames.length
      if (!canCoverWithGroups(unassigned.length, remainingGroups, minPlayersPerGame, maxGamePlayers)) break

      const sizeRange = getGroupSizeRange(unassigned.length, remainingGroups, minPlayersPerGame, maxGamePlayers)
      if (!sizeRange) break

      let bestGame = null
      let bestGroup = null
      let bestScore = -Infinity
      let bestDuration = 0

      for (const game of games) {
        if (usedGameIds.has(game.game_id)) continue
        const gameData = game.game_data || {}
        const maxPlayers = gameData.maxPlayers || 6
        const minPlayers = gameData.minPlayers || 2
        const duration = getGameDuration(game, durationMultiplier)

        if (duration > remainingMinutes) continue
        if (unassigned.length < minPlayers) continue

        const groupMin = Math.max(sizeRange.minSize, minPlayers)
        const groupMax = Math.min(sizeRange.maxSize, maxPlayers, unassigned.length)
        if (groupMin > groupMax) continue

        for (let groupSize = groupMax; groupSize >= groupMin; groupSize--) {
          const remainder = unassigned.length - groupSize
          if (remainder > 0 && !canCoverWithGroups(remainder, remainingGroups - 1, minPlayersPerGame, maxGamePlayers)) {
            logger.log(`Skipping group size ${groupSize} for ${game.game_name}: leaves ${remainder} players impossible to cover`)
            continue
          }

          const scored = buildScoredParticipants(unassigned, game.game_id, prefMap, playerGameCount)
          const group = scored.slice(0, groupSize).map(s => s.p)

          const gameScore = scoreGame(game, group, prefMap, playedGames, { prioritizePreferences })
          const social = socialScore(group, socialMatrix) * prioritizeSocial
          const total = gameScore + social

          if (total > bestScore) {
            bestScore = total
            bestGame = game
            bestGroup = group
            bestDuration = duration
            logger.log(`Candidate best: ${game.game_name} with ${groupSize} players, score ${total}`)
          }
        }
      }

      if (!bestGame || !bestGroup) {
        logger.log(`No feasible game could be assigned for slot ${slot.date} ${slot.part}`)
        break
      }

      // Commit this game to the slot
      const bestGameData = bestGame.game_data || {}
      slotGames.push({
        date: slot.date,
        part: slot.part,
        gameId: bestGame.game_id,
        gameName: bestGame.game_name,
        gameDuration: bestDuration,
        players: bestGroup.map(p => ({ id: p.id, name: p.name })),
        thumbnail: bestGameData.thumbnail || null,
        rating: bestGameData.rating || null,
      })
      usedGameIds.add(bestGame.game_id)
      logger.log(`Assigned ${bestGroup.map(p => p.name).join(', ')} to ${bestGame.game_name} for ${slot.date} ${slot.part}`)

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

      remainingMinutes -= bestDuration

      // Stop if we've hit max parallel games
      if (slotGames.length >= maxParallelGames) break
    }

    schedule.push(...slotGames)
  }

  logger.log(`Schedule generation complete: ${schedule.length} game sessions scheduled`)
  if (params.logSteps) return { schedule, log: logger.entries }
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
