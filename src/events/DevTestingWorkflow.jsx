// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  ⚠️  DEV / TESTING WORKFLOW — TEMPORARY                                      ║
// ║                                                                              ║
// ║  This file exists solely to speed up manual testing of the scheduling       ║
// ║  module.  It is NOT part of the production feature set.                     ║
// ║                                                                              ║
// ║  TO REMOVE:                                                                  ║
// ║    1. Delete this file (src/events/DevTestingWorkflow.jsx)                  ║
// ║    2. Remove the import + <DevTestingWorkflow … /> from AdminPage.jsx        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import React, { useState, useRef } from 'react'
import { db } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTS = ['morning', 'afternoon', 'evening']

// Rank (1 = most preferred) → preference string, given total N games.
// Distribution: top 25 % → really_want, 25–50 % → want,
//               50–75 % → neutral, bottom 25 % → dont_want.
function rankToPreference(rank, total) {
  if (!rank || isNaN(rank) || rank < 1) return 'dont_want'
  const r = Math.min(rank, total)
  if (r <= Math.ceil(total * 0.25)) return 'really_want'
  if (r <= Math.ceil(total * 0.50)) return 'want'
  if (r <= Math.ceil(total * 0.75)) return 'neutral'
  return 'dont_want'
}

// ─── Shared primitives (local copies so this file is self-contained) ──────────

function Section({ title, emoji, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      border: '2px dashed #f59e0b44',
      borderRadius: 12,
      overflow: 'hidden',
      background: '#f59e0b08',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#f59e0b99' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, disabled, accent, danger, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '4px 10px' : '7px 14px',
        borderRadius: 7, fontSize: small ? 12 : 13, fontWeight: 500,
        border: `1px solid ${danger ? '#e05a5a' : accent ? '#f59e0b' : 'var(--border)'}`,
        background: danger ? 'rgba(224,90,90,.12)' : accent ? 'rgba(245,158,11,.15)' : 'transparent',
        color: danger ? '#e05a5a' : accent ? '#f59e0b' : 'var(--text2)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap', transition: 'all 140ms',
      }}
    >{children}</button>
  )
}

function Notice({ children, type = 'info' }) {
  const colors = { info: '#3b82f6', warn: '#f59e0b', ok: '#4ade80', err: '#e05a5a' }
  const c = colors[type] || colors.info
  return (
    <div style={{
      fontSize: 12, borderRadius: 7, padding: '8px 12px',
      background: `${c}18`, border: `1px solid ${c}44`,
      color: `${c}`, lineHeight: 1.5,
    }}>{children}</div>
  )
}

// ─── Step 1 — Availability editor ─────────────────────────────────────────────

function AvailabilityEditor({ event, participants, onRefresh }) {
  // Local state: participantId → { arrive_date, arrive_part, depart_date, depart_part }
  const [local, setLocal] = useState(() => {
    const m = {}
    for (const p of participants) {
      m[p.id] = {
        arrive_date: p.arrive_date || event.start_date || '',
        arrive_part: p.arrive_part || 'morning',
        depart_date: p.depart_date || event.end_date || '',
        depart_part: p.depart_part || 'evening',
      }
    }
    return m
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const set = (pid, field, value) =>
    setLocal(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }))

  const handleSaveAll = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await Promise.all(
        participants.map(p =>
          db.update('participants', local[p.id], `id=eq.${p.id}`)
        )
      )
      setMsg({ type: 'ok', text: 'Availability saved for all participants.' })
      onRefresh()
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (participants.length === 0)
    return <Notice type="warn">No participants registered yet.</Notice>

  const inputStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 8px', color: 'var(--text)',
    fontSize: 12, outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Notice type="info">
        Set arrive / depart for each player. These drive which time-slots the
        scheduler can assign them to.
      </Notice>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {participants.map(p => {
          const v = local[p.id] || {}
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px',
              flexWrap: 'wrap',
            }}>
              {/* Avatar */}
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(245,158,11,.2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: '#f59e0b', flexShrink: 0,
              }}>
                {p.name[0].toUpperCase()}
              </div>

              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', minWidth: 90 }}>
                {p.name}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Arrive</span>
                <input
                  type="date" value={v.arrive_date || ''}
                  min={event.start_date} max={event.end_date}
                  onChange={e => set(p.id, 'arrive_date', e.target.value)}
                  style={inputStyle}
                />
                <select
                  value={v.arrive_part || 'morning'}
                  onChange={e => set(p.id, 'arrive_part', e.target.value)}
                  style={inputStyle}
                >
                  {PARTS.map(pt => (
                    <option key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</option>
                  ))}
                </select>

                <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>Depart</span>
                <input
                  type="date" value={v.depart_date || ''}
                  min={event.start_date} max={event.end_date}
                  onChange={e => set(p.id, 'depart_date', e.target.value)}
                  style={inputStyle}
                />
                <select
                  value={v.depart_part || 'evening'}
                  onChange={e => set(p.id, 'depart_part', e.target.value)}
                  style={inputStyle}
                >
                  {PARTS.map(pt => (
                    <option key={pt} value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Btn accent onClick={handleSaveAll} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save all availability'}
        </Btn>
        {msg && <Notice type={msg.type}>{msg.text}</Notice>}
      </div>
    </div>
  )
}

// ─── Step 2 — Download CSV ─────────────────────────────────────────────────────

function DownloadCsv({ event, participants, eventGames }) {
  const handleDownload = () => {
    if (eventGames.length === 0) return alert('No games in this event yet.')
    if (participants.length === 0) return alert('No participants yet.')

    // Header row
    const headers = ['game_id', 'game_name', ...participants.map(p => p.name)]

    // One row per game, preference cells empty
    const rows = eventGames.map(eg => [
      eg.game_id,
      eg.game_name,
      ...participants.map(() => ''),
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => {
        const s = String(cell ?? '')
        // Quote cells that contain commas, quotes, or newlines
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
      .join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `preferences-${event.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Notice type="info">
        Downloads a CSV with one row per game and one column per participant.
        Fill in each cell with a rank number — <strong>1 = most preferred</strong>,
        higher numbers = less preferred. Leave a cell blank to mark it as
        "don't want". The scheduler converts ranks to preference tiers as follows:
        top 25 % → ❤️ really want · 25–50 % → 👍 want · 50–75 % → 😐 neutral ·
        bottom 25 % / blank → 👎 don't want.
      </Notice>
      <div>
        <Btn accent onClick={handleDownload}>
          ⬇ Download preferences CSV ({eventGames.length} games × {participants.length} players)
        </Btn>
      </div>
    </div>
  )
}

// ─── Step 3 — Upload CSV & apply preferences ──────────────────────────────────

function UploadCsv({ event, participants, eventGames, onRefresh }) {
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)   // { headers, rows, warnings }
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const parseCsvLine = (line) => {
    const result = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur)
    return result
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPreview(null); setMsg(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      // Normalise line endings
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
      if (lines.length < 2) return setMsg({ type: 'err', text: 'CSV appears empty.' })

      const headers = parseCsvLine(lines[0])
      // headers[0] = game_id, headers[1] = game_name, headers[2..] = player names
      const playerNames = headers.slice(2)

      const warnings = []

      // Match player names → participant objects
      const playerMap = playerNames.map(name => {
        const match = participants.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())
        if (!match) warnings.push(`Column "${name}" does not match any registered participant — will be skipped.`)
        return match || null
      })

      // Match game rows → eventGames
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i])
        const gameId = cols[0]?.trim()
        const gameName = cols[1]?.trim()
        const game = eventGames.find(eg => eg.game_id === gameId)
        if (!game) {
          warnings.push(`Row ${i + 1}: game_id "${gameId}" not found in event — skipped.`)
          continue
        }
        const playerRanks = playerNames.map((_, pi) => {
          const raw = (cols[2 + pi] || '').trim()
          const rank = raw === '' ? null : parseInt(raw, 10)
          return isNaN(rank) ? null : rank
        })
        rows.push({ gameId, gameName, playerRanks })
      }

      setPreview({ headers, playerNames, playerMap, rows, warnings })
    }
    reader.readAsText(file)
    // Allow re-uploading the same file
    e.target.value = ''
  }

  const handleApply = async () => {
    if (!preview) return
    setSaving(true); setMsg(null)
    try {
      const N = preview.rows.length
      const upserts = []

      for (let pi = 0; pi < preview.playerMap.length; pi++) {
        const participant = preview.playerMap[pi]
        if (!participant) continue  // unmatched column
        for (const row of preview.rows) {
          const rank = row.playerRanks[pi]
          const preference = rankToPreference(rank, N)
          upserts.push(
            db.upsert('game_preferences', {
              event_id: event.id,
              participant_id: participant.id,
              game_id: row.gameId,
              preference,
            }, 'event_id,participant_id,game_id')
          )
        }
      }

      await Promise.all(upserts)
      setMsg({ type: 'ok', text: `Applied ${upserts.length} preference entries.` })
      setPreview(null)
      onRefresh()
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    } finally {
      setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Notice type="info">
        Upload the filled-in CSV. Existing preferences for matched
        participants will be overwritten.
      </Notice>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn accent onClick={() => fileRef.current?.click()}>⬆ Choose CSV file</Btn>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
        {msg && <Notice type={msg.type}>{msg.text}</Notice>}
      </div>

      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {preview.warnings.map((w, i) => <Notice key={i} type="warn">{w}</Notice>)}
            </div>
          )}

          {/* Summary table */}
          <div style={{
            fontSize: 12, background: 'var(--bg3)', borderRadius: 8,
            padding: '10px 14px', color: 'var(--text2)',
          }}>
            <strong style={{ color: 'var(--text)' }}>Preview</strong>
            {' · '}{preview.rows.length} games
            {' · '}{preview.playerMap.filter(Boolean).length} of {preview.playerNames.length} players matched
            {' · '}{preview.rows.length * preview.playerMap.filter(Boolean).length} entries to write
          </div>

          {/* Compact preview table */}
          <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
            <table style={{
              borderCollapse: 'collapse', fontSize: 11, width: '100%',
              color: 'var(--text2)',
            }}>
              <thead>
                <tr>
                  <th style={thStyle}>Game</th>
                  {preview.playerNames.map((name, pi) => (
                    <th key={pi} style={{
                      ...thStyle,
                      color: preview.playerMap[pi] ? 'var(--accent)' : '#e05a5a',
                    }}>
                      {name}{!preview.playerMap[pi] && ' ⚠'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td style={tdStyle}>{row.gameName}</td>
                    {row.playerRanks.map((rank, pi) => {
                      const N = preview.rows.length
                      const pref = rankToPreference(rank, N)
                      const colors = {
                        really_want: '#f59e0b', want: '#4ade80',
                        neutral: 'var(--text3)', dont_want: '#e05a5a',
                      }
                      return (
                        <td key={pi} style={{
                          ...tdStyle, textAlign: 'center',
                          color: preview.playerMap[pi] ? colors[pref] : '#888',
                          opacity: preview.playerMap[pi] ? 1 : 0.4,
                        }}>
                          {rank == null ? '–' : `${rank} → ${PREF_ABBR[pref]}`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn accent onClick={handleApply} disabled={saving}>
              {saving ? 'Applying…' : '✅ Apply preferences to database'}
            </Btn>
            <Btn onClick={() => setPreview(null)}>✕ Discard</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  padding: '6px 10px', textAlign: 'left', fontWeight: 600,
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'var(--bg3)',
}
const tdStyle = {
  padding: '4px 10px', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}
const PREF_ABBR = {
  really_want: '❤️', want: '👍', neutral: '😐', dont_want: '👎',
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function DevTestingWorkflow({ event, participants, eventGames, onRefresh }) {
  return (
    <div style={{
      marginTop: 32,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 8,
        background: '#f59e0b18', border: '1px solid #f59e0b44',
      }}>
        <span style={{ fontSize: 14 }}>⚠️</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>
          DEV / TESTING WORKFLOW
        </span>
        <span style={{ fontSize: 11, color: '#f59e0b88', marginLeft: 4 }}>
          Temporary tooling for scheduler testing — not for production use.
        </span>
      </div>

      {/* Step 1 */}
      <Section emoji="📅" title="Step 1 — Set player availability">
        <AvailabilityEditor event={event} participants={participants} onRefresh={onRefresh} />
      </Section>

      {/* Step 2 */}
      <Section emoji="⬇" title="Step 2 — Download blank preferences CSV">
        <DownloadCsv event={event} participants={participants} eventGames={eventGames} />
      </Section>

      {/* Step 3 */}
      <Section emoji="⬆" title="Step 3 — Upload filled preferences CSV">
        <UploadCsv event={event} participants={participants} eventGames={eventGames} onRefresh={onRefresh} />
      </Section>
    </div>
  )
}
