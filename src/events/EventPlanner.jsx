import React, { useState, useEffect, useCallback } from 'react'
import { db, isConfigured } from './supabase'
import { generateSchedule, scheduleStats, getSlots } from './scheduler'

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const VOTE_OPTS = [
  { value: 'want', label: '👍 Want', color: 'var(--green)' },
  { value: 'neutral', label: '😐 Neutral', color: 'var(--text3)' },
  { value: 'dont_want', label: '👎 Don\'t want', color: 'var(--red)' },
]

const PREF_OPTS = [
  { value: 'really_want', label: '❤️ Really want', color: '#e87d4a' },
  { value: 'want', label: '👍 Want', color: 'var(--green)' },
  { value: 'neutral', label: '😐 Neutral', color: 'var(--text3)' },
  { value: 'dont_want', label: '👎 Don\'t want', color: 'var(--red)' },
]

const PARTS = ['morning', 'afternoon', 'evening']
const STATUS_LABELS = {
  voting: 'Voting open',
  preferences: 'Collecting preferences',
  scheduled: 'Scheduled',
  closed: 'Closed',
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '20px',
      ...style,
    }}>{children}</div>
  )
}

function Btn({ children, onClick, accent, danger, disabled, small, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '5px 12px' : '8px 18px',
      borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: 500,
      border: `1px solid ${danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--border)'}`,
      background: danger ? 'rgba(224,90,90,0.12)' : accent ? 'var(--accent-bg)' : 'transparent',
      color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--text2)',
      cursor: disabled ? 'default', opacity: disabled ? 0.5 : 1,
      transition: 'all 140ms', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  )
}

function Input({ label, value, onChange, type = 'text', placeholder, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
          fontSize: 13, outline: 'none', width: '100%', ...style,
        }}
      />
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    voting: 'var(--blue)', preferences: 'var(--accent)',
    scheduled: 'var(--green)', closed: 'var(--text3)',
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: colors[status] || 'var(--text3)',
      background: `${colors[status]}22`,
      borderRadius: 4, padding: '2px 8px',
    }}>{STATUS_LABELS[status] || status}</span>
  )
}

// ─── Not configured banner ────────────────────────────────────────────────────

function NotConfigured() {
  return (
    <Card style={{ maxWidth: 600, margin: '40px auto' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>Supabase not configured</h2>
      <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16 }}>
        The event planner needs a Supabase database. Follow these steps:
      </p>
      <ol style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20 }}>
        <li>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>supabase.com</a> and create a free project</li>
        <li>In your Supabase dashboard → SQL Editor → paste and run <code style={{ color: 'var(--accent)' }}>supabase-schema.sql</code> from the repo</li>
        <li>Go to Project Settings → API → copy your Project URL and anon public key</li>
        <li>Add to Vercel environment variables (and local <code style={{ color: 'var(--accent)' }}>.env</code>):
          <pre style={{ background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px', marginTop: 8, fontSize: 12, color: 'var(--text)' }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </li>
        <li>Redeploy on Vercel</li>
      </ol>
    </Card>
  )
}

// ─── Event list / entry point ─────────────────────────────────────────────────

function EventList({ onOpen, onNew }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    const c = code.trim().toUpperCase()
    if (!c) return
    setLoading(true); setError('')
    try {
      const events = await db.select('events', { filter: `id=eq.${c}` })
      if (!events.length) { setError('Event not found. Check the code and try again.'); return }
      onOpen(events[0])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 500, margin: '60px auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗓️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: 'var(--text)' }}>Event Planner</h2>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 6 }}>Plan a multi-day board game event with friends</p>
      </div>

      <Card>
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Join an existing event</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Event code (e.g. XK7Q3M)"
            style={{
              flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
              fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.1em',
            }}
          />
          <Btn onClick={handleJoin} accent disabled={loading || !code.trim()}>
            {loading ? '…' : 'Join'}
          </Btn>
        </div>
        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{error}</p>}
      </Card>

      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>— or —</span>
      </div>

      <Btn onClick={onNew} accent style={{ padding: '12px', fontSize: 14 }}>
        + Create new event
      </Btn>
    </div>
  )
}

// ─── Create event form ────────────────────────────────────────────────────────

function CreateEvent({ onCreated, collection }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [participants, setParticipants] = useState(['', ''])
  const [attachCollection, setAttachCollection] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addParticipant = () => setParticipants(p => [...p, ''])
  const updateParticipant = (i, v) => setParticipants(p => p.map((x, j) => j === i ? v : x))
  const removeParticipant = (i) => setParticipants(p => p.filter((_, j) => j !== i))

  const handleCreate = async () => {
    const names = participants.map(p => p.trim()).filter(Boolean)
    if (!name.trim() || !startDate || !endDate || names.length < 2) {
      setError('Please fill in all fields and add at least 2 participants.')
      return
    }
    if (endDate < startDate) { setError('End date must be after start date.'); return }

    setSaving(true); setError('')
    try {
      // Generate a 6-char uppercase ID
      const id = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Slim down collection to save space (keep only essential fields)
      const col = attachCollection && collection.length
        ? collection.map(g => ({
            id: g.id, name: g.name, thumbnail: g.thumbnail,
            minPlayers: g.minPlayers, maxPlayers: g.maxPlayers,
            minPlaytime: g.minPlaytime, maxPlaytime: g.maxPlaytime,
            rating: g.rating, bggRank: g.bggRank, yearPublished: g.yearPublished,
          }))
        : []

      const [event] = await db.insert('events', {
        id, name: name.trim(), location: location.trim(),
        start_date: startDate, end_date: endDate,
        status: 'voting', collection: col,
      })

      // Insert participants
      await Promise.all(names.map(n =>
        db.insert('participants', { event_id: id, name: n })
      ))

      onCreated(event)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>Create event</h2>
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Event name" value={name} onChange={setName} placeholder="e.g. Summer board game weekend" />
        <Input label="Location" value={location} onChange={setLocation} placeholder="e.g. Bruges" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Start date" value={startDate} onChange={setStartDate} type="date" />
          <Input label="End date" value={endDate} onChange={setEndDate} type="date" />
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Participants</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {participants.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input
                value={p} onChange={e => updateParticipant(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                style={{
                  flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
                }}
              />
              {participants.length > 2 && (
                <button onClick={() => removeParticipant(i)} style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 14,
                }}>×</button>
              )}
            </div>
          ))}
          <Btn onClick={addParticipant} small>+ Add player</Btn>
        </div>
      </Card>

      <Card>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={attachCollection} onChange={e => setAttachCollection(e.target.checked)} />
          <div>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>Attach current collection to event</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {collection.length > 0
                ? `${collection.length} games currently loaded — participants can vote on these`
                : 'No collection loaded in the browser yet — participants will only see their own loaded games'}
            </p>
          </div>
        </label>
      </Card>

      {error && <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>}
      <Btn onClick={handleCreate} accent disabled={saving} style={{ padding: '12px' }}>
        {saving ? 'Creating…' : 'Create event'}
      </Btn>
    </div>
  )
}

// ─── Event dashboard (all phases) ─────────────────────────────────────────────

function EventDashboard({ initialEvent, localCollection }) {
  const [event, setEvent] = useState(initialEvent)
  const [participants, setParticipants] = useState([])
  const [votes, setVotes] = useState([])           // all votes from all participants
  const [eventGames, setEventGames] = useState([]) // selected games (after voting closed)
  const [prefs, setPrefs] = useState([])           // all preferences
  const [me, setMe] = useState(null)               // current participant
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [p, v, eg, pr] = await Promise.all([
        db.select('participants', { filter: `event_id=eq.${event.id}`, order: 'created_at.asc' }),
        db.select('game_votes', { filter: `event_id=eq.${event.id}` }),
        db.select('event_games', { filter: `event_id=eq.${event.id}` }),
        db.select('game_preferences', { filter: `event_id=eq.${event.id}` }),
      ])
      setParticipants(p)
      setVotes(v)
      setEventGames(eg)
      setPrefs(pr)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [event.id])

  useEffect(() => { reload() }, [reload])

  // Poll for updates every 8 seconds (simple alternative to websockets)
  useEffect(() => {
    const interval = setInterval(reload, 8000)
    return () => clearInterval(interval)
  }, [reload])

  const refreshEvent = async () => {
    const [ev] = await db.select('events', { filter: `id=eq.${event.id}` })
    if (ev) setEvent(ev)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading event…</div>

  // Participant picker
  if (!me) {
    return (
      <ParticipantPicker
        event={event}
        participants={participants}
        onSelect={setMe}
      />
    )
  }

  const mergedCollection = mergeCollections(event.collection || [], localCollection)

  const commonProps = { event, participants, me, votes, eventGames, prefs, reload, refreshEvent, mergedCollection }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Event header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>
            {event.name}
          </h2>
          <StatusBadge status={event.status} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          {event.location && `${event.location} · `}
          {event.start_date} → {event.end_date} · Code: <strong style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{event.id}</strong>
          {' · '}Logged in as <strong style={{ color: 'var(--text)' }}>{me.name}</strong>
          {' · '}<button onClick={() => setMe(null)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>switch</button>
        </p>
      </div>

      {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 16 }}>{error}</p>}

      {event.status === 'voting' && <VotingPhase {...commonProps} />}
      {event.status === 'preferences' && <PreferencesPhase {...commonProps} />}
      {(event.status === 'scheduled' || event.status === 'closed') && <SchedulePhase {...commonProps} />}
    </div>
  )
}

// Merge event's attached collection with locally loaded games, deduplicating by id
function mergeCollections(eventCol, localCol) {
  const map = new Map()
  for (const g of (eventCol || [])) map.set(g.id, g)
  for (const g of (localCol || [])) if (!map.has(g.id)) map.set(g.id, g)
  return Array.from(map.values())
}

// ─── Participant picker ───────────────────────────────────────────────────────

function ParticipantPicker({ event, participants, onSelect }) {
  return (
    <div style={{ maxWidth: 400, margin: '60px auto' }}>
      <Card>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 4 }}>{event.name}</h3>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Who are you?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {participants.map(p => (
            <button key={p.id} onClick={() => onSelect(p)} style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg3)',
              color: 'var(--text)', fontSize: 14, textAlign: 'left',
              cursor: 'pointer', transition: 'border-color 140ms',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >{p.name}</button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Phase 1: Voting ──────────────────────────────────────────────────────────

function VotingPhase({ event, participants, me, votes, mergedCollection, reload, refreshEvent }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | voted | unvoted
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [selectedGames, setSelectedGames] = useState(new Set())

  // My votes: gameId -> vote value
  const myVotes = {}
  for (const v of votes) {
    if (v.participant_id === me.id) myVotes[v.game_id] = v.vote
  }

  // Vote tallies: gameId -> { want, neutral, dont_want }
  const tallies = {}
  for (const v of votes) {
    if (!tallies[v.game_id]) tallies[v.game_id] = { want: 0, neutral: 0, dont_want: 0, name: v.game_name }
    tallies[v.game_id][v.vote] = (tallies[v.game_id][v.vote] || 0) + 1
  }

  const handleVote = async (game, vote) => {
    setSaving(true)
    try {
      await db.upsert('game_votes', {
        event_id: event.id,
        participant_id: me.id,
        game_id: game.id,
        game_name: game.name,
        game_data: {
          thumbnail: game.thumbnail, rating: game.rating,
          minPlayers: game.minPlayers, maxPlayers: game.maxPlayers,
          minPlaytime: game.minPlaytime, maxPlaytime: game.maxPlaytime,
          yearPublished: game.yearPublished,
        },
        vote,
      }, 'event_id,participant_id,game_id')
      await reload()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleCloseVoting = async () => {
    if (!confirm('Close voting and move to game selection? This cannot be undone.')) return
    setClosing(true)
    try {
      // Add all selected games to event_games
      const gamesToAdd = [...selectedGames].map(gid => {
        const g = mergedCollection.find(x => x.id === gid)
        return {
          event_id: event.id,
          game_id: gid,
          game_name: g?.name || tallies[gid]?.name || gid,
          game_data: g || {},
        }
      })
      // Also auto-include games with >=1 "want" vote
      for (const [gid, t] of Object.entries(tallies)) {
        if (t.want > 0 && !selectedGames.has(gid)) {
          const g = mergedCollection.find(x => x.id === gid)
          gamesToAdd.push({
            event_id: event.id, game_id: gid,
            game_name: g?.name || t.name || gid, game_data: g || {},
          })
        }
      }
      await Promise.all(gamesToAdd.map(g => db.insert('event_games', g).catch(() => {})))
      await db.update('events', { status: 'preferences' }, `id=eq.${event.id}`)
      await refreshEvent()
    } catch (e) { alert(e.message) }
    finally { setClosing(false) }
  }

  const games = mergedCollection.filter(g => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'voted' && !myVotes[g.id]) return false
    if (filter === 'unvoted' && myVotes[g.id]) return false
    return true
  })

  const totalVoters = participants.length
  const myVoteCount = Object.keys(myVotes).length

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Card style={{ padding: '10px 16px', flex: 1, minWidth: 140 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>My votes</p>
          <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--accent)' }}>{myVoteCount}</p>
        </Card>
        <Card style={{ padding: '10px 16px', flex: 1, minWidth: 140 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Games with votes</p>
          <p style={{ fontSize: 20, fontWeight: 500 }}>{Object.keys(tallies).length}</p>
        </Card>
        <Card style={{ padding: '10px 16px', flex: 1, minWidth: 140 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Participants voted</p>
          <p style={{ fontSize: 20, fontWeight: 500 }}>{new Set(votes.map(v => v.participant_id)).size} / {totalVoters}</p>
        </Card>
        <Btn onClick={handleCloseVoting} danger disabled={closing} style={{ height: 56 }}>
          {closing ? 'Closing…' : 'Close voting →'}
        </Btn>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search games…"
          style={{
            flex: 1, minWidth: 180, background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />
        {['all', 'voted', 'unvoted'].map(f => (
          <Btn key={f} small onClick={() => setFilter(f)} accent={filter === f}>
            {f === 'all' ? 'All games' : f === 'voted' ? 'My votes' : 'Not voted'}
          </Btn>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        {mergedCollection.length} games available · showing {games.length}
      </p>

      {/* Game list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {games.map(game => {
          const myVote = myVotes[game.id]
          const tally = tallies[game.id] || { want: 0, neutral: 0, dont_want: 0 }
          return (
            <div key={game.id} style={{
              background: 'var(--surface)', border: `1px solid ${myVote ? 'var(--border2)' : 'var(--border)'}`,
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {game.thumbnail && (
                <img src={game.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--text3)' }}>
                  {game.rating > 0 && <span>★ {game.rating.toFixed(1)}</span>}
                  {game.maxPlayers > 0 && <span>👤 {game.minPlayers}–{game.maxPlayers}</span>}
                  {game.maxPlaytime > 0 && <span>⏱ {game.maxPlaytime}m</span>}
                </div>
              </div>

              {/* Tally */}
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                {tally.want > 0 && <span style={{ color: 'var(--green)' }}>👍 {tally.want}</span>}
                {tally.neutral > 0 && <span>😐 {tally.neutral}</span>}
                {tally.dont_want > 0 && <span style={{ color: 'var(--red)' }}>👎 {tally.dont_want}</span>}
              </div>

              {/* Vote buttons */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {VOTE_OPTS.map(opt => (
                  <button key={opt.value} onClick={() => handleVote(game, opt.value)} disabled={saving}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${myVote === opt.value ? opt.color : 'var(--border)'}`,
                      background: myVote === opt.value ? `${opt.color}22` : 'transparent',
                      color: myVote === opt.value ? opt.color : 'var(--text3)',
                      cursor: 'pointer', transition: 'all 120ms',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          )
        })}
        {games.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 14 }}>
            No games found. {mergedCollection.length === 0 ? 'Load a collection in the main app first.' : 'Try a different search.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Phase 2: Preferences & Availability ─────────────────────────────────────

function PreferencesPhase({ event, participants, me, eventGames, prefs, reload, refreshEvent }) {
  const [savingPref, setSavingPref] = useState(null)
  const [savingAvail, setSavingAvail] = useState(false)
  const [generating, setGenerating] = useState(false)

  // My preferences: gameId -> preference
  const myPrefs = {}
  for (const p of prefs) {
    if (p.participant_id === me.id) myPrefs[p.game_id] = p.preference
  }

  const myInfo = participants.find(p => p.id === me.id)
  const [arriveDate, setArriveDate] = useState(myInfo?.arrive_date || event.start_date)
  const [arrivePart, setArrivePart] = useState(myInfo?.arrive_part || 'morning')
  const [departDate, setDepartDate] = useState(myInfo?.depart_date || event.end_date)
  const [departPart, setDepartPart] = useState(myInfo?.depart_part || 'evening')

  const handlePref = async (gameId, preference) => {
    setSavingPref(gameId)
    try {
      await db.upsert('game_preferences', {
        event_id: event.id, participant_id: me.id, game_id: gameId, preference,
      }, 'event_id,participant_id,game_id')
      await reload()
    } catch (e) { console.error(e) }
    finally { setSavingPref(null) }
  }

  const handleSaveAvailability = async () => {
    setSavingAvail(true)
    try {
      await db.update('participants', {
        arrive_date: arriveDate, arrive_part: arrivePart,
        depart_date: departDate, depart_part: departPart,
      }, `id=eq.${me.id}`)
      await reload()
    } catch (e) { alert(e.message) }
    finally { setSavingAvail(false) }
  }

  // Check if all participants have submitted preferences and availability
  const participantsWithPrefs = new Set(prefs.map(p => p.participant_id))
  const participantsWithAvail = participants.filter(p => p.arrive_date && p.depart_date)
  const allReady = participantsWithPrefs.size === participants.length && participantsWithAvail.length === participants.length

  const [schedParams, setSchedParams] = useState({
    hoursPerPart: 3, durationMultiplier: 1.5,
    prioritizePreferences: 1, prioritizeSocial: 1,
    minPlayersPerGame: 2, maxParallelGames: 2,
  })

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      // Build preferences map: participantId -> gameId -> preference
      const prefMap = {}
      for (const p of prefs) {
        if (!prefMap[p.participant_id]) prefMap[p.participant_id] = {}
        prefMap[p.participant_id][p.game_id] = p.preference
      }

      const schedule = generateSchedule(event, participants, eventGames, prefMap, schedParams)
      const stats = scheduleStats(schedule, participants, prefMap)

      await db.update('events', {
        status: 'scheduled',
        schedule: schedule,
        schedule_params: { ...schedParams, generatedAt: new Date().toISOString(), stats },
      }, `id=eq.${event.id}`)
      await refreshEvent()
    } catch (e) { alert(e.message) }
    finally { setGenerating(false) }
  }

  const partOptions = PARTS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))

  // Progress overview
  const totalPrefsNeeded = participants.length * eventGames.length
  const totalPrefsGiven = prefs.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Progress */}
      <Card>
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Overall progress</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>Preferences</p>
            <p style={{ fontSize: 18, fontWeight: 500, color: totalPrefsGiven === totalPrefsNeeded ? 'var(--green)' : 'var(--text)' }}>
              {totalPrefsGiven} / {totalPrefsNeeded}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>Availability set</p>
            <p style={{ fontSize: 18, fontWeight: 500, color: participantsWithAvail.length === participants.length ? 'var(--green)' : 'var(--text)' }}>
              {participantsWithAvail.length} / {participants.length}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>Games selected</p>
            <p style={{ fontSize: 18, fontWeight: 500 }}>{eventGames.length}</p>
          </div>
        </div>
      </Card>

      {/* My availability */}
      <Card>
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>My availability</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <Input label="Arrive date" value={arriveDate} onChange={setArriveDate} type="date" />
          <Select label="Arrive part" value={arrivePart} onChange={setArrivePart} options={partOptions} />
          <Input label="Depart date" value={departDate} onChange={setDepartDate} type="date" />
          <Select label="Depart part" value={departPart} onChange={setDepartPart} options={partOptions} />
        </div>
        <Btn onClick={handleSaveAvailability} accent disabled={savingAvail}>
          {savingAvail ? 'Saving…' : 'Save availability'}
        </Btn>
      </Card>

      {/* My preferences per game */}
      <Card>
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          My preferences ({Object.keys(myPrefs).length} / {eventGames.length} rated)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eventGames.map(eg => {
            const g = eg.game_data || {}
            const myPref = myPrefs[eg.game_id]
            return (
              <div key={eg.game_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px',
              }}>
                {g.thumbnail && <img src={g.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eg.game_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {g.maxPlayers > 0 && `👤 ${g.minPlayers}–${g.maxPlayers}`}
                    {g.maxPlaytime > 0 && ` · ⏱ ${g.maxPlaytime}m`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {PREF_OPTS.map(opt => (
                    <button key={opt.value} onClick={() => handlePref(eg.game_id, opt.value)}
                      disabled={savingPref === eg.game_id}
                      style={{
                        padding: '3px 8px', borderRadius: 5, fontSize: 11,
                        border: `1px solid ${myPref === opt.value ? opt.color : 'var(--border)'}`,
                        background: myPref === opt.value ? `${opt.color}22` : 'transparent',
                        color: myPref === opt.value ? opt.color : 'var(--text3)',
                        cursor: 'pointer', transition: 'all 120ms',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Schedule parameters + generate (organizer action) */}
      <Card>
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
          Schedule parameters (organizer)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>Hours per time block (morning/afternoon/evening)</label>
            <input type="number" min={1} max={8} step={0.5} value={schedParams.hoursPerPart}
              onChange={e => setSchedParams(p => ({ ...p, hoursPerPart: parseFloat(e.target.value) }))}
              style={{ width: '100%', marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>Duration multiplier (e.g. 1.5 = 150% of BGG duration)</label>
            <input type="number" min={1} max={4} step={0.1} value={schedParams.durationMultiplier}
              onChange={e => setSchedParams(p => ({ ...p, durationMultiplier: parseFloat(e.target.value) }))}
              style={{ width: '100%', marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>Max parallel games per time block</label>
            <input type="number" min={1} max={5} value={schedParams.maxParallelGames}
              onChange={e => setSchedParams(p => ({ ...p, maxParallelGames: parseInt(e.target.value) }))}
              style={{ width: '100%', marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>Min players per game</label>
            <input type="number" min={2} max={6} value={schedParams.minPlayersPerGame}
              onChange={e => setSchedParams(p => ({ ...p, minPlayersPerGame: parseInt(e.target.value) }))}
              style={{ width: '100%', marginTop: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>Prioritize preferences (0 = ignore, 2 = strong)</label>
            <input type="range" min={0} max={2} step={0.5} value={schedParams.prioritizePreferences}
              onChange={e => setSchedParams(p => ({ ...p, prioritizePreferences: parseFloat(e.target.value) }))}
              style={{ width: '100%', marginTop: 8 }}
            />
            <span style={{ fontSize: 11, color: 'var(--accent)' }}>{schedParams.prioritizePreferences}</span>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>Prioritize social mixing (0 = ignore, 2 = strong)</label>
            <input type="range" min={0} max={2} step={0.5} value={schedParams.prioritizeSocial}
              onChange={e => setSchedParams(p => ({ ...p, prioritizeSocial: parseFloat(e.target.value) }))}
              style={{ width: '100%', marginTop: 8 }}
            />
            <span style={{ fontSize: 11, color: 'var(--accent)' }}>{schedParams.prioritizeSocial}</span>
          </div>
        </div>

        <Btn onClick={handleGenerate} accent disabled={generating} style={{ padding: '10px 20px', fontSize: 14 }}>
          {generating ? 'Generating schedule…' : '✨ Generate schedule'}
        </Btn>
        {!allReady && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            ⚠ Not all participants have set preferences and availability yet — you can still generate.
          </p>
        )}
      </Card>
    </div>
  )
}

// ─── Phase 3: Schedule view ───────────────────────────────────────────────────

function SchedulePhase({ event, participants }) {
  const schedule = event.schedule || []
  const params = event.schedule_params || {}

  if (!schedule.length) {
    return <Card><p style={{ color: 'var(--text3)' }}>No schedule generated yet.</p></Card>
  }

  // Group by date + part
  const grouped = {}
  for (const slot of schedule) {
    const key = `${slot.date}_${slot.part}`
    if (!grouped[key]) grouped[key] = { date: slot.date, part: slot.part, games: [] }
    grouped[key].games.push(slot)
  }

  const partColors = { morning: 'var(--blue)', afternoon: 'var(--accent)', evening: 'var(--green)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      {params.stats && (
        <Card>
          <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Schedule overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            <Stat label="Total game slots" value={params.stats.totalGames} />
            <Stat label="Unique games" value={params.stats.uniqueGames} />
            {Object.values(params.stats.playerStats || {}).map(ps => (
              <Stat key={ps.name} label={ps.name} value={`${ps.gamesPlayed} games`} />
            ))}
          </div>
        </Card>
      )}

      {/* Schedule grid */}
      {Object.values(grouped).map(block => (
        <div key={`${block.date}_${block.part}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: partColors[block.part], textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {block.part}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{block.date}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {block.games.map((slot, i) => (
              <div key={i} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                {slot.thumbnail && (
                  <img src={slot.thumbnail} alt="" style={{ width: '100%', height: 80, objectFit: 'cover' }} />
                )}
                <div style={{ padding: '10px 12px' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
                    {slot.gameName}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>⏱ ~{slot.gameDuration} min</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {slot.players.map(p => (
                      <span key={p.id} style={{
                        fontSize: 11, background: 'var(--bg3)', borderRadius: 4,
                        padding: '2px 8px', color: 'var(--text2)',
                      }}>{p.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function EventPlanner({ collection }) {
  const [view, setView] = useState('list')   // list | create | event
  const [currentEvent, setCurrentEvent] = useState(null)

  if (!isConfigured()) return <NotConfigured />

  if (view === 'list') {
    return <EventList
      onOpen={ev => { setCurrentEvent(ev); setView('event') }}
      onNew={() => setView('create')}
    />
  }

  if (view === 'create') {
    return (
      <div>
        <button onClick={() => setView('list')} style={{ margin: '16px 0 0 16px', fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Back
        </button>
        <CreateEvent
          collection={collection}
          onCreated={ev => { setCurrentEvent(ev); setView('event') }}
        />
      </div>
    )
  }

  if (view === 'event' && currentEvent) {
    return (
      <div>
        <button onClick={() => setView('list')} style={{ margin: '16px 0 0 16px', fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← All events
        </button>
        <EventDashboard initialEvent={currentEvent} localCollection={collection} />
      </div>
    )
  }

  return null
}
