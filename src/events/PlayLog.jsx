import React, { useState, useEffect, useMemo } from 'react'
import { db, isConfigured } from './supabase'

const DEFAULT_PLAYER_NAMES = [
  'Fre', 'Geert', 'Jan', 'Jelle', 'Kristof', 'Mark', 'Tom', 'Robby'
]
const STORAGE_KEY = 'bgg-browser-playlogs'

function loadPlayLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function savePlayLogs(logs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  } catch {}
}

function createId() {
  return 'log_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

function parseDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

export default function PlayLog({ allGames, showToast }) {
  const [playLogs, setPlayLogs] = useState([])
  const [events, setEvents] = useState([])
  const [view, setView] = useState('logs')
  const [editing, setEditing] = useState(null)
  const [filterEventId, setFilterEventId] = useState('')
  const [draft, setDraft] = useState(createEmptyDraft())
  const [playerName, setPlayerName] = useState('Fre')
  const [playerScore, setPlayerScore] = useState('')
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPlayLogs(loadPlayLogs())
  }, [])

  useEffect(() => {
    savePlayLogs(playLogs)
  }, [playLogs])

  useEffect(() => {
    if (!isConfigured()) return
    setLoadingEvents(true)
    db.select('events', { order: 'start_date.desc' })
      .then(setEvents)
      .catch(err => console.warn('Failed to load events:', err))
      .finally(() => setLoadingEvents(false))
  }, [])

  const eventOptions = useMemo(() => [
    { value: '', label: 'No event' },
    ...events.map(e => ({ value: e.id, label: `${e.name} (${formatDate(e.start_date)})` }))
  ], [events])

  const filteredLogs = useMemo(() => {
    return filterEventId ? playLogs.filter(log => log.event_id === filterEventId) : playLogs
  }, [playLogs, filterEventId])

  const ranking = useMemo(() => {
    const counts = {}
    filteredLogs.forEach(log => {
      const topScore = Math.max(...log.players.map(p => Number(p.score) || 0))
      log.players.forEach(player => {
        const name = player.name.trim()
        if (!name) return
        if (!counts[name]) {
          counts[name] = { name, plays: 0, wins: 0, totalScore: 0 }
        }
        counts[name].plays += 1
        counts[name].totalScore += Number(player.score) || 0
        if (Number(player.score) === topScore) counts[name].wins += 1
      })
    })
    return Object.values(counts).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.plays !== a.plays) return b.plays - a.plays
      return b.totalScore - a.totalScore
    })
  }, [filteredLogs])

  const resetDraft = () => {
    setDraft(createEmptyDraft())
    setPlayerName('Fre')
    setPlayerScore('')
    setEditing(null)
  }

  function createEmptyDraft() {
    return {
      id: null,
      game_id: allGames[0]?.id || '',
      game_name: allGames[0]?.name || '',
      played_at: formatDate(new Date()),
      duration_minutes: 60,
      event_id: '',
      players: [],
    }
  }

  useEffect(() => {
    if (!editing) return
    setDraft({
      id: editing.id,
      game_id: editing.game_id,
      game_name: editing.game_name,
      played_at: formatDate(editing.played_at),
      duration_minutes: editing.duration_minutes,
      event_id: editing.event_id || '',
      players: editing.players.map(p => ({ name: p.name, score: p.score })),
    })
  }, [editing])

  const selectedGame = allGames.find(g => g.id === draft.game_id)
  const gameLabel = selectedGame ? `${selectedGame.name} (${selectedGame.yearPublished || 'n/a'})` : draft.game_name

  const addPlayer = () => {
    const trimmedName = playerName.trim()
    const score = Number(playerScore)
    if (!trimmedName || Number.isNaN(score)) {
      showToast('Enter a player name and score', 'err')
      return
    }
    setDraft(prev => ({
      ...prev,
      players: [...prev.players, { name: trimmedName, score }]
    }))
    setPlayerScore('')
  }

  const removePlayer = index => {
    setDraft(prev => ({
      ...prev,
      players: prev.players.filter((_, idx) => idx !== index)
    }))
  }

  const saveLog = async () => {
    if (!draft.game_id || draft.players.length === 0) {
      showToast('Select a game and add at least one player', 'err')
      return
    }
    setSaving(true)
    const game = allGames.find(g => g.id === draft.game_id)
    const players = [...draft.players].map(p => ({ name: p.name.trim(), score: Number(p.score) }))
    const topScore = Math.max(...players.map(p => p.score))
    const playersWithRank = players.map(p => ({
      ...p,
      winner: p.score === topScore && topScore !== -Infinity
    }))
    const savedLog = {
      id: draft.id || createId(),
      game_id: draft.game_id,
      game_name: game ? game.name : draft.game_name,
      game_data: game || {},
      played_at: draft.played_at,
      duration_minutes: Number(draft.duration_minutes) || 0,
      event_id: draft.event_id || '',
      players: playersWithRank,
      updated_at: new Date().toISOString(),
    }

    const next = playLogs.slice()
    const idx = next.findIndex(log => log.id === savedLog.id)
    if (idx >= 0) next[idx] = savedLog
    else next.unshift(savedLog)
    setPlayLogs(next)
    resetDraft()
    setView('logs')
    showToast(editing ? 'Play log updated' : 'Play logged', 'ok')

    if (isConfigured()) {
      try {
        await db.upsert('play_logs', savedLog, 'id')
      } catch (err) {
        console.warn('Failed to save play log to Supabase:', err)
      }
    }
    setSaving(false)
  }

  const editLog = log => {
    setEditing(log)
    setView('logs')
  }

  const deleteLog = async log => {
    if (!window.confirm('Delete this logged play?')) return
    setPlayLogs(prev => prev.filter(item => item.id !== log.id))
    if (isConfigured()) {
      try {
        await db.delete('play_logs', `id=eq.${log.id}`)
      } catch (err) {
        console.warn('Failed to delete play log from Supabase:', err)
      }
    }
    showToast('Play log deleted', 'ok')
  }

  const saveDraftField = (field, value) => setDraft(prev => ({ ...prev, [field]: value }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['logs', 'rankings'].map(item => (
          <button key={item}
            onClick={() => setView(item)}
            style={{
              padding: '8px 14px', borderRadius: 999,
              border: `1px solid ${view === item ? 'var(--accent)' : 'var(--border)'}`,
              background: view === item ? 'var(--accent-bg)' : 'transparent',
              color: view === item ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer', fontWeight: view === item ? 600 : 500,
            }}
          >
            {item === 'logs' ? 'Play logs' : 'Rankings'}
          </button>
        ))}
      </div>

      {view === 'logs' && (
        <>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Log a play</h2>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text3)' }}>
                    Pick the game, players, score and link it to an event.
                  </p>
                </div>
                {editing && (
                  <button onClick={resetDraft} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>
                    Cancel edit
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Game</label>
                  <select value={draft.game_id} onChange={e => {
                    const selection = allGames.find(g => g.id === e.target.value)
                    saveDraftField('game_id', e.target.value)
                    saveDraftField('game_name', selection ? selection.name : '')
                  }} style={{ width: '100%', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)' }}>
                    {allGames.map(game => (
                      <option key={game.id} value={game.id}>{game.name}{game.yearPublished ? ` (${game.yearPublished})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', minWidth: 0 }}>
                  <Input label="Played date" type="date" value={draft.played_at} onChange={value => saveDraftField('played_at', value)} />
                  <Input label="Duration (min)" type="number" value={draft.duration_minutes} onChange={value => saveDraftField('duration_minutes', Number(value))} />
                </div>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ display: 'grid', gap: 5 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event (optional)</label>
                    <select value={draft.event_id} onChange={e => saveDraftField('event_id', e.target.value)} style={{ borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)' }}>
                      {eventOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {!isConfigured() && <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)' }}>Connect Supabase to choose from scheduled events.</p>}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10, padding: 14, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                    <div style={{ display: 'grid', gap: 5 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Player name</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
                        <select value={playerName} onChange={e => setPlayerName(e.target.value)} style={{ borderRadius: '10px 0 0 10px', padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 14 }}>
                          <option value="">— Choose a player —</option>
                          {DEFAULT_PLAYER_NAMES.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={playerName}
                          onChange={e => setPlayerName(e.target.value)}
                          placeholder="or type"
                          style={{
                            borderRadius: '0 10px 10px 0', padding: '10px 12px', marginLeft: -1,
                            border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)',
                            fontSize: 14, outline: 'none', minWidth: 0, flex: 0.6,
                          }}
                        />
                      </div>
                    </div>
                    <Input label="Score" type="number" value={playerScore} onChange={setPlayerScore} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={addPlayer} style={{ flex: '1 1 auto', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: 'pointer' }}>Add player</button>
                    <button onClick={() => setPlayerName('')} style={{ flex: '1 1 auto', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>Clear</button>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)' }}>Choose a default name or type a custom one.</p>
                </div>

                {draft.players.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>Players</p>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {draft.players.map((player, index) => (
                        <div key={`${player.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{player.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Score: {player.score}</div>
                          </div>
                          <button onClick={() => removePlayer(index)} style={{ border: 'none', background: 'transparent', color: 'var(--red)', cursor: 'pointer' }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={saveLog} disabled={saving} style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                    {editing ? 'Save changes' : 'Log play'}
                  </button>
                  <button onClick={resetDraft} type="button" style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {filteredLogs.length === 0 ? (
                <div style={{ padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                  <p style={{ margin: 0, color: 'var(--text3)' }}>No play logs yet. Use the form above to add your first logged play.</p>
                </div>
              ) : filteredLogs.map(log => (
                <LogCard key={log.id} log={log} onEdit={() => editLog(log)} onDelete={() => deleteLog(log)} events={events} />
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'rankings' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Filter by event</label>
              <select value={filterEventId} onChange={e => setFilterEventId(e.target.value)} style={{ width: '100%', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)' }}>
                {eventOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Logged plays</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{filteredLogs.length}</div>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.8fr', gap: 0, padding: '12px 18px', background: 'var(--bg3)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)' }}>
              <span>Player</span>
              <span style={{ textAlign: 'right' }}>Wins</span>
              <span style={{ textAlign: 'right' }}>Plays</span>
              <span style={{ textAlign: 'right' }}>Score</span>
            </div>
            {ranking.length === 0 ? (
              <div style={{ padding: 18, color: 'var(--text3)' }}>No ranked plays available yet.</div>
            ) : ranking.map((player, index) => (
              <div key={player.name} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.8fr', gap: 0, alignItems: 'center', padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  {index === 0 ? '👑' : null} {player.name}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text)' }}>{player.wins}</span>
                <span style={{ textAlign: 'right', color: 'var(--text)' }}>{player.plays}</span>
                <span style={{ textAlign: 'right', color: 'var(--text)' }}>{player.totalScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', borderRadius: 10, padding: '10px 12px',
          border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)',
          fontSize: 14, outline: 'none', minWidth: 0,
        }}
      />
    </div>
  )
}

function LogCard({ log, onEdit, onDelete, events }) {
  const players = [...log.players].sort((a, b) => b.score - a.score)
  const eventName = events.find(e => e.id === log.event_id)?.name || ''
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{log.game_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{formatDate(log.played_at)} • {log.duration_minutes} min{log.duration_minutes !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {eventName && <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 999, padding: '4px 10px' }}>{eventName}</span>}
            <button onClick={onEdit} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>Edit</button>
            <button onClick={onDelete} style={{ border: '1px solid var(--red)', borderRadius: 10, padding: '8px 12px', background: 'rgba(224,90,90,0.1)', color: 'var(--red)', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {players.map((player, index) => (
            <div key={`${player.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'var(--bg3)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {player.score === players[0].score ? <span>👑</span> : <span style={{ width: 20 }} />}
                <span style={{ fontWeight: 500 }}>{player.name}</span>
              </div>
              <span style={{ color: 'var(--text3)' }}>{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
