// UX 라이팅 검증 탭 컴포넌트
import React, { useState, useEffect } from 'react'
import { postToPlugin, waitForMessage, onPluginMessage } from '../services/pluginBridge'
import { loadGuidelinePageId, loadGuidelinePageName, loadGuidelineTextCache, saveGuidelineTextCache } from '../services/storageService'
import { callNotionProxy } from '../services/supabaseClient'
import { blocksToGuidelineText, type NotionBlock } from '../services/notionBlockParser'
import { reviewUXWriting, type ReviewResult } from '../services/uxReviewService'

interface UXReviewProps {
  guidelinePageId: string
  guidelinePageName: string
  geminiModel: string
  geminiToken: string
  notionToken: string
}

export function UXReview({ guidelinePageId, guidelinePageName, geminiModel, geminiToken, notionToken }: UXReviewProps) {
  // 가이드라인 텍스트
  const [guidelineText, setGuidelineText] = useState('')
  const [isLoadingGuideline, setIsLoadingGuideline] = useState(false)
  const [guidelineLoadError, setGuidelineLoadError] = useState<string | null>(null)

  // 검증 상태
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewResults, setReviewResults] = useState<ReviewResult[]>([])

  // 토스트 메시지
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 초기화: guidelinePageId와 notionToken이 모두 준비됐을 때 로드
  useEffect(() => {
    const init = async () => {
      if (guidelinePageId && notionToken) {
        await loadGuidelineContent(guidelinePageId)
      }
    }
    init()
  }, [guidelinePageId, notionToken])

  // 가이드라인 콘텐츠 로드 (캐시 우선, 없으면 Notion API 호출)
  // 로드된 텍스트를 반환하여 호출자가 바로 사용할 수 있도록 함
  const loadGuidelineContent = async (pageId: string): Promise<string> => {
    setIsLoadingGuideline(true)
    setGuidelineLoadError(null)
    try {
      // 1. 캐시 확인
      const cached = await loadGuidelineTextCache()
      console.log('[guideline] pageId:', pageId, '| notionToken 길이:', notionToken?.length, '| 캐시:', cached?.length ?? 0, '자')
      if (cached) {
        setGuidelineText(cached)
        return cached
      }

      // 2. Notion API로 블록 조회 (중첩 블록 포함)
      // 하이픈 없는 ID를 UUID 형식으로 변환 (Notion API 요구사항)
      const normalizedId = pageId.includes('-') ? pageId
        : `${pageId.slice(0, 8)}-${pageId.slice(8, 12)}-${pageId.slice(12, 16)}-${pageId.slice(16, 20)}-${pageId.slice(20)}`
      const result = await callNotionProxy('retrieve_blocks_recursive', {
        blockId: normalizedId,
      }, notionToken)

      console.log('[guideline] API 응답 블록 수:', result.results?.length ?? 0)

      const blocks: NotionBlock[] = result.results || []
      // 디버깅: 블록 타입과 내용 확인
      blocks.forEach((b, i) => console.log(`[guideline] 블록[${i}] type=${b.type}, has_children=${b.has_children}, keys=${Object.keys(b).join(',')}`))

      // 3. 블록 → 텍스트 변환
      const text = blocksToGuidelineText(blocks)
      console.log('[guideline] 변환된 텍스트 길이:', text.length)
      setGuidelineText(text)
      saveGuidelineTextCache(text)
      return text
    } catch (error) {
      const msg = error instanceof Error ? error.message : '가이드라인을 불러오는데 실패했습니다'
      console.error('[guideline] 에러:', msg)
      setGuidelineLoadError(msg)
      return ''
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

    if (!guidelinePageId) {
      showToast('error', '설정 탭에서 가이드라인 문서를 선택해주세요')
      return
    }

    // 가이드라인 텍스트가 아직 로드되지 않았으면 로드 시도
    let currentGuidelineText = guidelineText
    if (!currentGuidelineText) {
      showToast('success', '가이드라인을 불러오는 중...')
      currentGuidelineText = await loadGuidelineContent(guidelinePageId)

      if (!currentGuidelineText) {
        showToast('error', guidelineLoadError || '가이드라인 텍스트를 불러올 수 없습니다. 설정을 확인해주세요.')
        return
      }
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

      // 2. 응답 타입 검증
      if (!Array.isArray(response.nodes)) {
        showToast('error', '플러그인 응답 형식이 올바르지 않습니다')
        setIsReviewing(false)
        return
      }

      // 3. Gemini API로 검증 요청
      const results = await reviewUXWriting({
        nodes: response.nodes
          .filter((n: { id: string; name: string; characters: string }) =>
            typeof n.id === 'string' && typeof n.characters === 'string'
          )
          .map((n: { id: string; name: string; characters: string }) => ({
            id: n.id,
            name: n.name ?? '',
            originalText: n.characters,
          })),
        guidelineText: currentGuidelineText,
        apiKey: geminiToken,
        model: geminiModel,
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

      // APPLY_RESULT 메시지 수신 확인 (3초 타임아웃)
      const result = await waitForMessage('APPLY_RESULT', undefined, 3000)

      if (result.success === false) {
        showToast('error', result.error || '적용에 실패했습니다')
        return
      }

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
      {/* 가이드라인 문서 상태 */}
      <div className="field-group">
        <label className="field-label">가이드라인 문서</label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '6px 8px',
          background: guidelinePageId ? '#f0f7ff' : '#fff9e6',
          borderRadius: 4,
          fontSize: 11,
        }}>
          {guidelinePageId ? (
            <>
              <span style={{ color: '#333' }}>✓ {guidelinePageName}</span>
              <button
                className="btn btn-secondary btn-small"
                onClick={handleRefreshGuideline}
                disabled={isLoadingGuideline}
              >
                {isLoadingGuideline ? '로딩...' : '새로고침'}
              </button>
            </>
          ) : (
            <span style={{ color: '#996600' }}>⚠ 설정 탭에서 가이드라인 문서를 선택해주세요</span>
          )}
        </div>
      </div>

      {/* 검증 버튼 */}
      <button
        className="btn btn-primary btn-block"
        onClick={handleReview}
        disabled={isReviewing || !guidelinePageId || isLoadingGuideline || !geminiToken}
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

      {/* 가이드라인 텍스트 로드 실패 안내 */}
      {guidelineLoadError && (
        <div style={{
          padding: '8px',
          background: '#fff0f0',
          borderRadius: 4,
          fontSize: 11,
          color: '#cc0000',
          marginTop: 8,
        }}>
          ⚠ 가이드라인 로드 실패: {guidelineLoadError}
        </div>
      )}

      {/* Gemini API 키 안내 */}
      {!geminiToken && (
        <div style={{
          padding: '8px',
          background: '#fff9e6',
          borderRadius: 4,
          fontSize: 11,
          color: '#996600',
          marginTop: 8,
        }}>
          ⚠ 설정 탭에서 Gemini API 키를 입력해주세요
        </div>
      )}

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
                        disabled={result.applied}
                      >
                        {result.applied ? '✓ 적용됨' : '적용'}
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
