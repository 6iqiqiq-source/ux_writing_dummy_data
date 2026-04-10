// 데이터 매핑 컴포넌트
// Notion 테이블 컬럼 버튼을 클릭하면 선택된 레이어에 즉시 데이터 적용
import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { TextNodeInfo } from '../../plugin/types'
import type { NotionPage, NotionDatabase } from '../types/notion'
import { extractPropertyValue, getDatabaseTitle } from '../types/notion'

interface DataMapperProps {
  selectedNodes: TextNodeInfo[]
  pages: NotionPage[]
  properties: Record<string, { id: string; name: string; type: string }>
  isConnected: boolean
  isLoading: boolean
  selectedDbId: string
  selectedDbUrl: string
  databases: NotionDatabase[]
  onSelectDb: (dbId: string) => void
}

export function DataMapper({
  selectedNodes,
  pages,
  properties,
  isConnected,
  isLoading,
  selectedDbId,
  selectedDbUrl,
  databases,
  onSelectDb,
}: DataMapperProps) {
  const [applyingField, setApplyingField] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; key: number } | null>(null)

  // 데이터베이스 커스텀 드롭다운
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false)
  const dbDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(e.target as Node)) {
        setIsDbDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message, key: Date.now() })
    setTimeout(() => setToast(null), 3000)
  }

  const propertyNames = useMemo(() => Object.keys(properties), [properties])

  // Notion 데이터베이스 링크 클릭 핸들러
  const handleNotionLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!selectedDbUrl) {
      e.preventDefault()
      showToast('error', '선택된 데이터베이스가 없습니다.')
    }
  }

  // 컬럼 버튼 클릭 → 즉시 적용
  const handleColumnClick = (field: string) => {
    if (selectedNodes.length === 0 || pages.length === 0) return

    setApplyingField(field)

    try {
      const mappings: Array<{ nodeId: string; text: string }> = []

      for (const node of selectedNodes) {
        const pageIndex = Math.floor(Math.random() * pages.length)
        const page = pages[pageIndex]
        const value = page.properties[field]
          ? extractPropertyValue(page.properties[field])
          : ''

        if (value) {
          mappings.push({ nodeId: node.id, text: value })
        }
      }

      if (mappings.length === 0) {
        showToast('error', '적용할 데이터가 없습니다.')
        setApplyingField(null)
        return
      }

      // Figma plugin 메시지로 전송
      parent.postMessage({
        pluginMessage: {
          type: 'BULK_FILL',
          mappings,
        },
      }, '*')

      showToast('success', `${mappings.length}개 레이어에 데이터를 적용했습니다`)

    } catch {
      showToast('error', '적용 중 오류가 발생했습니다.')
    } finally {
      setApplyingField(null)
    }
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="empty-state">
        <span className="spinner" />데이터 불러오는 중...
      </div>
    )
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

  const hasSelection = selectedNodes.length > 0

  return (
    <div>
      {/* 데이터베이스 선택 드롭다운 */}
      <div className="field-group" style={{ marginBottom: 12 }}>
        <label className="field-label">데이터베이스</label>
        <div className="custom-select-wrapper" ref={dbDropdownRef}>
          <button
            type="button"
            className={`custom-select-trigger field-select ${isDbDropdownOpen ? 'open' : ''}`}
            onClick={() => setIsDbDropdownOpen((prev) => !prev)}
          >
            <span>
              {selectedDbId
                ? getDatabaseTitle(databases.find((d) => d.id === selectedDbId)!)
                : '선택해주세요'}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              style={{ transform: isDbDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
            >
              <path fill="#666" d="M6 8L1 3h10z" />
            </svg>
          </button>
          {isDbDropdownOpen && (
            <ul className="custom-select-list">
              {databases.map((db) => (
                <li
                  key={db.id}
                  className={`custom-select-item ${selectedDbId === db.id ? 'selected' : ''}`}
                  onClick={() => { onSelectDb(db.id); setIsDbDropdownOpen(false) }}
                >
                  {getDatabaseTitle(db)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Notion 데이터베이스 열기 버튼 */}
      <div className="field-group">
        <a
          href={selectedDbUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-secondary btn-block ${!selectedDbUrl ? 'btn-disabled' : ''}`}
          onClick={handleNotionLinkClick}
          title={selectedDbUrl ? 'Notion에서 데이터베이스 열기' : '선택된 데이터베이스가 없습니다'}
          style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
        >
          Notion 데이터베이스 열기
        </a>
      </div>

      {/* 선택된 레이어 개수 */}
      <div className="field-group">
        <label className="field-label">
          {hasSelection
            ? `레이어 매핑 (${selectedNodes.length}개 선택)`
            : '레이어 매핑 (Figma에서 텍스트 레이어를 선택해주세요)'}
        </label>
      </div>

      {/* 컬럼 이름 버튼 그리드 */}
      <div className="column-grid">
        {propertyNames.map((name) => (
          <button
            key={name}
            className={`column-btn ${applyingField === name ? 'applying' : ''}`}
            onClick={() => handleColumnClick(name)}
            disabled={!hasSelection || applyingField !== null}
            title={`${name} (${properties[name].type})`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 하단 고정 토스트 메시지 */}
      {toast && (
        <div
          key={toast.key}
          className={`status-msg-toast ${toast.type === 'success' ? 'status-success' : 'status-error'}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
