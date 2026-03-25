// Plugin ↔ UI 공유 메시지 타입 정의

// 텍스트 노드 정보
export interface TextNodeInfo {
  id: string
  name: string
  characters: string
}

// Plugin → UI 메시지
export type PluginMessage =
  | { type: 'SELECTION_CHANGED'; nodes: TextNodeInfo[] }
  | { type: 'FRAME_TEXT_NODES'; nodes: TextNodeInfo[] }
  | { type: 'STORAGE_RESULT'; key: string; data: unknown }
  | { type: 'APPLY_RESULT'; success: boolean; error?: string }
  | { type: 'BULK_PROGRESS'; current: number; total: number }

// UI → Plugin 메시지
export type UIMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'GET_FRAME_TEXT_NODES' }
  | { type: 'APPLY_DATA'; nodeId: string; text: string }
  | { type: 'BULK_FILL'; mappings: Array<{ nodeId: string; text: string }> }
  | { type: 'SAVE_STORAGE'; key: string; value: unknown }
  | { type: 'LOAD_STORAGE'; key: string }
