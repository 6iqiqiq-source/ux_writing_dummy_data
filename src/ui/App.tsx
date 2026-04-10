// 메인 앱 컴포넌트 - 탭 네비게이션
import React, { useState, useEffect } from 'react'
import { NotionSetup } from './components/NotionSetup'
import { UXReview } from './components/UXReview'
import { FillTab } from './components/FillTab'
import { useNotionData } from './hooks/useNotionData'
import { useSelection } from './hooks/useSelection'
import { getDatabaseTitle } from './types/notion'
import type { NotionDatabase } from './types/notion'
import { loadSelectedDb, saveSelectedDb, loadDatabases, loadGuidelinePageId, loadGuidelinePageName, saveGuidelinePageId, saveGuidelinePageName, loadGeminiModel, saveGeminiModel, getUsageStats, loadNotionToken, saveNotionToken, loadGeminiToken, saveGeminiToken } from './services/storageService'
import './styles.css'

type Tab = 'setup' | 'fill' | 'review'

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('fill')
  const [selectedDbId, setSelectedDbId] = useState('')
  const [notionToken, setNotionToken] = useState('')
  const [geminiToken, setGeminiToken] = useState('')

  // 가이드라인 상태
  const [guidelinePageId, setGuidelinePageId] = useState('')
  const [guidelinePageName, setGuidelinePageName] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash')
  const [usageStats, setUsageStats] = useState<Record<string, number>>({})

  const notion = useNotionData()
  const { selectedNodes } = useSelection()

  // 초기화: 캐시된 DB 목록 → 저장된 DB ID로 바로 데이터 쿼리
  useEffect(() => {
    let mounted = true
    const initStorage = async () => {
      // Notion 토큰 로드
      const savedToken = await loadNotionToken()
      if (savedToken && mounted) {
        setNotionToken(savedToken)
      }

      // Gemini 토큰 로드
      const savedGeminiToken = await loadGeminiToken()
      if (savedGeminiToken && mounted) {
        setGeminiToken(savedGeminiToken)
      }

      // 캐시된 DB 목록 로드
      const cachedDbs = await loadDatabases<NotionDatabase>()
      if (cachedDbs && cachedDbs.length > 0 && mounted) {
        notion.setDatabasesDirect(cachedDbs)
      }

      // 저장된 DB ID로 바로 데이터 쿼리 (네트워크 요청 1회만)
      const dbId = await loadSelectedDb()
      if (dbId && savedToken && mounted) {
        setSelectedDbId(dbId)
        await notion.queryDatabase(dbId, savedToken)
      }

      // 가이드라인 페이지 로드
      const pageId = await loadGuidelinePageId()
      const pageName = await loadGuidelinePageName()
      if (pageId && pageName && mounted) {
        setGuidelinePageId(pageId)
        setGuidelinePageName(pageName)
      }

      // 모델 설정 로드
      const model = await loadGeminiModel()
      if (model && mounted) {
        setGeminiModel(model)
      }

      // 사용량 통계 로드
      const stats = await getUsageStats()
      if (stats && mounted) {
        setUsageStats(stats)
      }

      // 토큰 없으면 설정 탭으로 이동
      if (!savedToken && mounted) {
        setActiveTab('setup')
      }
    }
    initStorage()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'fill', label: '텍스트 채우기' },
    { key: 'review', label: '검증' },
    { key: 'setup', label: '설정' },
  ]

  // 가이드라인 페이지 선택 핸들러
  const handleSelectGuideline = (pageId: string, pageName: string) => {
    setGuidelinePageId(pageId)
    setGuidelinePageName(pageName)
    saveGuidelinePageId(pageId)
    saveGuidelinePageName(pageName)
  }

  // 모델 선택 핸들러
  const handleSelectModel = (model: string) => {
    setGeminiModel(model)
    saveGeminiModel(model)
  }

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
            notionToken={notionToken}
            onSaveNotionToken={(token) => {
              setNotionToken(token)
              saveNotionToken(token)
            }}
            geminiToken={geminiToken}
            onSaveGeminiToken={(token) => {
              setGeminiToken(token)
              saveGeminiToken(token)
            }}
            databases={notion.databases}
            selectedDbId={selectedDbId}
            onSelectDb={(dbId) => {
              setSelectedDbId(dbId)
              saveSelectedDb(dbId)
              if (dbId) {
                notion.queryDatabase(dbId, notionToken)
              }
            }}
            isLoading={notion.isLoading}
            error={notion.error}
            onSearchDatabases={() => notion.searchDatabases(notionToken)}
            onClearError={notion.clearError}
            guidelinePageId={guidelinePageId}
            guidelinePageName={guidelinePageName}
            onSelectGuideline={handleSelectGuideline}
            geminiModel={geminiModel}
            onSelectModel={handleSelectModel}
            usageStats={usageStats}
          />
        )}

        {activeTab === 'review' && (
          <UXReview
            guidelinePageId={guidelinePageId}
            guidelinePageName={guidelinePageName}
            geminiModel={geminiModel}
            geminiToken={geminiToken}
            notionToken={notionToken}
          />
        )}

        {activeTab === 'fill' && (
          <FillTab
            selectedNodes={selectedNodes}
            geminiModel={geminiModel}
            geminiToken={geminiToken}
            pages={notion.pages}
            properties={notion.properties}
            isConnected={!!selectedDbId && notion.pages.length > 0}
            isLoading={notion.isLoading}
            selectedDbId={selectedDbId}
            selectedDbUrl={notion.databases.find((db) => db.id === selectedDbId)?.url ?? ''}
            databases={notion.databases}
            onSelectDb={(dbId) => {
              setSelectedDbId(dbId)
              saveSelectedDb(dbId)
              if (dbId) {
                notion.queryDatabase(dbId, notionToken)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
