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
      borderRadius: 'var(--radius-lg)', padding: '20px', ...style,
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
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      transition: 'all 140ms', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  )
}

function Pill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 12,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'var(--accent-bg)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text2)',
      fontWeight: active ? 500 : 400,
      cursor: 'pointer', transition: 'all 140ms', whiteSpace: 'nowrap',
    }}>{label}</button>
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

// ─── Game filter bar (reused in voting + preferences) ─────────────────────────

function GameFilterBar({ games, filters, onChange }) {
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14,
    }}>
      {/* Search */}
      <input
        value={filters.search} onChange={e => onChange({ ...filters, search: e.target.value })}
        placeholder="Search games…"
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '7px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Players */}
        <FilterGroup label="Players">
          <Pill label="Any" active={!filters.players} onClick={() => onChange({ ...filters, players: null })} />
          {[1,2,3,4,5,6].map(n => (
            <Pill key={n} label={`${n}`}
              active={filters.players === n}
              onClick={() => onChange({ ...filters, players: filters.players === n ? null : n })} />
          ))}
          <Pill label="7+" active={filters.players === 7} onClick={() => onChange({ ...filters, players: filters.players === 7 ? null : 7 })} />
        </FilterGroup>

        {/* Playtime */}
        <FilterGroup label="Playtime">
          <Pill label="Any" active={!filters.maxTime} onClick={() => onChange({ ...filters, maxTime: null })} />
          {[[30,'≤30m'],[60,'≤60m'],[90,'≤90m'],[120,'≤2h'],[999,'2h+']].map(([v,l]) => (
            <Pill key={v} label={l}
              active={filters.maxTime === v}
              onClick={() => onChange({ ...filters, maxTime: filters.maxTime === v ? null : v })} />
          ))}
        </FilterGroup>

        {/* Min rating */}
        <FilterGroup label="Min. rating">
          <Pill label="Any" active={!filters.minRating} onClick={() => onChange({ ...filters, minRating: null })} />
          {[6,7,7.5,8,8.5].map(n => (
            <Pill key={n} label={`${n}+`}
              active={filters.minRating === n}
              onClick={() => onChange({ ...filters, minRating: filters.minRating === n ? null : n })} />
          ))}
        </FilterGroup>

        {/* Release date */}
        {(() => {
          const years = games.map(g => g.yearPublished).filter(Boolean)
          if (!years.length) return null
          const maxYear = new Date().getFullYear()
          const startDecade = Math.floor(Math.min(...years) / 10) * 10
          const allDecades = []
          for (let d = startDecade; d <= maxYear; d += 10) {
            if (years.some(y => y >= d && y < d + 10)) allDecades.push(d)
          }
          if (!allDecades.length) return null
          const selected = filters.decades || []
          const toggle = d => {
            const next = selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d]
            onChange({ ...filters, decades: next })
          }
          return (
            <FilterGroup label="Release date">
              <Pill label="Any" active={selected.length === 0} onClick={() => onChange({ ...filters, decades: [] })} />
              {allDecades.map(d => (
                <Pill key={d} label={`${d}s`} active={selected.includes(d)} onClick={() => toggle(d)} />
              ))}
            </FilterGroup>
          )
        })()}
      </div>
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <p style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function applyGameFilters(games, filters) {
  return games.filter(g => {
    if (filters.search && !g.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.players) {
      if (filters.players === 7) { if (g.maxPlayers < 7) return false }
      else { if (g.minPlayers > filters.players || g.maxPlayers < filters.players) return false }
    }
    if (filters.maxTime === 999) { if (g.maxPlaytime < 120) return false }
    else if (filters.maxTime) { if (!g.maxPlaytime || g.maxPlaytime > filters.maxTime) return false }
    if (filters.minRating && g.rating < filters.minRating) return false
    if (filters.decades && filters.decades.length > 0) {
      if (!g.yearPublished || !filters.decades.some(d => g.yearPublished >= d && g.yearPublished < d + 10)) return false
    }
    return true
  })
}

const EMPTY_GAME_FILTERS = { search: '', players: null, maxTime: null, minRating: null, decades: [] }

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
      const id = Math.random().toString(36).substring(2, 8).toUpperCase()
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
      await Promise.all(names.map(n => db.insert('participants', { event_id: id, name: n })))
      onCreated(event)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text)' }}>Create event</h2>
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
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
              />
              {participants.length > 2 && (
                <button onClick={() => removeParticipant(i)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>×</button>
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
                : 'No collection loaded in the browser yet'}
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
  const [votes, setVotes] = useState([])
  const [eventGames, setEventGames] = useState([])
  const [prefs, setPrefs] = useState([])
  const [me, setMe] = useState(null)
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
      setParticipants(p); setVotes(v); setEventGames(eg); setPrefs(pr)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [event.id])

  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const interval = setInterval(reload, 8000)
    return () => clearInterval(interval)
  }, [reload])

  const refreshEvent = async () => {
    const [ev] = await db.select('events', { filter: `id=eq.${event.id}` })
    if (ev) setEvent(ev)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading event…</div>

  if (!me) {
    return <ParticipantPicker event={event} participants={participants} onSelect={setMe} />
  }

  const mergedCollection = mergeCollections(event.collection || [], localCollection)
  const commonProps = { event, participants, me, votes, eventGames, prefs, reload, refreshEvent, mergedCollection }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>{event.name}</h2>
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

function mergeCollections(eventCol, localCol) {
  const map = new Map()
  // Start with event collection (basic game data from Supabase)
  for (const g of (eventCol || [])) map.set(g.id, g)
  // Layer in local collection — always copy ownership fields even if game already exists,
  // because the event collection never has ownerStatuses/actualOwners (those are browser-only)
  for (const g of (localCol || [])) {
    if (map.has(g.id)) {
      const existing = map.get(g.id)
      map.set(g.id, {
        ...existing,
        ownerStatuses: g.ownerStatuses || existing.ownerStatuses,
        actualOwners:  g.actualOwners  || existing.actualOwners,
        owners:        g.owners        || existing.owners,
        // Also fill in any missing stats from local collection
        rating:      existing.rating      || g.rating,
        numRatings:  existing.numRatings  || g.numRatings,
        bggRank:     existing.bggRank     || g.bggRank,
        minPlayers:  existing.minPlayers  || g.minPlayers,
        maxPlayers:  existing.maxPlayers  || g.maxPlayers,
        minPlaytime: existing.minPlaytime || g.minPlaytime,
        maxPlaytime: existing.maxPlaytime || g.maxPlaytime,
        minAge:      existing.minAge      || g.minAge,
        yearPublished: existing.yearPublished || g.yearPublished,
        thumbnail:   existing.thumbnail   || g.thumbnail,
      })
    } else {
      map.set(g.id, g)
    }
  }
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

// Fetch a single game from BGG by its numeric ID via the existing /api/bgg proxy
async function fetchBggGame(gameId) {
  const query = new URLSearchParams({ path: 'thing', id: gameId, stats: '1' }).toString()
  const res = await fetch('/api/bgg?' + query)
  const text = await res.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  if (doc.querySelector('parsererror') || !doc.querySelector('item')) {
    throw new Error('Game not found on BGG.')
  }
  const item = doc.querySelector('item')
  const getText = (sel) => item.querySelector(sel)?.textContent?.trim() || ''
  const getAttr = (sel, attr) => item.querySelector(sel)?.getAttribute(attr) || ''

  // Name: prefer primary, fall back to first
  const primaryName = item.querySelector('name[type="primary"]')
  const name = primaryName ? primaryName.getAttribute('value') : getAttr('name', 'value')
  const yearPublished = parseInt(getAttr('yearpublished', 'value')) || null
  const minPlayers = parseInt(getAttr('minplayers', 'value')) || 0
  const maxPlayers = parseInt(getAttr('maxplayers', 'value')) || 0
  const minPlaytime = parseInt(getAttr('minplaytime', 'value')) || 0
  const maxPlaytime = parseInt(getAttr('maxplaytime', 'value')) || 0
  const minAge = parseInt(getAttr('minage', 'value')) || 0
  const rating = Math.round((parseFloat(getAttr('statistics ratings average', 'value')) || 0) * 10) / 10
  const numRatings = parseInt(getAttr('statistics ratings usersrated', 'value')) || 0
  const rankEl = item.querySelector('statistics ratings ranks rank[name="boardgame"]')
  const bggRankRaw = rankEl?.getAttribute('value')
  const bggRank = bggRankRaw && bggRankRaw !== 'Not Ranked' ? parseInt(bggRankRaw) : null
  const thumbnailRaw = getText('thumbnail')
  const fixUrl = u => !u ? null : u.startsWith('//') ? 'https:' + u : u.startsWith('http') ? u : null
  const thumbnail = fixUrl(thumbnailRaw)

  return {
    id: gameId,
    name,
    yearPublished,
    minPlayers, maxPlayers, minPlaytime, maxPlaytime, minAge,
    rating, numRatings, bggRank,
    thumbnail,
    bggUrl: `https://boardgamegeek.com/boardgame/${gameId}`,
    owners: [], actualOwners: [], ownerStatuses: {},
  }
}

// Extract a BGG game ID from a BGG URL or a raw numeric ID
function parseBggInput(input) {
  const trimmed = input.trim()
  // Match URLs like boardgamegeek.com/boardgame/12345 or /boardgame/12345/game-name
  const urlMatch = trimmed.match(/boardgamegeek\.com\/boardgame\/(\d+)/)
  if (urlMatch) return urlMatch[1]
  // Raw numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}

function VotingPhase({ event, participants, me, votes, mergedCollection, reload }) {
  const [voteFilter, setVoteFilter] = useState('all') // all | voted | unvoted | allvotes
  const [gameFilters, setGameFilters] = useState(EMPTY_GAME_FILTERS)
  const [saving, setSaving] = useState(false)

  // BGG URL lookup state
  const [bggInput, setBggInput] = useState('')
  const [bggLookup, setBggLookup] = useState(null)   // null | 'loading' | { game } | { error }
  const [bggAdding, setBggAdding] = useState(false)

  // My votes: gameId -> vote value
  const myVotes = {}
  for (const v of votes) {
    if (v.participant_id === me.id) myVotes[v.game_id] = v.vote
  }

  // Vote tallies: gameId -> counts + game_name
  const tallies = {}
  for (const v of votes) {
    if (!tallies[v.game_id]) tallies[v.game_id] = { want: 0, neutral: 0, dont_want: 0, name: v.game_name, game_data: v.game_data }
    tallies[v.game_id][v.vote] = (tallies[v.game_id][v.vote] || 0) + 1
  }

  const handleVote = async (game, vote) => {
    setSaving(true)
    try {
      await db.upsert('game_votes', {
        event_id: event.id, participant_id: me.id,
        game_id: game.id, game_name: game.name,
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

  // Look up a game from BGG by URL/ID
  const handleBggLookup = async () => {
    const gameId = parseBggInput(bggInput)
    if (!gameId) {
      setBggLookup({ error: 'Please paste a valid BGG game URL (e.g. https://boardgamegeek.com/boardgame/12345) or a numeric game ID.' })
      return
    }
    // Check if already in collection
    if (mergedCollection.find(g => g.id === gameId)) {
      setBggLookup({ error: 'This game is already in the collection. Search for it above.' })
      return
    }
    setBggLookup('loading')
    try {
      const game = await fetchBggGame(gameId)
      setBggLookup({ game })
    } catch (e) {
      setBggLookup({ error: e.message })
    }
  }

  // Cast a vote for a game not in our collection (adds it temporarily via the vote itself)
  const handleVoteBggGame = async (game, vote) => {
    setBggAdding(true)
    try {
      await db.upsert('game_votes', {
        event_id: event.id, participant_id: me.id,
        game_id: game.id, game_name: game.name,
        game_data: {
          thumbnail: game.thumbnail, rating: game.rating,
          minPlayers: game.minPlayers, maxPlayers: game.maxPlayers,
          minPlaytime: game.minPlaytime, maxPlaytime: game.maxPlaytime,
          yearPublished: game.yearPublished,
        },
        vote,
      }, 'event_id,participant_id,game_id')
      await reload()
      setBggLookup(null)
      setBggInput('')
    } catch (e) { alert(e.message) }
    finally { setBggAdding(false) }
  }

  // Build the "all participant votes" list: games voted on by anyone, including those not in collection
  const allVotedGames = Object.entries(tallies).map(([gid, t]) => {
    const inCollection = mergedCollection.find(g => g.id === gid)
    if (inCollection) return inCollection
    // Game is not in collection: reconstruct a minimal game object from vote data
    const gd = t.game_data || {}
    return {
      id: gid, name: t.name,
      thumbnail: gd.thumbnail || null, rating: gd.rating || 0,
      minPlayers: gd.minPlayers || 0, maxPlayers: gd.maxPlayers || 0,
      minPlaytime: gd.minPlaytime || 0, maxPlaytime: gd.maxPlaytime || 0,
      yearPublished: gd.yearPublished || null,
      bggUrl: `https://boardgamegeek.com/boardgame/${gid}`,
      owners: [], actualOwners: [], ownerStatuses: {},
    }
  })

  // Apply game filters then vote-filter
  let games
  if (voteFilter === 'allvotes') {
    games = allVotedGames // show all games with any vote; no collection filter
  } else {
    games = applyGameFilters(mergedCollection, gameFilters)
    if (voteFilter === 'voted') games = games.filter(g => myVotes[g.id])
    else if (voteFilter === 'unvoted') games = games.filter(g => !myVotes[g.id])
  }

  const totalVoters = participants.length
  const myVoteCount = Object.keys(myVotes).length

  const VOTE_TOOLTIP = 'After voting closes, the admin will select the final game list. ' +
    'Games with at least one 👍 Want vote are automatically included. ' +
    'The admin can also manually add or remove games before moving to the preferences phase.'

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Card style={{ padding: '10px 16px', flex: 1, minWidth: 130 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>My votes</p>
          <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--accent)' }}>{myVoteCount}</p>
        </Card>
        <Card style={{ padding: '10px 16px', flex: 1, minWidth: 130 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Games with votes</p>
          <p style={{ fontSize: 20, fontWeight: 500 }}>{Object.keys(tallies).length}</p>
        </Card>
        <Card style={{ padding: '10px 16px', flex: 1, minWidth: 130 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Participants voted</p>
          <p style={{ fontSize: 20, fontWeight: 500 }}>{new Set(votes.map(v => v.participant_id)).size} / {totalVoters}</p>
        </Card>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
          Voting open — the admin will close when ready
        </div>
      </div>

      {/* Game filters (hidden when showing all-votes filter) */}
      {voteFilter !== 'allvotes' && (
        <GameFilterBar games={mergedCollection} filters={gameFilters} onChange={setGameFilters} />
      )}

      {/* Vote filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          ['all', 'All games'],
          ['voted', 'My votes only'],
          ['unvoted', 'Not yet voted'],
          ['allvotes', 'All participants votes'],
        ].map(([f, label]) => (
          <Pill key={f} label={label} active={voteFilter === f} onClick={() => setVoteFilter(f)} />
        ))}
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
          {voteFilter === 'allvotes' ? `${allVotedGames.length} games voted on` : `${mergedCollection.length} games · showing ${games.length}`}
        </span>
      </div>

      {/* Add game from BGG */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{
          fontSize: 12, color: 'var(--text3)', cursor: 'pointer', userSelect: 'none',
          padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8,
          border: '1px solid var(--border)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>+</span> Add a game from BGG that's not in our collection
        </summary>
        <div style={{ marginTop: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px' }}>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
            Paste the BGG page link for the game (e.g. <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>https://boardgamegeek.com/boardgame/12345</span>) or just the numeric ID.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={bggInput} onChange={e => { setBggInput(e.target.value); setBggLookup(null) }}
              onKeyDown={e => e.key === 'Enter' && handleBggLookup()}
              placeholder="https://boardgamegeek.com/boardgame/..."
              style={{
                flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
              }}
            />
            <Btn onClick={handleBggLookup} accent disabled={!bggInput.trim() || bggLookup === 'loading'}>
              {bggLookup === 'loading' ? 'Looking up…' : 'Look up'}
            </Btn>
          </div>

          {/* Error */}
          {bggLookup && bggLookup.error && (
            <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{bggLookup.error}</p>
          )}

          {/* Found game preview */}
          {bggLookup && bggLookup.game && (() => {
            const g = bggLookup.game
            const myVote = myVotes[g.id]
            return (
              <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {g.thumbnail && <img src={g.thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{g.name}</p>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                      {g.yearPublished && <span>{g.yearPublished}</span>}
                      {g.rating > 0 && <span>★ {g.rating.toFixed(1)}</span>}
                      {g.maxPlayers > 0 && <span>👤 {g.minPlayers}–{g.maxPlayers}</span>}
                      {g.maxPlaytime > 0 && <span>⏱ {g.maxPlaytime}m</span>}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Vote on this game to add it to the event's voting pool:
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {VOTE_OPTS.map(opt => (
                    <button key={opt.value} onClick={() => handleVoteBggGame(g, opt.value)} disabled={bggAdding}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        border: `1px solid ${myVote === opt.value ? opt.color : 'var(--border)'}`,
                        background: myVote === opt.value ? `${opt.color}22` : 'transparent',
                        color: myVote === opt.value ? opt.color : 'var(--text2)',
                        cursor: 'pointer', transition: 'all 120ms',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
                {myVote && <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>✓ Your vote has been recorded. The game now appears in "All participants' votes".</p>}
              </div>
            )
          })()}
        </div>
      </details>

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
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                {tally.want > 0 && <span style={{ color: 'var(--green)' }}>👍 {tally.want}</span>}
                {tally.neutral > 0 && <span>😐 {tally.neutral}</span>}
                {tally.dont_want > 0 && <span style={{ color: 'var(--red)' }}>👎 {tally.dont_want}</span>}
              </div>
              {/* Vote buttons with tooltip */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, position: 'relative' }}>
                {VOTE_OPTS.map(opt => (
                  <button key={opt.value} onClick={() => handleVote(game, opt.value)} disabled={saving}
                    title={VOTE_TOOLTIP}
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
            {voteFilter === 'allvotes'
              ? 'No votes cast yet by any participant.'
              : mergedCollection.length === 0 ? 'Load a collection in the main app first.' : 'No games match your filters.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Phase 2: Preferences & Availability ─────────────────────────────────────

function PreferencesPhase({ event, participants, me, eventGames, prefs, reload }) {
  const [savingPref, setSavingPref] = useState(null)
  const [savingAvail, setSavingAvail] = useState(false)
  const [gameFilters, setGameFilters] = useState(EMPTY_GAME_FILTERS)

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

  const participantsWithAvail = participants.filter(p => p.arrive_date && p.depart_date)
  const totalPrefsNeeded = participants.length * eventGames.length
  const totalPrefsGiven = prefs.length
  const partOptions = PARTS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))

  // Build game objects for filtering (from eventGames)
  const gamesForFilter = eventGames.map(eg => ({
    id: eg.game_id, name: eg.game_name,
    ...(eg.game_data || {}),
  }))
  const filteredEventGames = applyGameFilters(gamesForFilter, gameFilters)
  const filteredIds = new Set(filteredEventGames.map(g => g.id))

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
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          My preferences ({Object.keys(myPrefs).length} / {eventGames.length} rated)
        </p>

        {/* Game filters */}
        <GameFilterBar games={gamesForFilter} filters={gameFilters} onChange={setGameFilters} />

        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Showing {filteredEventGames.length} of {eventGames.length} games
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eventGames
            .filter(eg => filteredIds.has(eg.game_id))
            .map(eg => {
              const g = eg.game_data || {}
              const myPref = myPrefs[eg.game_id]
              return (
                <div key={eg.game_id} style={{
                  background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {g.thumbnail && <img src={g.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eg.game_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {g.maxPlayers > 0 && `👤 ${g.minPlayers}–${g.maxPlayers}`}
                        {g.maxPlaytime > 0 && ` · ⏱ ${g.maxPlaytime}m`}
                        {g.rating > 0 && ` · ★ ${g.rating.toFixed(1)}`}
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
                  {/* Others' preferences */}
                  {(() => {
                    const others = participants.filter(p => p.id !== me.id)
                    const gamePrefs = prefs.filter(p => p.game_id === eg.game_id && p.participant_id !== me.id)
                    if (gamePrefs.length === 0 && others.length === 0) return null
                    const PREF_DISPLAY = {
                      really_want: { icon: '❤️', color: '#e87d4a' },
                      want:        { icon: '👍', color: 'var(--green)' },
                      neutral:     { icon: '😐', color: 'var(--text3)' },
                      dont_want:   { icon: '👎', color: 'var(--red)' },
                    }
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text3)', alignSelf: 'center', marginRight: 2 }}>Others:</span>
                        {others.map(p => {
                          const pref = gamePrefs.find(r => r.participant_id === p.id)
                          const d = pref ? PREF_DISPLAY[pref.preference] : null
                          return (
                            <span key={p.id} title={pref ? pref.preference.replace('_', ' ') : 'not rated'} style={{
                              fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                              background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px',
                              color: d ? d.color : 'var(--text3)',
                              opacity: d ? 1 : 0.4,
                              border: `1px solid ${d ? d.color + '55' : 'var(--border)'}`,
                            }}>
                              <span style={{ fontSize: 10 }}>{d ? d.icon : '·'}</span>
                              {p.name}
                            </span>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
        </div>
      </Card>

      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
        Once all participants have set their preferences and availability, the admin will generate the schedule.
      </div>
    </div>
  )
}

// ─── Phase 3: Schedule view ───────────────────────────────────────────────────

function SchedulePhase({ event, participants, me, eventGames, prefs, mergedCollection }) {
  const schedule = event.schedule || []
  const params = event.schedule_params || {}
  const [myGamesOnly, setMyGamesOnly] = useState(false)
  const [showBringList, setShowBringList] = useState(false)

  if (!schedule.length) {
    return <Card><p style={{ color: 'var(--text3)' }}>No schedule generated yet.</p></Card>
  }

  const visibleSchedule = myGamesOnly
    ? schedule.filter(slot => slot.players && slot.players.some(p => p.id === me.id))
    : schedule

  const grouped = {}
  for (const slot of visibleSchedule) {
    const key = `${slot.date}_${slot.part}`
    if (!grouped[key]) grouped[key] = { date: slot.date, part: slot.part, games: [] }
    grouped[key].games.push(slot)
  }

  const partColors = { morning: 'var(--blue)', afternoon: 'var(--accent)', evening: 'var(--green)' }

  // Build bring list enriched with ownership from mergedCollection
  const scheduledGameIds = new Set(schedule.map(s => s.gameId))
  const bringList = eventGames
    .filter(eg => scheduledGameIds.has(eg.game_id))
    .map(eg => {
      const g = eg.game_data || {}
      const localGame = (mergedCollection || []).find(m => m.id === eg.game_id)
      const owners = localGame?.actualOwners || localGame?.owners || []
      return { id: eg.game_id, name: eg.game_name, thumbnail: g.thumbnail, owners }
    })

  // Build a lookup: gameId -> enriched data (from eventGames + mergedCollection)
  const gameDataMap = {}
  for (const eg of eventGames) {
    const localGame = (mergedCollection || []).find(m => m.id === eg.game_id)
    gameDataMap[eg.game_id] = {
      ...(eg.game_data || {}),
      bggUrl: `https://boardgamegeek.com/boardgame/${eg.game_id}`,
      actualOwners: localGame?.actualOwners || localGame?.owners || [],
      ownerStatuses: localGame?.ownerStatuses || {},
      rating: eg.game_data?.rating || localGame?.rating || 0,
      numRatings: localGame?.numRatings || 0,
      bggRank: localGame?.bggRank || null,
    }
  }

  if (showBringList) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowBringList(false)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back to schedule
          </button>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
            What to bring
          </h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>All games scheduled for this event, and who owns them.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bringList.map(g => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 14px',
            }}>
              {g.thumbnail && <img src={g.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{g.name}</p>
                {g.owners.length > 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                    Owned by: {g.owners.map((o, i) => (
                      <span key={o} style={{ color: 'var(--green)', fontWeight: 500 }}>
                        {o}{i < g.owners.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 3 }}>⚠ No owner recorded</p>
                )}
              </div>
            </div>
          ))}
          {bringList.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>No games found. The collection may not have owner data attached.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pill label="All games" active={!myGamesOnly} onClick={() => setMyGamesOnly(false)} />
        <Pill label="My games only" active={myGamesOnly} onClick={() => setMyGamesOnly(true)} />
        <span style={{ marginLeft: 'auto' }}>
          <Btn small onClick={() => setShowBringList(true)}>🎒 What to bring</Btn>
        </span>
      </div>

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

      {/* Preferences overview */}
      {eventGames.length > 0 && (
        <PreferencesOverview eventGames={eventGames} participants={participants} prefs={prefs} me={me} />
      )}

      {Object.keys(grouped).length === 0 && (
        <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 14 }}>
          You are not participating in any scheduled games.
        </p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {block.games.map((slot, i) => (
              <ScheduleGameCard
                key={i}
                slot={slot}
                gameData={gameDataMap[slot.gameId] || {}}
                me={me}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PreferencesOverview({ eventGames, participants, prefs, me }) {
  const [open, setOpen] = useState(false)

  const PREF_DISPLAY = {
    really_want: { icon: '❤️', label: 'Really want', color: '#e87d4a' },
    want:        { icon: '👍', label: 'Want',        color: 'var(--green)' },
    neutral:     { icon: '😐', label: 'Neutral',     color: 'var(--text3)' },
    dont_want:   { icon: '👎', label: "Don't want",  color: 'var(--red)' },
  }

  // Build map: gameId -> participantId -> preference
  const prefMap = {}
  for (const p of prefs) {
    if (!prefMap[p.game_id]) prefMap[p.game_id] = {}
    prefMap[p.game_id][p.participant_id] = p.preference
  }

  return (
    <Card>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preferences overview
        </p>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{open ? '▲ hide' : '▼ show'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px 6px 0', color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                  Game
                </th>
                {participants.map(p => (
                  <th key={p.id} style={{
                    padding: '6px 8px', color: p.id === me.id ? 'var(--accent)' : 'var(--text3)',
                    fontWeight: p.id === me.id ? 600 : 500,
                    textAlign: 'center', whiteSpace: 'nowrap',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 11,
                  }}>
                    {p.name}{p.id === me.id ? ' ★' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventGames.map((eg, i) => {
                const gamePrefs = prefMap[eg.game_id] || {}
                return (
                  <tr key={eg.game_id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                    <td style={{ padding: '7px 10px 7px 0', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 160, textOverflow: 'ellipsis', borderBottom: '1px solid var(--border)' }}>
                      {eg.game_name}
                    </td>
                    {participants.map(p => {
                      const pref = gamePrefs[p.id]
                      const d = pref ? PREF_DISPLAY[pref] : null
                      return (
                        <td key={p.id} style={{
                          textAlign: 'center', padding: '7px 8px',
                          borderBottom: '1px solid var(--border)',
                        }}>
                          {d ? (
                            <span title={d.label} style={{ fontSize: 14 }}>{d.icon}</span>
                          ) : (
                            <span style={{ color: 'var(--border2)', fontSize: 12 }}>–</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {Object.values(PREF_DISPLAY).map(d => (
              <span key={d.label} style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{d.icon}</span> {d.label}
              </span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--border2)' }}>–</span> Not rated
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

function ScheduleGameCard({ slot, gameData, me }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const isMe = slot.players && slot.players.some(p => p.id === me.id)
  const thumbnail = slot.thumbnail || gameData.thumbnail
  const bggUrl = gameData.bggUrl || `https://boardgamegeek.com/boardgame/${slot.gameId}`

  const ratingColor = (gameData.rating || 0) >= 8 ? 'var(--green)'
    : (gameData.rating || 0) >= 7 ? 'var(--accent)'
    : (gameData.rating || 0) >= 6 ? 'var(--text2)'
    : 'var(--text3)'

  const playerStr = gameData.minPlayers && gameData.maxPlayers
    ? gameData.minPlayers === gameData.maxPlayers ? `${gameData.minPlayers}`
      : `${gameData.minPlayers}–${gameData.maxPlayers}`
    : null

  const timeStr = gameData.minPlaytime && gameData.maxPlaytime
    ? gameData.minPlaytime === gameData.maxPlaytime ? `${gameData.minPlaytime} min`
      : `${gameData.minPlaytime}–${gameData.maxPlaytime} min`
    : gameData.maxPlaytime ? `${gameData.maxPlaytime} min` : null

  const ownerStatuses = gameData.ownerStatuses || {}
  const actualOwners = gameData.actualOwners || []
  const fileLinks = Array.isArray(gameData.files) ? gameData.files : []

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Thumbnail — links to BGG */}
      <a href={bggUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: 'block', position: 'relative', paddingTop: '56%', background: 'var(--bg3)', flexShrink: 0, textDecoration: 'none' }}
      >
        {thumbnail && !imgErr ? (
          <img src={thumbnail} alt={slot.gameName} onError={() => setImgErr(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--text3)' }}>🎲</div>
        )}
        {/* Rating badge */}
        {gameData.rating > 0 && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(15,14,12,0.88)', backdropFilter: 'blur(4px)',
            borderRadius: 5, padding: '2px 6px',
            fontSize: 11, fontWeight: 600, color: ratingColor,
          }}>★ {gameData.rating.toFixed(1)}</div>
        )}
        {/* Owner badges */}
        {actualOwners.length > 0 && (
          <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: '70%' }}>
            {actualOwners.map(o => (
              <span key={o} style={{
                background: 'rgba(15,14,12,0.88)', backdropFilter: 'blur(4px)',
                borderRadius: 3, padding: '1px 5px',
                fontSize: 10, color: 'var(--green)', fontWeight: 500,
              }}>{o}</span>
            ))}
          </div>
        )}
      </a>

      {/* Card body */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)' }}>
          {slot.gameName}
          {isMe && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6, fontFamily: 'var(--font-body)', fontWeight: 500 }}>★ you</span>}
        </p>

        <p style={{ fontSize: 11, color: 'var(--text3)' }}>⏱ ~{slot.gameDuration} min</p>

        {/* Players in this slot */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {slot.players && slot.players.map(p => (
            <span key={p.id} style={{
              fontSize: 11, borderRadius: 4, padding: '2px 7px',
              background: p.id === me.id ? 'var(--accent-bg)' : 'var(--bg3)',
              color: p.id === me.id ? 'var(--accent)' : 'var(--text2)',
              fontWeight: p.id === me.id ? 500 : 400,
            }}>{p.name}</span>
          ))}
        </div>

        {/* Show details toggle */}
        <button
          onClick={() => setDetailsOpen(o => !o)}
          style={{
            marginTop: 6, padding: '4px 0', background: 'none', border: 'none',
            fontSize: 11, color: detailsOpen ? 'var(--accent)' : 'var(--text3)',
            cursor: 'pointer', textAlign: 'left', transition: 'color 140ms',
          }}
        >
          {detailsOpen ? '▲ Hide details' : '▼ Show details'}
        </button>

        {/* Inline details panel */}
        {detailsOpen && (
          <div style={{
            marginTop: 4, background: 'var(--bg3)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {gameData.rating > 0 && (
              <SchRow label="BGG rating">
                <span style={{ color: ratingColor, fontWeight: 600 }}>★ {gameData.rating.toFixed(1)}</span>
                {gameData.numRatings > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({gameData.numRatings.toLocaleString()})</span>}
              </SchRow>
            )}
            {gameData.bggRank && <SchRow label="BGG rank">#{gameData.bggRank.toLocaleString()}</SchRow>}
            {playerStr && <SchRow label="Players">{playerStr}</SchRow>}
            {timeStr && <SchRow label="BGG playtime">{timeStr}</SchRow>}
            {gameData.minAge > 0 && <SchRow label="Min. age">{gameData.minAge}+</SchRow>}

            {/* Per-user ownership status */}
            {Object.keys(ownerStatuses).length > 0 && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '6px 0 4px' }} />
                {Object.entries(ownerStatuses).map(([username, status]) => {
                  const hasStatus = status.owned || status.wishlist || status.wantToPlay || status.prevOwned
                  return (
                    <div key={username} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', flexShrink: 0 }}>{username}</span>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {status.owned      && <SChPill label="Owns" color="var(--green)" bg="var(--green-bg)" />}
                        {status.wishlist   && <SChPill label="Wishlist" color="var(--blue)" bg="var(--blue-bg)" />}
                        {status.wantToPlay && <SChPill label="Wants to play" color="var(--accent)" bg="rgba(232,200,74,0.12)" />}
                        {!status.owned && status.prevOwned && <SChPill label="Prev. owned" color="var(--text3)" bg="rgba(255,255,255,0.06)" />}
                        {!hasStatus && <span style={{ fontSize: 10, color: 'var(--text3)' }}>in collection</span>}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {fileLinks.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Files</span>
                {fileLinks.map((file, index) => (
                  <a
                    key={index}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {file.name || file.url}
                  </a>
                ))}
              </div>
            )}
            <a href={bggUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', marginTop: 6, fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>
              Open on BGG ↗
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function SchRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function SChPill({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '1px 6px',
      borderRadius: 4, background: bg, color, whiteSpace: 'nowrap',
    }}>{label}</span>
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
  const [view, setView] = useState('list')
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
        <CreateEvent collection={collection} onCreated={ev => { setCurrentEvent(ev); setView('event') }} />
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
