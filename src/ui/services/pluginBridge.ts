// Plugin 스레드와의 postMessage 통신 래퍼
// Promise 기반 요청/응답 패턴 구현

import type { UIMessage, PluginMessage } from '../../plugin/types'

type MessageHandler = (msg: PluginMessage) => void

// 메시지 리스너 등록/해제
const listeners = new Set<MessageHandler>()

// Plugin → UI 메시지 수신 (단일 글로벌 리스너)
window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage as PluginMessage | undefined
  if (!msg) return
  listeners.forEach((handler) => handler(msg))
}

// UI → Plugin 메시지 전송
export function postToPlugin(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*')
}

// 메시지 리스너 등록 (구독 해제 함수 반환)
export function onPluginMessage(handler: MessageHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

// 특정 타입의 메시지를 기다리는 Promise 헬퍼
export function waitForMessage<T extends PluginMessage['type']>(
  type: T,
  filter?: (msg: Extract<PluginMessage, { type: T }>) => boolean,
  timeoutMs = 10000
): Promise<Extract<PluginMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`메시지 대기 시간 초과: ${type}`))
    }, timeoutMs)

    const cleanup = onPluginMessage((msg) => {
      if (msg.type === type) {
        const typedMsg = msg as Extract<PluginMessage, { type: T }>
        if (filter && !filter(typedMsg)) {
          return // 필터 조건에 맞지 않으면 무시
        }
        clearTimeout(timer)
        cleanup()
        resolve(typedMsg)
      }
    })
  })
}

// 선택된 텍스트 노드 목록 요청
export async function requestSelection() {
  postToPlugin({ type: 'GET_SELECTION' })
  return waitForMessage('SELECTION_CHANGED')
}

// clientStorage에 데이터 저장
export function saveStorage(key: string, value: unknown) {
  postToPlugin({ type: 'SAVE_STORAGE', key, value })
}

// clientStorage에서 데이터 로드
export async function loadStorage<T>(key: string): Promise<T | null> {
  postToPlugin({ type: 'LOAD_STORAGE', key })
  const result = await waitForMessage('STORAGE_RESULT', (msg) => msg.key === key)
  return (result.data as T) ?? null
}
