import React from 'react'

export default function FilterBar({ filters, onChange, games }) {
  // Derive max players from data
  const maxPossiblePlayers = Math.min(
    Math.max(...games.map(g => g.maxPlayers).filter(Boolean), 10),
    20
  )

  const pill = (label, active, onClick) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 20,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text2)',
        fontSize: 13, fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 140ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>

      {/* Search */}
      <input
        type="text"
        placeholder="Search games…"
        value={filters.search}
        onChange={e => onChange('search', e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 12px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 140ms',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--border2)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />

      {/* Status */}
      <Section label="Status">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pill('All', !filters.status, () => onChange('status', null))}
          {pill('Owned', filters.status === 'owned', () => onChange('status', filters.status === 'owned' ? null : 'owned'))}
          {pill('Wishlist', filters.status === 'wishlist', () => onChange('status', filters.status === 'wishlist' ? null : 'wishlist'))}
          {pill('Want to play', filters.status === 'wantToPlay', () => onChange('status', filters.status === 'wantToPlay' ? null : 'wantToPlay'))}
        </div>
      </Section>

      {/* Player count */}
      <Section label="Player count">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pill('Any', !filters.players, () => onChange('players', null))}
          {[1, 2, 3, 4, 5, 6].map(n =>
            pill(`${n}`, filters.players === n, () => onChange('players', filters.players === n ? null : n))
          )}
          {pill('7+', filters.players === 7, () => onChange('players', filters.players === 7 ? null : 7))}
        </div>
      </Section>

      {/* Rating */}
      <Section label="Min. BGG rating">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pill('Any', !filters.minRating, () => onChange('minRating', null))}
          {[6, 7, 7.5, 8, 8.5].map(n =>
            pill(`${n}+`, filters.minRating === n, () => onChange('minRating', filters.minRating === n ? null : n))
          )}
        </div>
      </Section>

      {/* Playtime */}
      <Section label="Playtime">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pill('Any', !filters.maxTime, () => onChange('maxTime', null))}
          {pill('≤30m', filters.maxTime === 30, () => onChange('maxTime', filters.maxTime === 30 ? null : 30))}
          {pill('≤60m', filters.maxTime === 60, () => onChange('maxTime', filters.maxTime === 60 ? null : 60))}
          {pill('≤90m', filters.maxTime === 90, () => onChange('maxTime', filters.maxTime === 90 ? null : 90))}
          {pill('≤2h', filters.maxTime === 120, () => onChange('maxTime', filters.maxTime === 120 ? null : 120))}
          {pill('2h+', filters.maxTime === 999, () => onChange('maxTime', filters.maxTime === 999 ? null : 999))}
        </div>
      </Section>

      {/* Release Date */}
      <Section label="Release date">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(() => {
            const years = games.map(g => g.yearPublished).filter(Boolean)
            if (!years.length) return null
            const maxYear = new Date().getFullYear()
            const minYear = Math.min(...years)
            const allDecades = []
            const startDecade = Math.floor(minYear / 10) * 10
            for (let d = startDecade; d <= maxYear; d += 10) {
              if (years.some(y => y >= d && y < d + 10)) allDecades.push(d)
            }
            const selected = filters.decades || []
            const toggle = (d) => {
              const next = selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d]
              onChange('decades', next)
            }
            return [
              <button
                key="any"
                onClick={() => onChange('decades', [])}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 13,
                  border: `1px solid ${selected.length === 0 ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected.length === 0 ? 'var(--accent-bg)' : 'transparent',
                  color: selected.length === 0 ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: selected.length === 0 ? 500 : 400,
                  cursor: 'pointer', transition: 'all 140ms ease', whiteSpace: 'nowrap',
                }}
              >Any</button>,
              ...allDecades.map(d => {
                const active = selected.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggle(d)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 13,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-bg)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text2)',
                      fontWeight: active ? 500 : 400,
                      cursor: 'pointer', transition: 'all 140ms ease', whiteSpace: 'nowrap',
                    }}
                  >{d}s</button>
                )
              })
            ]
          })()}
        </div>
      </Section>

      {/* Sort */}
      <Section label="Sort by">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['rating', 'Rating'],
            ['name', 'Name'],
            ['year', 'Year'],
            ['plays', 'Most played'],
            ['rank', 'BGG rank'],
          ].map(([val, label]) =>
            pill(label, filters.sort === val, () => onChange('sort', val))
          )}
        </div>
      </Section>

    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
        {label}
      </p>
      {children}
    </div>
  )
}
