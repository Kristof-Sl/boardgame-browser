// State export/import/default-load utilities

const STATE_VERSION = 1

export function exportState(accounts, collections, filename = 'boardgame-collection.json') {
  const state = {
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: accounts
      .filter(a => !a.loading && !a.error)
      .map(a => ({ username: a.username, count: a.count })),
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
    source: 'local',
    loading: false,
    error: null,
  }))
  return { accounts, collections: state.collections }
}
