// figma.clientStorage 래퍼
// clientStorage는 Plugin 스레드에서만 접근 가능하므로 postMessage로 중개
import { saveStorage, loadStorage } from './pluginBridge'

// 저장 키 상수
export const STORAGE_KEYS = {
  NOTION_TOKEN: 'notion_token',
  SELECTED_DB: 'selected_db',
  PRESETS: 'presets',
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

// 프리셋 저장/로드
export function savePresets(presets: Preset[]) {
  saveStorage(STORAGE_KEYS.PRESETS, presets)
}

export async function loadPresets(): Promise<Preset[]> {
  return (await loadStorage<Preset[]>(STORAGE_KEYS.PRESETS)) ?? []
}

// 프리셋 타입
export interface Preset {
  id: string
  name: string
  databaseId: string
  databaseName: string
  mappings: Array<{ layerPattern: string; notionField: string }>
  mode: 'random' | 'sequential'
  token?: string
  createdAt: number
}
