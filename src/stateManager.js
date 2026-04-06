// State export/import/default-load utilities

const STATE_VERSION = 1

export function exportState(accounts, collections, filename = 'boardgame-collection.json') {
  const state = {
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: accounts
      .filter(a => !a.loading && !a.error)
      .map(a => ({ username: a.username, count: a.count, fromFile: a.fromFile || false })),
    collections,
  }
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseStateFile(jsonText) {
  let state
  try {
    state = JSON.parse(jsonText)
  } catch {
    throw new Error('Invalid JSON file.')
  }
  if (!state.collections || typeof state.collections !== 'object') {
    throw new Error('This file does not look like a valid boardgame-browser export.')
  }
  const accounts = (state.accounts || []).map(a => ({
    username: a.username,
    count: a.count,
    fromFile: a.fromFile || false,
    loading: false,
    error: null,
  }))
  return { accounts, collections: state.collections }
}

// Try to fetch /default-collection.json — returns null if not found
export async function loadDefaultCollection() {
  try {
    const res = await fetch('/default-collection.json')
    if (!res.ok) return null
    const text = await res.text()
    return parseStateFile(text)
  } catch {
    return null
  }
}
