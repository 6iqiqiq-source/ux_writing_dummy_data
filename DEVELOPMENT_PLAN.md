# Notion 연동 Figma 더미 데이터 플러그인 — 개발 계획서

## 개요

Notion 데이터베이스의 데이터를 Figma 텍스트 레이어에 자동으로 채워넣는 플러그인.
디자이너의 더미 데이터 입력 시간을 줄이는 것이 목표.

### 아키텍처

```
Figma Plugin UI (iframe) ──fetch──▶ Supabase Edge Function ──fetch──▶ Notion API
       │                                (CORS 프록시)
       │ postMessage
       ▼
Plugin 스레드 (샌드박스) ──▶ Figma API (텍스트 노드 읽기/쓰기)
```

**왜 Supabase가 필요한가?**
Figma 플러그인 UI는 `null` origin iframe에서 실행되어 Notion API 직접 호출 시 CORS 차단됨.
Supabase Edge Function이 중간 프록시 역할을 수행하여 해결.

### 기술 스택

| 영역 | 기술 |
|------|------|
| Plugin 코드 | TypeScript |
| UI | React 18 + TypeScript |
| 번들러 | Webpack 5 |
| CORS 프록시 | Supabase Edge Function (Deno) |
| 데이터 소스 | Notion API (Internal Integration) |
| 영구 저장소 | figma.clientStorage |

---

## 프로젝트 구조

```
ux_writing_dummy_data/
├── manifest.json              # Figma 플러그인 매니페스트
├── package.json
├── tsconfig.json
├── webpack.config.js
│
├── src/
│   ├── plugin/                # Plugin 스레드 (Figma API 접근)
│   │   ├── controller.ts      #   진입점, 메시지 라우팅
│   │   ├── figmaService.ts    #   텍스트 노드 선택/수정
│   │   └── types.ts           #   Plugin ↔ UI 공유 타입
│   │
│   └── ui/                    # UI 스레드 (React, 네트워크 접근)
│       ├── App.tsx            #   탭 네비게이션
│       ├── index.tsx / .html
│       ├── components/
│       │   ├── NotionSetup.tsx    # 토큰 입력 + DB 선택
│       │   ├── DataMapper.tsx     # 레이어 ↔ Notion 필드 매핑
│       │   ├── BulkFillPanel.tsx  # 일괄 채우기
│       │   └── PresetManager.tsx  # 프리셋 CRUD
│       ├── services/
│       │   ├── supabaseClient.ts  # Edge Function 호출
│       │   ├── pluginBridge.ts    # postMessage 래퍼
│       │   └── storageService.ts  # clientStorage 래퍼
│       ├── hooks/
│       │   ├── useNotionData.ts
│       │   ├── useSelection.ts
│       │   └── usePresets.ts
│       └── types/
│           ├── notion.ts
│           └── messages.ts
│
├── supabase/
│   └── functions/
│       ├── notion-proxy/index.ts  # Notion API 프록시
│       └── _shared/cors.ts        # CORS 헤더
│
└── dist/                      # 빌드 결과물
    ├── code.js
    └── ui.html
```

---

## Step 1: Supabase Edge Function (CORS 프록시)

> 이것이 없으면 Notion 연동 자체가 불가능하므로 가장 먼저 구현

### 1-1. CORS 헤더 공통 모듈

**파일:** `supabase/functions/_shared/cors.ts`

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

### 1-2. Notion 프록시 함수

**파일:** `supabase/functions/notion-proxy/index.ts`

3가지 액션 지원:
- `validate_token` → `GET /v1/users/me`
- `search_databases` → `POST /v1/search`
- `query_database` → `POST /v1/databases/{id}/query`

```typescript
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { action, notionToken, databaseId, ...params } = await req.json()

  const notionHeaders = {
    'Authorization': `Bearer ${notionToken}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  }

  let result
  switch (action) {
    case 'validate_token':
      result = await fetch('https://api.notion.com/v1/users/me', {
        headers: notionHeaders,
      })
      break
    case 'search_databases':
      result = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ filter: { property: 'object', value: 'database' } }),
      })
      break
    case 'query_database':
      result = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(params),
      })
      break
    default:
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
  }

  const data = await result.json()
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: result.status,
  })
})
```

### 1-3. 배포 & 검증

```bash
supabase functions deploy notion-proxy

# 테스트
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/notion-proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action":"validate_token","notionToken":"ntn_xxx"}'
```

**완료 기준:** curl로 Notion API 응답이 정상 반환됨

---

## Step 2: Figma 플러그인 프로젝트 셋업

### 2-1. package.json 및 의존성

```bash
npm init -y
npm install react react-dom
npm install -D typescript @types/react @types/react-dom \
  @figma/plugin-typings webpack webpack-cli ts-loader \
  html-webpack-plugin html-inline-script-webpack-plugin \
  css-loader style-loader
```

> `html-inline-script-webpack-plugin`: Figma는 UI를 **단일 HTML 파일**로 요구하므로 JS를 인라인해야 함

### 2-2. manifest.json

```json
{
  "name": "Notion Dummy Data",
  "id": "notion-dummy-data-plugin",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["https://*.supabase.co"]
  }
}
```

> `allowedDomains`에 Supabase만 등록. Notion API는 프록시 경유.

### 2-3. webpack.config.js

Plugin 코드와 UI 코드를 **별도 엔트리**로 번들:
- `code` → `src/plugin/controller.ts` → `dist/code.js`
- `ui` → `src/ui/index.tsx` → `dist/ui.html` (JS 인라인)

### 2-4. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  },
  "include": ["src/**/*"]
}
```

### 2-5. 기본 파일 생성

**`src/plugin/controller.ts`**
```typescript
figma.showUI(__html__, { width: 360, height: 540 })
figma.ui.onmessage = (msg) => {
  console.log('메시지 수신:', msg)
}
```

**`src/ui/index.tsx`**
```typescript
import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return <div>플러그인 UI 로딩 완료</div>
}

createRoot(document.getElementById('root')!).render(<App />)
```

**`src/ui/index.html`**
```html
<!DOCTYPE html>
<html>
<body>
  <div id="root"></div>
</body>
</html>
```

### 2-6. 검증

```bash
npm run build
```

Figma Desktop → Plugins → Development → Import plugin from manifest → UI 표시 확인

**완료 기준:** Figma에서 플러그인 실행 시 "플러그인 UI 로딩 완료" 텍스트 표시

---

## Step 3: Plugin ↔ UI 통신 기반

### 3-1. 메시지 타입 정의

**파일:** `src/plugin/types.ts`

```typescript
// Plugin → UI
export type PluginMessage =
  | { type: 'SELECTION_CHANGED'; nodes: TextNodeInfo[] }
  | { type: 'STORAGE_RESULT'; key: string; data: any }
  | { type: 'APPLY_RESULT'; success: boolean; error?: string }
  | { type: 'BULK_PROGRESS'; current: number; total: number }

// UI → Plugin
export type UIMessage =
  | { type: 'GET_SELECTION' }
  | { type: 'APPLY_DATA'; nodeId: string; text: string }
  | { type: 'BULK_FILL'; mappings: Array<{ nodeId: string; text: string }> }
  | { type: 'SAVE_STORAGE'; key: string; value: any }
  | { type: 'LOAD_STORAGE'; key: string }

export interface TextNodeInfo {
  id: string
  name: string
  characters: string
}
```

### 3-2. Plugin Controller 확장

**파일:** `src/plugin/controller.ts`

- 메시지 라우팅 (switch/case)
- `selectionchange` 이벤트 감지 → UI에 텍스트 노드 목록 전송
- `figma.clientStorage` 읽기/쓰기 중개

### 3-3. Plugin Bridge (UI 측)

**파일:** `src/ui/services/pluginBridge.ts`

- `parent.postMessage` 래퍼
- Promise 기반 요청/응답 패턴 구현 (요청 ID로 매칭)

### 3-4. 검증

Figma에서 텍스트 레이어 선택 → UI 콘솔에 노드 정보 출력

**완료 기준:** 선택 변경 시 UI가 실시간으로 텍스트 노드 목록 수신

---

## Step 4: Supabase 클라이언트 & Notion 데이터 연동

### 4-1. Supabase 클라이언트

**파일:** `src/ui/services/supabaseClient.ts`

```typescript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'

export async function callNotionProxy(
  action: string,
  params: Record<string, any>
) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notion-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...params }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || `API 오류: ${res.status}`)
  }
  return res.json()
}
```

### 4-2. Notion 타입 정의

**파일:** `src/ui/types/notion.ts`

- NotionDatabase, NotionPage, NotionProperty 인터페이스
- 속성 타입별 값 추출 유틸리티 (title, rich_text, number, select, date 등)

### 4-3. Notion 데이터 훅

**파일:** `src/ui/hooks/useNotionData.ts`

- `validateToken(token)` → 토큰 유효성 검증
- `searchDatabases(token)` → DB 목록 조회
- `queryDatabase(token, dbId)` → 페이지 데이터 조회
- `extractPropertyValue(property)` → 속성값 문자열 추출

### 4-4. 검증

Figma 플러그인 UI에서 Notion 토큰 입력 → DB 목록 표시 (CORS 에러 없음)

**완료 기준:** 플러그인 UI에서 Notion 데이터베이스 목록이 정상 표시

---

## Step 5: UI 컴포넌트 — 설정 & 데이터 매핑

### 5-1. App.tsx (탭 네비게이션)

3개 탭: **설정** | **데이터** | **프리셋**

### 5-2. NotionSetup.tsx (설정 탭)

| 요소 | 설명 |
|------|------|
| 토큰 입력 필드 | Notion Integration Token 입력 |
| 연결 테스트 버튼 | Supabase 경유 토큰 검증 |
| DB 선택 드롭다운 | 접근 가능한 데이터베이스 목록 |
| 속성 미리보기 | 선택된 DB의 컬럼(속성) 표시 |

### 5-3. DataMapper.tsx (데이터 탭 — 핵심 UI)

| 요소 | 설명 |
|------|------|
| 선택된 레이어 목록 | Figma에서 선택한 텍스트 노드 표시 |
| 필드 매핑 드롭다운 | 각 레이어에 매핑할 Notion 컬럼 선택 |
| 모드 토글 | 랜덤 / 순차 선택 |
| 미리보기 | 적용 전 데이터 확인 |
| 적용 버튼 | 선택된 레이어에 데이터 적용 |

### 5-4. BulkFillPanel.tsx (일괄 채우기)

- 여러 레이어 동시 선택
- 진행률 바 (0% → 100%)
- 취소 버튼

### 5-5. 검증

토큰 입력 → DB 선택 → 텍스트 레이어 선택 → 매핑 → 적용 → Figma 텍스트 변경

**완료 기준:** 단일 텍스트 레이어에 Notion 데이터가 정상 적용됨

---

## Step 6: Figma API 통합 (텍스트 노드 수정)

### 6-1. figmaService.ts

**파일:** `src/plugin/figmaService.ts`

```typescript
// 텍스트 노드 수정 (폰트 로딩 필수)
export async function updateTextNode(nodeId: string, text: string) {
  const node = figma.getNodeById(nodeId)
  if (!node || node.type !== 'TEXT') return

  const fontName = node.fontName as FontName
  await figma.loadFontAsync(fontName)
  node.characters = text
}

// 일괄 수정 (진행률 전송)
export async function bulkUpdateNodes(
  mappings: Array<{ nodeId: string; text: string }>
) {
  for (let i = 0; i < mappings.length; i++) {
    await updateTextNode(mappings[i].nodeId, mappings[i].text)
    figma.ui.postMessage({
      type: 'BULK_PROGRESS',
      current: i + 1,
      total: mappings.length,
    })
  }
}
```

> **주의:** `node.characters` 수정 전 반드시 `figma.loadFontAsync()` 호출.
> Mixed font (한 노드에 여러 폰트)인 경우 `node.fontName === figma.mixed` 처리 필요.

### 6-2. 검증

여러 텍스트 레이어 선택 → 일괄 채우기 → 모든 레이어 텍스트 변경 + 진행률 표시

**완료 기준:** 10개 이상 텍스트 노드 일괄 적용 성공

---

## Step 7: 로컬 저장소 & 프리셋

### 7-1. storageService.ts

**파일:** `src/ui/services/storageService.ts`

`figma.clientStorage`는 Plugin 스레드에서만 접근 가능 → postMessage로 래핑:

```typescript
export async function save(key: string, value: any): Promise<void> {
  // UI → Plugin: SAVE_STORAGE 메시지
}

export async function load<T>(key: string): Promise<T | null> {
  // UI → Plugin: LOAD_STORAGE 메시지 → 응답 대기
}
```

저장 항목:
- `notion_token`: Notion Integration Token
- `selected_db`: 마지막 선택 DB ID
- `presets`: 프리셋 배열

### 7-2. 프리셋 구조

```typescript
interface Preset {
  id: string
  name: string
  databaseId: string
  databaseName: string
  mappings: Array<{ layerPattern: string; notionField: string }>
  mode: 'random' | 'sequential'
  createdAt: number
}
```

### 7-3. PresetManager.tsx

- 현재 매핑 설정 → 이름 입력 → 저장
- 프리셋 목록 표시
- 불러오기 / 삭제 버튼

### 7-4. 검증

프리셋 저장 → 플러그인 닫기 → 다시 열기 → 프리셋 불러오기 → 동일 설정 복원

**완료 기준:** 플러그인 재시작 후 토큰/DB/프리셋 모두 유지

---

## Step 8: 성능 최적화 & 에러 처리

### 8-1. 성능

- 대량 노드 처리: 20개씩 청크 단위 + 진행률 업데이트
- Notion API rate limit (초당 3회): 429 에러 시 지수 백오프 재시도
- React.memo로 불필요한 리렌더링 방지

### 8-2. 에러 처리

| 상황 | 처리 |
|------|------|
| 잘못된 Notion 토큰 | "토큰이 유효하지 않습니다" 메시지 |
| 네트워크 에러 | "네트워크 연결을 확인해주세요" 메시지 |
| Rate limit (429) | 자동 재시도 (1초 → 2초 → 4초) |
| 빈 DB | "데이터베이스가 비어있습니다" 안내 |
| 선택 없음 | "텍스트 레이어를 선택해주세요" 안내 |
| 폰트 로딩 실패 | 해당 노드 건너뛰고 경고 표시 |

### 8-3. UX 개선

- 로딩 스피너 (API 호출 중)
- 토스트 메시지 (성공/실패)
- 빈 상태 안내 문구

### 8-4. 검증

- 50+ 텍스트 노드 일괄 처리 테스트
- Notion 토큰 만료/잘못된 토큰 입력 테스트
- 네트워크 끊김 시 에러 메시지 확인

**완료 기준:** 모든 에러 시나리오에서 사용자에게 명확한 피드백 표시

---

## 사전 준비 (테스트 시 필요)

### Notion Integration 생성

1. https://www.notion.so/profile/integrations 접속
2. "New Integration" → Internal 선택 → 생성
3. Token 복사
4. 접근할 DB 페이지에서 ... → "연결 추가" → 생성한 Integration 선택

### Supabase 정보 확인

- 이미 있는 Supabase 프로젝트의 **Project URL**과 **Anon Key** 확인
- Supabase CLI 설치: `npm install -g supabase`

---

## 핵심 제약사항 요약

| 제약 | 설명 |
|------|------|
| CORS | Figma → Notion 직접 호출 불가. Supabase 프록시 필수 |
| 이중 스레드 | Plugin(Figma API) / UI(네트워크) 분리. postMessage 통신 |
| 단일 HTML | Figma UI는 하나의 HTML 파일이어야 함. JS 인라인 번들 필요 |
| 폰트 로딩 | 텍스트 수정 전 `figma.loadFontAsync()` 필수 |
| clientStorage | Plugin 스레드에서만 접근 가능. UI는 메시지로 중개 |
| Rate Limit | Notion API 초당 3회 제한. 재시도 로직 필요 |
| allowedDomains | manifest.json에 허용 도메인 등록 필수 |

---

## 참고 자료

- [channel.io — Notion DB를 활용한 Figma 플러그인 만들기](https://channel.io/ko/team/blog/articles/03d17d96)
- [여기쏙 — Figma Plugin 제작기 3: 성능](https://techblog.gccompany.co.kr/여기쏙-figma-plugin-제작기-3-성능-5ecec226b80b)
- [Notion Authorization 문서](https://developers.notion.com)
- [Supabase Edge Functions CORS 가이드](https://supabase.com/docs/guides/functions/cors)
