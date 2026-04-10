# UX Flow 개선 계획

> 작성일: 2026-04-06

## 문제 진단

현재 플러그인은 기능 단위(Notion/AI/설정)로 탭을 나눴지만, 사용자는 작업 단위로 이동한다.

| 문제 | 현상 |
|------|------|
| 온보딩 순서 역전 | 설정이 필요한데 AI 생성 탭으로 열림 |
| API 키 분산 | Gemini 키 → AI 생성 탭 / Notion 토큰 → 설정 탭 → 탭 왕복 발생 |
| DB 변경 불편 | 데이터 탭에서 DB 바꾸려면 설정 탭 이동 후 복귀 필요 |
| Notion URL 입력 불가 | 32자리 ID를 직접 추출해야 함, URL 붙여넣기 안 됨 |
| 사용량 컨텍스트 부족 | 리셋 시간 표시 없음, 초과 시 동작 안내 없음 |

---

## 개선 1. 탭 4개 → 3개 통합

**현재**: `AI 생성` | `검증` | `데이터` | `설정`

**변경**: `텍스트 채우기` | `검증` | `설정`

"AI 생성"과 "데이터" 탭을 **"텍스트 채우기"** 탭으로 통합.
탭 내부에 **서브 토글** (`[AI 생성] [Notion 데이터]`)로 모드 전환.

```
[텍스트 채우기]  [검증]  [설정]
       ↓
  ┌─────────────────────────┐
  │ [AI 생성] [Notion 데이터] │  ← 서브 토글
  └─────────────────────────┘
```

### App.tsx 변경
```ts
// 탭 타입 변경
type Tab = 'fill' | 'review' | 'setup'

// 기본값: notionToken 없으면 'setup', 있으면 'fill'
// initStorage에서 동적 결정
if (!savedToken) setActiveTab('setup')
else setActiveTab('fill')
```

---

## 개선 2. Gemini API 키 전역화

**현재**: `AIGenerator.tsx` 로컬 상태 → UXReview도 별도 로드 필요

**변경**: `App.tsx`에서 `geminiToken` 전역 상태로 관리, props로 전달

- **NotionSetup.tsx**: Notion 토큰과 동일한 패턴으로 Gemini 키 섹션 추가
- **AIGenerator.tsx**: 내부 `token`, `isTokenSaved` 상태 제거 → `geminiToken: string` prop 수신
- **UXReview.tsx**: `loadGeminiToken()` 내부 로드 제거 → `geminiToken: string` prop 수신

**설정 탭 구조 변경:**
```
설정 탭
├── Notion Integration Token   [기존]
├── Gemini API Key             [AIGenerator에서 이동]  ← 추가
├── AI 모델 선택               [기존]
├── 실시간 사용 현황           [기존]
├── ──────────────────────────
├── 데이터베이스 선택          [기존]
└── UX 가이드라인 문서         [기존]
```

---

## 개선 3. DataMapper 인라인 DB 변경

**현재**: [변경] 버튼 → `setActiveTab('setup')` → 설정 탭에서 DB 선택 → 돌아오기

**변경**: [변경] 클릭 시 인라인 `<select>` 드롭다운으로 교체

### DataMapper.tsx props 변경
```ts
interface DataMapperProps {
  databases: NotionDatabase[]      // 추가
  onSelectDb: (dbId: string) => void  // 추가
  // onChangeDb 제거
}
```

---

## 개선 4. Notion URL 직접 붙여넣기 지원

**현재**: 32자리 hex ID만 허용

**변경**: URL에서 ID 자동 추출

```ts
// NotionSetup.tsx에 추가
const extractPageIdFromInput = (input: string): string | null => {
  // Notion URL: https://www.notion.so/...-<id> 패턴
  const urlMatch = input.trim().match(/([a-f0-9]{32})(?:[?#]|$)/i)
  if (urlMatch) return urlMatch[1]
  // 하이픈 포함 UUID
  const cleanId = input.trim().replace(/-/g, '')
  if (/^[a-f0-9]{32}$/i.test(cleanId)) return cleanId
  return null
}
```

---

## 개선 5. 첫 실행 온보딩 배너

토큰 없을 때 설정 탭 상단에 3단계 체크리스트 표시:

```
┌─────────────────────────────────┐
│ 처음 시작하는 3단계              │
│ [✓] 1. Notion 토큰 입력         │
│ [ ] 2. 데이터베이스 선택         │
│ [ ] 3. (선택) Gemini 키로 AI 사용│
└─────────────────────────────────┘
```

`notionToken` 설정 완료 시 배너 자동 사라짐.

---

## 개선 6. 사용량 날짜 자동 리셋

**현재**: `Record<string, number>` → 날짜 무관 누적

**변경**: `{ date: string; counts: Record<string, number> }` 구조로 변경

- 날짜 바뀌면 자동 리셋
- 표시 시 "매일 자정 초기화" 텍스트 추가

```ts
// storageService.ts 변경
type UsageStats = {
  date: string  // YYYY-MM-DD
  counts: Record<string, number>
}

// 로드 시 날짜 비교 → 다르면 counts 초기화
```

---

## 수정 파일 목록

| 파일 | 변경 규모 | 내용 |
|------|---------|------|
| `src/ui/App.tsx` | 중간 | 탭 3개 재구성, geminiToken 전역화, isFirstRun, 기본 탭 동적 결정 |
| `src/ui/components/NotionSetup.tsx` | 중간 | Gemini 키 섹션 추가, URL 파싱, 온보딩 배너, 사용량 날짜 표시 |
| `src/ui/components/AIGenerator.tsx` | 소규모 | geminiToken prop 수신, 내부 토큰 상태/UI 제거 |
| `src/ui/components/DataMapper.tsx` | 소규모 | databases/onSelectDb props 추가, 인라인 DB 변경 UI |
| `src/ui/components/UXReview.tsx` | 미세 | geminiToken prop 수신으로 변경 |
| `src/ui/services/storageService.ts` | 소규모 | 사용량 구조에 date 필드 추가, 자동 리셋 로직 |
| `src/ui/styles.css` | 최소 | 온보딩 배너 스타일 (~10줄), 서브 토글 스타일 |

새 파일 생성 없음. 모든 변경은 기존 파일 내에서 기존 패턴 재사용.

---

## 구현 순서 (우선순위)

| 순서 | 작업 | 파일 | 효과 |
|------|------|------|------|
| 1 | Notion URL 파싱 | NotionSetup.tsx | 즉각적, 독립적 |
| 2 | geminiToken 전역화 | App + AIGenerator + UXReview | 탭 왕복 70% 해소 |
| 3 | DataMapper 인라인 DB 변경 | DataMapper + App | 설정 탭 왕복 제거 |
| 4 | 탭 3개 통합 | App.tsx + 서브 토글 | 전체 구조 개선 |
| 5 | 온보딩 배너 + 사용량 리셋 | NotionSetup + storageService | 첫 사용자 경험 개선 |

1~2단계만 완료해도 사용자가 느끼는 마찰의 대부분이 해소됩니다.

---

## 검증 방법

1. `npm run build` 빌드 성공 확인
2. Figma Desktop에서 플러그인 로드
3. **첫 실행 시나리오**: localStorage 초기화 → 설정 탭 자동 열림 + 온보딩 배너 확인
4. **탭 왕복 제거 확인**: 설정 탭 방문 없이 AI 생성 + Notion 데이터 모드 전환 가능한지
5. **Notion URL 붙여넣기**: 실제 Notion 페이지 URL → ID 자동 추출 확인
6. **DB 인라인 변경**: 텍스트 채우기 탭에서 DB 변경 가능한지
