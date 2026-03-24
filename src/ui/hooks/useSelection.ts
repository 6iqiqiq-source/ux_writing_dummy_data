// Figma 텍스트 노드 선택 상태 관리 훅
// Plugin 스레드에서 보내는 SELECTION_CHANGED 메시지를 구독

import { useState, useEffect } from 'react'
import { onPluginMessage, postToPlugin } from '../services/pluginBridge'
import type { TextNodeInfo } from '../../plugin/types'

export function useSelection() {
  const [selectedNodes, setSelectedNodes] = useState<TextNodeInfo[]>([])

  useEffect(() => {
    // Plugin에서 보내는 선택 변경 메시지 구독
    const unsubscribe = onPluginMessage((msg) => {
      if (msg.type === 'SELECTION_CHANGED') {
        setSelectedNodes(msg.nodes)
      }
    })

    // 초기 선택 상태 요청
    postToPlugin({ type: 'GET_SELECTION' })

    return unsubscribe
  }, [])

  return { selectedNodes }
}
