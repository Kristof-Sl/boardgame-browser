import React, { useMemo, useState } from 'react'
import { convertMeepleMapSchedule, getMeepleMapPlayerNames, suggestMeepleMapPlayerLinks } from './meepleMapSchedule'

export default function MeepleMapImportDialog({ payload, participants, eventGames, onCancel, onImport }) {
  const playerNames = useMemo(() => getMeepleMapPlayerNames(payload), [payload])
  const [description, setDescription] = useState(payload.name || 'MeepleMap schedule')
  const [playerLinks, setPlayerLinks] = useState(() => suggestMeepleMapPlayerLinks(playerNames, participants))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleImport = async () => {
    if (!description.trim()) {
      setError('Enter a schedule description.')
      return
    }
    try {
      const schedule = convertMeepleMapSchedule(payload, playerLinks, eventGames, participants)
      setBusy(true)
      setError('')
      await onImport(schedule, description.trim())
    } catch (importError) {
      setError(importError.message || String(importError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onCancel()} style={{
      position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.62)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="meeplemap-import-title" style={{
        width: 'min(560px, 100%)', maxHeight: 'min(80vh, 720px)', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <h3 id="meeplemap-import-title" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>
          Import MeepleMap schedule
        </h3>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>
          Schedule description
          <input value={description} onChange={event => setDescription(event.target.value)} maxLength={120}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 13, textTransform: 'none' }} />
        </label>

        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
          Link each MeepleMap player name to an event participant.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
          {playerNames.map(name => (
            <label key={name} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(160px, 1.2fr)', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              <select value={playerLinks[name] || ''} onChange={event => setPlayerLinks(current => ({ ...current, [name]: event.target.value }))}
                style={{ minWidth: 0, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', color: 'var(--text)', fontSize: 12 }}>
                <option value="">Select participant</option>
                {participants.map(participant => <option key={participant.id} value={participant.id}>{participant.name}</option>)}
              </select>
            </label>
          ))}
          {playerNames.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>This schedule contains no player names.</p>}
        </div>

        {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 12, marginTop: 12 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} disabled={busy} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleImport} disabled={busy || !participants.length} style={{ border: '1px solid var(--accent)', borderRadius: 7, padding: '7px 12px', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Importing…' : 'Import schedule'}
          </button>
        </div>
      </section>
    </div>
  )
}