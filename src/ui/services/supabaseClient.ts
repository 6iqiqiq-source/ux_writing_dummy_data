// Supabase Edge Function 호출 클라이언트
// Notion API를 CORS 프록시 경유로 호출
// 빌드 타임에 webpack DefinePlugin이 process.env.* 값을 상수로 치환함

declare const process: { env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; PLUGIN_SECRET: string } }

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const PLUGIN_SECRET = process.env.PLUGIN_SECRET

// 빌드 타임에 환경변수가 주입되지 않은 경우 런타임에 명확한 에러 출력
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabaseClient] SUPABASE_URL 또는 SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. 빌드 환경을 확인하세요.')
}

const REQUEST_TIMEOUT_MS = 30_000 // 30초 타임아웃

export async function callNotionProxy(
  action: string,
  params: Record<string, unknown>,
  notionToken: string
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notion-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-plugin-secret': PLUGIN_SECRET,
      },
      body: JSON.stringify({ action, notionToken, ...params }),
      signal: controller.signal,
    })

    if (!res.ok) {
      let errorMsg = `API 오류: ${res.status}`
      try {
        const error = await res.json()
        errorMsg = error.message || error.error || errorMsg
      } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
      }
      throw new Error(errorMsg)
    }

    return res.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
