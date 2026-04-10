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

      // 블록 타입별 포맷팅
      switch (block.type) {
        case 'heading_1':
          return text ? `# ${text}` : ''
        case 'heading_2':
          return text ? `## ${text}` : ''
        case 'heading_3':
          return text ? `### ${text}` : ''
        case 'bulleted_list_item':
          return text ? `- ${text}` : ''
        case 'numbered_list_item':
          return text ? `1. ${text}` : ''
        case 'quote':
          return text ? `> ${text}` : ''
        case 'callout':
          return text ? `💡 ${text}` : ''
        case 'toggle':
          return text ? `▶ ${text}` : ''
        case 'table_row': {
          // 테이블 행 처리: 각 셀을 ' | '로 구분
          const tableRowData = (block.table_row as any) || {}
          const cells = (tableRowData.cells || []) as any[][]
          const cellTexts = cells.map(cell =>
            cell.map(rt => (rt.text?.content || rt.plain_text || '')).join('')
          )
          return cellTexts.join(' | ')
        }
        case 'table':
          // 테이블 블록 자체는 텍스트 없음
          return ''
        case 'paragraph':
        default:
          return text
      }
    })
    .filter(Boolean)
    .join('\n')
}
