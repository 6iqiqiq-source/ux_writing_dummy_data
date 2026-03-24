// 데이터 매핑 컴포넌트
// Figma 텍스트 레이어와 Notion 필드를 매핑하고 적용
import React, { useState, useMemo } from 'react'
import type { TextNodeInfo } from '../../plugin/types'
import type { NotionPage } from '../types/notion'
import { extractPropertyValue } from '../types/notion'
import { BulkFillPanel } from './BulkFillPanel'

interface DataMapperProps {
  selectedNodes: TextNodeInfo[]
  pages: NotionPage[]
  properties: Record<string, { id: string; name: string; type: string }>
  isConnected: boolean
}

export type FillMode = 'random' | 'sequential'

export interface NodeMapping {
  nodeId: string
  nodeName: string
  field: string // Notion 속성 이름
}

export function DataMapper({
  selectedNodes,
  pages,
  properties,
  isConnected,
}: DataMapperProps) {
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<FillMode>('random')

  const propertyNames = useMemo(() => Object.keys(properties), [properties])

  // 매핑 변경
  const handleMappingChange = (nodeId: string, field: string) => {
    setMappings((prev) => ({ ...prev, [nodeId]: field }))
  }

  // 미리보기 데이터 생성
  const previewData = useMemo(() => {
    if (pages.length === 0) return []

    return selectedNodes
      .filter((node) => mappings[node.id])
      .map((node) => {
        const field = mappings[node.id]
        const pageIndex =
          mode === 'random' ? Math.floor(Math.random() * pages.length) : 0
        const page = pages[pageIndex]
        const value = page.properties[field]
          ? extractPropertyValue(page.properties[field])
          : ''

        return {
          nodeId: node.id,
          nodeName: node.name,
          field,
          value,
        }
      })
  }, [selectedNodes, mappings, pages, mode])

  // 일괄 적용할 매핑 데이터 생성
  const buildBulkMappings = (): Array<{ nodeId: string; text: string }> => {
    const result: Array<{ nodeId: string; text: string }> = []
    let seqIndex = 0

    for (const node of selectedNodes) {
      const field = mappings[node.id]
      if (!field) continue

      const pageIndex =
        mode === 'random'
          ? Math.floor(Math.random() * pages.length)
          : seqIndex % pages.length
      const page = pages[pageIndex]
      const value = page.properties[field]
        ? extractPropertyValue(page.properties[field])
        : ''

      if (value) {
        result.push({ nodeId: node.id, text: value })
        seqIndex++
      }
    }

    return result
  }

  // 연결되지 않은 상태
  if (!isConnected) {
    return (
      <div className="empty-state">
        먼저 설정 탭에서 Notion을 연결하고
        <br />
        데이터베이스를 선택해주세요.
      </div>
    )
  }

  // 선택된 노드가 없는 상태
  if (selectedNodes.length === 0) {
    return (
      <div className="empty-state">
        Figma에서 텍스트 레이어를 선택해주세요.
      </div>
    )
  }

  const hasMappings = Object.values(mappings).some((v) => v)

  return (
    <div>
      {/* 모드 토글 */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'random' ? 'active' : ''}`}
          onClick={() => setMode('random')}
        >
          랜덤
        </button>
        <button
          className={`mode-btn ${mode === 'sequential' ? 'active' : ''}`}
          onClick={() => setMode('sequential')}
        >
          순차
        </button>
      </div>

      {/* 선택된 레이어 + 필드 매핑 */}
      <div className="field-group">
        <label className="field-label">
          레이어 매핑 ({selectedNodes.length}개 선택)
        </label>
        <div>
          {selectedNodes.map((node) => (
            <div key={node.id} className="mapping-row">
              <span className="mapping-label" title={node.characters}>
                {node.name}
              </span>
              <select
                className="mapping-select"
                value={mappings[node.id] || ''}
                onChange={(e) => handleMappingChange(node.id, e.target.value)}
              >
                <option value="">미연결</option>
                {propertyNames.map((name) => (
                  <option key={name} value={name}>
                    {name} ({properties[name].type})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 미리보기 */}
      {hasMappings && previewData.length > 0 && (
        <div className="preview-section">
          <div className="preview-title">미리보기</div>
          {previewData.map((item) => (
            <div key={item.nodeId} className="preview-item">
              <strong>{item.nodeName}</strong> → {item.value || '(빈 값)'}
            </div>
          ))}
        </div>
      )}

      {/* 일괄 채우기 패널 */}
      {hasMappings && (
        <BulkFillPanel buildMappings={buildBulkMappings} />
      )}
    </div>
  )
}
