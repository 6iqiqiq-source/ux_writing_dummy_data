// Notion API 응답 타입 정의

// 데이터베이스 정보
export interface NotionDatabase {
  id: string
  title: Array<{ plain_text: string }>
  properties: Record<string, NotionPropertySchema>
}

// 속성 스키마 (데이터베이스 컬럼 정의)
export interface NotionPropertySchema {
  id: string
  name: string
  type: NotionPropertyType
}

export type NotionPropertyType =
  | 'title'
  | 'rich_text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'formula'
  | 'status'
  | 'people'
  | 'files'
  | 'created_time'
  | 'last_edited_time'

// 페이지(행) 데이터
export interface NotionPage {
  id: string
  properties: Record<string, NotionPropertyValue>
}

// 속성 값 (여러 타입 지원)
export interface NotionPropertyValue {
  type: NotionPropertyType
  title?: Array<{ plain_text: string }>
  rich_text?: Array<{ plain_text: string }>
  number?: number | null
  select?: { name: string } | null
  multi_select?: Array<{ name: string }>
  date?: { start: string; end?: string } | null
  checkbox?: boolean
  url?: string | null
  email?: string | null
  phone_number?: string | null
  formula?: { type: string; string?: string; number?: number; boolean?: boolean }
  status?: { name: string } | null
  people?: Array<{ name?: string }>
  files?: Array<{ name: string }>
  created_time?: string
  last_edited_time?: string
}

// 속성 값에서 문자열 추출
export function extractPropertyValue(prop: NotionPropertyValue): string {
  switch (prop.type) {
    case 'title':
      return prop.title?.map((t) => t.plain_text).join('') ?? ''
    case 'rich_text':
      return prop.rich_text?.map((t) => t.plain_text).join('') ?? ''
    case 'number':
      return prop.number != null ? String(prop.number) : ''
    case 'select':
      return prop.select?.name ?? ''
    case 'multi_select':
      return prop.multi_select?.map((s) => s.name).join(', ') ?? ''
    case 'date':
      if (!prop.date) return ''
      return prop.date.end
        ? `${prop.date.start} ~ ${prop.date.end}`
        : prop.date.start
    case 'checkbox':
      return prop.checkbox ? 'true' : 'false'
    case 'url':
      return prop.url ?? ''
    case 'email':
      return prop.email ?? ''
    case 'phone_number':
      return prop.phone_number ?? ''
    case 'formula':
      if (!prop.formula) return ''
      return String(
        prop.formula.string ?? prop.formula.number ?? prop.formula.boolean ?? ''
      )
    case 'status':
      return prop.status?.name ?? ''
    case 'people':
      return prop.people?.map((p) => p.name ?? '').join(', ') ?? ''
    case 'files':
      return prop.files?.map((f) => f.name).join(', ') ?? ''
    case 'created_time':
      return prop.created_time ?? ''
    case 'last_edited_time':
      return prop.last_edited_time ?? ''
    default:
      return ''
  }
}

// 데이터베이스 제목 추출 헬퍼
export function getDatabaseTitle(db: NotionDatabase): string {
  return db.title?.map((t) => t.plain_text).join('') || '제목 없음'
}
