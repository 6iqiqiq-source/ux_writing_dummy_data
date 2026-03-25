// Notion 연결 설정 컴포넌트
// 회사 토큰이 서버에 설정되어 있으므로, DB 선택과 가이드라인 페이지 선택 담당
import React, { useEffect, useState } from 'react'
import type { NotionDatabase } from '../types/notion'
import { getDatabaseTitle } from '../types/notion'

interface NotionSetupProps {
  databases: NotionDatabase[]
  selectedDbId: string
  onSelectDb: (dbId: string) => void
  isLoading: boolean
  error: string | null
  onSearchDatabases: () => Promise<void>
  onClearError: () => void
  // 가이드라인 관련
  guidelinePageId: string
  guidelinePageName: string
  onSelectGuideline: (pageId: string, pageName: string) => void
}

export function NotionSetup({
  databases,
  selectedDbId,
  onSelectDb,
  isLoading,
  error,
  onSearchDatabases,
  onClearError,
  guidelinePageId,
  guidelinePageName,
  onSelectGuideline,
}: NotionSetupProps) {
  // 가이드라인 페이지 ID 입력 상태
  const [pageIdInput, setPageIdInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

  // 컴포넌트 마운트 시 DB 목록이 없으면 자동 검색
  useEffect(() => {
    if (databases.length === 0) {
      onClearError()
      onSearchDatabases()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 페이지 ID 형식 검증 (32자리 hex 또는 하이픈 포함 36자리)
  const isValidPageId = (id: string): boolean => {
    const cleanId = id.replace(/-/g, '')
    return /^[a-f0-9]{32}$/i.test(cleanId)
  }

  // 페이지 ID 입력 처리
  const handleSetPageId = () => {
    const trimmedInput = pageIdInput.trim()

    if (!trimmedInput) {
      setInputError('페이지 ID를 입력해주세요')
      return
    }

    if (!isValidPageId(trimmedInput)) {
      setInputError('올바른 Notion 페이지 ID 형식이 아닙니다 (32자리 영숫자)')
      return
    }

    // 하이픈 제거하여 정규화
    const normalizedId = trimmedInput.replace(/-/g, '')

    // 페이지 이름은 임시로 "가이드라인 문서"로 설정
    onSelectGuideline(normalizedId, '가이드라인 문서')
    setPageIdInput('')
    setInputError(null)
  }

  return (
    <div>
      {/* 연결 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: '#22c55e',
          display: 'inline-block',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: '#666' }}>연결 상태 : 정상</span>
      </div>

      {/* DB 새로고침 버튼 */}
      <button
        className="btn btn-primary btn-block"
        onClick={() => {
          onClearError()
          onSearchDatabases()
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner" />
            불러오는 중...
          </>
        ) : (
          '데이터베이스 새로고침'
        )}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="status-msg status-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {/* DB 선택 */}
      {databases.length > 0 && (
        <div className="field-group" style={{ marginTop: 12 }}>
          <label className="field-label">데이터베이스 선택</label>
          <select
            className="field-select"
            value={selectedDbId}
            onChange={(e) => onSelectDb(e.target.value)}
          >
            <option value="">선택해주세요</option>
            {databases.map((db) => (
              <option key={db.id} value={db.id}>
                {getDatabaseTitle(db)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 선택된 DB 속성 미리보기 */}
      {selectedDbId && databases.length > 0 && (
        <div className="preview-section">
          <div className="preview-title">데이터베이스 속성</div>
          {(() => {
            const db = databases.find((d) => d.id === selectedDbId)
            if (!db) return null
            return Object.entries(db.properties).map(([name, prop]) => (
              <div key={prop.id} className="preview-item">
                <strong>{name}</strong>{' '}
                <span style={{ color: '#999' }}>({prop.type})</span>
              </div>
            ))
          })()}
        </div>
      )}

      {/* 구분선 */}
      <div style={{ borderTop: '1px solid #e5e5e5', margin: '20px 0' }} />

      {/* UX 가이드라인 문서 설정 */}
      <div className="guideline-section">
        <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          UX 가이드라인 문서
        </h3>

        {guidelinePageId ? (
          // 가이드라인이 선택된 경우
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">선택된 문서</div>
            <div style={{
              padding: '8px 10px',
              background: '#f0f7ff',
              borderRadius: 4,
              fontSize: 11,
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 500 }}>{guidelinePageName}</span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  onSelectGuideline('', '')
                  setPageIdInput('')
                  setInputError(null)
                }}
                style={{ padding: '2px 8px', fontSize: 10 }}
              >
                변경
              </button>
            </div>
          </div>
        ) : (
          // 가이드라인 미선택: 페이지 ID 입력 UI
          <div>
            <div className="field-group">
              <label className="field-label">Notion 페이지 ID</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="field-input"
                  placeholder="예: 1234567890abcdef1234567890abcdef"
                  value={pageIdInput}
                  onChange={(e) => setPageIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSetPageId()
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSetPageId}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  확인
                </button>
              </div>
            </div>

            {/* 입력 에러 */}
            {inputError && (
              <div className="status-msg status-error" style={{ marginTop: 6 }}>
                {inputError}
              </div>
            )}

            {/* 도움말 */}
            <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
              💡 Notion 페이지 URL에서 마지막 32자리 ID를 입력하세요
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
