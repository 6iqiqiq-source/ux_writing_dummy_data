// geminiService 단위 테스트 - 타임아웃, 응답 파싱 검증
// (P0 수정: AbortController, 정적 import, 타임아웃 에러 메시지)

const mockFetch = jest.fn()
global.fetch = mockFetch

// storageService 모킹 (부수효과 없애기)
jest.mock('../ui/services/storageService', () => ({
  incrementUsage: jest.fn().mockResolvedValue(undefined),
}))

import { generateAIText } from '../ui/services/geminiService'

beforeEach(() => {
  mockFetch.mockReset()
})

const NODES = [
  { id: 'n1', originalText: '안녕하세요' },
  { id: 'n2', originalText: '버튼' },
]

function makeGeminiResponse(texts: string[]) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(texts) }] }
      }]
    }),
  }
}

describe('generateAIText - 성공 케이스', () => {
  test('nodes 배열과 동일한 길이의 결과 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeGeminiResponse(['반갑습니다', '확인']))

    const result = await generateAIText({
      nodes: NODES,
      prompt: '친근하게 바꿔주세요',
      apiKey: 'test-key',
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'n1', text: '반갑습니다' })
    expect(result[1]).toEqual({ id: 'n2', text: '확인' })
  })

  test('nodes가 빈 배열이면 빈 배열 반환 (fetch 호출 없음)', async () => {
    const result = await generateAIText({ nodes: [], prompt: 'test', apiKey: 'key' })
    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('generateAIText - 에러 처리 (P0 수정 검증)', () => {
  test('apiKey 없으면 즉시 에러 throw', async () => {
    await expect(generateAIText({ nodes: NODES, prompt: 'test', apiKey: '' }))
      .rejects.toThrow('Gemini API 키가 필요합니다')
  })

  test('응답 배열 길이 불일치 시 에러 throw', async () => {
    // 2개 노드에 1개 결과만 반환
    mockFetch.mockResolvedValueOnce(makeGeminiResponse(['하나만']))

    await expect(generateAIText({ nodes: NODES, prompt: 'test', apiKey: 'key' }))
      .rejects.toThrow('API 응답 개수가 요청 개수와 다릅니다.')
  })

  test('응답이 JSON 배열이 아닐 때 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"error": "not array"}' }] } }]
      }),
    })

    await expect(generateAIText({ nodes: NODES, prompt: 'test', apiKey: 'key' }))
      .rejects.toThrow('API 응답이 배열 형식이 아닙니다.')
  })

  test('API 에러 응답(4xx) 시 에러 메시지 throw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'API key not valid.' } }),
    })

    await expect(generateAIText({ nodes: NODES, prompt: 'test', apiKey: 'bad-key' }))
      .rejects.toThrow('API key not valid.')
  })

  test('AbortError 시 타임아웃 메시지로 에러 throw', async () => {
    // AbortController가 abort()할 때 발생하는 에러와 동일한 형태
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    await expect(generateAIText({ nodes: NODES, prompt: 'test', apiKey: 'key' }))
      .rejects.toThrow('요청 시간이 초과되었습니다')
  })

  test('contentText 없을 때 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [] } }] }),
    })

    await expect(generateAIText({ nodes: NODES, prompt: 'test', apiKey: 'key' }))
      .rejects.toThrow('응답을 파싱할 수 없습니다')
  })
})
