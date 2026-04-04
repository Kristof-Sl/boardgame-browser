import React, { useState } from 'react'

export default function AccountManager({ accounts, onAdd, onRemove, loading }) {
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
    if (err) setError(err)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
    }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18, fontWeight: 500,
        marginBottom: 14, color: 'var(--text)',
      }}>
        BGG Accounts
      </p>

      {/* Existing accounts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {accounts.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
            No accounts added yet
          </p>
        )}
        {accounts.map(acc => (
          <div key={acc.username} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg3)',
            borderRadius: 8, padding: '8px 12px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 500, color: 'var(--accent)',
              }}>
                {acc.username[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{acc.username}</p>
                {acc.count != null && (
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>{acc.count} games</p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {acc.loading && (
                <Spinner />
              )}
              {acc.error && (
                <span style={{ fontSize: 11, color: 'var(--red)' }}>Failed</span>
              )}
              <button
                onClick={() => onRemove(acc.username)}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 14, lineHeight: 1,
                  transition: 'all 140ms',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--red)'
                  e.currentTarget.style.color = 'var(--red)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text3)'
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="BGG username"
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          onKeyDown={handleKey}
          disabled={loading}
          style={{
            flex: 1,
            background: 'var(--bg3)',
            border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '8px 12px',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim() || loading}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: input.trim() ? 'var(--accent)' : 'var(--bg4)',
            color: input.trim() ? '#0f0e0c' : 'var(--text3)',
            fontSize: 13, fontWeight: 500,
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'all 140ms',
            whiteSpace: 'nowrap',
          }}
        >
          Add
        </button>
      </div>
      {error && (
        <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{error}</p>
      )}
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
    }} />
  )
}
