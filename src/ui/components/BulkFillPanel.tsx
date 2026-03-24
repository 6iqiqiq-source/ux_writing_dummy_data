// 일괄 채우기 패널
// 매핑된 데이터를 Figma 텍스트 레이어에 일괄 적용
import React, { useState } from 'react'
import { postToPlugin, onPluginMessage } from '../services/pluginBridge'

interface BulkFillPanelProps {
  buildMappings: () => Array<{ nodeId: string; text: string }>
}

export function BulkFillPanel({ buildMappings }: BulkFillPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleFill = () => {
    const mappings = buildMappings()
    if (mappings.length === 0) {
      setResult({ type: 'error', message: '적용할 매핑이 없습니다' })
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: mappings.length })
    setResult(null)

    // 진행률 및 완료 메시지 구독
    const unsubscribe = onPluginMessage((msg) => {
      if (msg.type === 'BULK_PROGRESS') {
        setProgress({ current: msg.current, total: msg.total })
      }
      if (msg.type === 'APPLY_RESULT') {
        setIsProcessing(false)
        unsubscribe()
        if (msg.success) {
          setResult({
            type: 'success',
            message: `${mappings.length}개 레이어에 데이터를 적용했습니다`,
          })
        } else {
          setResult({
            type: 'error',
            message: msg.error || '적용 중 오류가 발생했습니다',
          })
        }
      }
    })

    postToPlugin({ type: 'BULK_FILL', mappings })
  }

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div style={{ marginTop: 12 }}>
      {/* 적용 버튼 */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleFill}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <span className="spinner" />
            적용 중... ({progress.current}/{progress.total})
          </>
        ) : (
          '데이터 적용'
        )}
      </button>

      {/* 진행률 바 */}
      {isProcessing && (
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* 결과 메시지 */}
      {result && (
        <div
          className={`status-msg ${
            result.type === 'success' ? 'status-success' : 'status-error'
          }`}
          style={{ marginTop: 8 }}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
