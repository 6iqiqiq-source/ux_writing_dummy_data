// Notion API 프록시 Edge Function
// Figma 플러그인 UI에서 CORS 제약 없이 Notion API를 호출하기 위한 중간 프록시
// 사용자 본인의 Notion Integration Token을 요청 body로 전달받아 사용
import { corsHeaders } from '../_shared/cors.ts'

const NOTION_API_BASE = 'https://api.notion.com'
const NOTION_VERSION = '2022-06-28'

// 무분별한 호출 차단용 시크릿 (클라이언트 빌드 타임에 삽입된 값과 대조)
const PLUGIN_SECRET = Deno.env.get('PLUGIN_SECRET')

// IP 기반 Rate Limiting: 분당 최대 30회
// Map<ip, { count: number, resetAt: number }>
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30        // 분당 최대 요청 수
const RATE_WINDOW_MS = 60_000 // 1분

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false

  entry.count++
  return true
}

Deno.serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // IP 기반 Rate Limiting 체크
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      }
    )
  }

  // PLUGIN_SECRET 검증 (필수: 미설정 시 서비스 거부)
  if (!PLUGIN_SECRET) {
    return new Response(
      JSON.stringify({ error: 'PLUGIN_SECRET 환경변수가 설정되지 않았습니다. 서비스 관리자에게 문의하세요.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      }
    )
  }

  const pluginSecret = req.headers.get('x-plugin-secret')
  if (pluginSecret !== PLUGIN_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    )
  }

  try {
    const { action, databaseId, notionToken, ...params } = await req.json()

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
        JSON.stringify({ error: 'notionToken이 필요합니다. Notion Integration Token을 설정 탭에서 입력해주세요.' }),
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

      // 접근 가능한 데이터베이스 목록 검색 (페이지네이션 처리, 최대 500개)
      case 'search_databases': {
        const allDatabases: unknown[] = []
        let hasMore = true
        let startCursor: string | undefined = undefined
        const MAX_PAGES = 5 // 페이지당 100개 × 5페이지 = 최대 500개

        let pageCount = 0
        while (hasMore && pageCount < MAX_PAGES) {
          const response: Response = await fetch(`${NOTION_API_BASE}/v1/search`, {
            method: 'POST',
            headers: notionHeaders,
            body: JSON.stringify({
              filter: { property: 'object', value: 'database' },
              ...(startCursor ? { start_cursor: startCursor } : {}),
            }),
          })

          const data: any = await response.json()
          allDatabases.push(...(data.results ?? []))
          hasMore = data.has_more ?? false
          startCursor = data.next_cursor
          pageCount++
        }

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

      // 페이지/블록의 하위 블록을 재귀적으로 조회 (중첩 블록 포함)
      case 'retrieve_blocks_recursive': {
        const { blockId } = params as { blockId?: string }
        if (!blockId) {
          return new Response(
            JSON.stringify({ error: 'retrieve_blocks_recursive 액션에는 blockId가 필요합니다' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          )
        }

        const allBlocks: any[] = []

        async function fetchBlocks(parentId: string) {
          let cursor: string | undefined = undefined
          let hasMore = true

          while (hasMore) {
            let url = `${NOTION_API_BASE}/v1/blocks/${parentId}/children?page_size=100`
            if (cursor) url += `&start_cursor=${cursor}`

            const response = await fetch(url, { headers: notionHeaders })
            const data = await response.json()

            for (const block of data.results || []) {
              allBlocks.push(block)
              if (block.has_children) {
                // synced_block 참조인 경우 원본 블록 ID로 children 조회
                if (block.type === 'synced_block' && block.synced_block?.synced_from?.block_id) {
                  await fetchBlocks(block.synced_block.synced_from.block_id)
                } else {
                  await fetchBlocks(block.id)
                }
              }
            }

            hasMore = data.has_more
            cursor = data.next_cursor
          }
        }

        await fetchBlocks(blockId)

        return new Response(JSON.stringify({ results: allBlocks }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // 페이지 정보 조회
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
