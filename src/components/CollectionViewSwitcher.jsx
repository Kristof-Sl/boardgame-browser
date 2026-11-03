import React from 'react'

const VIEWS = [
  { id: 'standard', label: 'Standard' },
  { id: 'compact', label: 'Compact' },
  { id: 'rows', label: 'Rows' },
]

export default function CollectionViewSwitcher({ value, onChange }) {
  return (
    <div role="group" aria-label="Collection view" style={{ display: 'flex', gap: 6 }}>
      {VIEWS.map(view => {
        const selected = value === view.id
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(view.id)}
            style={{
              flex: 1,
              padding: '7px 8px',
              borderRadius: 7,
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
              background: selected ? 'var(--accent-bg)' : 'transparent',
              color: selected ? 'var(--accent)' : 'var(--text2)',
              fontSize: 12,
              fontWeight: selected ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {view.label}
          </button>
        )
      })}
    </div>
  )
}
