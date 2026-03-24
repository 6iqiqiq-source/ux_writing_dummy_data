// 메인 앱 컴포넌트 - 탭 네비게이션
import React, { useState, useEffect } from 'react'
import { NotionSetup } from './components/NotionSetup'
import { DataMapper } from './components/DataMapper'
import { AIGenerator } from './components/AIGenerator'
import { useNotionData } from './hooks/useNotionData'
import { useSelection } from './hooks/useSelection'
import { getDatabaseTitle } from './types/notion'
import type { NotionDatabase } from './types/notion'
import { loadToken, saveToken, loadSelectedDb, saveSelectedDb, saveDatabases, loadDatabases } from './services/storageService'
import './styles.css'

type Tab = 'setup' | 'data' | 'ai'

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')
  const [notionToken, setNotionToken] = useState('')
  const [selectedDbId, setSelectedDbId] = useState('')
  const [isTokenValid, setIsTokenValid] = useState(false)

  const notion = useNotionData()
  const { selectedNodes } = useSelection()

  // 최적화된 초기화: 토큰 검증 스킵, 캐시된 DB 목록 사용, DB 쿼리만 실행
  useEffect(() => {
    let mounted = true
    const initStorage = async () => {
      const token = await loadToken()
      if (!token || !mounted) return

      setNotionToken(token)
      setIsTokenValid(true) // 저장된 토큰은 유효하다고 신뢰

      // 캐시된 DB 목록 로드
      const cachedDbs = await loadDatabases<NotionDatabase>()
      if (cachedDbs && cachedDbs.length > 0 && mounted) {
        notion.setDatabasesDirect(cachedDbs)
      }

      // 저장된 DB ID로 바로 데이터 쿼리 (네트워크 요청 1회만)
      const dbId = await loadSelectedDb()
      if (dbId && mounted) {
        setSelectedDbId(dbId)
        await notion.queryDatabase(token, dbId)
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
            isLoading={notion.isLoading}
            selectedDbName={
              notion.databases.find((db) => db.id === selectedDbId)
                ? getDatabaseTitle(notion.databases.find((db) => db.id === selectedDbId)!)
                : '연결된 DB 없음'
            }
            onChangeDb={() => setActiveTab('setup')}
          />
        )}

        {activeTab === 'ai' && (
          <AIGenerator selectedNodes={selectedNodes} />
        )}
      </div>
    </div>
  )
}
