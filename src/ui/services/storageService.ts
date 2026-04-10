// figma.clientStorage 래퍼
// clientStorage는 Plugin 스레드에서만 접근 가능하므로 postMessage로 중개
import { saveStorage, loadStorage } from './pluginBridge'

// 저장 키 상수
export const STORAGE_KEYS = {
  GEMINI_TOKEN: 'gemini_token',
  NOTION_TOKEN: 'notion_token',
  SELECTED_DB: 'selected_db',
  CACHED_DATABASES: 'cached_databases',
  GUIDELINE_PAGE_ID: 'guideline_page_id',
  GUIDELINE_PAGE_NAME: 'guideline_page_name',
  GUIDELINE_TEXT_CACHE: 'guideline_text_cache',
  GEMINI_MODEL: 'gemini_model',
  USAGE_STATS: 'usage_stats',
} as const

// 제미나이 모델 저장/로드
export function saveGeminiModel(model: string) {
  saveStorage(STORAGE_KEYS.GEMINI_MODEL, model)
}

export async function loadGeminiModel(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.GEMINI_MODEL)
}

// 모델별 사용량 추적 (날짜 기반 자동 리셋)
type UsageData = { date: string; counts: Record<string, number> }

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export async function getUsageStats(): Promise<Record<string, number>> {
  const data = await loadStorage<UsageData>(STORAGE_KEYS.USAGE_STATS)
  if (!data) return {}
  // 날짜가 다르면 자동 리셋
  if (data.date !== getTodayString()) return {}
  return data.counts || {}
}

export async function incrementUsage(model: string): Promise<Record<string, number>> {
  const counts = await getUsageStats()
  counts[model] = (counts[model] || 0) + 1
  saveStorage(STORAGE_KEYS.USAGE_STATS, { date: getTodayString(), counts })
  return counts
}

// 선택된 DB 저장/로드
export function saveSelectedDb(dbId: string) {
  saveStorage(STORAGE_KEYS.SELECTED_DB, dbId)
}

export async function loadSelectedDb(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.SELECTED_DB)
}

// 제미나이 토큰 저장/로드
export function saveGeminiToken(token: string) {
  saveStorage(STORAGE_KEYS.GEMINI_TOKEN, token)
}

export async function loadGeminiToken(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.GEMINI_TOKEN)
}

// Notion Integration Token 저장/로드
export function saveNotionToken(token: string) {
  saveStorage(STORAGE_KEYS.NOTION_TOKEN, token)
}

export async function loadNotionToken(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.NOTION_TOKEN)
}

// 데이터베이스 목록 캐싱
export function saveDatabases(databases: unknown[]) {
  saveStorage(STORAGE_KEYS.CACHED_DATABASES, databases)
}

export async function loadDatabases<T>(): Promise<T[] | null> {
  return loadStorage<T[]>(STORAGE_KEYS.CACHED_DATABASES)
}

// 가이드라인 페이지 ID 저장/로드
export function saveGuidelinePageId(pageId: string): void {
  saveStorage(STORAGE_KEYS.GUIDELINE_PAGE_ID, pageId)
}

export async function loadGuidelinePageId(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.GUIDELINE_PAGE_ID)
}

// 가이드라인 페이지 이름 저장/로드
export function saveGuidelinePageName(name: string): void {
  saveStorage(STORAGE_KEYS.GUIDELINE_PAGE_NAME, name)
}

export async function loadGuidelinePageName(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.GUIDELINE_PAGE_NAME)
}

// 가이드라인 텍스트 캐시 저장/로드
export function saveGuidelineTextCache(text: string): void {
  saveStorage(STORAGE_KEYS.GUIDELINE_TEXT_CACHE, text)
}

export async function loadGuidelineTextCache(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.GUIDELINE_TEXT_CACHE)
}
