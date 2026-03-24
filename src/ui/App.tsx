// 메인 앱 컴포넌트 - 탭 네비게이션
import React, { useState, useEffect } from 'react'
import { NotionSetup } from './components/NotionSetup'
import { DataMapper } from './components/DataMapper'
import { AIGenerator } from './components/AIGenerator'
import { useNotionData } from './hooks/useNotionData'
import { useSelection } from './hooks/useSelection'
import { loadToken, saveToken, loadSelectedDb, saveSelectedDb } from './services/storageService'
import './styles.css'

type Tab = 'setup' | 'data' | 'ai'

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')
  const [notionToken, setNotionToken] = useState('')
  const [selectedDbId, setSelectedDbId] = useState('')
  const [isTokenValid, setIsTokenValid] = useState(false)

  const notion = useNotionData()
  const { selectedNodes } = useSelection()

  // 이 컴포넌트 마운트 시 한 번만 실행되도록 eslint 무시 또는 그냥 []
  useEffect(() => {
    let mounted = true
    const initStorage = async () => {
      const token = await loadToken()
      if (token && mounted) {
        setNotionToken(token)
        const valid = await notion.validateToken(token)
        if (mounted) setIsTokenValid(valid)
        if (valid && mounted) {
          await notion.searchDatabases(token)
          
          const dbId = await loadSelectedDb()
          if (dbId && mounted) {
            setSelectedDbId(dbId)
            await notion.queryDatabase(token, dbId)
          }
        }
      }
    }
    initStorage()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ai', label: 'AI 생성' },
    { key: 'data', label: '데이터' },
    { key: 'setup', label: '설정' },
  ]

  return (
    <div>
      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {activeTab === 'setup' && (
          <NotionSetup
            token={notionToken}
            isTokenValid={isTokenValid}
            onTokenValidChange={setIsTokenValid}
            onTokenChange={(token) => {
              setNotionToken(token)
              saveToken(token)
            }}
            databases={notion.databases}
            selectedDbId={selectedDbId}
            onSelectDb={(dbId) => {
              setSelectedDbId(dbId)
              saveSelectedDb(dbId)
              if (dbId && notionToken) {
                notion.queryDatabase(notionToken, dbId)
              }
            }}
            isLoading={notion.isLoading}
            error={notion.error}
            onValidateToken={() => notion.validateToken(notionToken)}
            onSearchDatabases={() => notion.searchDatabases(notionToken)}
            onClearError={notion.clearError}
          />
        )}

        {activeTab === 'data' && (
          <DataMapper
            selectedNodes={selectedNodes}
            pages={notion.pages}
            properties={notion.properties}
            isConnected={!!selectedDbId && notion.pages.length > 0}
          />
        )}

        {activeTab === 'ai' && (
          <AIGenerator selectedNodes={selectedNodes} />
        )}
      </div>
    </div>
  )
}
