// Notion API 프록시 Edge Function
// Figma 플러그인 UI에서 CORS 제약 없이 Notion API를 호출하기 위한 중간 프록시
import { corsHeaders } from '../_shared/cors.ts'

const NOTION_API_BASE = 'https://api.notion.com'
const NOTION_VERSION = '2022-06-28'

Deno.serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, notionToken, databaseId, ...params } = await req.json()

    // 필수 파라미터 검증
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action 파라미터가 필요합니다' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!notionToken) {
      return new Response(
        JSON.stringify({ error: 'notionToken 파라미터가 필요합니다' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    const notionHeaders = {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    }

    let result: Response

    switch (action) {
      // 토큰 유효성 검증
      case 'validate_token':
        result = await fetch(`${NOTION_API_BASE}/v1/users/me`, {
          headers: notionHeaders,
        })
        break

      // 접근 가능한 데이터베이스 목록 검색
      case 'search_databases':
        result = await fetch(`${NOTION_API_BASE}/v1/search`, {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            filter: { property: 'object', value: 'database' },
          }),
        })
        break

      // 데이터베이스 내 페이지 데이터 조회
      case 'query_database':
        if (!databaseId) {
          return new Response(
            JSON.stringify({
              error: 'query_database 액션에는 databaseId가 필요합니다',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }
        result = await fetch(
          `${NOTION_API_BASE}/v1/databases/${databaseId}/query`,
          {
            method: 'POST',
            headers: notionHeaders,
            body: JSON.stringify(params),
          }
        )
        break

      default:
        return new Response(
          JSON.stringify({ error: `알 수 없는 액션: ${action}` }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
    }

    const data = await result.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.status,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
