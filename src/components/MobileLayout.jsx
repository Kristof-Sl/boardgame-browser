import React, { useState, useMemo } from 'react'
import FilterBar from './FilterBar'
import AccountManager from './AccountManager'
import GameCard from './GameCard'

export default function MobileLayout({
  accounts, collections, allGames, filteredGames, filters, 
  handleFilterChange, handleAddAccount, handleRemoveAccount, 
  handleUploadXml, handleUploadCombinedXml, handleExport, 
  handleExportDefault, handleImportFile, anyLoading, tab, setTab,
  importRef, DEFAULT_FILTERS, EventPlanner, AdminPage, PlayLog, showToast, handleAuthChange
}) {
  const [showFilters, setShowFilters] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)

  const EmptyStateMobile = () => (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px 120px', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>🎲</div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 24, fontWeight: 500,
        color: 'var(--text)',
      }}>
        No collection loaded
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 280, lineHeight: 1.6 }}>
        Add a BGG account or upload an XML file to get started.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16, width: '100%', flexDirection: 'column' }}>
        <button
          onClick={() => setShowAccounts(true)}
          style={{
            padding: '14px 20px', borderRadius: 8, fontSize: 16, fontWeight: 500,
            border: '1px solid var(--accent)', background: 'var(--accent-bg)',
            color: 'var(--accent)', cursor: 'pointer', touchAction: 'manipulation',
          }}
        >
          Add Account
        </button>
        <button
          onClick={() => importRef.current?.click()}
          style={{
            padding: '14px 20px', borderRadius: 8, fontSize: 16, fontWeight: 500,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text2)', cursor: 'pointer', touchAction: 'manipulation',
          }}
        >
          ↑ Import
        </button>
      </div>
    </div>
  )

  const LoadingStateMobile = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12, padding: '20px',
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          height: 120,
          animation: 'pulse 2s infinite',
        }} />
      ))}
    </div>
  )

  const FilterSheetMobile = () => (
    <>
      {showFilters && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 40,
          animation: 'fadeIn 200ms ease',
        }} onClick={() => setShowFilters(false)} />
      )}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg)',
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        borderTop: '1px solid var(--border)',
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 50,
        transform: showFilters ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease',
        touchAction: 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg)',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Filters</h3>
          <button
            onClick={() => setShowFilters(false)}
            style={{
              background: 'none', border: 'none', fontSize: 24,
              cursor: 'pointer', color: 'var(--text2)',
              padding: 0, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <FilterBar filters={filters} onChange={handleFilterChange} games={allGames} />
        </div>
      </div>
    </>
  )

  const AccountSheetMobile = () => (
    <>
      {showAccounts && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 40,
          animation: 'fadeIn 200ms ease',
        }} onClick={() => setShowAccounts(false)} />
      )}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg)',
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        borderTop: '1px solid var(--border)',
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 50,
        transform: showAccounts ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease',
        touchAction: 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg)',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Accounts</h3>
          <button
            onClick={() => setShowAccounts(false)}
            style={{
              background: 'none', border: 'none', fontSize: 24,
              cursor: 'pointer', color: 'var(--text2)',
              padding: 0, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <AccountManager
            accounts={accounts}
            onAdd={handleAddAccount}
            onRemove={handleRemoveAccount}
            onUploadXml={handleUploadXml}
            onUploadCombinedXml={handleUploadCombinedXml}
            loading={anyLoading}
          />
        </div>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', paddingBottom: 60 }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        height: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)',
        backdropFilter: 'blur(8px)',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="/MeepleSync_Logo.png"
            alt="MeepleSync"
            style={{ height: 32, width: 32, borderRadius: 6 }}
          />
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18, fontWeight: 700,
            margin: 0,
          }}>
            <span style={{ color: 'var(--text)' }}>Meeple</span><span style={{ color: 'var(--accent)' }}>Sync</span>
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {allGames.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              {filteredGames.length}/{allGames.length}
            </span>
          )}
          <button
            onClick={() => importRef.current?.click()}
            title="Import"
            style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text2)',
              cursor: 'pointer', transition: 'all 140ms',
            }}
          >
            ↑
          </button>
        </div>
        <input ref={importRef} type="file" accept=".json,application/json"
          onChange={handleImportFile} style={{ display: 'none' }} />
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto' }}>
        {tab === 'collection' && (
          <>
            {allGames.length === 0 && accounts.length === 0 && <EmptyStateMobile />}
            {anyLoading && allGames.length === 0 && <LoadingStateMobile />}
            {allGames.length > 0 && filteredGames.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
                <p style={{ fontSize: 16, marginBottom: 16 }}>No games match your filters</p>
                <button
                  onClick={() => handleFilterChange('search', '') && Object.keys(DEFAULT_FILTERS).forEach(k => handleFilterChange(k, DEFAULT_FILTERS[k]))}
                  style={{
                    fontSize: 14, color: 'var(--accent)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textDecoration: 'underline', fontWeight: 500,
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {filteredGames.length > 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 12, padding: '16px',
              }}>
                {filteredGames.map(game => (
                  <div key={game.id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}>
                    <GameCard game={game} isMobile={true} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'events' && (
          <div style={{ padding: '16px' }}>
            <EventPlanner collection={allGames} />
          </div>
        )}

        {tab === 'playlog' && (
          <div style={{ padding: '16px' }}>
            <PlayLog allGames={allGames} showToast={showToast} />
          </div>
        )}

        {tab === 'admin' && (
          <div style={{ padding: '16px' }}>
            <AdminPage localCollection={allGames} onAuthChange={handleAuthChange} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'space-around',
        height: 60, zIndex: 20,
        touchAction: 'manipulation',
      }}>
        {[
          ['collection', '📚 Collection'],
          ['events', '🗓️ Events'],
          ['playlog', '📝 PlayLog'],
          ['admin', '⚙️ Admin'],
        ].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              border: 'none',
              background: tab === t ? 'var(--accent-bg)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text3)',
              fontSize: 12,
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 200ms',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4,
              padding: 8,
              touchAction: 'manipulation',
            }}
          >
            <span style={{ fontSize: 20 }}>{label.split(' ')[0]}</span>
            <span style={{ fontSize: 11 }}>{label.split(' ')[1]}</span>
          </button>
        ))}
      </nav>

      {/* Action buttons overlay for collection tab */}
      {tab === 'collection' && allGames.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 70, right: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
          zIndex: 15,
        }}>
          <button
            onClick={() => setShowFilters(true)}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              touchAction: 'manipulation',
            }}
            title="Filters"
          >
            ⚙️
          </button>
          <button
            onClick={() => setShowAccounts(true)}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              touchAction: 'manipulation',
            }}
            title="Accounts"
          >
            👤
          </button>
          {allGames.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                touchAction: 'manipulation',
              }}
              title="Export"
            >
              ↓
            </button>
          )}
        </div>
      )}

      {/* Sheets */}
      <FilterSheetMobile />
      <AccountSheetMobile />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  )
}
