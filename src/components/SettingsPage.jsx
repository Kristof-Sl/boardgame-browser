import React from 'react'

export const THEMES = [
  { id: 'original', name: 'Original', description: 'The familiar warm dark collection workspace.', swatches: ['#0f0e0c', '#1e1d1a', '#e8c84a'] },
  { id: 'steampunk', name: 'Steampunk Foundry', description: 'Copper, brass, worn wood, and workshop grid lines.', swatches: ['#17120e', '#2a1d15', '#d79a45'] },
  { id: 'blueprint', name: 'Blueprint Workshop', description: 'Drafting-paper blue, cyan lines, and brass annotations.', swatches: ['#10202a', '#193746', '#e4bf62'] },
  { id: 'verdant', name: 'Verdant Cabinet', description: 'A quiet natural palette inspired by an old game library.', swatches: ['#111914', '#1e2d21', '#d4b85c'] },
  { id: 'neon', name: 'Neon Arcade', description: 'Electric cyan, coral accents, and midnight glass.', swatches: ['#0b0d16', '#171b33', '#ffcc66'] },
]

export default function SettingsPage({ theme, onThemeChange, onBack }) {
  return (
    <main style={{ flex: 1, padding: '32px clamp(20px, 5vw, 72px)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <button onClick={onBack} style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 24 }}>← Back to collection</button>
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>Appearance</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: 'var(--text)' }}>Choose your workshop</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 8 }}>Switch the visual language of MeepleSync without changing how it works.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {THEMES.map(option => {
            const active = theme === option.id
            return (
              <button key={option.id} onClick={() => onThemeChange(option.id)} style={{
                textAlign: 'left', padding: 16, borderRadius: 'var(--radius-lg)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-bg)' : 'var(--surface)', color: 'var(--text)',
                boxShadow: active ? '0 0 0 2px var(--accent-bg)' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
                  {option.swatches.map(color => <span key={color} style={{ width: 24, height: 24, borderRadius: 6, background: color, border: '1px solid rgba(255,255,255,0.16)' }} />)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{option.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginTop: 5 }}>{option.description}</div>
                <div style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text3)', marginTop: 14 }}>{active ? 'Currently selected' : 'Use this theme'}</div>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}