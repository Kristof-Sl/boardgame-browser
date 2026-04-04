import React, { useState } from 'react'

const starIcon = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
    <path d="M6 0l1.5 4.5H12L8.25 7.5 9.75 12 6 9 2.25 12l1.5-4.5L0 4.5h4.5z"/>
  </svg>
)

const personIcon = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="3.5" r="2"/>
    <path d="M1 11c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
  </svg>
)

const clockIcon = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="5"/>
    <path d="M6 3v3l2 1.5"/>
  </svg>
)

export default function GameCard({ game }) {
  const [imgErr, setImgErr] = useState(false)

  const playerStr = game.minPlayers === game.maxPlayers
    ? `${game.minPlayers}`
    : `${game.minPlayers}–${game.maxPlayers}`

  const timeStr = game.minPlaytime && game.maxPlaytime
    ? game.minPlaytime === game.maxPlaytime
      ? `${game.minPlaytime}m`
      : `${game.minPlaytime}–${game.maxPlaytime}m`
    : game.maxPlaytime ? `${game.maxPlaytime}m` : null

  const ratingColor = game.rating >= 8 ? 'var(--green)' : game.rating >= 7 ? 'var(--accent)' : 'var(--text2)'

  return (
    <a
      href={game.bggUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color var(--transition), transform var(--transition)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border2)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingTop: '56%', background: 'var(--bg3)', flexShrink: 0 }}>
        {game.thumbnail && !imgErr ? (
          <img
            src={game.thumbnail}
            alt={game.name}
            onError={() => setImgErr(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, color: 'var(--text3)',
          }}>
            🎲
          </div>
        )}
        {game.rating > 0 && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(15,14,12,0.85)',
            backdropFilter: 'blur(4px)',
            borderRadius: 6,
            padding: '3px 7px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 500,
            color: ratingColor,
          }}>
            {starIcon} {game.rating.toFixed(1)}
          </div>
        )}
        {/* Owner badges */}
        {game.owners.length > 0 && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: '60%',
          }}>
            {game.owners.map(o => (
              <span key={o} style={{
                background: 'rgba(15,14,12,0.85)',
                backdropFilter: 'blur(4px)',
                borderRadius: 4, padding: '2px 6px',
                fontSize: 10, color: 'var(--accent)',
                fontWeight: 500, letterSpacing: '0.02em',
              }}>
                {o}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 500,
            lineHeight: 1.3, color: 'var(--text)',
            marginBottom: 2,
          }}>
            {game.name}
          </p>
          {game.yearPublished && (
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>{game.yearPublished}</p>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 6 }}>
          {game.maxPlayers > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
              {personIcon} {playerStr}
            </span>
          )}
          {timeStr && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
              {clockIcon} {timeStr}
            </span>
          )}
          {game.numPlays > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {game.numPlays} play{game.numPlays !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Status tags */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {game.owned && <Tag color="green">Owned</Tag>}
          {game.wishlist && <Tag color="blue">Wishlist</Tag>}
          {game.wantToPlay && <Tag color="amber">Want to play</Tag>}
          {game.prevOwned && <Tag color="gray">Previously owned</Tag>}
        </div>
      </div>
    </a>
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
      borderRadius: 4, padding: '2px 6px',
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}
