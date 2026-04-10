// Notion 연결 설정 컴포넌트
// 사용자 본인의 Notion Integration Token을 입력받아 DB 선택 및 가이드라인 설정 담당
import React, { useEffect, useRef, useState } from 'react'
import type { NotionDatabase } from '../types/notion'
import { getDatabaseTitle } from '../types/notion'

interface NotionSetupProps {
  notionToken: string
  onSaveNotionToken: (token: string) => void
  geminiToken: string
  onSaveGeminiToken: (token: string) => void
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
  // 모델 관련
  geminiModel: string
  onSelectModel: (model: string) => void
  usageStats: Record<string, number>
}

export function NotionSetup({
  notionToken,
  onSaveNotionToken,
  geminiToken,
  onSaveGeminiToken,
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
  geminiModel,
  onSelectModel,
  usageStats,
}: NotionSetupProps) {
  // Notion 토큰 입력 상태
  const [tokenInput, setTokenInput] = useState('')
  const [isEditingToken, setIsEditingToken] = useState(false)

  // 데이터베이스 커스텀 드롭다운 상태
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false)
  const dbDropdownRef = useRef<HTMLDivElement>(null)

  // Gemini 모델 커스텀 드롭다운 상태
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  // Gemini 토큰 입력 상태
  const [geminiInput, setGeminiInput] = useState('')
  const [isEditingGemini, setIsEditingGemini] = useState(false)

  // 가이드라인 페이지 ID 입력 상태
  const [pageIdInput, setPageIdInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

  // 사용량 통계 접기/펼치기
  const [showStats, setShowStats] = useState(false)

  // 토큰이 없으면 바로 입력 모드
  useEffect(() => {
    if (!notionToken) {
      setIsEditingToken(true)
    }
  }, [notionToken])

  // 토큰 저장 후 DB 목록 자동 로드
  const handleSaveToken = () => {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    onSaveNotionToken(trimmed)
    setTokenInput('')
    setIsEditingToken(false)
    onClearError()
    onSearchDatabases()
  }

  // 컴포넌트 마운트 시 토큰이 있으면 DB 목록 자동 로드
  useEffect(() => {
    if (notionToken && databases.length === 0) {
      onClearError()
      onSearchDatabases()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dbDropdownRef.current && !dbDropdownRef.current.contains(e.target as Node)) {
        setIsDbDropdownOpen(false)
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Gemini 토큰 저장 핸들러
  const handleSaveGeminiToken = () => {
    const trimmed = geminiInput.trim()
    if (!trimmed) return
    onSaveGeminiToken(trimmed)
    setGeminiInput('')
    setIsEditingGemini(false)
  }

  // Notion URL 또는 ID에서 페이지 ID 추출
  const extractPageIdFromInput = (input: string): string | null => {
    const trimmed = input.trim()
    // Notion URL 패턴에서 32자리 hex ID 추출
    const urlMatch = trimmed.match(/([a-f0-9]{32})(?:[?#]|$)/i)
    if (urlMatch) return urlMatch[1]
    // 하이픈 포함 UUID
    const cleanId = trimmed.replace(/-/g, '')
    if (/^[a-f0-9]{32}$/i.test(cleanId)) return cleanId
    return null
  }

  // 페이지 ID 입력 처리
  const handleSetPageId = () => {
    const trimmedInput = pageIdInput.trim()

    if (!trimmedInput) {
      setInputError('페이지 ID 또는 URL을 입력해주세요')
      return
    }

    const extractedId = extractPageIdFromInput(trimmedInput)
    if (!extractedId) {
      setInputError('올바른 Notion 페이지 ID 또는 URL이 아닙니다')
      return
    }

    onSelectGuideline(extractedId, '가이드라인 문서')
    setPageIdInput('')
    setInputError(null)
  }

  return (
    <div className="settings-container">

      {/* ── 섹션 1: Notion 연결 (필수) ── */}
      <div className="settings-section settings-section--required">
        <div className="settings-section-header">
          <span className="settings-section-title">Notion 연결</span>
          <span className="settings-badge settings-badge--required">필수</span>
        </div>

        {/* Notion Integration Token */}
        <div className="field-group" style={{ marginBottom: notionToken && !isEditingToken ? 12 : 0 }}>
          <label className="field-label">Notion Integration Token</label>

          {notionToken && !isEditingToken ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              background: '#f0f7ff',
              borderRadius: 4,
              fontSize: 11,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{ color: '#666' }}>
                  {notionToken.slice(0, 8)}••••••••
                </span>
              </div>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  setIsEditingToken(true)
                  setTokenInput('')
                }}
              >
                변경
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="password"
                  className="field-input"
                  placeholder="secret_xxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveToken()
                  }}
                  autoFocus
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSaveToken}
                  disabled={!tokenInput.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  저장
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6' }}
                >
                  Notion Integrations
                </a>
                {' '}에서 토큰을 발급하고 DB에 연결하세요
              </div>
            </div>
          )}
        </div>

        {/* 토큰 저장 후: 데이터베이스 선택 + 미리보기 + 새로고침 */}
        {notionToken && !isEditingToken && (
          <>
            {/* 데이터베이스 선택 */}
            <div className="field-group" style={{ marginBottom: 8 }}>
              <label className="field-label">데이터베이스</label>
              {databases.length > 0 ? (
                <div className="custom-select-wrapper" ref={dbDropdownRef}>
                  <button
                    type="button"
                    className={`custom-select-trigger field-select ${isDbDropdownOpen ? 'open' : ''}`}
                    onClick={() => setIsDbDropdownOpen((prev) => !prev)}
                  >
                    <span>
                      {selectedDbId
                        ? getDatabaseTitle(databases.find((d) => d.id === selectedDbId) ?? databases[0])
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
                      <li
                        className={`custom-select-item ${!selectedDbId ? 'selected' : ''}`}
                        onClick={() => { onSelectDb(''); setIsDbDropdownOpen(false) }}
                      >
                        선택해주세요
                      </li>
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
              ) : (
                <div style={{ fontSize: 11, color: '#999', padding: '6px 0' }}>
                  {isLoading ? '불러오는 중...' : '데이터베이스가 없습니다. 새로고침해주세요.'}
                </div>
              )}
            </div>

            {/* DB 속성 미리보기 */}
            {selectedDbId && databases.length > 0 && (
              <div className="preview-section" style={{ marginBottom: 8 }}>
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

            {/* DB 새로고침 버튼 */}
            <button
              className="btn btn-secondary btn-block"
              onClick={() => {
                onClearError()
                onSearchDatabases()
              }}
              disabled={isLoading}
              style={{ marginBottom: 4 }}
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
              <div className="status-msg status-error" style={{ marginTop: 8, marginBottom: 0 }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 섹션 2, 3: 항상 표시 ── */}
      <>
          {/* 섹션 2: AI 기능 설정 (선택) */}
          <div className="settings-section settings-section--optional">
            <div className="settings-section-header">
              <span className="settings-section-title">AI 기능 설정</span>
              <span className="settings-badge settings-badge--optional">선택</span>
            </div>

            {/* Gemini API Key */}
            <div className="field-group" style={{ marginBottom: 16 }}>
              <label className="field-label">Gemini API Key</label>

              {geminiToken && !isEditingGemini ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: '#f0f7ff',
                  borderRadius: 4,
                  fontSize: 11,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: '#666' }}>{geminiToken.slice(0, 8)}••••••••</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => { setIsEditingGemini(true); setGeminiInput('') }}
                  >
                    변경
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="password"
                      className="field-input"
                      placeholder="AIzaSy..."
                      value={geminiInput}
                      onChange={(e) => setGeminiInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGeminiToken() }}
                      autoFocus={isEditingGemini}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveGeminiToken}
                      disabled={!geminiInput.trim()}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      저장
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                      Google AI Studio
                    </a>
                    {' '}에서 발급 (AI 생성·검증 기능에 필요)
                  </div>
                </div>
              )}
            </div>

            {/* Gemini 키 설정 후에만 모델 선택 및 사용량 노출 */}
            {geminiToken && !isEditingGemini && (
              <>
                {/* AI 모델 선택 */}
                <div className="field-group" style={{ marginBottom: 16 }}>
                  <label className="field-label">AI 모델</label>
                  {(() => {
                    const modelOptions = [
                      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
                      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
                    ]
                    const selectedLabel = modelOptions.find((m) => m.value === geminiModel)?.label ?? 'Gemini 3 Flash'
                    return (
                      <div className="custom-select-wrapper" ref={modelDropdownRef}>
                        <button
                          type="button"
                          className={`custom-select-trigger field-select ${isModelDropdownOpen ? 'open' : ''}`}
                          onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                        >
                          <span>{selectedLabel}</span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            style={{ transform: isModelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
                          >
                            <path fill="#666" d="M6 8L1 3h10z" />
                          </svg>
                        </button>
                        {isModelDropdownOpen && (
                          <ul className="custom-select-list">
                            {modelOptions.map((m) => (
                              <li
                                key={m.value}
                                className={`custom-select-item ${geminiModel === m.value ? 'selected' : ''}`}
                                onClick={() => { onSelectModel(m.value); setIsModelDropdownOpen(false) }}
                              >
                                {m.label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* 사용량 통계 (접기/펼치기) */}
                <button
                  onClick={() => setShowStats(v => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    marginBottom: showStats ? 8 : 0,
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#666',
                  }}
                >
                  <span>사용량 현황</span>
                  <span style={{ fontSize: 10, color: '#999' }}>{showStats ? '▲ 접기' : '▼ 펼치기'}</span>
                </button>

                {showStats && (
                  <div style={{
                    background: '#f9f9f9',
                    borderRadius: 8,
                    padding: 12,
                    border: '1px solid #eee',
                  }}>
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 10 }}>매일 자정 자동 초기화</div>
                    {[
                      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', limit: 5 },
                      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', limit: 10 },
                      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', limit: 20 },
                    ].map(model => {
                      const usage = usageStats[model.id] || 0
                      const percentage = Math.min((usage / model.limit) * 100, 100)
                      return (
                        <div key={model.id} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                            <span style={{ color: '#666' }}>{model.name}</span>
                            <span style={{ fontWeight: 500 }}>{usage} / {model.limit}</span>
                          </div>
                          <div style={{ height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${percentage}%`,
                              background: percentage > 80 ? '#ef4444' : '#3b82f6',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 섹션 3: 검증 기능 설정 (선택) */}
          <div className="settings-section settings-section--optional">
            <div className="settings-section-header">
              <span className="settings-section-title">검증 기능 설정</span>
              <span className="settings-badge settings-badge--optional">선택</span>
            </div>

            {/* UX 가이드라인 문서 */}
            <div className="guideline-section">
              <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>UX 가이드라인 문서</label>

              {guidelinePageId ? (
                <div>
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
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        onSelectGuideline('', '')
                        setPageIdInput('')
                        setInputError(null)
                      }}
                    >
                      변경
                    </button>
                  </div>
                  <a
                    href={`https://www.notion.so/${guidelinePageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-block"
                    style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                  >
                    문서 바로가기
                  </a>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Notion URL 또는 페이지 ID"
                      value={pageIdInput}
                      onChange={(e) => setPageIdInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSetPageId() }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleSetPageId}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      확인
                    </button>
                  </div>
                  {inputError && (
                    <div className="status-msg status-error" style={{ marginTop: 6 }}>
                      {inputError}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
                    Notion 페이지 URL 또는 32자리 ID를 입력하세요
                  </div>
                </div>
              )}
            </div>
          </div>
      </>

      {/* 하단 데이터 전송 고지 (항상 표시) */}
      <div className="settings-notice">
        Notion, Google Gemini 외부 서버를 사용합니다. API 키는 이 기기에만 저장됩니다.
      </div>
    </div>
  )
}
