// supabaseClient 단위 테스트 - 네트워크 타임아웃 및 에러 처리 검증
// (P0 수정: AbortController 타임아웃, JSON 파싱 실패 안전 처리)

// fetch 전역 모킹
const mockFetch = jest.fn()
global.fetch = mockFetch

// DefinePlugin이 치환하는 process.env 상수를 테스트 환경에서 모킹
// webpack DefinePlugin은 빌드 시 리터럴로 치환하므로, 테스트에서는 직접 설정
Object.defineProperty(global, 'process', {
  value: {
    ...process,
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      PLUGIN_SECRET: 'test-secret',
    },
  },
  writable: true,
})

import { callNotionProxy } from '../ui/services/supabaseClient'

beforeEach(() => {
  mockFetch.mockReset()
})

describe('callNotionProxy - 성공 케이스', () => {
  test('정상 응답 시 JSON 반환', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: ['db1', 'db2'] }),
    })

    const result = await callNotionProxy('search_databases', {}, 'notion-token') as any
    expect(result.results).toEqual(['db1', 'db2'])
  })
})

describe('callNotionProxy - 에러 처리 (P0 수정 검증)', () => {
  test('서버 에러(4xx/5xx) 시 error 메시지로 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Unauthorized' }),
    })

    await expect(callNotionProxy('search_databases', {}, 'bad-token'))
      .rejects.toThrow('Unauthorized')
  })

  test('서버 에러 시 JSON 파싱 실패해도 기본 메시지로 에러 throw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('JSON parse error') },
    })

    await expect(callNotionProxy('search_databases', {}, 'token'))
      .rejects.toThrow('API 오류: 500')
  })

  test('AbortError 시 타임아웃 메시지로 에러 throw', async () => {
    // AbortController가 abort()를 호출할 때 발생하는 에러와 동일한 형태
    const abortError = new Error('The operation was aborted.')
    abortError.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(abortError)

    await expect(callNotionProxy('search_databases', {}, 'token'))
      .rejects.toThrow('요청 시간이 초과되었습니다')
  })

  test('네트워크 에러 시 원래 에러 그대로 throw', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network Error'))

    await expect(callNotionProxy('search_databases', {}, 'token'))
      .rejects.toThrow('Network Error')
  })
})
