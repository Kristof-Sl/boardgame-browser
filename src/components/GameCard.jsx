import React, { useState, useRef } from 'react'

export default function GameCard({ game }) {
  const [imgErr, setImgErr] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: true, left: true })
  const cardRef = useRef()

  const playerStr = !game.minPlayers && !game.maxPlayers ? null
    : game.minPlayers === game.maxPlayers ? `${game.minPlayers}`
    : `${game.minPlayers}–${game.maxPlayers}`

  const timeStr = game.minPlaytime && game.maxPlaytime
    ? game.minPlaytime === game.maxPlaytime ? `${game.minPlaytime} min`
      : `${game.minPlaytime}–${game.maxPlaytime} min`
    : game.maxPlaytime ? `${game.maxPlaytime} min` : null

  const ratingColor = game.rating >= 8 ? 'var(--green)'
    : game.rating >= 7 ? 'var(--accent)'
    : game.rating >= 6 ? 'var(--text2)'
    : 'var(--text3)'

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceRight = window.innerWidth - rect.right
      setPopupPos({ top: spaceBelow < 220, left: spaceRight < 240 })
    }
    setHovered(true)
  }

  return (
    <div
      ref={cardRef}
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={game.bggUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)',
          border: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          textDecoration: 'none', color: 'inherit',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'border-color 180ms ease, transform 180ms ease',
          cursor: 'pointer', height: '100%',
        }}
      >
        {/* Thumbnail */}
        <div style={{ position: 'relative', paddingTop: '56%', background: 'var(--bg3)', flexShrink: 0 }}>
          {game.thumbnail && !imgErr ? (
            <img
              src={game.thumbnail} alt={game.name}
              onError={() => setImgErr(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--text3)' }}>
              🎲
            </div>
          )}

          {/* Rating badge */}
          {game.rating > 0 && (
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(15,14,12,0.88)', backdropFilter: 'blur(4px)',
              borderRadius: 6, padding: '3px 7px',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, color: ratingColor,
            }}>
              ★ {game.rating.toFixed(1)}
            </div>
          )}

          {/* Owner badges */}
          {game.owners.length > 0 && (
            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: '70%' }}>
              {game.owners.map(o => (
                <span key={o} style={{
                  background: 'rgba(15,14,12,0.88)', backdropFilter: 'blur(4px)',
                  borderRadius: 4, padding: '2px 6px',
                  fontSize: 10, color: 'var(--accent)', fontWeight: 500, letterSpacing: '0.02em',
                }}>{o}</span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500,
            lineHeight: 1.3, color: 'var(--text)',
          }}>{game.name}</p>

          {game.yearPublished && (
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>{game.yearPublished}</p>
          )}

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {playerStr && <Stat icon="👤" label={playerStr} />}
            {timeStr && <Stat icon="⏱" label={timeStr} />}
          </div>

          {/* Status tags */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {game.owned && <Tag color="green">Owned</Tag>}
            {game.wishlist && <Tag color="blue">Wishlist</Tag>}
            {game.wantToPlay && <Tag color="amber">Want to play</Tag>}
            {game.prevOwned && <Tag color="gray">Prev. owned</Tag>}
          </div>
        </div>
      </a>

      {/* Hover popup */}
      {hovered && (
        <div style={{
          position: 'absolute',
          ...(popupPos.top ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
          ...(popupPos.left ? { right: 0 } : { left: 0 }),
          width: 230,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: '12px 14px',
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
            {game.name} {game.yearPublished ? `(${game.yearPublished})` : ''}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {game.rating > 0 && (
              <PopupRow label="BGG rating">
                <span style={{ color: ratingColor, fontWeight: 600 }}>★ {game.rating.toFixed(1)}</span>
                {game.numRatings > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({game.numRatings.toLocaleString()} ratings)</span>}
              </PopupRow>
            )}
            {game.bggRank && <PopupRow label="BGG rank">#{game.bggRank.toLocaleString()}</PopupRow>}
            {game.userRating && <PopupRow label="Your rating">★ {game.userRating.toFixed(1)}</PopupRow>}
            {playerStr && <PopupRow label="Players">{playerStr}</PopupRow>}
            {timeStr && <PopupRow label="Playtime">{timeStr}</PopupRow>}
            {game.minAge > 0 && <PopupRow label="Min. age">{game.minAge}+</PopupRow>}
            {game.numPlays > 0 && <PopupRow label="Plays logged">{game.numPlays}</PopupRow>}
            {game.owners.length > 0 && (
              <PopupRow label="Owner(s)">{game.owners.join(', ')}</PopupRow>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {game.owned && <Tag color="green">Owned</Tag>}
            {game.wishlist && <Tag color="blue">Wishlist</Tag>}
            {game.wantToPlay && <Tag color="amber">Want to play</Tag>}
            {game.prevOwned && <Tag color="gray">Prev. owned</Tag>}
          </div>

          <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>Click to open on BGG ↗</p>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text2)' }}>
      <span style={{ fontSize: 10 }}>{icon}</span> {label}
    </span>
  )
}

function PopupRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text)', textAlign: 'right' }}>{children}</span>
    </div>
  )
}

function Tag({ children, color }) {
  const colors = {
    green: { bg: 'var(--green-bg)', text: 'var(--green)' },
    blue: { bg: 'var(--blue-bg)', text: 'var(--blue)' },
    amber: { bg: 'rgba(232,200,74,0.12)', text: 'var(--accent)' },
    gray: { bg: 'rgba(255,255,255,0.06)', text: 'var(--text3)' },
  }
  const c = colors[color] || colors.gray
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
      background: c.bg, color: c.text,
      borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
    }}>{children}</span>
  )
}
