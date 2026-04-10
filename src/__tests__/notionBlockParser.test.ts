// notionBlockParser 단위 테스트
import { extractBlockText, blocksToGuidelineText, NotionBlock } from '../ui/services/notionBlockParser'

// 테스트용 블록 생성 헬퍼
function makeBlock(type: string, text: string, extra?: Record<string, unknown>): NotionBlock {
  return {
    id: `block-${Math.random()}`,
    type,
    has_children: false,
    [type]: {
      rich_text: [{ plain_text: text }],
      ...extra,
    },
  }
}

describe('extractBlockText', () => {
  test('paragraph 블록에서 텍스트 추출', () => {
    const block = makeBlock('paragraph', '안녕하세요')
    expect(extractBlockText(block)).toBe('안녕하세요')
  })

  test('rich_text 없는 블록은 빈 문자열 반환', () => {
    const block: NotionBlock = { id: 'x', type: 'divider', has_children: false, divider: {} }
    expect(extractBlockText(block)).toBe('')
  })

  test('여러 rich_text 조각을 이어붙임', () => {
    const block: NotionBlock = {
      id: 'x',
      type: 'paragraph',
      has_children: false,
      paragraph: {
        rich_text: [{ plain_text: '첫 번째 ' }, { plain_text: '두 번째' }],
      },
    }
    expect(extractBlockText(block)).toBe('첫 번째 두 번째')
  })
})

describe('blocksToGuidelineText', () => {
  test('heading_1 → # 접두사', () => {
    const blocks = [makeBlock('heading_1', '제목')]
    expect(blocksToGuidelineText(blocks)).toBe('# 제목')
  })

  test('heading_2 → ## 접두사', () => {
    const blocks = [makeBlock('heading_2', '소제목')]
    expect(blocksToGuidelineText(blocks)).toBe('## 소제목')
  })

  test('heading_3 → ### 접두사', () => {
    const blocks = [makeBlock('heading_3', '항목')]
    expect(blocksToGuidelineText(blocks)).toBe('### 항목')
  })

  test('bulleted_list_item → - 접두사', () => {
    const blocks = [makeBlock('bulleted_list_item', '목록 항목')]
    expect(blocksToGuidelineText(blocks)).toBe('- 목록 항목')
  })

  test('numbered_list_item → 1. 접두사', () => {
    const blocks = [makeBlock('numbered_list_item', '순서 항목')]
    expect(blocksToGuidelineText(blocks)).toBe('1. 순서 항목')
  })

  test('quote → > 접두사', () => {
    const blocks = [makeBlock('quote', '인용')]
    expect(blocksToGuidelineText(blocks)).toBe('> 인용')
  })

  test('callout → 💡 접두사', () => {
    const blocks = [makeBlock('callout', '콜아웃')]
    expect(blocksToGuidelineText(blocks)).toBe('💡 콜아웃')
  })

  test('여러 블록을 줄바꿈으로 결합', () => {
    const blocks = [
      makeBlock('heading_1', '가이드라인'),
      makeBlock('paragraph', '설명 내용'),
      makeBlock('bulleted_list_item', '규칙 1'),
    ]
    expect(blocksToGuidelineText(blocks)).toBe('# 가이드라인\n설명 내용\n- 규칙 1')
  })

  test('빈 블록은 필터링', () => {
    const blocks = [
      makeBlock('heading_1', '제목'),
      makeBlock('paragraph', ''), // 빈 paragraph
      makeBlock('bulleted_list_item', '항목'),
    ]
    expect(blocksToGuidelineText(blocks)).toBe('# 제목\n- 항목')
  })

  test('[DEBUG] 문자열이 결과에 포함되지 않음 (P0 수정 검증)', () => {
    // 미지원 블록 타입(divider 등)이 있어도 DEBUG 텍스트 없어야 함
    const blocks: NotionBlock[] = [
      makeBlock('heading_1', '제목'),
      { id: 'x', type: 'divider', has_children: false, divider: {} },
    ]
    const result = blocksToGuidelineText(blocks)
    expect(result).not.toContain('[DEBUG]')
    expect(result).toBe('# 제목')
  })

  test('빈 배열 입력 시 빈 문자열 반환', () => {
    expect(blocksToGuidelineText([])).toBe('')
  })
})
