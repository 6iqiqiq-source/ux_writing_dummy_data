// UX 라이팅 검증 탭 컴포넌트
import React, { useState, useEffect } from 'react'
import { postToPlugin, waitForMessage, onPluginMessage } from '../services/pluginBridge'
import { loadGeminiToken, loadGuidelinePageId, loadGuidelinePageName, loadGuidelineTextCache, saveGuidelineTextCache } from '../services/storageService'
import { callNotionProxy } from '../services/supabaseClient'
import { blocksToGuidelineText, type NotionBlock } from '../services/notionBlockParser'
import { reviewUXWriting, type ReviewResult } from '../services/uxReviewService'

interface UXReviewProps {
  guidelinePageId: string
  guidelinePageName: string
}

export function UXReview({ guidelinePageId, guidelinePageName }: UXReviewProps) {
  // Gemini API 키
  const [geminiToken, setGeminiToken] = useState('')

  // 가이드라인 텍스트
  const [guidelineText, setGuidelineText] = useState('')
  const [isLoadingGuideline, setIsLoadingGuideline] = useState(false)

  // 검증 상태
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewResults, setReviewResults] = useState<ReviewResult[]>([])

  // 토스트 메시지
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 초기화: Gemini 토큰 및 가이드라인 로드
  useEffect(() => {
    const init = async () => {
      const token = await loadGeminiToken()
      if (token) setGeminiToken(token)

      // 가이드라인이 설정되어 있으면 텍스트 로드
      if (guidelinePageId) {
        await loadGuidelineContent(guidelinePageId)
      }
    }
    init()
  }, [guidelinePageId])

  // 가이드라인 콘텐츠 로드 (캐시 우선, 없으면 Notion API 호출)
  const loadGuidelineContent = async (pageId: string) => {
    setIsLoadingGuideline(true)
    try {
      // 1. 캐시 확인
      const cached = await loadGuidelineTextCache()
      if (cached) {
        setGuidelineText(cached)
        return
      }

      // 2. Notion API로 블록 조회 (중첩 블록 포함)
      const result = await callNotionProxy('retrieve_blocks_recursive', {
        blockId: pageId,
      })

      const blocks: NotionBlock[] = result.results || []

      // 3. 블록 → 텍스트 변환
      const text = blocksToGuidelineText(blocks)
      console.log('[UXReview] 가이드라인 로드 완료:', {
        blockCount: blocks.length,
        textLength: text.length,
        preview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
      })
      setGuidelineText(text)
      saveGuidelineTextCache(text)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '가이드라인을 불러오는데 실패했습니다')
    } finally {
      setIsLoadingGuideline(false)
    }
  }

  // 캐시 삭제 및 가이드라인 재로드
  const handleRefreshGuideline = async () => {
    if (!guidelinePageId) return

    setIsLoadingGuideline(true)
    try {
      // 캐시 삭제
      saveGuidelineTextCache('')
      setGuidelineText('')

      // 재로드
      await loadGuidelineContent(guidelinePageId)
      showToast('success', '가이드라인을 다시 불러왔습니다')
    } catch (error) {
      showToast('error', '가이드라인을 다시 불러오는데 실패했습니다')
    } finally {
      setIsLoadingGuideline(false)
    }
  }

  // 검증 실행
  const handleReview = async () => {
    if (!geminiToken) {
      showToast('error', 'Gemini API 키를 설정해주세요 (AI 생성 탭)')
      return
    }

    if (!guidelinePageId || !guidelineText) {
      showToast('error', '설정 탭에서 가이드라인 문서를 선택해주세요')
      return
    }

    setIsReviewing(true)
    setReviewResults([])

    try {
      // 1. Plugin에 프레임 하위 텍스트 노드 요청
      postToPlugin({ type: 'GET_FRAME_TEXT_NODES' })
      const response = await waitForMessage('FRAME_TEXT_NODES', undefined, 5000)

      if (!response.nodes || response.nodes.length === 0) {
        showToast('error', 'Figma에서 프레임을 선택해주세요')
        setIsReviewing(false)
        return
      }

      // 2. Gemini API로 검증 요청
      console.log('[UXReview] 검증 시작:', {
        nodeCount: response.nodes.length,
        guidelineLength: guidelineText.length,
        guidelinePreview: guidelineText.substring(0, 100)
      })
      const results = await reviewUXWriting({
        nodes: response.nodes.map((n: any) => ({
          id: n.id,
          name: n.name,
          originalText: n.characters,
        })),
        guidelineText,
        apiKey: geminiToken,
      })

      setReviewResults(results)

      const failCount = results.filter(r => r.status === 'fail').length
      if (failCount === 0) {
        showToast('success', `모든 텍스트가 가이드라인에 부합합니다 (${results.length}개 검증 완료)`)
      } else {
        showToast('success', `${results.length}개 텍스트 검증 완료`)
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '검증 중 오류가 발생했습니다')
    } finally {
      setIsReviewing(false)
    }
  }

  // 개선안 적용
  const handleApplySuggestion = async (nodeId: string, suggestion: string, index: number) => {
    try {
      postToPlugin({ type: 'APPLY_DATA', nodeId, text: suggestion })

      // 대기 시간 추가 (Plugin이 처리할 시간)
      await new Promise(resolve => setTimeout(resolve, 100))

      // 해당 항목을 applied 상태로 표시
      setReviewResults(prev =>
        prev.map((r, i) =>
          i === index ? { ...r, applied: true } : r
        )
      )

      showToast('success', '개선안이 적용되었습니다')
    } catch (error) {
      showToast('error', '적용 중 오류가 발생했습니다')
    }
  }

  // 토스트 메시지 표시
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 3000)
  }

  const failCount = reviewResults.filter(r => r.status === 'fail').length
  const passCount = reviewResults.filter(r => r.status === 'pass').length

  return (
    <div>
      {/* 가이드라인 연결 상태 */}
      <div className="field-group">
        <label className="field-label">가이드라인 문서</label>
        {guidelinePageId ? (
          <div style={{
            padding: '6px 8px',
            background: '#f0f7ff',
            borderRadius: 4,
            fontSize: 11,
            color: '#333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>✓ {guidelinePageName}</span>
            <button
              className="btn btn-secondary btn-small"
              onClick={handleRefreshGuideline}
              disabled={isLoadingGuideline}
              style={{ padding: '2px 6px', fontSize: 10 }}
            >
              {isLoadingGuideline ? '로딩...' : '새로고침'}
            </button>
          </div>
        ) : (
          <div style={{
            padding: '6px 8px',
            background: '#fff9e6',
            borderRadius: 4,
            fontSize: 11,
            color: '#996600',
          }}>
            ⚠ 설정 탭에서 가이드라인을 선택해주세요
          </div>
        )}
      </div>

      {/* 검증 버튼 */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleReview}
        disabled={isReviewing || !guidelinePageId || !guidelineText || isLoadingGuideline}
        style={{ marginTop: 8 }}
      >
        {isReviewing ? (
          <>
            <span className="spinner" />
            검증 중...
          </>
        ) : isLoadingGuideline ? (
          <>
            <span className="spinner" />
            가이드라인 로딩 중...
          </>
        ) : (
          'UX 라이팅 검증하기'
        )}
      </button>

      {/* 검증 결과 요약 */}
      {reviewResults.length > 0 && (
        <div className="review-summary">
          총 {reviewResults.length}개 중{' '}
          <span className="fail-count">{failCount}개 개선 필요</span>,{' '}
          <span className="pass-count">{passCount}개 통과</span>
        </div>
      )}

      {/* 검증 결과 리스트 */}
      {reviewResults.length > 0 && (
        <ul className="review-list">
          {reviewResults.map((result, index) => (
            <li
              key={result.nodeId}
              className={`review-item ${result.status}`}
            >
              <div className="review-item-header">
                <span className={`review-dot ${result.status}`} />
                <span className="review-item-name">{result.nodeName}</span>
              </div>

              <div className="review-item-text">
                "{result.originalText}"
              </div>

              {result.status === 'fail' && (
                <>
                  {result.reason && (
                    <div className="review-reason">
                      {result.reason}
                    </div>
                  )}

                  {result.suggestion && (
                    <>
                      <div className="review-suggestion">
                        💡 개선안: "{result.suggestion}"
                      </div>

                      <button
                        className="btn-apply-suggestion"
                        onClick={() => handleApplySuggestion(result.nodeId, result.suggestion!, index)}
                        disabled={(result as any).applied}
                      >
                        {(result as any).applied ? '✓ 적용됨' : '적용'}
                      </button>
                      <div style={{ clear: 'both' }} />
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 토스트 메시지 */}
      {toastMsg && (
        <div className={`status-msg-toast status-${toastMsg.type}`}>
          {toastMsg.text}
        </div>
      )}
    </div>
  )
}
