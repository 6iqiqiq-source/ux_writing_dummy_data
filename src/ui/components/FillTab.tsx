// 텍스트 채우기 탭 - AI 생성과 Notion 데이터 모드를 서브 토글로 통합
import React, { useState } from 'react'
import { AIGenerator } from './AIGenerator'
import { DataMapper } from './DataMapper'
import type { TextNodeInfo } from '../../plugin/types'
import type { NotionPage, NotionDatabase } from '../types/notion'

type FillMode = 'ai' | 'data'

interface FillTabProps {
  selectedNodes: TextNodeInfo[]
  geminiModel: string
  geminiToken: string
  pages: NotionPage[]
  properties: Record<string, { id: string; name: string; type: string }>
  isConnected: boolean
  isLoading: boolean
  selectedDbId: string
  selectedDbUrl: string
  databases: NotionDatabase[]
  onSelectDb: (dbId: string) => void
}

export function FillTab({
  selectedNodes,
  geminiModel,
  geminiToken,
  pages,
  properties,
  isConnected,
  isLoading,
  selectedDbId,
  selectedDbUrl,
  databases,
  onSelectDb,
}: FillTabProps) {
  const [mode, setMode] = useState<FillMode>('data')

  return (
    <div>
      {/* 서브 토글 */}
      <div className="mode-toggle" style={{ marginBottom: 12 }}>
        <button
          className={`mode-btn ${mode === 'data' ? 'active' : ''}`}
          onClick={() => setMode('data')}
        >
          Notion 데이터
        </button>
        <button
          className={`mode-btn ${mode === 'ai' ? 'active' : ''}`}
          onClick={() => setMode('ai')}
        >
          AI 생성
        </button>
      </div>

      {mode === 'ai' && (
        <AIGenerator
          selectedNodes={selectedNodes}
          geminiModel={geminiModel}
          geminiToken={geminiToken}
        />
      )}

      {mode === 'data' && (
        <DataMapper
          selectedNodes={selectedNodes}
          pages={pages}
          properties={properties}
          isConnected={isConnected}
          isLoading={isLoading}
          selectedDbId={selectedDbId}
          selectedDbUrl={selectedDbUrl}
          databases={databases}
          onSelectDb={onSelectDb}
        />
      )}
    </div>
  )
}
