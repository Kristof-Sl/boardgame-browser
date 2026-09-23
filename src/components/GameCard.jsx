import React, { useState, useRef } from 'react'

const STATUS_INFO = {
  owned:      { label: 'Owns',             color: 'var(--green)',  bg: 'var(--green-bg)' },
  wishlist:   { label: 'Wishlist',          color: 'var(--blue)',   bg: 'var(--blue-bg)' },
  wantToPlay: { label: 'Wants to play',     color: 'var(--accent)', bg: 'rgba(232,200,74,0.12)' },
  prevOwned:  { label: 'Previously owned',  color: 'var(--text3)',  bg: 'rgba(255,255,255,0.06)' },
}

export default function GameCard({ game, isMobile, detailsMode = false, onDetails }) {
  const [imgErr, setImgErr] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [popupPos, setPopupPos] = useState({ top: false, left: false })
  const cardRef = useRef()

  const fileLinks = Array.isArray(game.files) ? game.files : []

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
      setPopupPos({
        top: window.innerHeight - rect.bottom < 280,
        left: window.innerWidth - rect.right < 260,
      })
    }
    setHovered(true)
  }

  const ownerBadges = game.actualOwners || []
  const userStatuses = Object.entries(game.ownerStatuses || {})
  const showPopup = hovered || detailsOpen

  // Popup content — shared between hover and details panel
  const popupContent = (
    <>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
        {game.name}{game.yearPublished ? ` (${game.yearPublished})` : ''}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {game.rating > 0 && (
          <PopupRow label="BGG rating">
            <span style={{ color: ratingColor, fontWeight: 600 }}>★ {game.rating.toFixed(1)}</span>
            {game.numRatings > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({game.numRatings.toLocaleString()})</span>}
          </PopupRow>
        )}
        {game.bggRank && <PopupRow label="BGG rank">#{game.bggRank.toLocaleString()}</PopupRow>}
        {playerStr && <PopupRow label="Players">{playerStr}</PopupRow>}
        {timeStr && <PopupRow label="Playtime">{timeStr}</PopupRow>}
        {game.minAge > 0 && <PopupRow label="Min. age">{game.minAge}+</PopupRow>}
      </div>
      {userStatuses.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '10px 0 8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {userStatuses.map(([username, status]) => {
              const hasStatus = status.owned || status.wishlist || status.wantToPlay || status.prevOwned
              return (
                <div key={username}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', flexShrink: 0 }}>{username}</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {status.owned      && <StatusPill type="owned" />}
                      {status.wishlist   && <StatusPill type="wishlist" />}
                      {status.wantToPlay && <StatusPill type="wantToPlay" />}
                      {!status.owned && status.prevOwned && <StatusPill type="prevOwned" />}
                      {!hasStatus && <span style={{ fontSize: 10, color: 'var(--text3)' }}>in collection</span>}
                    </div>
                  </div>
                  {(status.numPlays > 0 || status.userRating) && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                      {status.numPlays > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                          {status.numPlays} play{status.numPlays !== 1 ? 's' : ''}
                        </span>
                      )}
                      {status.userRating && (
                        <span style={{ fontSize: 10, color: 'var(--accent)' }}>
                          ★ {status.userRating.toFixed(1)} personal
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
      <a
        href={game.bggUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: 'block', marginTop: 10, fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}
      >
        Open on BGG ↗
      </a>
    </>
  )

  return (
    <div
      ref={cardRef}
      style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Card — no longer an <a>, so clicks on body don't navigate */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        color: 'inherit',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'border-color 180ms ease, transform 180ms ease',
        height: '100%',
      }}>
        {/* Thumbnail — this IS the link to BGG */}
        <a
          href={game.bggUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', position: 'relative', paddingTop: '56%', background: 'var(--bg3)', flexShrink: 0, textDecoration: 'none' }}
        >
          {game.thumbnail && !imgErr ? (
            <img src={game.thumbnail} alt={game.name} onError={() => setImgErr(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--text3)' }}>🎲</div>
          )}

          {/* Rating badge */}
          {game.rating > 0 && (
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(15,14,12,0.88)', backdropFilter: 'blur(4px)',
              borderRadius: 6, padding: '3px 7px',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, color: ratingColor,
            }}>★ {game.rating.toFixed(1)}</div>
          )}

          {/* Owner badges */}
          {ownerBadges.length > 0 && (
            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: '70%' }}>
              {ownerBadges.map(o => (
                <span key={o} style={{
                  background: 'rgba(15,14,12,0.88)', backdropFilter: 'blur(4px)',
                  borderRadius: 4, padding: '2px 6px',
                  fontSize: 10, color: 'var(--green)', fontWeight: 500, letterSpacing: '0.02em',
                }}>{o}</span>
              ))}
            </div>
          )}
        </a>

        {/* Card body — plain div, no navigation */}
        <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)' }}>
            {game.name}
          </p>
          {game.yearPublished && <p style={{ fontSize: 11, color: 'var(--text3)' }}>{game.yearPublished}</p>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {playerStr && <Stat icon="👤" label={playerStr} />}
            {timeStr && <Stat icon="⏱" label={timeStr} />}
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {game.owned && <Tag color="green">Owned</Tag>}
            {game.wishlist && <Tag color="blue">Wishlist</Tag>}
            {game.wantToPlay && <Tag color="amber">Want to play</Tag>}
            {game.prevOwned && <Tag color="gray">Prev. owned</Tag>}
          </div>

          {/* Show details button */}
          <button
            onClick={() => detailsMode ? onDetails?.(game) : setDetailsOpen(o => !o)}
            style={{
              marginTop: 6, padding: '4px 0',
              background: 'none', border: 'none',
              fontSize: 11, color: detailsOpen ? 'var(--accent)' : 'var(--text3)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'color 140ms',
            }}
          >
            {detailsMode ? '▣ Open details' : detailsOpen ? '▲ Hide details' : '▼ Show details'}
          </button>

          {/* Inline details panel (visible when detailsOpen) */}
          {!detailsMode && detailsOpen && (
            <div style={{
              marginTop: 4,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
            }}>
              {popupContent}
              <PlayerRecommendations details={game.details} />
            </div>
          )}
        </div>
      </div>

      {/* Hover popup — only on desktop (pointer: fine), hidden when detailsOpen */}
      {hovered && !detailsOpen && (
        <div style={{
          position: 'absolute',
          ...(popupPos.top ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
          ...(popupPos.left ? { right: 0 } : { left: 0 }),
          width: 256,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: '12px 14px',
          zIndex: 100,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          {popupContent}
        </div>
      )}
    </div>
  )
}

export function GameDetailsPanel({ game, onClose }) {
  const detail = game.details || game
  const fileLinks = Array.isArray(game.files) ? game.files : []
  const playerStr = !detail.minPlayers && !detail.maxPlayers ? null
    : detail.minPlayers === detail.maxPlayers ? `${detail.minPlayers}`
    : `${detail.minPlayers}–${detail.maxPlayers}`
  const timeStr = detail.minPlaytime && detail.maxPlaytime
    ? detail.minPlaytime === detail.maxPlaytime ? `${detail.minPlaytime} min`
      : `${detail.minPlaytime}–${detail.maxPlaytime} min`
    : detail.maxPlaytime ? `${detail.maxPlaytime} min` : null
  const ratingColor = detail.rating >= 8 ? 'var(--green)'
    : detail.rating >= 7 ? 'var(--accent)'
    : detail.rating >= 6 ? 'var(--text2)'
    : 'var(--text3)'
  const userStatuses = Object.entries(game.ownerStatuses || {})
  const categories = detail.categories || detail.themes || game.categories || game.themes || []
  const mechanics = detail.mechanics || game.mechanics || []
  const designers = detail.designers || game.designers || []
  const weight = Number(detail.averageweight ?? detail.weight ?? game.averageweight ?? game.weight) || 0

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
            {detail.name || game.name}
          </p>
          {detail.yearPublished && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{detail.yearPublished}</p>}
        </div>
        <button onClick={onClose} aria-label="Close details" style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>
      {(detail.image || detail.thumbnail) && <img src={detail.image || detail.thumbnail} alt={detail.name || game.name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {detail.rating > 0 && <PopupRow label="BGG rating"><span style={{ color: ratingColor, fontWeight: 600 }}>★ {detail.rating.toFixed(1)}</span>{detail.numRatings > 0 && <span style={{ color: 'var(--text3)', fontSize: 10 }}> ({detail.numRatings.toLocaleString()})</span>}</PopupRow>}
        {detail.bggRank && <PopupRow label="BGG rank">#{detail.bggRank.toLocaleString()}</PopupRow>}
        {playerStr && <PopupRow label="Players">{playerStr}</PopupRow>}
        {timeStr && <PopupRow label="Playtime">{timeStr}</PopupRow>}
        {detail.minAge > 0 && <PopupRow label="Min. age">{detail.minAge}+</PopupRow>}
        {weight > 0 && <PopupRow label="Weight">{weight.toFixed(2)} / 5</PopupRow>}
      </div>
      {(categories.length > 0 || mechanics.length > 0 || designers.length > 0) && <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categories.length > 0 && <PopupRow label="Categories">{categories.join(', ')}</PopupRow>}
        {mechanics.length > 0 && <PopupRow label="Mechanisms">{mechanics.join(', ')}</PopupRow>}
        {designers.length > 0 && <PopupRow label="Designers">{designers.join(', ')}</PopupRow>}
      </div>}
      {userStatuses.length > 0 && <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {userStatuses.map(([username, status]) => <div key={username} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 11, color: 'var(--text2)' }}>{username}</span><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{status.owned && <StatusPill type="owned" />}{status.wishlist && <StatusPill type="wishlist" />}{status.wantToPlay && <StatusPill type="wantToPlay" />}{!status.owned && status.prevOwned && <StatusPill type="prevOwned" />}</div></div>)}
      </div>}
      <PlayerRecommendations details={detail} />
      {detail.description && <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}><p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Description</p><p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{detail.description}</p></div>}
      {fileLinks.length > 0 && <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}><p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Files</p>{fileLinks.map((file, index) => <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 11, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all', marginBottom: 4 }}>{file.name || file.url}</a>)}</div>}
      <a href={detail.bggUrl || game.bggUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 16, fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Open on BGG ↗</a>
    </div>
  )
}

function PlayerRecommendations({ details }) {
  const recommendations = details?.suggestedPlayerCounts
  if (!recommendations) return null

  const formatPlayers = entries => entries.map(entry => entry.players).join(', ')
  const hasRecommendations = recommendations.best?.length || recommendations.recommended?.length || recommendations.notRecommended?.length
  if (!hasRecommendations) return null

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>BGG player recommendations</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 5 }}>
        {recommendations.best?.length > 0 && <PopupRow label="Best with">{formatPlayers(recommendations.best)}</PopupRow>}
        {recommendations.recommended?.length > 0 && <PopupRow label="Recommended with">{formatPlayers(recommendations.recommended)}</PopupRow>}
        {recommendations.notRecommended?.length > 0 && <PopupRow label="Not recommended">{formatPlayers(recommendations.notRecommended)}</PopupRow>}
      </div>
    </div>
  )
}

function StatusPill({ type }) {
  const info = STATUS_INFO[type]
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '1px 6px',
      borderRadius: 4, background: info.bg, color: info.color,
      whiteSpace: 'nowrap',
    }}>{info.label}</span>
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
    blue:  { bg: 'var(--blue-bg)',  text: 'var(--blue)' },
    amber: { bg: 'rgba(232,200,74,0.12)', text: 'var(--accent)' },
    gray:  { bg: 'rgba(255,255,255,0.06)', text: 'var(--text3)' },
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
