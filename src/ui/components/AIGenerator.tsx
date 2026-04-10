import React, { useState } from 'react'
import { TextNodeInfo } from '../../plugin/types'
import { generateAIText } from '../services/geminiService'
import { sendAndWait } from '../services/pluginBridge'

interface Props {
  selectedNodes: TextNodeInfo[]
  geminiModel: string
  geminiToken: string
}

export function AIGenerator({ selectedNodes, geminiModel, geminiToken }: Props) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; key: number } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message, key: Date.now() })
    setTimeout(() => setToast(null), 3000)
  }

  const handleGenerate = async () => {
    if (!geminiToken) {
      showToast('error', 'Gemini API 키가 필요합니다. 설정 탭에서 입력해주세요.')
      return
    }
    if (!prompt.trim()) {
      showToast('error', '프롬프트를 입력해주세요.')
      return
    }
    if (selectedNodes.length === 0) {
      showToast('error', '변경할 텍스트 레이어를 하나 이상 선택해주세요.')
      return
    }

    setIsLoading(true)

    try {
      const generatedMappings = await generateAIText({
        apiKey: geminiToken,
        prompt: prompt.trim(),
        nodes: selectedNodes.map(n => ({ id: n.id, originalText: n.characters })),
        model: geminiModel
      })

      if (generatedMappings.length === 0) {
        showToast('error', '생성된 텍스트가 없습니다.')
        setIsLoading(false)
        return
      }

      // Figma plugin 메시지로 전송 후 결과 대기 (리스너 먼저 등록)
      const mappings = generatedMappings.map(m => ({ nodeId: m.id, text: m.text }))
      const result = await sendAndWait(
        { type: 'BULK_FILL', mappings },
        'APPLY_RESULT',
        undefined,
        10000
      )

      if (result.success) {
        setPrompt('')
        showToast('success', `${selectedNodes.length}개 레이어에 텍스트를 생성했습니다`)
      } else {
        showToast('error', result.error || '텍스트 적용에 실패했습니다')
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ai-generator">
      {/* Gemini 연결 상태 */}
      {geminiToken ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          background: '#f0f7ff',
          borderRadius: 4,
          fontSize: 11,
          marginBottom: 12,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#666' }}>Gemini API 연결됨</span>
        </div>
      ) : (
        <div style={{
          padding: '8px',
          background: '#fff9e6',
          borderRadius: 4,
          fontSize: 11,
          color: '#996600',
          marginBottom: 12,
        }}>
          ⚠ 설정 탭에서 Gemini API 키를 입력해주세요
        </div>
      )}

      <div className="field-group">
        <label className="field-label">프롬프트</label>
        <textarea
          className="field-input"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: 친근하고 공손한 톤의 에러 메시지로 작성해줘"
          style={{ resize: 'vertical' }}
        />
      </div>

      <button
        className="btn btn-primary btn-block"
        onClick={handleGenerate}
        disabled={isLoading || selectedNodes.length === 0 || !geminiToken}
      >
        {isLoading ? (
          <><span className="spinner"></span>생성 중...</>
        ) : (
          `선택된 레이어 (${selectedNodes.length}개) 생성하기`
        )}
      </button>

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
