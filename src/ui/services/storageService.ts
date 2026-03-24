// figma.clientStorage 래퍼
// clientStorage는 Plugin 스레드에서만 접근 가능하므로 postMessage로 중개
import { saveStorage, loadStorage } from './pluginBridge'

// 저장 키 상수
export const STORAGE_KEYS = {
  NOTION_TOKEN: 'notion_token',
  GEMINI_TOKEN: 'gemini_token',
  SELECTED_DB: 'selected_db',
  CACHED_DATABASES: 'cached_databases',
} as const

// 토큰 저장/로드
export function saveToken(token: string) {
  saveStorage(STORAGE_KEYS.NOTION_TOKEN, token)
}

export async function loadToken(): Promise<string | null> {
  return loadStorage<string>(STORAGE_KEYS.NOTION_TOKEN)
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

// 데이터베이스 목록 캐싱
export function saveDatabases(databases: unknown[]) {
  saveStorage(STORAGE_KEYS.CACHED_DATABASES, databases)
}

export async function loadDatabases<T>(): Promise<T[] | null> {
  return loadStorage<T[]>(STORAGE_KEYS.CACHED_DATABASES)
}
