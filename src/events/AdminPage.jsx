import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from './supabase'
import { generateSchedule, scheduleStats, validateScheduleCoverage } from './scheduler'
// ⚠️ DEV ONLY — remove this import together with DevTestingWorkflow.jsx when no longer needed
import DevTestingWorkflow from './DevTestingWorkflow'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD
//test
// ─── Shared UI ────────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px', ...style,
    }}>{children}</div>
  )
}

function Btn({ children, onClick, accent, danger, disabled, small, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '4px 10px' : '8px 16px',
      borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 500,
      border: `1px solid ${danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--border)'}`,
      background: danger ? 'rgba(224,90,90,0.12)' : accent ? 'var(--accent-bg)' : 'transparent',
      color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--text2)',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 140ms', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  )
}

const STATUS_LABELS = {
  voting: 'Voting open',
  preferences: 'Preferences',
  scheduled: 'Scheduled',
  closed: 'Closed',
}
const STATUS_COLORS = {
  voting: 'var(--blue)', preferences: 'var(--accent)',
  scheduled: 'var(--green)', closed: 'var(--text3)',
}

function StatusBadge({ status }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: STATUS_COLORS[status] || 'var(--text3)',
      background: `${STATUS_COLORS[status] || '#888'}22`,
      borderRadius: 4, padding: '2px 8px',
    }}>{STATUS_LABELS[status] || status}</span>
  )
}

// ─── Login gate ───────────────────────────────────────────────────────────────

function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const attempt = () => {
    if (!ADMIN_PASSWORD) {
      setError('VITE_ADMIN_PASSWORD is not set in environment variables.')
      return
    }
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', '1')
      onLogin()
    } else {
      setError('Incorrect password.')
      setPw('')
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '100px auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>
            Admin access
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Enter the admin password to continue</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password" value={pw}
            onChange={e => { setPw(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            placeholder="Password"
            autoFocus
            style={{
              background: 'var(--bg3)', border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
              borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
              fontSize: 14, outline: 'none', width: '100%',
            }}
          />
          {error && <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>}
          <Btn onClick={attempt} accent style={{ padding: '10px', fontSize: 14 }}>Login</Btn>
        </div>
      </Card>
    </div>
  )
}

// ─── Event list (admin overview) ──────────────────────────────────────────────

function AdminEventList({ onOpen }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const reload = useCallback(async () => {
    try {
      const evs = await db.select('events', { order: 'created_at.desc' })
      setEvents(evs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleDelete = async (ev) => {
    if (!confirm(`Delete event "${ev.name}"? This cannot be undone.`)) return
    setDeleting(ev.id)
    try {
      await db.delete('events', `id=eq.${ev.id}`)
      setEvents(prev => prev.filter(e => e.id !== ev.id))
    } catch (e) { alert(e.message) }
    finally { setDeleting(null) }
  }

  if (loading) return <p style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 24 }}>🔧</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>
          Admin — All events
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <Card><p style={{ color: 'var(--text3)', fontSize: 14 }}>No events yet.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div key={ev.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{ev.name}</p>
                  <StatusBadge status={ev.status} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {ev.location && `${ev.location} · `}
                  {ev.start_date} → {ev.end_date}
                  {' · '}Code: <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{ev.id}</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Btn small onClick={() => onOpen(ev)} accent>Manage →</Btn>
                <Btn small danger onClick={() => handleDelete(ev)} disabled={deleting === ev.id}>
                  {deleting === ev.id ? '…' : 'Delete'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Admin event manager ──────────────────────────────────────────────────────

function AdminEventManager({ initialEvent, localCollection, onBack }) {
  const [event, setEvent] = useState(initialEvent)
  const [participants, setParticipants] = useState([])
  const [votes, setVotes] = useState([])
  const [eventGames, setEventGames] = useState([])
  const [prefs, setPrefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // For adding games (phase preferences)
  const [gameSearch, setGameSearch] = useState('')
  const [showGamePicker, setShowGamePicker] = useState(false)

  // Schedule params
  const [schedParams, setSchedParams] = useState({
    hoursPerPart: 3, durationMultiplier: 1.5,
    prioritizePreferences: 1, prioritizeSocial: 1,
    minPlayersPerGame: 2, maxParallelGames: 2,
  })

  const mergedCollection = mergeCollections(event.collection || [], localCollection)

  const reload = useCallback(async () => {
    try {
      const [p, v, eg, pr] = await Promise.all([
        db.select('participants', { filter: `event_id=eq.${event.id}`, order: 'created_at.asc' }),
        db.select('game_votes', { filter: `event_id=eq.${event.id}` }),
        db.select('event_games', { filter: `event_id=eq.${event.id}` }),
        db.select('game_preferences', { filter: `event_id=eq.${event.id}` }),
      ])
      setParticipants(p); setVotes(v); setEventGames(eg); setPrefs(pr)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [event.id])

  useEffect(() => { reload() }, [reload])

  const refreshEvent = async () => {
    const [ev] = await db.select('events', { filter: `id=eq.${event.id}` })
    if (ev) setEvent(ev)
  }

  const setStatus = async (status) => {
    if (!confirm(`Move event to "${status}" phase?`)) return
    setBusy(true)
    try {
      await db.update('events', { status }, `id=eq.${event.id}`)
      await refreshEvent()
      await reload()
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Close voting: auto-select games with ≥1 want vote
  const handleCloseVoting = async () => {
    if (!confirm('Close voting and move to preferences phase? This will auto-select all games with at least one "want" vote.')) return
    setBusy(true)
    try {
      // Tally votes
      const tallies = {}
      for (const v of votes) {
        if (!tallies[v.game_id]) tallies[v.game_id] = { want: 0, data: v }
        if (v.vote === 'want') tallies[v.game_id].want++
      }
      const toAdd = Object.entries(tallies)
        .filter(([, t]) => t.want > 0)
        .map(([gid, t]) => ({
          event_id: event.id,
          game_id: gid,
          game_name: t.data.game_name,
          game_data: t.data.game_data || {},
        }))

      await Promise.all(toAdd.map(g => db.insert('event_games', g).catch(() => {})))
      await db.update('events', { status: 'preferences' }, `id=eq.${event.id}`)
      await refreshEvent()
      await reload()
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Add a game from the merged collection to event_games
  const handleAddGame = async (game) => {
    try {
      await db.insert('event_games', {
        event_id: event.id,
        game_id: game.id,
        game_name: game.name,
        game_data: {
          thumbnail: game.thumbnail, rating: game.rating,
          minPlayers: game.minPlayers, maxPlayers: game.maxPlayers,
          minPlaytime: game.minPlaytime, maxPlaytime: game.maxPlaytime,
          yearPublished: game.yearPublished,
        },
      })
      await reload()
    } catch (e) {
      if (e.message.includes('duplicate') || e.message.includes('unique')) return // already added
      alert(e.message)
    }
  }

  const handleRemoveGame = async (gameId) => {
    if (!confirm('Remove this game from the event?')) return
    try {
      await db.delete('event_games', `event_id=eq.${event.id}&game_id=eq.${gameId}`)
      await reload()
    } catch (e) { alert(e.message) }
  }

  // Generate schedule
  const handleGenerate = async () => {
    if (!confirm('Generate schedule? The existing schedule (if any) will be replaced.')) return
    setBusy(true)
    try {
      const prefMap = {}
      for (const p of prefs) {
        if (!prefMap[p.participant_id]) prefMap[p.participant_id] = {}
        prefMap[p.participant_id][p.game_id] = p.preference
      }
      const schedule = generateSchedule(event, participants, eventGames, prefMap, schedParams)
      const stats = scheduleStats(schedule, participants, prefMap)
      const warnings = validateScheduleCoverage(event, participants, eventGames, schedParams)
      await db.update('events', {
        status: 'scheduled',
        schedule,
        schedule_params: { ...schedParams, generatedAt: new Date().toISOString(), stats, warnings },
      }, `id=eq.${event.id}`)
      await refreshEvent()
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Vote tallies for display
  const tallies = {}
  for (const v of votes) {
    if (!tallies[v.game_id]) tallies[v.game_id] = { want: 0, neutral: 0, dont_want: 0, name: v.game_name }
    tallies[v.game_id][v.vote] = (tallies[v.game_id][v.vote] || 0) + 1
  }

  const addableGames = mergedCollection.filter(g => {
    const already = eventGames.some(eg => eg.game_id === g.id)
    if (already) return false
    if (gameSearch && !g.name.toLowerCase().includes(gameSearch.toLowerCase())) return false
    return true
  })

  if (loading) return <p style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <button onClick={onBack} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>← All events</button>
        <div style={{ flex: 1 }} />
        <StatusBadge status={event.status} />
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{event.name}</h2>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>
        {event.location && `${event.location} · `}{event.start_date} → {event.end_date}
        {' · '}Code: <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{event.id}</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Phase controls */}
        <Card>
          <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Phase controls</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {event.status === 'voting' && (
              <Btn danger onClick={handleCloseVoting} disabled={busy}>
                🔒 Close voting & move to preferences
              </Btn>
            )}
            {event.status === 'preferences' && (
              <>
                <Btn accent onClick={handleGenerate} disabled={busy}>
                  ✨ Generate schedule
                </Btn>
                <Btn onClick={() => setStatus('voting')} disabled={busy}>
                  ← Reopen voting
                </Btn>
              </>
            )}
            {event.status === 'scheduled' && (
              <>
                <Btn accent onClick={handleGenerate} disabled={busy}>
                  🔄 Regenerate schedule
                </Btn>
                <Btn onClick={() => setStatus('preferences')} disabled={busy}>
                  ← Back to preferences
                </Btn>
                <Btn danger onClick={() => setStatus('closed')} disabled={busy}>
                  🔒 Close event
                </Btn>
              </>
            )}
            {event.status === 'closed' && (
              <Btn onClick={() => setStatus('scheduled')} disabled={busy}>← Reopen</Btn>
            )}
          </div>
        </Card>

        {/* Schedule params (visible in preferences + scheduled) */}
        {(event.status === 'preferences' || event.status === 'scheduled') && (
          <Card>
            <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Schedule parameters</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 8 }}>
              {[
                ['hoursPerPart', 'Hours per time block', 0.5, 1, 8],
                ['durationMultiplier', 'Duration multiplier (×BGG)', 0.1, 1, 4],
                ['maxParallelGames', 'Max parallel games per block', 1, 1, 6],
                ['minPlayersPerGame', 'Min players per game', 1, 2, 8],
              ].map(([key, label, step, min, max]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</label>
                  <input type="number" min={min} max={max} step={step} value={schedParams[key]}
                    onChange={e => setSchedParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    style={{ width: '100%', marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                  />
                </div>
              ))}
              {[
                ['prioritizePreferences', 'Weight: preferences'],
                ['prioritizeSocial', 'Weight: social mixing'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>{label} ({schedParams[key]})</label>
                  <input type="range" min={0} max={2} step={0.5} value={schedParams[key]}
                    onChange={e => setSchedParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    style={{ width: '100%', marginTop: 8 }}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Participants & availability */}
        <Card>
          <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Participants ({participants.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {participants.map(p => {
              const myVoteCount = votes.filter(v => v.participant_id === p.id).length
              const myPrefCount = prefs.filter(pr => pr.participant_id === p.id).length
              const hasAvail = p.arrive_date && p.depart_date
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 500, color: 'var(--accent)', flexShrink: 0,
                  }}>{p.name[0].toUpperCase()}</div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{p.name}</p>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text3)' }}>
                    <span style={{ color: myVoteCount > 0 ? 'var(--green)' : 'var(--text3)' }}>
                      👍 {myVoteCount} votes
                    </span>
                    <span style={{ color: myPrefCount > 0 ? 'var(--green)' : 'var(--text3)' }}>
                      ❤️ {myPrefCount} prefs
                    </span>
                    <span style={{ color: hasAvail ? 'var(--green)' : 'var(--red)' }}>
                      {hasAvail ? `📅 ${p.arrive_date} ${p.arrive_part} → ${p.depart_date} ${p.depart_part}` : '📅 no availability'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Voting results (voting phase) */}
        {event.status === 'voting' && (
          <Card>
            <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Vote tallies ({Object.keys(tallies).length} games voted on)
            </p>
            {Object.keys(tallies).length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>No votes yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(tallies)
                  .sort((a, b) => (b[1].want - b[1].dont_want) - (a[1].want - a[1].dont_want))
                  .map(([gid, t]) => (
                    <div key={gid} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px',
                    }}>
                      <p style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{t.name}</p>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                        <span style={{ color: 'var(--green)' }}>👍 {t.want}</span>
                        <span style={{ color: 'var(--text3)' }}>😐 {t.neutral}</span>
                        <span style={{ color: 'var(--red)' }}>👎 {t.dont_want}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        )}

        {/* Selected games (preferences + scheduled phase) */}
        {(event.status === 'preferences' || event.status === 'scheduled' || event.status === 'closed') && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Selected games ({eventGames.length})
              </p>
              {event.status === 'preferences' && (
                <Btn small accent onClick={() => setShowGamePicker(v => !v)}>
                  {showGamePicker ? '✕ Close' : '+ Add game'}
                </Btn>
              )}
            </div>

            {/* Game picker */}
            {showGamePicker && event.status === 'preferences' && (
              <div style={{ marginBottom: 16, background: 'var(--bg3)', borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Pick from merged collection ({mergedCollection.length} games):
                </p>
                <input
                  value={gameSearch} onChange={e => setGameSearch(e.target.value)}
                  placeholder="Search games…"
                  style={{
                    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
                    marginBottom: 10,
                  }}
                />
                <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {addableGames.slice(0, 40).map(g => (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--surface)', borderRadius: 8, padding: '8px 10px',
                    }}>
                      {g.thumbnail && <img src={g.thumbnail} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {g.maxPlayers > 0 && `👤 ${g.minPlayers}–${g.maxPlayers}`}
                          {g.maxPlaytime > 0 && ` · ⏱ ${g.maxPlaytime}m`}
                          {g.rating > 0 && ` · ★ ${g.rating.toFixed(1)}`}
                        </p>
                      </div>
                      <Btn small accent onClick={() => handleAddGame(g)}>Add</Btn>
                    </div>
                  ))}
                  {addableGames.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>No matching games found.</p>}
                  {addableGames.length > 40 && <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>Showing 40 of {addableGames.length} — refine your search</p>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventGames.map(eg => {
                const g = eg.game_data || {}
                // Build per-participant preference map for this game
                const gamePrefs = prefs.filter(p => p.game_id === eg.game_id)
                const prefByParticipant = {}
                for (const p of gamePrefs) prefByParticipant[p.participant_id] = p.preference
                const PREF_DISPLAY = {
                  really_want: { label: '❤️', color: '#e87d4a', text: 'Really want' },
                  want:        { label: '👍', color: 'var(--green)', text: 'Want' },
                  neutral:     { label: '😐', color: 'var(--text3)', text: 'Neutral' },
                  dont_want:   { label: '👎', color: 'var(--red)', text: "Don't want" },
                }
                return (
                  <div key={eg.game_id} style={{
                    background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {g.thumbnail && <img src={g.thumbnail} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eg.game_name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {g.maxPlayers > 0 && `👤 ${g.minPlayers}–${g.maxPlayers}`}
                          {g.maxPlaytime > 0 && ` · ⏱ ${g.maxPlaytime}m`}
                          {g.rating > 0 && ` · ★ ${g.rating.toFixed(1)}`}
                        </p>
                      </div>
                      {event.status === 'preferences' && (
                        <Btn small danger onClick={() => handleRemoveGame(eg.game_id)}>Remove</Btn>
                      )}
                    </div>
                    {/* Per-participant preferences */}
                    {participants.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {participants.map(p => {
                          const pref = prefByParticipant[p.id]
                          const display = pref ? PREF_DISPLAY[pref] : null
                          return (
                            <div key={p.id} title={display ? `${p.name}: ${display.text}` : `${p.name}: not rated`} style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: 'var(--bg4)', borderRadius: 5, padding: '3px 8px',
                              border: `1px solid ${display ? display.color : 'var(--border)'}`,
                              opacity: display ? 1 : 0.45,
                            }}>
                              <span style={{ fontSize: 10 }}>{display ? display.label : '·'}</span>
                              <span style={{ fontSize: 11, color: display ? display.color : 'var(--text3)', fontWeight: display ? 500 : 400 }}>{p.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {eventGames.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)' }}>No games selected yet.</p>}
            </div>
          </Card>
        )}

        {/* Schedule preview (if generated) */}
        {event.schedule?.length > 0 && (
          <Card>
            <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
              Current schedule ({event.schedule.length} slots · generated {new Date(event.schedule_params?.generatedAt).toLocaleString()})
            </p>
            {event.schedule_params?.warnings?.length > 0 && (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'rgba(255, 229, 100, 0.16)', border: '1px solid rgba(255, 195, 0, 0.24)' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Schedule warnings</p>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text3)', fontSize: 12, lineHeight: 1.4 }}>
                  {event.schedule_params.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {event.schedule_params?.stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
                {Object.values(event.schedule_params.stats.playerStats || {}).map(ps => (
                  <div key={ps.name} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                    <p style={{ fontSize: 11, color: 'var(--text3)' }}>{ps.name}</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{ps.gamesPlayed} games</p>
                    <p style={{ fontSize: 10, color: ps.preferenceScore >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      score: {ps.preferenceScore > 0 ? '+' : ''}{ps.preferenceScore}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {event.schedule.map((slot, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, minWidth: 120 }}>
                    {slot.date} {slot.part}
                  </span>
                  {slot.thumbnail && <img src={slot.thumbnail} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                  <p style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.gameName}</p>
                  <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>~{slot.gameDuration}m</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>{slot.players.map(p => p.name).join(', ')}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ⚠️ DEV ONLY — remove the line below together with DevTestingWorkflow.jsx */}
      <DevTestingWorkflow event={event} participants={participants} eventGames={eventGames} onRefresh={reload} />

    </div>
  )
}

function mergeCollections(eventCol, localCol) {
  const map = new Map()
  for (const g of (eventCol || [])) map.set(g.id, g)
  for (const g of (localCol || [])) if (!map.has(g.id)) map.set(g.id, g)
  return Array.from(map.values())
}

// ─── Admin game files manager ─────────────────────────────────────────────────

function AdminGameFiles({ localCollection, onBack }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // {mode: 'edit'|'create', game_id, game_name, files}
  const [newFileName, setNewFileName] = useState('')
  const [newFileUrl, setNewFileUrl] = useState('')
  const [fileError, setFileError] = useState('')
  const [search, setSearch] = useState('')

  const reload = useCallback(async () => {
    try {
      const f = await db.select('game_files', { order: 'updated_at.desc' })
      setFiles(f)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const gamesById = useMemo(() => {
    const map = {}
    for (const game of (localCollection || [])) map[game.id] = game
    return map
  }, [localCollection])

  const displayRows = files.map(f => ({
    ...f,
    game_name: gamesById[f.game_id]?.name || `Game ${f.game_id}`,
    fileCount: Array.isArray(f.files) ? f.files.length : 0,
  }))
  const filteredRows = displayRows.filter(row =>
    row.game_name.toLowerCase().includes(search.toLowerCase()) ||
    row.game_id.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (file) => {
    setEditing({
      mode: 'edit',
      game_id: file.game_id,
      game_name: gamesById[file.game_id]?.name || `Game ${file.game_id}`,
      files: Array.isArray(file.files) ? [...file.files] : [],
    })
    setNewFileName('')
    setNewFileUrl('')
    setFileError('')
  }

  const handleCreate = () => {
    const firstGame = (localCollection || [])[0]
    setEditing({
      mode: 'create',
      game_id: firstGame?.id || '',
      game_name: firstGame?.name || '',
      files: [],
    })
    setNewFileName('')
    setNewFileUrl('')
    setFileError('')
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.game_id) {
      setFileError('Select a game first.')
      return
    }
    try {
      if (!editing.files.length) {
        await db.delete('game_files', `game_id=eq.${editing.game_id}`)
      } else {
        await db.upsert('game_files', {
          game_id: editing.game_id,
          files: editing.files,
          updated_at: new Date().toISOString(),
        })
      }
      setEditing(null)
      await reload()
    } catch (e) { alert(e.message) }
  }

  const handleAddLink = () => {
    if (!editing) return
    const url = newFileUrl.trim()
    if (!url) {
      setFileError('Enter a URL for the file link.')
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      setFileError('File links must start with http:// or https://')
      return
    }
    const nextFiles = [...editing.files, { name: newFileName.trim() || 'Document', url }]
    setEditing({ ...editing, files: nextFiles })
    setNewFileName('')
    setNewFileUrl('')
    setFileError('')
  }

  const handleRemoveLink = (index) => {
    if (!editing) return
    const nextFiles = editing.files.filter((_, i) => i !== index)
    setEditing({ ...editing, files: nextFiles })
  }

  const handleSelectGame = (gameId) => {
    const game = gamesById[gameId]
    setEditing({ ...editing, game_id: gameId, game_name: game?.name || `Game ${gameId}` })
  }

  if (loading) return <p style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        <div style={{ fontSize: 24 }}>📁</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>Game Files</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{files.length} game rows</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}> 
          <Btn accent onClick={handleCreate}>+ Add file</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search games or IDs…"
          style={{ flex: '1 1 240px', minWidth: 200, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', padding: '10px 14px', color: 'var(--text)' }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--text3)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>Game</th>
              <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--text3)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>Files</th>
              <th style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--text3)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>Updated</th>
              <th style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '20px 14px', color: 'var(--text3)', textAlign: 'center' }}>No matching games.</td>
              </tr>
            ) : filteredRows.map(row => (
              <tr key={row.game_id} style={{ background: 'var(--surface)' }}>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{row.game_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{row.game_id}</div>
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{row.fileCount}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>link{row.fileCount !== 1 ? 's' : ''}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</span>
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', textAlign: 'right' }}>
                  <Btn small onClick={() => handleEdit(row)}>Edit</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 22 }}>✏️</div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)', margin: 0 }}>Add file links</h3>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Select a game and attach one or more external file links.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                Game
                <select
                  value={editing.game_id}
                  onChange={e => handleSelectGame(e.target.value)}
                  style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', padding: '10px 12px', color: 'var(--text)' }}
                >
                  {(localCollection || []).map(game => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                    Link label
                    <input
                      value={newFileName}
                      onChange={e => setNewFileName(e.target.value)}
                      placeholder="Optional label"
                      style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', padding: '10px 12px', color: 'var(--text)' }}
                    />
                  </label>
                </div>
                <div style={{ flex: '1 1 260px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                    File URL
                    <input
                      value={newFileUrl}
                      onChange={e => { setNewFileUrl(e.target.value); setFileError('') }}
                      placeholder="https://drive.google.com/..."
                      style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', padding: '10px 12px', color: 'var(--text)' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Btn accent onClick={handleAddLink}>Add link</Btn>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{editing.files.length} link{editing.files.length !== 1 ? 's' : ''} added</span>
              </div>
              {fileError && <div style={{ fontSize: 12, color: 'var(--red)' }}>{fileError}</div>}
            </div>

            {editing.files.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                {editing.files.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}>{file.name || file.url}</a>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{file.url}</div>
                    </div>
                    <button onClick={() => handleRemoveLink(idx)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Btn onClick={handleSave} accent>Save</Btn>
              <Btn onClick={() => setEditing(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AdminPage({ localCollection, onAuthChange }) {
  const [authed, setAuthed] = useState(sessionStorage.getItem('admin_auth') === '1')
  const [view, setView] = useState('events')  // events | files
  const [currentEvent, setCurrentEvent] = useState(null)

  const handleLogin = () => {
    setAuthed(true)
    onAuthChange?.(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setAuthed(false)
    onAuthChange?.(false)
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />

  if (view === 'event' && currentEvent) {
    return (
      <AdminEventManager
        initialEvent={currentEvent}
        localCollection={localCollection}
        onBack={() => { setView('events'); setCurrentEvent(null) }}
      />
    )
  }

  if (view === 'files') {
    return <AdminGameFiles localCollection={localCollection} onBack={() => setView('events')} />
  }

  return (
    <div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 24 }}>🔧</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>
            Admin Panel
          </h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={() => setView('events')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 13,
                border: `1px solid ${view === 'events' ? 'var(--accent)' : 'var(--border)'}`,
                background: view === 'events' ? 'var(--accent-bg)' : 'transparent',
                color: view === 'events' ? 'var(--accent)' : 'var(--text3)',
                cursor: 'pointer',
              }}
            >
              Events
            </button>
            <button
              onClick={() => setView('files')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 13,
                border: `1px solid ${view === 'files' ? 'var(--accent)' : 'var(--border)'}`,
                background: view === 'files' ? 'var(--accent-bg)' : 'transparent',
                color: view === 'files' ? 'var(--accent)' : 'var(--text3)',
                cursor: 'pointer',
              }}
            >
              Game Files
            </button>
          </div>
        </div>
      </div>
      {view === 'events' && (
        <AdminEventList onOpen={ev => { setCurrentEvent(ev); setView('event') }} />
      )}
    </div>
  )
}
