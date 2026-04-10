// 메인 앱 컴포넌트 - 탭 네비게이션
import React, { useState, useEffect, useCallback } from 'react'
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

  // 초기화: 캐시된 설정을 병렬 로드 → 저장된 DB ID로 데이터 쿼리
  useEffect(() => {
    let mounted = true
    const initStorage = async () => {
      // 독립적인 저장소 로드를 병렬 실행
      const [savedToken, savedGeminiToken, cachedDbs, dbId, pageId, pageName, model, stats] = await Promise.all([
        loadNotionToken(),
        loadGeminiToken(),
        loadDatabases<NotionDatabase>(),
        loadSelectedDb(),
        loadGuidelinePageId(),
        loadGuidelinePageName(),
        loadGeminiModel(),
        getUsageStats(),
      ])

      if (!mounted) return

      if (savedToken) setNotionToken(savedToken)
      if (savedGeminiToken) setGeminiToken(savedGeminiToken)
      if (cachedDbs && cachedDbs.length > 0) notion.setDatabasesDirect(cachedDbs)
      if (pageId) {
        setGuidelinePageId(pageId)
        setGuidelinePageName(pageName ?? '가이드라인 문서')
      }
      if (model) setGeminiModel(model)
      if (stats) setUsageStats(stats)

      // 저장된 DB ID로 바로 데이터 쿼리 (네트워크 요청 1회만)
      if (dbId && savedToken) {
        setSelectedDbId(dbId)
        await notion.queryDatabase(dbId, savedToken)
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
  const handleSelectGuideline = useCallback((pageId: string, pageName: string) => {
    setGuidelinePageId(pageId)
    setGuidelinePageName(pageName)
    saveGuidelinePageId(pageId)
    saveGuidelinePageName(pageName)
  }, [])

  // 모델 선택 핸들러
  const handleSelectModel = useCallback((model: string) => {
    setGeminiModel(model)
    saveGeminiModel(model)
  }, [])

  // Notion 토큰 저장 핸들러
  const handleSaveNotionToken = useCallback((token: string) => {
    setNotionToken(token)
    saveNotionToken(token)
  }, [])

  // Gemini 토큰 저장 핸들러
  const handleSaveGeminiToken = useCallback((token: string) => {
    setGeminiToken(token)
    saveGeminiToken(token)
  }, [])

  // DB 선택 핸들러 (설정/채우기 탭 공용)
  const handleSelectDb = useCallback((dbId: string) => {
    setSelectedDbId(dbId)
    saveSelectedDb(dbId)
    if (dbId) {
      notion.queryDatabase(dbId, notionToken)
    }
  }, [notionToken, notion.queryDatabase])

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
            onSaveNotionToken={handleSaveNotionToken}
            geminiToken={geminiToken}
            onSaveGeminiToken={handleSaveGeminiToken}
            databases={notion.databases}
            selectedDbId={selectedDbId}
            onSelectDb={handleSelectDb}
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
            onSelectDb={handleSelectDb}
          />
        )}
      </div>
    </div>
  )
}
