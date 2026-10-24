import React, { useState } from 'react'

export default function AccountManager({ accounts, onAdd, onRefresh, onReloadDefault, onRemove, loading }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleAdd = async () => {
    const username = input.trim()
    if (!username) return
    if (accounts.find(a => a.username.toLowerCase() === username.toLowerCase())) {
      setError('Already added')
      return
    }
    setError('')
    setInput('')
    const err = await onAdd(username)
    if (err) setError(String(err))
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleReloadDefault = async () => {
    setError('')
    const err = await onReloadDefault()
    if (err) setError(String(err))
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18, fontWeight: 500,
          margin: 0, color: 'var(--text)',
        }}>
          BGG Accounts
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleReloadDefault}
            disabled={loading}
            title="Restore the database collection and discard local additions"
            style={{
              padding: '5px 9px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text2)',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >↻ Default</button>
          <button
            onClick={onRefresh}
              disabled={loading || !accounts.some(account => account.source === 'database')}
            title="Refresh the shared BGG collections in the database"
            style={{
              padding: '5px 9px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text2)',
              cursor: loading || !accounts.some(account => account.source === 'database') ? 'default' : 'pointer',
              opacity: loading || !accounts.some(account => account.source === 'database') ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >↻ Refresh</button>
        </div>
      </div>

      {/* Existing accounts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {accounts.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
            No accounts added yet
          </p>
        )}
        {accounts.map(acc => (
          <div key={acc.username} style={{
            background: 'var(--bg3)',
            borderRadius: 8, padding: '8px 12px',
            border: `1px solid ${acc.error ? 'var(--red)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: acc.source === 'local' ? 'rgba(90,154,224,0.15)' : 'var(--accent-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 500,
                  color: acc.source === 'local' ? 'var(--blue)' : 'var(--accent)',
                }}>
                  {acc.username[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{acc.username}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {acc.loading ? 'Loading…' : acc.count != null ? `${acc.count} games` : ''}
                    {acc.source === 'local' ? ' · only visible to you' : ' · shared'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {acc.loading && <Spinner />}
                {acc.source === 'local' && <button
                  onClick={() => onRemove(acc.username)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 14, lineHeight: 1,
                    transition: 'all 140ms', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
                >×</button>}
              </div>
            </div>
            {acc.error && <ErrorBox text={acc.error} />}
          </div>
        ))}
      </div>

      <div>
          <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
            <input
              type="text"
              placeholder="BGG username"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={handleKey}
              disabled={loading}
              style={{
                flex: 1, minWidth: 0, boxSizing: 'border-box', background: 'var(--bg3)',
                border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 8, padding: '8px 12px',
                color: 'var(--text)', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim() || loading}
              style={{
                padding: '8px 14px', borderRadius: 8,
                flexShrink: 0,
                background: input.trim() ? 'var(--accent)' : 'var(--bg4)',
                color: input.trim() ? '#0f0e0c' : 'var(--text3)',
                fontSize: 13, fontWeight: 500,
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 140ms', whiteSpace: 'nowrap',
              }}
            >Add</button>
          </div>
          {error && <ErrorBox text={error} />}
      </div>

    </div>
  )
}

function ErrorBox({ text }) {
  return (
    <div style={{
      marginTop: 8, background: 'var(--red-bg)',
      border: '1px solid var(--red)', borderRadius: 6,
      padding: '8px 10px',
    }}>
      <p style={{
        fontSize: 11, color: 'var(--red)', lineHeight: 1.6,
        wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontFamily: 'monospace',
      }}>
        {text}
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14,
      border: '2px solid var(--border)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}
