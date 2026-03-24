// Supabase Edge Function 호출 클라이언트
// Notion API를 CORS 프록시 경유로 호출

// TODO: 실제 Supabase 프로젝트 정보로 교체
const SUPABASE_URL = 'https://mottzvgkpvirwynzlzjq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdHR6dmdrcHZpcnd5bnpsempxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjg0NzYsImV4cCI6MjA4OTkwNDQ3Nn0.U0yvObPAB6SGaAS_43YF8n7NahUIDhO1flvznZPniGg'

export async function callNotionProxy(
  action: string,
  params: Record<string, unknown>
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notion-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...params }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || error.error || `API 오류: ${res.status}`)
  }

  return res.json()
}
