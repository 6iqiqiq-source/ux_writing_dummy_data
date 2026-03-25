// Notion Blocks API 응답 파싱 유틸리티
// 페이지의 블록 콘텐츠를 가이드라인 텍스트로 변환

export interface NotionBlock {
  id: string
  type: string
  has_children: boolean
  [key: string]: unknown
}

interface RichText {
  plain_text: string
}

interface BlockData {
  rich_text?: RichText[]
}

// 블록에서 텍스트 추출
export function extractBlockText(block: NotionBlock): string {
  const blockData = block[block.type] as BlockData | undefined
  if (!blockData?.rich_text) return ''
  return blockData.rich_text.map(rt => rt.plain_text).join('')
}

// 블록 목록을 마크다운 형식의 가이드라인 텍스트로 변환
export function blocksToGuidelineText(blocks: NotionBlock[]): string {
  return blocks
    .map(block => {
      const text = extractBlockText(block)
      if (!text) return ''

      // 블록 타입별 포맷팅
      switch (block.type) {
        case 'heading_1':
          return `# ${text}`
        case 'heading_2':
          return `## ${text}`
        case 'heading_3':
          return `### ${text}`
        case 'bulleted_list_item':
          return `- ${text}`
        case 'numbered_list_item':
          return `1. ${text}`
        case 'quote':
          return `> ${text}`
        case 'callout':
          return `💡 ${text}`
        case 'toggle':
          return `▶ ${text}`
        case 'paragraph':
        default:
          return text
      }
    })
    .filter(Boolean)
    .join('\n')
}
