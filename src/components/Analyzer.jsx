import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GameDetailsPanel } from './GameCard'

const INTERESTS = [
  { id: 'reallyWant', label: 'Really want', icon: '❤️', color: 'var(--green)' },
  { id: 'want', label: 'Want', icon: '👍', color: 'var(--accent)' },
  { id: 'neutral', label: 'Neutral', icon: '😐', color: 'var(--text2)' },
  { id: 'dontWant', label: "Don't want", icon: '👎', color: 'var(--red)' },
  { id: 'unmarked', label: 'Unmarked', icon: '·', color: 'var(--text3)' },
]

const PRESETS = [
  { id: 'date', label: 'Date night', note: '2 players · under 45 min', players: [2, 2], time: [0, 45], weight: [2, 3.2] },
  { id: 'kids', label: 'With 4 kids', note: '4 players · up to 90 min', players: [4, 4], time: [0, 90], weight: [1.5, 2.8] },
  { id: 'heavy', label: 'Weekend heavies', note: '90 min+ · meaty', players: [2, 5], time: [90, 240], weight: [3, 4.6] },
  { id: 'friends', label: 'Casual with friends', note: '4–8 players · easy', players: [4, 8], time: [0, 60], weight: [1.5, 2.5] },
  { id: 'solo', label: 'Solo session', note: '1 player', players: [1, 1], time: [0, 240], weight: [1, 4.6] },
]

const DEFAULT_FILTERS = {
  rating: [0, 10], weight: [0, 5], time: [0, 240], players: [1, 8],
  theme: '', mechanic: '', interest: [], search: '',
}

function numberValue(...values) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function enrichGame(game) {
  const detail = game.details || {}
  const weight = numberValue(game.weight, game.averageweight, detail.weight, detail.averageweight)
  return {
    ...game,
    analyzerWeight: weight,
    analyzerTheme: game.theme || detail.theme || detail.themes?.[0] || 'Unknown',
    analyzerMechanic: game.mechanic || game.mech || detail.mechanic || detail.mechanics?.[0] || 'Unknown',
    analyzerRating: numberValue(game.rating, detail.rating) || 0,
    analyzerMinPlayers: numberValue(game.minPlayers, detail.minPlayers) || 0,
    analyzerMaxPlayers: numberValue(game.maxPlayers, detail.maxPlayers) || 0,
    analyzerMinTime: numberValue(game.minPlaytime, detail.minPlaytime) || 0,
    analyzerMaxTime: numberValue(game.maxPlaytime, detail.maxPlaytime) || 0,
    analyzerYear: numberValue(game.yearPublished, detail.yearPublished),
    analyzerRatings: numberValue(game.numRatings, detail.numRatings) || 0,
  }
}

function formatRange(min, max, suffix = '') {
  if (!min && !max) return '—'
  if (min === max) return `${min}${suffix}`
  return `${min}–${max}${suffix}`
}

export default function Analyzer({ games }) {
  const [view, setView] = useState('map')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [preset, setPreset] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [importedGames, setImportedGames] = useState(null)
  const importRef = useRef()
  const [interest, setInterest] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bgg-browser-analyzer-interest') || '{}') } catch { return {} }
  })

  const analyzerGames = useMemo(() => (importedGames || games || []).map(enrichGame), [games, importedGames])
  const themes = useMemo(() => [...new Set(analyzerGames.map(game => game.analyzerTheme))].sort(), [analyzerGames])
  const mechanics = useMemo(() => [...new Set(analyzerGames.map(game => game.analyzerMechanic))].sort(), [analyzerGames])
  const bounds = useMemo(() => ({
    rating: [Math.min(0, ...analyzerGames.map(g => g.analyzerRating)), 10],
    weight: [0, Math.max(5, ...analyzerGames.map(g => g.analyzerWeight || 0))],
    time: [0, Math.max(240, ...analyzerGames.map(g => g.analyzerMaxTime || 0))],
    players: [1, Math.max(8, ...analyzerGames.map(g => g.analyzerMaxPlayers || 0))],
  }), [analyzerGames])

  useEffect(() => {
    localStorage.setItem('bgg-browser-analyzer-interest', JSON.stringify(interest))
  }, [interest])

  const filteredGames = useMemo(() => analyzerGames.filter(game => {
    if (filters.search && !game.name.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (game.analyzerRating < filters.rating[0] || game.analyzerRating > filters.rating[1]) return false
    if (game.analyzerWeight != null && (game.analyzerWeight < filters.weight[0] || game.analyzerWeight > filters.weight[1])) return false
    if (game.analyzerMaxTime && (game.analyzerMaxTime < filters.time[0] || game.analyzerMinTime > filters.time[1])) return false
    if (game.analyzerMaxPlayers && (game.analyzerMaxPlayers < filters.players[0] || game.analyzerMinPlayers > filters.players[1])) return false
    if (filters.theme && game.analyzerTheme !== filters.theme) return false
    if (filters.mechanic && game.analyzerMechanic !== filters.mechanic) return false
    if (filters.interest.length && !filters.interest.includes(interest[game.id] || 'unmarked')) return false
    return true
  }).sort((a, b) => b.analyzerRating - a.analyzerRating), [analyzerGames, filters, interest])

  const applyPreset = selected => {
    if (!selected) {
      setPreset(null)
      setFilters(DEFAULT_FILTERS)
      return
    }
    setPreset(selected.id)
    setFilters(current => ({ ...current, players: selected.players, time: selected.time, weight: selected.weight }))
  }

  const toggleInterest = (gameId, value) => {
    setInterest(current => {
      const next = { ...current }
      if (next[gameId] === value) delete next[gameId]
      else next[gameId] = value
      return next
    })
  }

  const handleImport = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      const imported = Array.isArray(payload) ? payload : payload.games
      if (Array.isArray(imported)) setImportedGames(imported)
      else if (payload.collections && typeof payload.collections === 'object') {
        const unique = new Map()
        Object.values(payload.collections).flat().forEach(game => {
          if (game?.id != null && !unique.has(String(game.id))) unique.set(String(game.id), game)
        })
        if (!unique.size) throw new Error('No games found in the JSON file.')
        setImportedGames([...unique.values()])
      } else throw new Error('Expected a games array or exported collections object.')
    } catch (error) {
      window.alert(`Analyzer import failed: ${error.message || error}`)
    }
    event.target.value = ''
  }

  return (
    <div className="analyzer-shell">
      <div className="analyzer-toolbar">
        <div>
          <p className="analyzer-kicker">Collection intelligence</p>
          <h2>Analyzer</h2>
          <p className="analyzer-subtitle">Explore {analyzerGames.length} games by rating, complexity, time, and player fit.</p>
        </div>
        <div className="analyzer-toolbar-actions">
          {importedGames && <button className="analyzer-source-reset" onClick={() => setImportedGames(null)}>Use app collection</button>}
          <button className="analyzer-import" onClick={() => importRef.current?.click()}>Import JSON</button>
          <input ref={importRef} type="file" accept=".json,application/json" onChange={handleImport} hidden />
          <div className="analyzer-view-tabs">
          {['map', 'yearly', 'list'].map(option => <button key={option} className={view === option ? 'active' : ''} onClick={() => setView(option)}>{option === 'map' ? 'Ratings map' : option === 'yearly' ? 'Yearly hits' : 'List'}</button>)}
          </div>
        </div>
      </div>

      <div className="analyzer-body">
        <aside className="analyzer-filters">
          <label className="analyzer-search"><span>Search collection</span><input value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Game name…" /></label>
          <section><h3>Presets</h3><div className="analyzer-presets">{PRESETS.map(option => <button key={option.id} className={preset === option.id ? 'active' : ''} onClick={() => applyPreset(preset === option.id ? null : option)}><strong>{option.label}</strong><small>{option.note}</small></button>)}</div></section>
          <AnalyzerRange label="BGG rating" values={filters.rating} bounds={[0, 10]} step={0.1} onChange={value => setFilters({ ...filters, rating: value })} format={value => value.toFixed(1)} />
          <AnalyzerRange label="Complexity" values={filters.weight} bounds={bounds.weight} step={0.1} onChange={value => setFilters({ ...filters, weight: value })} format={value => value.toFixed(1)} />
          <AnalyzerRange label="Playtime" values={filters.time} bounds={bounds.time} step={5} onChange={value => setFilters({ ...filters, time: value })} format={value => `${value}${value >= bounds.time[1] ? '+' : ''}m`} />
          <AnalyzerRange label="Players" values={filters.players} bounds={bounds.players} step={1} onChange={value => setFilters({ ...filters, players: value })} format={value => `${value}${value >= bounds.players[1] ? '+' : ''}`} />
          <label><span>Theme</span><select value={filters.theme} onChange={event => setFilters({ ...filters, theme: event.target.value })}><option value="">Any theme</option>{themes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Mechanic</span><select value={filters.mechanic} onChange={event => setFilters({ ...filters, mechanic: event.target.value })}><option value="">Any mechanic</option>{mechanics.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <section><h3>Player interest</h3><div className="analyzer-interest-filter">{INTERESTS.map(option => <button key={option.id} className={filters.interest.includes(option.id) ? 'active' : ''} onClick={() => setFilters({ ...filters, interest: filters.interest.includes(option.id) ? filters.interest.filter(value => value !== option.id) : [...filters.interest, option.id] })}>{option.icon} {option.label}</button>)}</div></section>
          <button className="analyzer-reset" onClick={() => { setFilters(DEFAULT_FILTERS); setPreset(null) }}>Reset filters</button>
        </aside>

        <main className="analyzer-results">
          <div className="analyzer-result-head"><span>{filteredGames.length} matching games</span><span>Interest markings are saved in this browser</span></div>
          {filteredGames.length === 0 ? <div className="analyzer-empty">No games match these filters.</div> : view === 'map' ? <RatingsMap games={filteredGames} onSelect={setSelectedGame} /> : view === 'yearly' ? <YearlyView games={filteredGames} onSelect={setSelectedGame} /> : <ListView games={filteredGames} interest={interest} onSelect={setSelectedGame} />}
        </main>

        <aside className="analyzer-detail-column">{selectedGame ? <GameDetailsPanel game={selectedGame} onClose={() => setSelectedGame(null)} /> : <div className="analyzer-empty analyzer-empty-detail">Select a game to see its details and mark player interest.</div>}</aside>
      </div>
    </div>
  )
}

function AnalyzerRange({ label, values, bounds, step, onChange, format }) {
  const update = (index, raw) => {
    const next = [...values]
    next[index] = Number(raw)
    if (index === 0) next[0] = Math.min(next[0], next[1])
    else next[1] = Math.max(next[1], next[0])
    onChange(next)
  }
  return <label className="analyzer-range"><span><b>{label}</b><em>{format(values[0])} – {format(values[1])}</em></span><div><input type="range" min={bounds[0]} max={bounds[1]} step={step} value={values[0]} onChange={event => update(0, event.target.value)} /><input type="range" min={bounds[0]} max={bounds[1]} step={step} value={values[1]} onChange={event => update(1, event.target.value)} /></div></label>
}

function RatingsMap({ games, onSelect }) {
  const width = 900
  const height = 520
  const valid = games.filter(game => game.analyzerWeight != null && game.analyzerRating > 0)
  const x = value => 50 + ((value - 1) / 3.6) * (width - 90)
  const y = value => height - 45 - ((value - 5) / 5) * (height - 85)
  return <div className="analyzer-map"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Complexity against BGG rating"><line x1="50" y1="25" x2="50" y2={height - 45} /><line x1="50" y1={height - 45} x2={width - 40} y2={height - 45} />{[1, 2, 3, 4].map(value => <g key={value}><line className="grid" x1={x(value)} y1="25" x2={x(value)} y2={height - 45} /><text x={x(value)} y={height - 20}>{value}</text></g>)}{[6, 7, 8, 9].map(value => <g key={value}><line className="grid" x1="50" y1={y(value)} x2={width - 40} y2={y(value)} /><text x="28" y={y(value) + 4}>{value}</text></g>)}{valid.map(game => <g key={game.id} className="analyzer-dot" onClick={() => onSelect(game)}><circle cx={x(game.analyzerWeight)} cy={y(game.analyzerRating)} r={Math.max(5, Math.min(13, 4 + Math.sqrt(game.analyzerRatings || 1) / 35))} /><title>{game.name}</title></g>)}<text className="axis-label" x={width / 2} y={height - 3}>Complexity</text><text className="axis-label" transform={`translate(12 ${height / 2}) rotate(-90)`}>BGG rating</text></svg><div className="analyzer-map-note">Click a point to open details. Games without complexity metadata are omitted from the map.</div></div>
}

function YearlyView({ games, onSelect }) {
  const grouped = games.reduce((result, game) => { const year = game.analyzerYear || 'Unknown'; (result[year] ||= []).push(game); return result }, {})
  return <div className="analyzer-years">{Object.entries(grouped).sort(([a], [b]) => String(b).localeCompare(String(a))).map(([year, yearGames]) => <section key={year}><h3>{year}</h3><div>{yearGames.map(game => <button key={game.id} onClick={() => onSelect(game)}><img src={game.thumbnail || game.details?.thumbnail || ''} alt="" /><span>{game.name}</span><small>{game.analyzerRating ? `★ ${game.analyzerRating.toFixed(1)}` : 'Unrated'}</small></button>)}</div></section>)}</div>
}

function ListView({ games, interest, onSelect }) {
  return <div className="analyzer-list">{games.map((game, index) => <button key={game.id} onClick={() => onSelect(game)}><strong>{index + 1}</strong><img src={game.thumbnail || game.details?.thumbnail || ''} alt="" /><span><b>{game.name}</b><small>{formatRange(game.analyzerMinPlayers, game.analyzerMaxPlayers, ' players')} · {formatRange(game.analyzerMinTime, game.analyzerMaxTime, ' min')} · {game.analyzerYear || 'Unknown'}</small></span><em>{INTERESTS.find(option => option.id === (interest[game.id] || 'unmarked'))?.icon}</em><i>{game.analyzerRating ? game.analyzerRating.toFixed(1) : '—'}</i></button>)}</div>
}
