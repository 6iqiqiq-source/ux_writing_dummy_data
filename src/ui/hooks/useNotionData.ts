// Notion 데이터 조회 훅
// Supabase 프록시를 통해 Notion API 호출

import { useState, useCallback } from 'react'
import { callNotionProxy } from '../services/supabaseClient'
import type { NotionDatabase, NotionPage } from '../types/notion'

interface UseNotionDataReturn {
  // 상태
  databases: NotionDatabase[]
  pages: NotionPage[]
  properties: Record<string, { id: string; name: string; type: string }>
  isLoading: boolean
  error: string | null

  // 액션
  validateToken: (token: string) => Promise<boolean>
  searchDatabases: (token: string) => Promise<void>
  queryDatabase: (token: string, databaseId: string) => Promise<void>
  clearError: () => void
}

export function useNotionData(): UseNotionDataReturn {
  const [databases, setDatabases] = useState<NotionDatabase[]>([])
  const [pages, setPages] = useState<NotionPage[]>([])
  const [properties, setProperties] = useState<
    Record<string, { id: string; name: string; type: string }>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 토큰 유효성 검증
  const validateToken = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      await callNotionProxy('validate_token', { notionToken: token })
      return true
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '토큰 검증에 실패했습니다'
      )
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 데이터베이스 목록 검색
  const searchDatabases = useCallback(async (token: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await callNotionProxy('search_databases', {
        notionToken: token,
      })
      setDatabases(data.results ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '데이터베이스 목록을 불러오지 못했습니다'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 데이터베이스 내 페이지 조회
  const queryDatabase = useCallback(
    async (token: string, databaseId: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await callNotionProxy('query_database', {
          notionToken: token,
          databaseId,
        })

        const resultPages: NotionPage[] = data.results ?? []
        setPages(resultPages)

        // 첫 번째 페이지에서 속성 스키마 추출
        if (resultPages.length > 0) {
          const propMap: Record<
            string,
            { id: string; name: string; type: string }
          > = {}
          for (const [key, value] of Object.entries(
            resultPages[0].properties
          )) {
            const prop = value as { id: string; type: string }
            propMap[key] = { id: prop.id, name: key, type: prop.type }
          }
          setProperties(propMap)
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : '데이터를 불러오지 못했습니다'
        )
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    databases,
    pages,
    properties,
    isLoading,
    error,
    validateToken,
    searchDatabases,
    queryDatabase,
    clearError,
  }
}
