// Notion API 프록시 Edge Function
// Figma 플러그인 UI에서 CORS 제약 없이 Notion API를 호출하기 위한 중간 프록시
// 회사 Notion 토큰을 서버 측에서 관리하여 클라이언트에 노출되지 않도록 함
import { corsHeaders } from '../_shared/cors.ts'

const NOTION_API_BASE = 'https://api.notion.com'
const NOTION_VERSION = '2022-06-28'

// 회사 공용 Notion Integration Token (환경 변수 사용)
const COMPANY_NOTION_TOKEN = Deno.env.get('COMPANY_NOTION_TOKEN')

Deno.serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, databaseId, ...params } = await req.json()

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

    const notionHeaders = {
      Authorization: `Bearer ${COMPANY_NOTION_TOKEN}`,
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

      // 접근 가능한 데이터베이스 목록 검색 (페이지네이션 처리)
      case 'search_databases': {
        const allDatabases: unknown[] = []
        let hasMore = true
        let startCursor: string | undefined = undefined

        // 모든 페이지 순회
        while (hasMore) {
          const response: Response = await fetch(`${NOTION_API_BASE}/v1/search`, {
            method: 'POST',
            headers: notionHeaders,
            body: JSON.stringify({
              filter: { property: 'object', value: 'database' },
              start_cursor: startCursor,
            }),
          })

          const data: any = await response.json()
          allDatabases.push(...(data.results ?? []))
          hasMore = data.has_more ?? false
          startCursor = data.next_cursor
        }

        // 통합 응답 반환
        return new Response(JSON.stringify({ results: allDatabases }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

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

      // Notion 페이지 검색 (가이드라인 문서용)
      case 'search_pages': {
        const { query: searchQuery } = params as { query?: string }
        result = await fetch(`${NOTION_API_BASE}/v1/search`, {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            query: searchQuery || '',
            filter: { property: 'object', value: 'page' },
          }),
        })
        break
      }

      // 페이지/블록의 하위 블록 조회 (가이드라인 콘텐츠)
      case 'retrieve_blocks': {
        const { blockId, startCursor } = params as { blockId?: string; startCursor?: string }
        if (!blockId) {
          return new Response(
            JSON.stringify({ error: 'retrieve_blocks 액션에는 blockId가 필요합니다' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }
        let url = `${NOTION_API_BASE}/v1/blocks/${blockId}/children?page_size=100`
        if (startCursor) {
          url += `&start_cursor=${startCursor}`
        }
        result = await fetch(url, { headers: notionHeaders })
        break
      }

      // 페이지 정보 조회 (URL로 입력된 경우)
      case 'retrieve_page': {
        const { pageId } = params as { pageId?: string }
        if (!pageId) {
          return new Response(
            JSON.stringify({ error: 'retrieve_page 액션에는 pageId가 필요합니다' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }
        result = await fetch(`${NOTION_API_BASE}/v1/pages/${pageId}`, {
          headers: notionHeaders,
        })
        break
      }

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
