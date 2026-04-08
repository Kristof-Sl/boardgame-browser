import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { fetchCollection, mergeCollections, parseCollectionXml, parseCombinedXml } from './bggApi'
import GameCard from './components/GameCard'
import FilterBar from './components/FilterBar'
import AccountManager from './components/AccountManager'
import EventPlanner from './events/EventPlanner'
import AdminPage from './events/AdminPage'


const DEFAULT_FILTERS = {
  search: '',
  status: null,
  players: null,
  minRating: null,
  maxTime: null,
  sort: 'rating',
}

const STORAGE_KEY = 'bgg-browser-collections'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accounts: [], collections: {} }
    return JSON.parse(raw)
  } catch {
    return { accounts: [], collections: {} }
  }
}

function saveToStorage(accounts, collections) {
  try {
    // Only save accounts that loaded successfully (not loading/errored)
    const savedAccounts = accounts
      .filter(a => !a.loading && !a.error)
      .map(a => ({ username: a.username, count: a.count, fromFile: a.fromFile || false }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts: savedAccounts, collections }))
  } catch {
    // localStorage might be full or unavailable — fail silently
  }
}

export default function App() {
  const saved = useMemo(() => loadFromStorage(), [])
  const [accounts, setAccounts] = useState(saved.accounts || [])
  const [collections, setCollections] = useState(saved.collections || {})
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900)
  const [tab, setTab] = useState('collection') // 'collection' | 'events'

  // Persist to localStorage whenever accounts or collections change
  useEffect(() => {
    saveToStorage(accounts, collections)
  }, [accounts, collections])

  const allGames = useMemo(() => mergeCollections(collections), [collections])

  const filteredGames = useMemo(() => {
    let games = [...allGames]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      games = games.filter(g => g.name.toLowerCase().includes(q))
    }

    if (filters.status === 'owned') games = games.filter(g => g.owned)
    else if (filters.status === 'wishlist') games = games.filter(g => g.wishlist)
    else if (filters.status === 'wantToPlay') games = games.filter(g => g.wantToPlay)

    if (filters.players) {
      if (filters.players === 7) {
        games = games.filter(g => g.maxPlayers >= 7)
      } else {
        games = games.filter(g => g.minPlayers <= filters.players && g.maxPlayers >= filters.players)
      }
    }

    if (filters.minRating) {
      games = games.filter(g => g.rating >= filters.minRating)
    }

    if (filters.maxTime === 999) {
      games = games.filter(g => g.minPlaytime >= 120)
    } else if (filters.maxTime) {
      games = games.filter(g => g.maxPlaytime > 0 && g.maxPlaytime <= filters.maxTime)
    }

    // Sort
    games.sort((a, b) => {
      switch (filters.sort) {
        case 'name': return a.name.localeCompare(b.name)
        case 'year': return (b.yearPublished || 0) - (a.yearPublished || 0)
        case 'plays': return b.numPlays - a.numPlays
        case 'rank': {
          if (!a.bggRank && !b.bggRank) return 0
          if (!a.bggRank) return 1
          if (!b.bggRank) return -1
          return a.bggRank - b.bggRank
        }
        default: return b.rating - a.rating
      }
    })

    return games
  }, [allGames, filters])

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleAddAccount = useCallback(async (username) => {
    setAccounts(prev => [...prev, { username, loading: true, error: null, count: null }])

    try {
      const games = await fetchCollection(username)
      setCollections(prev => ({ ...prev, [username]: games }))
      setAccounts(prev => prev.map(a =>
        a.username === username ? { ...a, loading: false, count: games.length } : a
      ))
      return null
    } catch (err) {
      setAccounts(prev => prev.map(a =>
        a.username === username ? { ...a, loading: false, error: err.message } : a
      ))
      return err.message
    }
  }, [])

  const handleRemoveAccount = useCallback((username) => {
    setAccounts(prev => prev.filter(a => a.username !== username))
    setCollections(prev => {
      const next = { ...prev }
      delete next[username]
      return next
    })
  }, [])

  const handleUploadXml = useCallback(async (username, xmlText) => {
    try {
      const games = parseCollectionXml(xmlText, username)
      setCollections(prev => ({ ...prev, [username]: games }))
      setAccounts(prev => [...prev, { username, loading: false, error: null, count: games.length, fromFile: true }])
      return null
    } catch (err) {
      return err.message
    }
  }, [])

const handleUploadCombinedXml = useCallback(async (xmlText) => {
    try {
      const gamesByOwner = parseCombinedXml(xmlText);
      const newOwners = Object.keys(gamesByOwner);

      // Merge all the new collections into state
      setCollections(prev => ({ ...prev, ...gamesByOwner }));

      // Add all the detected owners into the sidebar accounts list
      setAccounts(prev => {
        const next = [...prev];
        newOwners.forEach(owner => {
          const existingIndex = next.findIndex(a => a.username === owner);
          if (existingIndex === -1) {
            next.push({ username: owner, loading: false, error: null, count: gamesByOwner[owner].length, fromFile: true });
          } else {
            // Update game count if account already existed
            next[existingIndex].count = gamesByOwner[owner].length;
          }
        });
        return next;
      });
      return null;
    } catch (err) {
      return err.message;
    }
  }, []);

  const anyLoading = accounts.some(a => a.loading)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🎲</span>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20, fontWeight: 500,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
          }}>
            Board Game Browser
          </h1>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            {[['collection', 'Collection'], ['events', '🗓️ Events'], ['admin', '🔧 Admin']].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 13,
                border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`,
                background: tab === t ? 'var(--accent-bg)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text3)',
                cursor: 'pointer', transition: 'all 140ms',
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {allGames.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>
              {filteredGames.length} / {allGames.length} games
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 13,
              background: sidebarOpen ? 'var(--bg3)' : 'transparent',
            }}
          >
            {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, maxWidth: 1400, margin: '0 auto', width: '100%', padding: '0' }}>

        {/* Events tab */}
        {tab === 'events' && (
          <div style={{ flex: 1, overflowX: 'hidden' }}>
            <EventPlanner collection={allGames} />
          </div>
        )}

        {/* Admin tab */}
        {tab === 'admin' && (
          <div style={{ flex: 1, overflowX: 'hidden' }}>
            <AdminPage localCollection={allGames} />
          </div>
        )}

        {/* Collection tab */}
        {tab === 'collection' && (<>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: 280, flexShrink: 0,
            padding: '20px 16px',
            display: 'flex', flexDirection: 'column', gap: 16,
            position: 'sticky', top: 56,
            height: 'calc(100vh - 56px)',
            overflowY: 'auto',
            borderRight: '1px solid var(--border)',
          }}>
            <AccountManager
              accounts={accounts}
              onAdd={handleAddAccount}
              onRemove={handleRemoveAccount}
              onUploadXml={handleUploadXml}
			  onUploadCombinedXml={handleUploadCombinedXml}
              loading={anyLoading}
            />
            {allGames.length > 0 && (
              <FilterBar
                filters={filters}
                onChange={handleFilterChange}
                games={allGames}
              />
            )}
          </aside>
        )}

        {/* Game grid */}
        <main style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}>
          {allGames.length === 0 && accounts.length === 0 && (
            <EmptyState />
          )}

          {anyLoading && allGames.length === 0 && (
            <LoadingState />
          )}

          {allGames.length > 0 && filteredGames.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>No games match your filters</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                style={{
                  fontSize: 13, color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          {filteredGames.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}>
              {filteredGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </main>
        </>)}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '80px 20px', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56 }}>🎲</div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontWeight: 500,
        color: 'var(--text)',
      }}>
        Add a BGG account to get started
      </h2>
      <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 400, lineHeight: 1.7 }}>
        Enter a BoardGameGeek username in the sidebar to import their collection.
        You can add multiple accounts to browse combined collections.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 16,
    }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          animation: 'pulse 1.4s ease infinite',
          animationDelay: `${i * 80}ms`,
        }}>
          <div style={{ paddingTop: '56%', background: 'var(--bg3)' }} />
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 14, borderRadius: 4, background: 'var(--bg4)', width: '80%' }} />
            <div style={{ height: 11, borderRadius: 4, background: 'var(--bg4)', width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
