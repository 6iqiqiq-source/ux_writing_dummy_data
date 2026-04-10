// UX 라이팅 검증 AI 서비스
// Gemini API를 사용하여 가이드라인 기반으로 텍스트 검증
import { incrementUsage } from './storageService'

const REQUEST_TIMEOUT_MS = 30_000 // 30초 타임아웃

export interface ReviewResult {
  nodeId: string
  nodeName: string
  originalText: string
  status: 'pass' | 'fail'
  reason?: string // fail인 경우 위반 사유
  suggestion?: string // fail인 경우 개선안 텍스트
  guidelineRef?: string // 참조한 가이드라인 항목
  applied?: boolean // 개선안 적용 여부 (UI 상태)
}

export interface ReviewParams {
  nodes: Array<{ id: string; name: string; originalText: string }>
  guidelineText: string
  apiKey: string
  model?: string
}

export async function reviewUXWriting(params: ReviewParams): Promise<ReviewResult[]> {
  const { nodes, guidelineText, apiKey, model = 'gemini-2.5-flash' } = params

  if (!nodes.length) return []
  if (!apiKey) throw new Error('Gemini API 키가 필요합니다.')
  if (!guidelineText) throw new Error('가이드라인 문서가 설정되지 않았습니다.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const systemInstruction = `
당신은 전문 UX 라이팅 검수자입니다.
아래 제공된 UX 라이팅 가이드라인을 **반드시 엄격히 준수**하여 Figma 디자인의 텍스트를 검증하세요.

## 📋 가이드라인 (필수 준수):
${guidelineText}

## 검증 기준:
- **가이드라인이 최우선 기준**입니다. 가이드라인에 명시된 모든 규칙을 확인하세요.
- 각 fail 판정 시 **반드시** 위반한 가이드라인의 구체적인 항목을 'reason'에 인용하세요.
- 'suggestion'은 가이드라인에 완전히 부합하도록 작성하세요.
- 가이드라인에 언급되지 않은 일반적인 UX 원칙은 2차적으로만 고려하세요.

## 응답 형식:
각 노드에 대해 다음 JSON 배열로 응답하세요 (Markdown 코드 블록 포함하지 마세요):
[
  {
    "nodeId": "노드ID",
    "status": "pass" 또는 "fail",
    "reason": "fail인 경우 **가이드라인의 구체적인 항목을 인용**하여 위반 사유 설명 (예: '가이드라인 2.1 존댓말 사용 규칙 위반')",
    "suggestion": "fail인 경우 가이드라인에 맞는 개선안 텍스트",
    "guidelineRef": "참조한 가이드라인 항목 번호나 제목"
  }
]

- pass: 가이드라인에 부합함
- fail: 가이드라인 위반, reason에 **구체적인 가이드라인 항목 인용 필수**
`.trim()

  const userContent = `검증할 텍스트 노드 목록:\n${JSON.stringify(
    nodes.map(n => ({ id: n.id, name: n.name, originalText: n.originalText })),
    null,
    2
  )}`

  const body = {
    system_instruction: {
      parts: { text: systemInstruction }
    },
    contents: [
      {
        parts: [{ text: userContent }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.2, // 더 일관되고 엄격한 판단을 위해 낮은 temperature
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.error?.message || 'Gemini API 호출에 실패했습니다.')
    }

    const data = await response.json()
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!contentText) {
      throw new Error('응답을 파싱할 수 없습니다.')
    }

    let results: Array<{
      nodeId: string
      status: 'pass' | 'fail'
      reason?: string
      suggestion?: string
      guidelineRef?: string
    }> = []

    try {
      results = JSON.parse(contentText)
      if (!Array.isArray(results)) {
        throw new Error('응답이 배열 형식이 아닙니다.')
      }
    } catch (e) {
      throw new Error('API 응답 형식이 올바르지 않습니다.')
    }

    // 성공 시 사용량 증가
    incrementUsage(model).catch(() => {/* 사용량 기록 실패는 무시 */})

    // 결과 매핑: nodeName과 originalText 추가
    return results.map((result) => {
      const node = nodes.find(n => n.id === result.nodeId)
      return {
        nodeId: result.nodeId,
        nodeName: node?.name || '알 수 없음',
        originalText: node?.originalText || '',
        status: result.status,
        reason: result.reason,
        suggestion: result.suggestion,
        guidelineRef: result.guidelineRef,
      }
    })

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.')
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error('알 수 없는 오류가 발생했습니다.')
  } finally {
    clearTimeout(timeoutId)
  }
}
