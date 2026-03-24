// 메인 앱 컴포넌트 - 탭 네비게이션
import React, { useState } from 'react'
import { NotionSetup } from './components/NotionSetup'
import { DataMapper } from './components/DataMapper'
import { PresetManager } from './components/PresetManager'
import { useNotionData } from './hooks/useNotionData'
import { useSelection } from './hooks/useSelection'
import './styles.css'

type Tab = 'setup' | 'data' | 'preset'

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('setup')
  const [notionToken, setNotionToken] = useState('')
  const [selectedDbId, setSelectedDbId] = useState('')

  const notion = useNotionData()
  const { selectedNodes } = useSelection()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'setup', label: '설정' },
    { key: 'data', label: '데이터' },
    { key: 'preset', label: '프리셋' },
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
            onTokenChange={setNotionToken}
            databases={notion.databases}
            selectedDbId={selectedDbId}
            onSelectDb={(dbId) => {
              setSelectedDbId(dbId)
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

        {activeTab === 'preset' && (
          <PresetManager
            token={notionToken}
            selectedDbId={selectedDbId}
            onLoadPreset={(preset) => {
              setNotionToken(preset.token || notionToken)
              setSelectedDbId(preset.databaseId)
              setActiveTab('data')
            }}
          />
        )}
      </div>
    </div>
  )
}
