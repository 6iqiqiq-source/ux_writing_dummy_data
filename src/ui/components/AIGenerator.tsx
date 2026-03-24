import React, { useState, useEffect } from 'react'
import { TextNodeInfo } from '../../plugin/types'
import { loadGeminiToken, saveGeminiToken } from '../services/storageService'
import { generateAIText } from '../services/geminiService'

interface Props {
  selectedNodes: TextNodeInfo[]
}

export function AIGenerator({ selectedNodes }: Props) {
  const [token, setToken] = useState('')
  const [isTokenSaved, setIsTokenSaved] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadGeminiToken().then((savedToken) => {
      if (savedToken) {
        setToken(savedToken)
        setIsTokenSaved(true)
      }
    })
  }, [])

  const handleSaveToken = () => {
    if (!token.trim()) return
    saveGeminiToken(token.trim())
    setIsTokenSaved(true)
    setSuccessMsg('API 키가 저장되었습니다.')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleGenerate = async () => {
    if (!token) {
      setError('Gemini API 키가 필요합니다.')
      return
    }
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.')
      return
    }
    if (selectedNodes.length === 0) {
      setError('변경할 텍스트 레이어를 하나 이상 선택해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const generatedMappings = await generateAIText({
        apiKey: token,
        prompt: prompt.trim(),
        nodes: selectedNodes.map(n => ({ id: n.id, originalText: n.characters }))
      })

      if (generatedMappings.length === 0) {
        setError('생성된 텍스트가 없습니다.')
        setIsLoading(false)
        return
      }

      // Figma plugin 메시지로 전송
      parent.postMessage({
        pluginMessage: {
          type: 'BULK_FILL',
          mappings: generatedMappings.map(m => ({ nodeId: m.id, text: m.text }))
        }
      }, '*')

      setSuccessMsg('성공적으로 텍스트가 적용되었습니다.')
      setPrompt('') // 프롬프트 초기화 여부는 자유
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ai-generator">
      {!isTokenSaved ? (
        <div className="field-group">
          <label className="field-label">Gemini API Key</label>
          <input
            type="password"
            className="field-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="AI Studio에서 발급받은 API 키 입력"
          />
          <button className="btn btn-primary btn-block" style={{ marginTop: '8px' }} onClick={handleSaveToken}>
            저장하기
          </button>
        </div>
      ) : (
        <div className="field-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="field-label">Gemini API 가 연결되었습니다.</label>
            <button className="btn btn-secondary btn-small" onClick={() => setIsTokenSaved(false)}>
              변경
            </button>
          </div>
        </div>
      )}

      {isTokenSaved && (
        <>
          <div className="field-group" style={{ marginTop: '16px' }}>
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
            disabled={isLoading || selectedNodes.length === 0}
          >
            {isLoading ? (
              <><span className="spinner"></span>생성 중...</>
            ) : (
              `선택된 레이어 (${selectedNodes.length}개) 생성하기`
            )}
          </button>
        </>
      )}

      {error && <div className="status-msg status-error" style={{ marginTop: '12px' }}>{error}</div>}
      {successMsg && <div className="status-msg status-success" style={{ marginTop: '12px' }}>{successMsg}</div>}
    </div>
  )
}
