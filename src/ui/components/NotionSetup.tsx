// Notion 연결 설정 컴포넌트
// 토큰 입력, 연결 테스트, DB 선택
import React, { useState } from 'react'
import type { NotionDatabase } from '../types/notion'
import { getDatabaseTitle } from '../types/notion'

interface NotionSetupProps {
  token: string
  isTokenValid: boolean
  onTokenValidChange: (valid: boolean) => void
  onTokenChange: (token: string) => void
  databases: NotionDatabase[]
  selectedDbId: string
  onSelectDb: (dbId: string) => void
  isLoading: boolean
  error: string | null
  onValidateToken: () => Promise<boolean>
  onSearchDatabases: () => Promise<void>
  onClearError: () => void
}

export function NotionSetup({
  token,
  isTokenValid,
  onTokenValidChange,
  onTokenChange,
  databases,
  selectedDbId,
  onSelectDb,
  isLoading,
  error,
  onValidateToken,
  onSearchDatabases,
  onClearError,
}: NotionSetupProps) {
  const handleConnect = async () => {
    onClearError()
    const valid = await onValidateToken()
    onTokenValidChange(valid)
    if (valid) {
      await onSearchDatabases()
    }
  }

  return (
    <div>
      {/* 토큰 입력 */}
      <div className="field-group">
        <label className="field-label">Notion Integration Token</label>
        <input
          className="field-input"
          type="password"
          placeholder="ntn_xxxxxxxxxxxxx"
          value={token}
          onChange={(e) => {
            onTokenChange(e.target.value)
            onTokenValidChange(false)
          }}
        />
      </div>

      {/* 연결 테스트 버튼 */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleConnect}
        disabled={isLoading || !token.trim()}
      >
        {isLoading ? (
          <>
            <span className="spinner" />
            연결 중...
          </>
        ) : isTokenValid ? (
          '다시 연결'
        ) : (
          '연결 테스트'
        )}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="status-msg status-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      {/* 연결 성공 */}
      {isTokenValid && !error && (
        <div className="status-msg status-success" style={{ marginTop: 8 }}>
          연결 성공! 데이터베이스를 선택해주세요.
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
    </div>
  )
}
