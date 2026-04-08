import React, { useState, useRef } from 'react'

const BGG_COLLECTION_URL = (username) =>
  `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&stats=1&excludesubtype=boardgameexpansion`

export default function AccountManager({ accounts, onAdd, onRemove, onUploadXml, onUploadCombinedXml, loading }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState('api') // 'api' | 'upload' | 'combined'
  const [uploadUsername, setUploadUsername] = useState('')
  const fileRef = useRef()
  const combinedFileRef = useRef()

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const username = uploadUsername.trim()
    if (!username) {
      setError('Enter a username before uploading the XML file')
      return
    }
    if (accounts.find(a => a.username.toLowerCase() === username.toLowerCase())) {
      setError('Already added')
      return
    }
    setError('')
    const text = await file.text()
    const err = await onUploadXml(username, text)
    if (err) setError(String(err))
    else {
      setUploadUsername('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleCombinedFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    const text = await file.text()
    const err = await onUploadCombinedXml(text)
    if (err) setError(String(err))
    else if (combinedFileRef.current) combinedFileRef.current.value = ''
  }

  const apiUrl = input.trim() ? BGG_COLLECTION_URL(input.trim()) : null
  const uploadApiUrl = uploadUsername.trim() ? BGG_COLLECTION_URL(uploadUsername.trim()) : null

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
                  background: acc.fromFile ? 'rgba(90,154,224,0.15)' : 'var(--accent-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 500,
                  color: acc.fromFile ? 'var(--blue)' : 'var(--accent)',
                }}>
                  {acc.username[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{acc.username}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {acc.loading ? 'Loading…' : acc.count != null ? `${acc.count} games` : ''}
                    {acc.fromFile ? ' · from file' : ''}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {acc.loading && <Spinner />}
                <button
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
                >×</button>
              </div>
            </div>
            {acc.error && <ErrorBox text={acc.error} />}
          </div>
        ))}
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['api', 'upload', 'combined'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError('') }} style={{
            flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 12, fontWeight: 500,
            border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
            background: mode === m ? 'var(--accent-bg)' : 'transparent',
            color: mode === m ? 'var(--accent)' : 'var(--text3)',
            cursor: 'pointer', transition: 'all 140ms',
          }}>
            {m === 'api' ? '⚡ API' : m === 'upload' ? '📄 Upload XML' : '📦 Combined'}
          </button>
        ))}
      </div>

      {/* API mode */}
      {mode === 'api' && (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="BGG username"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={handleKey}
              disabled={loading}
              style={{
                flex: 1, background: 'var(--bg3)',
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
      )}

      {/* Upload XML mode */}
      {mode === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, lineHeight: 1.6 }}>
              Open the BGG API URL in your browser while logged in, save the page as XML, then upload it here.
            </p>
          </div>

          {/* Username input + API URL */}
          <input
            type="text"
            placeholder="BGG username"
            value={uploadUsername}
            onChange={e => { setUploadUsername(e.target.value); setError('') }}
            style={{
              background: 'var(--bg3)',
              border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
              borderRadius: 8, padding: '8px 12px',
              color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%',
            }}
          />

          {/* Show the BGG API URL once a username is entered */}
          {uploadApiUrl && (
            <div style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                1. Open this URL in your browser (you must be logged in to BGG):
              </p>
              <a
                href={uploadApiUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11, color: 'var(--accent)',
                  wordBreak: 'break-all', lineHeight: 1.6,
                  fontFamily: 'monospace',
                }}
              >
                {uploadApiUrl}
              </a>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                2. Once the XML loads, save the page: <strong style={{ color: 'var(--text2)' }}>File → Save As → Webpage, XML only</strong> (or just Ctrl+S)
              </p>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                3. Then upload that file below.
              </p>
            </div>
          )}

          {/* File upload */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '1px dashed var(--border2)',
              borderRadius: 8, padding: '14px',
              textAlign: 'center', cursor: 'pointer',
              transition: 'border-color 140ms, background 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'transparent' }}
          >
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Click to upload XML file</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>.xml files only</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>

          {error && <ErrorBox text={error} />}
        </div>
      )}

      {/* Combined XML mode */}
      {mode === 'combined' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Upload a combined XML file containing collections from multiple BGG users. All owners will be detected and added automatically.
          </p>
          <div
            onClick={() => combinedFileRef.current?.click()}
            style={{
              border: '1px dashed var(--border2)',
              borderRadius: 8, padding: '14px',
              textAlign: 'center', cursor: 'pointer',
              transition: 'border-color 140ms, background 140ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'transparent' }}
          >
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Click to upload combined XML</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>.xml files only</p>
            <input
              ref={combinedFileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={handleCombinedFileUpload}
              style={{ display: 'none' }}
            />
          </div>
          {error && <ErrorBox text={error} />}
        </div>
      )}
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
