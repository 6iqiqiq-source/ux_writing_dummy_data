/// <reference types="@figma/plugin-typings" />
// Plugin 스레드 진입점
// Figma API에 접근하고, UI와 postMessage로 통신

import type { UIMessage, TextNodeInfo, PluginMessage } from './types'

figma.showUI(__html__, { width: 360, height: 540 })

// 텍스트 노드의 폰트를 로드 (mixed font일 경우 중복 로드 방지)
async function loadFontsForNode(node: TextNode) {
  if (node.fontName === figma.mixed) {
    const loaded = new Set<string>()
    const len = node.characters.length
    for (let i = 0; i < len; i++) {
      const font = node.getRangeFontName(i, i + 1) as FontName
      const key = `${font.family}::${font.style}`
      if (!loaded.has(key)) {
        await figma.loadFontAsync(font)
        loaded.add(key)
      }
    }
  } else {
    await figma.loadFontAsync(node.fontName as FontName)
  }
}

// 현재 선택된 텍스트 노드 목록 추출
function getSelectedTextNodes(): TextNodeInfo[] {
  return figma.currentPage.selection
    .filter((node): node is TextNode => node.type === 'TEXT')
    .map((node) => ({
      id: node.id,
      name: node.name,
      characters: node.characters,
    }))
}

// 선택된 노드(프레임 포함)에서 하위 텍스트 노드를 재귀적으로 추출
function getTextNodesRecursive(node: SceneNode): TextNodeInfo[] {
  if (node.type === 'TEXT') {
    return [{ id: node.id, name: node.name, characters: node.characters }]
  }
  if ('children' in node) {
    const results: TextNodeInfo[] = []
    const children = (node as ChildrenMixin & SceneNode).children
    for (const child of children) {
      results.push(...getTextNodesRecursive(child))
    }
    return results
  }
  return []
}

// UI에 선택 변경 알림
function notifySelectionChange() {
  const nodes = getSelectedTextNodes()
  const msg: PluginMessage = { type: 'SELECTION_CHANGED', nodes }
  figma.ui.postMessage(msg)
}

// 선택 변경 이벤트 감지
figma.on('selectionchange', () => {
  notifySelectionChange()
})

// UI → Plugin 메시지 처리
figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'GET_SELECTION': {
      notifySelectionChange()
      break
    }

    case 'GET_FRAME_TEXT_NODES': {
      const allTextNodes: TextNodeInfo[] = []
      for (const node of figma.currentPage.selection) {
        allTextNodes.push(...getTextNodesRecursive(node))
      }
      const response: PluginMessage = { type: 'FRAME_TEXT_NODES', nodes: allTextNodes }
      figma.ui.postMessage(response)
      break
    }

    case 'APPLY_DATA': {
      try {
        const node = figma.getNodeById(msg.nodeId)
        if (!node || node.type !== 'TEXT') {
          const response: PluginMessage = {
            type: 'APPLY_RESULT',
            success: false,
            error: '텍스트 노드를 찾을 수 없습니다',
          }
          figma.ui.postMessage(response)
          return
        }

        await loadFontsForNode(node)
        node.characters = msg.text
        const response: PluginMessage = { type: 'APPLY_RESULT', success: true }
        figma.ui.postMessage(response)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
        const response: PluginMessage = {
          type: 'APPLY_RESULT',
          success: false,
          error: errorMsg,
        }
        figma.ui.postMessage(response)
      }
      break
    }

    case 'BULK_FILL': {
      const { mappings } = msg
      for (let i = 0; i < mappings.length; i++) {
        try {
          const node = figma.getNodeById(mappings[i].nodeId)
          if (!node || node.type !== 'TEXT') continue

          await loadFontsForNode(node)
          node.characters = mappings[i].text
        } catch {
          // 개별 노드 실패 시 건너뛰고 계속 진행
        }

        const progress: PluginMessage = {
          type: 'BULK_PROGRESS',
          current: i + 1,
          total: mappings.length,
        }
        figma.ui.postMessage(progress)
      }

      const response: PluginMessage = { type: 'APPLY_RESULT', success: true }
      figma.ui.postMessage(response)
      break
    }

    case 'SAVE_STORAGE': {
      await figma.clientStorage.setAsync(msg.key, msg.value)
      break
    }

    case 'LOAD_STORAGE': {
      const data = await figma.clientStorage.getAsync(msg.key)
      const response: PluginMessage = {
        type: 'STORAGE_RESULT',
        key: msg.key,
        data,
      }
      figma.ui.postMessage(response)
      break
    }
  }
}
