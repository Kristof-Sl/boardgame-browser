import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { fetchCollection, mergeCollections } from './bggApi'
import { exportState, parseStateFile } from './stateManager'
import GameCard, { GameDetailsPanel } from './components/GameCard'
import FilterBar from './components/FilterBar'
import AccountManager from './components/AccountManager'
import EventPlanner from './events/EventPlanner'
import PlayLog from './events/PlayLog'
import AdminPage from './events/AdminPage'
import MobileLayout from './components/MobileLayout'
import SettingsPage from './components/SettingsPage'
import Analyzer from './components/Analyzer'
import { db, isConfigured } from './events/supabase'
import { loadDatabaseSnapshot, refreshDatabaseCollections } from './databaseCollections'

const DEFAULT_FILTERS = {
  search: '',
  status: null,
  players: null,
  minRating: null,
  maxTime: null,
  bestWith: null,
  recommendedWith: null,
  decades: [],
  accounts: [],
  minWeight: null,
  category: null,
  mechanism: null,
  designer: null,
  sort: 'rating',
}

const STORAGE_KEY = 'bgg-browser-collections'
const THEME_STORAGE_KEY = 'bgg-browser-theme'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveToStorage(accounts, collections) {
  try {
    const savedAccounts = accounts
      .filter(a => a.source === 'local' && !a.loading && !a.error)
      .map(a => ({ username: a.username, count: a.count, source: 'local' }))
    const savedCollections = Object.fromEntries(savedAccounts.map(account => [account.username, collections[account.username] || []]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accounts: savedAccounts, collections: savedCollections }))
  } catch {}
}

export default function App() {
  const saved = useMemo(() => loadFromStorage(), [])
  const localAccounts = (saved?.accounts || []).map(account => ({ ...account, source: 'local' }))
  const localCollections = Object.fromEntries(localAccounts.map(account => [account.username, saved?.collections?.[account.username] || []]))
  const [accounts, setAccounts] = useState(localAccounts)
  const [collections, setCollections] = useState(localCollections)
  const [gameDetails, setGameDetails] = useState({})
  const [gameFiles, setGameFiles] = useState({})
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900)
  const [tab, setTab] = useState('collection')
  const [defaultLoaded, setDefaultLoaded] = useState(false)
  const [databaseLoading, setDatabaseLoading] = useState(isConfigured())
  const [toast, setToast] = useState(null)
  const [isAdmin, setIsAdmin] = useState(sessionStorage.getItem('admin_auth') === '1')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [detailsMode, setDetailsMode] = useState(true)
  const [selectedGame, setSelectedGame] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'original')
  const importRef = useRef()
  const headerRef = useRef()
  const [headerHeight, setHeaderHeight] = useState(56)

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (isMobile || !headerRef.current) return
    const updateHeaderHeight = () => setHeaderHeight(headerRef.current.getBoundingClientRect().height)
    updateHeaderHeight()
    const observer = new ResizeObserver(updateHeaderHeight)
    observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [isMobile])

  // The shared collection and game details are loaded from Supabase.
  useEffect(() => {
    if (!isConfigured()) {
      setDefaultLoaded(true)
      return
    }
    loadDatabaseSnapshot().then(snapshot => {
      const sharedNames = new Set(snapshot.accounts.map(account => account.username.toLowerCase()))
      const personalAccounts = localAccounts.filter(account => !sharedNames.has(account.username.toLowerCase()))
      setAccounts([...snapshot.accounts, ...personalAccounts])
      setCollections({
        ...snapshot.collections,
        ...Object.fromEntries(personalAccounts.map(account => [account.username, localCollections[account.username] || []])),
      })
      setGameDetails(snapshot.gameDetails)
    }).catch(error => {
      console.warn('Failed to load collection from Supabase:', error)
      showToast('Could not load the shared collection from the database', 'err')
    }).finally(() => {
      setDatabaseLoading(false)
      setDefaultLoaded(true)
    })
  }, [])

  // Handle window resize for mobile/desktop detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load game files from Supabase
  useEffect(() => {
    if (isConfigured()) {
      db.select('game_files').then(files => {
        const fileMap = {}
        files.forEach(f => fileMap[f.game_id] = f.files)
        setGameFiles(fileMap)
      }).catch(err => console.warn('Failed to load game files:', err))
    }
  }, [])

  useEffect(() => {
    if (defaultLoaded) saveToStorage(accounts, collections)
  }, [accounts, collections, defaultLoaded])

  const showToast = (message, type = 'ok') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const allGames = useMemo(() => {
    const merged = mergeCollections(collections)
    return merged.map(game => ({
      ...game,
      details: gameDetails[String(game.id)] || null,
      files: gameFiles[game.id] || game.files || []
    }))
  }, [collections, gameDetails, gameFiles])

  const sharedGames = useMemo(() => {
    const sharedNames = new Set(accounts.filter(account => account.source === 'database').map(account => account.username))
    return allGames.filter(game => game.owners?.some(owner => sharedNames.has(owner)))
  }, [accounts, allGames])

  const filteredGames = useMemo(() => {
    let games = [...allGames]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      games = games.filter(g => g.name.toLowerCase().includes(q))
    }

    if (filters.status) {
      games = games.filter(g => {
        const selectedOwners = filters.accounts && filters.accounts.length > 0
          ? filters.accounts
          : g.owners || []

        if (g.ownerStatuses) {
          return selectedOwners.some(owner => g.ownerStatuses[owner]?.[filters.status])
        }

        return Boolean(g[filters.status])
      })
    }

    if (filters.players) {
      if (filters.players === 7) {
        games = games.filter(g => g.maxPlayers >= 7)
      } else {
        games = games.filter(g => g.minPlayers <= filters.players && g.maxPlayers >= filters.players)
      }
    }

    const hasPlayerCount = (game, category, playerCount) => {
      const entries = game.details?.suggestedPlayerCounts?.[category] || []
      return entries.some(entry => {
        const players = String(entry.players || '')
        if (playerCount === 7) return players === '7+' || players.split('-').some(value => parseInt(value, 10) >= 7)
        return players === String(playerCount) || players.split('-').some(value => parseInt(value, 10) === playerCount)
      })
    }

    const bestWith = Array.isArray(filters.bestWith)
      ? filters.bestWith
      : filters.bestWith ? [filters.bestWith] : []
    const recommendedWith = Array.isArray(filters.recommendedWith)
      ? filters.recommendedWith
      : filters.recommendedWith ? [filters.recommendedWith] : []

    if (bestWith.length || recommendedWith.length) {
      games = games.filter(g =>
        bestWith.some(playerCount => hasPlayerCount(g, 'best', playerCount)) ||
        recommendedWith.some(playerCount => hasPlayerCount(g, 'recommended', playerCount))
      )
    }

    if (filters.minRating) {
      games = games.filter(g => g.rating >= filters.minRating)
    }

    if (filters.maxTime === 999) {
      games = games.filter(g => g.minPlaytime >= 120)
    } else if (filters.maxTime) {
      games = games.filter(g => g.maxPlaytime > 0 && g.maxPlaytime <= filters.maxTime)
    }

    if (filters.decades && filters.decades.length > 0) {
      games = games.filter(g => g.yearPublished && filters.decades.some(d => g.yearPublished >= d && g.yearPublished < d + 10))
    }

    games = games.filter(g => {
      const detail = g.details || g
      const categories = detail.categories || detail.themes || g.categories || g.themes || []
      const mechanics = detail.mechanics || g.mechanics || []
      const designers = detail.designers || g.designers || []
      const weight = Number(detail.averageweight ?? detail.weight ?? g.averageweight ?? g.weight) || 0
      return (!filters.minWeight || weight >= filters.minWeight)
        && (!filters.category || categories.includes(filters.category))
        && (!filters.mechanism || mechanics.includes(filters.mechanism))
        && (!filters.designer || designers.includes(filters.designer))
    })

    if (filters.accounts && filters.accounts.length > 0) {
      games = games.filter(g => g.owners && g.owners.some(owner => filters.accounts.includes(owner)))
    }

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
    setAccounts(prev => [...prev, { username, loading: true, error: null, count: null, source: 'local' }])
    try {
      const games = await fetchCollection(username)
      setCollections(prev => ({ ...prev, [username]: games }))
      setAccounts(prev => prev.map(a =>
        a.username === username ? { ...a, loading: false, count: games.length, source: 'local' } : a
      ))
      return null
    } catch (err) {
      setAccounts(prev => prev.map(a =>
        a.username === username ? { ...a, loading: false, error: err.message } : a
      ))
      return err.message
    }
  }, [])

  const handleRefreshAccounts = useCallback(async () => {
    const localAccounts = accounts.filter(account => account.source === 'local')
    setAccounts(prev => prev.map(account => account.source === 'database'
      ? { ...account, loading: true, error: null }
      : account
    ))
    try {
      const snapshot = await refreshDatabaseCollections()
      setAccounts([...snapshot.accounts, ...localAccounts])
      setCollections(prev => ({ ...snapshot.collections, ...Object.fromEntries(localAccounts.map(account => [account.username, prev[account.username] || []])) }))
      setGameDetails(snapshot.gameDetails)
    } catch (error) {
      showToast(`Could not refresh database collections: ${error.message}`, 'err')
      setAccounts(prev => prev.map(account => ({ ...account, loading: false })))
    }
  }, [accounts])

  const handleReloadDefaultCollection = useCallback(async () => {
    try {
      const snapshot = await loadDatabaseSnapshot()
      setAccounts(snapshot.accounts)
      setCollections(snapshot.collections)
      setGameDetails(snapshot.gameDetails)
      return null
    } catch (error) {
      return `Could not load the database collection: ${error.message}`
    }
  }, [])

  const handleDatabaseChanged = useCallback(async () => {
    const snapshot = await loadDatabaseSnapshot()
    const sharedNames = new Set(snapshot.accounts.map(account => account.username.toLowerCase()))
    setAccounts(current => [...snapshot.accounts, ...current.filter(account => account.source === 'local' && !sharedNames.has(account.username.toLowerCase()))])
    setCollections(current => ({
      ...snapshot.collections,
      ...Object.fromEntries(accounts.filter(account => account.source === 'local' && !sharedNames.has(account.username.toLowerCase())).map(account => [account.username, current[account.username] || []])),
    }))
    setGameDetails(snapshot.gameDetails)
  }, [accounts])

  const handleRemoveAccount = useCallback((username) => {
    setAccounts(prev => prev.filter(a => a.username !== username || a.source !== 'local'))
    setCollections(prev => {
      const next = { ...prev }
      if (!accounts.find(account => account.username === username && account.source === 'database')) delete next[username]
      return next
    })
  }, [accounts])

  const handleUpdateGameFiles = useCallback(async (gameId, files) => {
    // Update local state
    setCollections(prev => {
      const next = {}
      for (const owner in prev) {
        next[owner] = prev[owner].map(game => game.id === gameId ? { ...game, files } : game)
      }
      return next
    })

    // Save to Supabase if configured
    if (isConfigured()) {
      try {
        if (files.length === 0) {
          // Delete if no files
          await db.delete('game_files', `game_id=eq.${gameId}`)
          setGameFiles(prev => {
            const next = { ...prev }
            delete next[gameId]
            return next
          })
        } else {
          // Upsert
          await db.upsert('game_files', { game_id: gameId, files, updated_at: new Date().toISOString() }, 'game_id')
          setGameFiles(prev => ({ ...prev, [gameId]: files }))
        }
      } catch (err) {
        console.warn('Failed to save game files:', err)
        showToast('Failed to save file links', 'err')
      }
    }
  }, [])

  // Export current state as downloadable JSON
  const handleExport = useCallback(() => {
    if (allGames.length === 0) return
    exportState(accounts, collections, 'boardgame-collection.json')
    showToast('Collection exported', 'ok')
  }, [accounts, collections, allGames])

  // Import a state JSON file
  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const state = parseStateFile(text)
      setAccounts(state.accounts.map(account => ({ ...account, source: 'local' })))
      setCollections(state.collections)
      showToast(`Loaded ${Object.keys(state.collections).length} collection(s)`, 'ok')
    } catch (err) {
      showToast(err.message, 'err')
    }
    e.target.value = ''
  }, [])

  const handleAdminLogout = useCallback(() => {
    sessionStorage.removeItem('admin_auth')
    sessionStorage.removeItem('admin_password')
    setIsAdmin(false)
    setTab('collection')
  }, [])

  const anyLoading = databaseLoading || accounts.some(a => a.loading)

  // Mobile layout
  if (isMobile) {
    return (
      <MobileLayout
        accounts={accounts}
        collections={collections}
        allGames={allGames}
        sharedGames={sharedGames}
        filteredGames={filteredGames}
        filters={filters}
        handleFilterChange={handleFilterChange}
        handleAddAccount={handleAddAccount}
        handleRefreshAccounts={handleRefreshAccounts}
        handleReloadDefaultCollection={handleReloadDefaultCollection}
        handleRemoveAccount={handleRemoveAccount}
        handleExport={handleExport}
        handleImportFile={handleImportFile}
        anyLoading={anyLoading}
        tab={tab}
        setTab={setTab}
        importRef={importRef}
        DEFAULT_FILTERS={DEFAULT_FILTERS}
        EventPlanner={EventPlanner}
        AdminPage={AdminPage}
        PlayLog={PlayLog}
        Analyzer={Analyzer}
        showToast={showToast}
        handleAuthChange={setIsAdmin}
        handleDatabaseChanged={handleDatabaseChanged}
        theme={theme}
        onThemeChange={setTheme}
      />
    )
  }

  // Desktop layout
  return (
    <div data-theme={theme} style={{ '--app-header-height': `${headerHeight}px`, display: 'flex', minHeight: '100vh', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 16px 0 24px',
        minHeight: 56, height: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)',
        backdropFilter: 'blur(8px)',
      }} ref={headerRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
          <img 
			src="/MeepleSync_Logo.png"
			alt="MeepleSync"
			style={{ height: 36, width: 36, borderRadius: 8, objectFit: 'cover' }}
			/>
		<h1 style={{
			fontFamily: 'var(--font-display)',
			fontSize: 20, fontWeight: 700,
			letterSpacing: '-0.01em',
		}}>
		<span style={{ color: 'var(--text)' }}>Meeple</span><span style={{ color: 'var(--accent)' }}>Sync</span>
	</h1>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexWrap: 'wrap' }}>
            {[['collection', 'Collection'], ['events', '🗓️ Events'], ['playlog', '📝 PlayLog'], ['admin', '🔧 Admin'], ['analyzer', 'Analyzer']].map(([t, label]) => (
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {allGames.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text3)', marginRight: 4 }}>
              {filteredGames.length} / {allGames.length} games
            </span>
          )}

          <input ref={importRef} type="file" accept=".json,application/json"
            onChange={handleImportFile} style={{ display: 'none' }} />

          <a href="/meeplemap.html" title="Open MeepleMap" style={{
            display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 6,
            border: '1px solid var(--green)', background: 'var(--green-bg)', color: 'var(--green)',
            textDecoration: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap',
          }}>MEEPLEMAP</a>

          {/* Export */}
          {allGames.length > 0 && (
            <HeaderBtn onClick={handleExport} title="Export current collection as a JSON file">
              ↓ Export
            </HeaderBtn>
          )}

          {/* Admin logout */}
          {isAdmin && (
            <HeaderBtn onClick={handleAdminLogout} title="Log out of admin session">
              🔧 Admin log out
            </HeaderBtn>
          )}

          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              color: 'var(--text2)', fontSize: 13,
              background: sidebarOpen ? 'var(--bg3)' : 'transparent',
            }}
          >
            {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          </button>
          <button
            onClick={() => { setDetailsMode(mode => !mode); setSelectedGame(null) }}
            title="Open tile details in a right-side panel"
            style={{
              padding: '5px 12px', borderRadius: 8,
              border: `1px solid ${detailsMode ? 'var(--accent)' : 'var(--border)'}`,
              color: detailsMode ? 'var(--accent)' : 'var(--text2)', fontSize: 13,
              background: detailsMode ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer',
            }}
          >{detailsMode ? 'Panel details' : 'Tile details'}</button>
          <button
            onClick={() => setTab('settings')}
            aria-label="Open settings"
            title="Settings"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)', color: 'var(--text2)',
              background: 'transparent', fontSize: 17, lineHeight: 1,
            }}
          >⚙</button>
        </div>
      </header>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, width: '100%', padding: '0' }}>

        {/* Events tab */}
        {tab === 'events' && (
          <div style={{ flex: 1, overflowX: 'hidden' }}>
            <EventPlanner collection={sharedGames} detailsMode={detailsMode} />
          </div>
        )}

        {/* PlayLog tab */}
        {tab === 'playlog' && (
          <div style={{ flex: 1, overflowX: 'hidden' }}>
            <PlayLog allGames={allGames} showToast={showToast} />
          </div>
        )}

        {/* Admin tab */}
        {tab === 'admin' && (
          <div style={{ flex: 1, overflowX: 'hidden' }}>
            <AdminPage localCollection={sharedGames} onAuthChange={setIsAdmin} onDatabaseChange={handleDatabaseChanged} />
          </div>
        )}

        {tab === 'settings' && (
          <SettingsPage theme={theme} onThemeChange={setTheme} onBack={() => setTab('collection')} />
        )}

        {tab === 'analyzer' && <Analyzer games={allGames} />}

        {/* Collection tab */}
        {tab === 'collection' && (<>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: 280, flexShrink: 0,
            padding: '20px 16px',
            display: 'flex', flexDirection: 'column', gap: 16,
            position: 'sticky', top: 'var(--app-header-height, 56px)',
            height: 'calc(100vh - 56px)',
            overflowY: 'auto',
            borderRight: '1px solid var(--border)',
          }}>
            <AccountManager
              accounts={accounts}
              onAdd={handleAddAccount}
              onRefresh={handleRefreshAccounts}
              onReloadDefault={handleReloadDefaultCollection}
              onRemove={handleRemoveAccount}
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
        <main style={{ flex: 1, minWidth: 0, padding: '24px', overflowX: 'hidden' }}>
          {allGames.length === 0 && accounts.length === 0 && (
            <EmptyState onImport={() => importRef.current?.click()} />
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
                <GameCard key={game.id} game={game} detailsMode={detailsMode} onDetails={setSelectedGame} />
              ))}
            </div>
          )}
        </main>
        {detailsMode && selectedGame && (
          <aside style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 'var(--app-header-height, 56px)', height: 'calc(100vh - var(--app-header-height, 56px))', overflow: 'hidden' }}>
            <GameDetailsPanel game={selectedGame} onClose={() => setSelectedGame(null)} />
          </aside>
        )}
        </>)}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'ok' ? 'var(--green)' : 'var(--red)',
          color: '#0f0e0c', borderRadius: 8,
          padding: '10px 20px', fontSize: 13, fontWeight: 500,
          zIndex: 1000, pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 200ms ease',
        }}>
          {toast.message}
        </div>
      )}

      {/* BGG credit footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
      }}>
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center',
            textDecoration: 'none', opacity: 0.75, transition: 'opacity 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
        >
          <img
            src="/powered_by_BGG.png"
            alt="Powered by BoardGameGeek"
            style={{ height: 28, width: 'auto' }}
          />
        </a>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  )
}

function HeaderBtn({ children, onClick, title, accent }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: '5px 12px', borderRadius: 8, fontSize: 13,
      border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      background: accent ? 'var(--accent-bg)' : 'transparent',
      color: accent ? 'var(--accent)' : 'var(--text2)',
      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 140ms',
    }}>{children}</button>
  )
}

function EmptyState({ onImport }) {
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
        No collection loaded
      </h2>
      <p style={{ fontSize: 15, color: 'var(--text2)', maxWidth: 420, lineHeight: 1.7 }}>
        Add a BGG account for your local view, or import a previously exported collection.
      </p>
      <button
        onClick={onImport}
        style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          border: '1px solid var(--accent)', background: 'var(--accent-bg)',
          color: 'var(--accent)', cursor: 'pointer',
        }}
      >
        ↑ Import collection
      </button>
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
