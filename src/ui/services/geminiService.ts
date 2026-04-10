import { incrementUsage } from './storageService'

const REQUEST_TIMEOUT_MS = 30_000 // 30초 타임아웃

export interface GenerateTextParams {
  nodes: { id: string; originalText: string }[]
  prompt: string
  apiKey: string
  model?: string
}

export async function generateAIText(params: GenerateTextParams): Promise<{ id: string; text: string }[]> {
  const { nodes, prompt, apiKey, model = 'gemini-2.5-flash' } = params

  if (!nodes.length) return []
  if (!apiKey) throw new Error('Gemini API 키가 필요합니다.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const systemInstruction = `
당신은 Figma 플러그인에서 동작하는 전문 UX 라이터 및 카피라이터입니다.
사용자 프롬프트를 기반으로 지정된 텍스트 레이어들의 문구를 생성하거나 다듬어야 합니다.

- 레이어마다 서로 다른, 개별적인 텍스트 결과물을 반환하세요.
- 각 레이어에 기존 텍스트(originalText)가 있다면, 해당 텍스트를 프롬프트에 맞게 다듬어주세요(Rewriting).
- 기존 텍스트가 비어있거나 플레이스홀더 성격이라면, 프롬프트에 따라 완전히 새롭게 창작하세요.
- 출력 언어는 반드시 '한국어'여야 합니다.
- 시스템 메시지나 추가 설명 없이 오직 결과물만 JSON 배열의 문자열들로 응답하세요.

요청받을 JSON 형식 예시:
[
  { "id": "layer1", "originalText": "안녕하세요" },
  { "id": "layer2", "originalText": "" }
]

반드시 응답해야 할 JSON 형식 (Markdown 코드 블록 포함하지 마세요):
[
  "다듬어진 인사말",
  "새로 창작된 텍스트"
]
  `.trim()

  const userContent = JSON.stringify(nodes.map(n => ({ id: n.id, originalText: n.originalText }))) + '\n\n프롬프트: ' + prompt

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
      temperature: 0.7,
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

    let generatedTexts: string[] = []
    try {
      generatedTexts = JSON.parse(contentText)
      if (!Array.isArray(generatedTexts)) {
        throw new Error('API 응답이 배열 형식이 아닙니다.')
      }
      if (generatedTexts.length !== nodes.length) {
        throw new Error('API 응답 개수가 요청 개수와 다릅니다.')
      }
      if (!generatedTexts.every(t => typeof t === 'string')) {
        throw new Error('API 응답에 문자열이 아닌 항목이 포함되어 있습니다.')
      }
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('API 응답 형식이 올바르지 않습니다.')
    }

    // 성공 시 사용량 증가
    incrementUsage(model).catch(() => {/* 사용량 기록 실패는 무시 */})

    return nodes.map((node, index) => ({
      id: node.id,
      text: generatedTexts[index]
    }))

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
