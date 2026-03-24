# Notion Dummy Data - Figma Plugin

Notion 데이터베이스의 데이터를 Figma 텍스트 레이어에 자동으로 채워넣는 플러그인입니다.

## 아키텍처

```
Figma Plugin UI (iframe)
    ↓ fetch (CORS 제약)
Supabase Edge Function (프록시)
    ↓ fetch
Notion API
```

- Figma 플러그인 UI는 `null` origin iframe에서 실행되므로 Notion API 직접 호출 시 CORS 차단
- Supabase Edge Function이 중간 프록시 역할 수행

## 기술 스택

- **Plugin 코드**: TypeScript + Figma Plugin API
- **UI**: React 18 + TypeScript
- **번들러**: Webpack 5 (단일 HTML 파일로 번들)
- **CORS 프록시**: Supabase Edge Function (Deno)
- **데이터 소스**: Notion API (Internal Integration)
- **영구 저장소**: figma.clientStorage

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
│   │   └── types.ts           #   Plugin ↔ UI 공유 타입
│   │
│   └── ui/                    # UI 스레드 (React, 네트워크 접근)
│       ├── App.tsx            #   탭 네비게이션
│       ├── index.tsx / .html
│       ├── styles.css
│       ├── components/
│       │   ├── NotionSetup.tsx      # 토큰 입력 + DB 선택
│       │   ├── DataMapper.tsx       # 레이어 ↔ Notion 필드 매핑
│       │   ├── BulkFillPanel.tsx    # 일괄 채우기
│       │   └── PresetManager.tsx    # 프리셋 CRUD
│       ├── services/
│       │   ├── supabaseClient.ts    # Edge Function 호출
│       │   ├── pluginBridge.ts      # postMessage 래퍼
│       │   └── storageService.ts    # clientStorage 래퍼
│       ├── hooks/
│       │   ├── useNotionData.ts
│       │   ├── useSelection.ts
│       │   └── usePresets.ts
│       └── types/
│           └── notion.ts
│
├── supabase/
│   └── functions/
│       ├── notion-proxy/index.ts    # Notion API 프록시
│       └── _shared/cors.ts          # CORS 헤더
│
└── dist/                      # 빌드 결과물
    ├── code.js
    └── ui.html
```

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. Supabase 프로젝트의 URL과 Anon Key를 확인
2. `src/ui/services/supabaseClient.ts`에 입력 (이미 완료됨)

### 3. Supabase Edge Function 배포

```bash
supabase functions deploy notion-proxy \
  --project-ref mottzvgkpvirwynzlzjq \
  --workdir /Users/big/Desktop/my-project/spi-figma-plugin/ux_writing_dummy_data
```

배포 완료 후 URL:
```
https://mottzvgkpvirwynzlzjq.supabase.co/functions/v1/notion-proxy
```

## 빌드

```bash
npm run build        # 프로덕션 빌드
npm run watch        # 개발 감시 모드
```

빌드 결과:
- `dist/code.js` — Plugin 스레드 코드
- `dist/ui.html` — UI 코드 (React + CSS 인라인)

## Figma에서 테스트

### 1. 플러그인 Import

1. **Figma Desktop 실행** (브라우저 버전 불가)
2. `Plugins` → `Development` → `Import plugin from manifest...`
3. 이 프로젝트의 `manifest.json` 선택
4. `Plugins` → `Development` → `Notion Dummy Data` 실행

### 2. Notion Integration 준비

1. https://www.notion.so/profile/integrations 접속
2. **"New Integration"** 클릭
   - Type: **Internal Integration**
   - Name: 예) "Figma Dummy Data"
3. **Integration Token 복사** (`ntn_xxxxx...`)
4. 사용할 **Notion 데이터베이스**에 Integration 연결
   - DB 페이지 우측 상단 `...` → `연결 추가` → Integration 선택

### 3. 테스트 Flow

#### 설정 탭
1. Notion Integration Token 입력
2. "연결 테스트" 버튼 클릭
3. 드롭다운에서 데이터베이스 선택
4. 속성(컬럼) 미리보기 확인

#### 데이터 탭
1. Figma에서 여러 개의 텍스트 레이어 생성 (`T` 키)
2. 플러그인에서 선택된 레이어 목록 확인
3. 각 레이어에 Notion 필드 매핑 (드롭다운)
4. 랜덤/순차 모드 선택
5. 미리보기에서 적용될 데이터 확인
6. **"데이터 적용"** 버튼 클릭
7. 진행률 바로 진행 상황 확인
8. Figma 텍스트 레이어에 Notion 데이터 반영됨 ✅

#### 프리셋 탭
- 현재 설정(토큰 + DB)을 프리셋으로 저장
- 저장된 프리셋 불러오기/삭제

## 주요 기능

### ✅ 구현 완료

- [x] Notion API CORS 프록시 (Supabase Edge Function)
- [x] Figma 텍스트 노드 선택 감지
- [x] Plugin ↔ UI 양방향 통신 (postMessage)
- [x] Notion 토큰 검증 및 DB 목록 조회
- [x] Notion 데이터베이스 페이지 데이터 조회
- [x] 텍스트 레이어 ↔ Notion 필드 매핑 UI
- [x] 랜덤/순차 데이터 적용 모드
- [x] 일괄 채우기 (진행률 표시)
- [x] Mixed font 처리 (한 노드에 여러 폰트)
- [x] 프리셋 저장/불러오기/삭제
- [x] 로컬 저장소 (figma.clientStorage)
- [x] 16개 Notion 속성 타입 지원 (title, rich_text, number, select, date 등)

### 에러 처리

- 잘못된 Notion 토큰 감지
- 네트워크 에러 메시지
- 빈 데이터베이스 안내
- 폰트 로딩 실패 시 건너뛰기

## 제약사항

| 제약 | 설명 |
|------|------|
| CORS | Figma → Notion 직접 호출 불가. Supabase 프록시 필수 |
| 이중 스레드 | Plugin(Figma API) / UI(네트워크) 분리. postMessage 통신 |
| 단일 HTML | Figma UI는 하나의 HTML 파일이어야 함. JS 인라인 번들 필요 |
| 폰트 로딩 | 텍스트 수정 전 `figma.loadFontAsync()` 필수 |
| clientStorage | Plugin 스레드에서만 접근 가능. UI는 메시지로 중개 |
| Rate Limit | Notion API 초당 3회 제한. 재시도 로직 필요 (미구현) |
| allowedDomains | manifest.json에 허용 도메인 등록 필수 |

## 향후 개선 사항

- [ ] Notion API Rate Limit (429) 자동 재시도 (지수 백오프)
- [ ] 대량 노드 처리 최적화 (청크 단위)
- [ ] 프리셋에 매핑 정보 저장 (현재는 토큰/DB만 저장)
- [ ] 에러 메시지 토스트 UI 개선
- [ ] 로딩 스피너 통일
- [ ] 다크 모드 지원

## 참고 자료

- [channel.io — Notion DB를 활용한 Figma 플러그인 만들기](https://channel.io/ko/team/blog/articles/03d17d96)
- [여기쏙 — Figma Plugin 제작기 3: 성능](https://techblog.gccompany.co.kr/여기쏙-figma-plugin-제작기-3-성능-5ecec226b80b)
- [Notion Authorization 문서](https://developers.notion.com)
- [Supabase Edge Functions CORS 가이드](https://supabase.com/docs/guides/functions/cors)
- [Figma Plugin API 문서](https://www.figma.com/plugin-docs/)

## 라이센스

MIT
