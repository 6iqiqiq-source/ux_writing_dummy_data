# Figma 플러그인 커뮤니티 공개 배포 가이드

> 목표: Figma Community에 플러그인을 공개해 누구나 설치·사용할 수 있도록 퍼블리시

---

## 현재 상태 요약

| 항목 | 상태 |
|------|------|
| 빌드 산출물 (`dist/`) | ✅ 존재 |
| Supabase Edge Function | ✅ 배포 완료 |
| 환경변수 (`.env`) | ✅ 설정됨 |
| API 키 하드코딩 | ✅ 없음 (환경변수로 관리) |
| 플러그인 아이콘 | ❌ 없음 (제작 필요) |
| 커뮤니티 스크린샷 | ❌ 없음 (준비 필요) |

---

## 배포 전 준비사항

### 1. 플러그인 이름 최종 결정

현재 이름: **"Notion Dummy Data"**

실제 기능(Notion 연동 + AI UX Writing 검증)을 더 잘 설명하는 이름으로 변경 검토:
- 예: "UX Writing Assistant for Figma"
- 예: "Notion Data & UX Review"

이름이 확정되면 `manifest.json`의 `name` 필드 수정.

### 2. 프로덕션 빌드 재실행

`.env` 파일에 아래 변수가 채워져 있는지 확인 후 빌드:

```bash
# .env 확인
SUPABASE_URL=https://mottzvgkpvirwynzlzjq.supabase.co
SUPABASE_ANON_KEY=eyJ...
PLUGIN_SECRET=...

# 프로덕션 빌드
npm run build
```

빌드 성공 시 `dist/` 폴더에 아래 파일 생성 확인:
- `dist/code.js` — 플러그인 로직 (압축됨)
- `dist/ui.html` — UI 전체 (JS/CSS 인라인, 약 238KB)

### 3. 플러그인 아이콘 제작

Figma Community 등록 필수 항목:

| 항목 | 스펙 |
|------|------|
| 크기 | **128 × 128 px** |
| 형식 | **PNG** |
| 배경 | 투명 또는 단색 권장 |

Figma에서 직접 제작 후 PNG로 내보내기.

### 4. 스크린샷 준비

Figma Community 페이지에 표시될 플러그인 소개 이미지:
- 최소 1장, 권장 3–5장
- 권장 해상도: 1920 × 1080 또는 1280 × 800

촬영 추천 화면:
1. **텍스트 채우기 탭** — Notion DB 데이터 적용 화면
2. **AI 생성 탭** — Gemini 프롬프트 입력 → 결과 화면
3. **검증 탭** — UX Writing 검증 결과 화면
4. **설정 탭** — 전체 설정 화면

### 5. 플러그인 설명문 작성

Figma Community 등록 시 입력할 설명 (영어 권장, 200자 이내):

```
Generate dummy text from Notion databases and review UX writing
with Gemini AI — directly inside Figma.

Requires: Notion Integration Token, Gemini API Key
```

---

## Figma Developer Console 등록 절차

### Step 1: Developer Console 접속

Figma Desktop 앱 > 메뉴 > **Plugins > Development > Manage plugins**

또는 웹: `figma.com/developers`

### Step 2: 새 플러그인 생성

1. **"Create new plugin"** 클릭
2. 플러그인 이름 입력
3. **"Import from manifest"** 선택
4. 프로젝트의 `manifest.json` 파일 선택

> Figma가 새로운 고유 `id`를 부여함 → `manifest.json`의 `id` 필드가 자동 업데이트됨

### Step 3: 플러그인 정보 입력

Developer Console에서 다음 항목 작성:

| 항목 | 내용 |
|------|------|
| Name | 플러그인 이름 |
| Description | 기능 설명 |
| Tags | `content`, `productivity`, `developer` 등 |
| Icon | 128×128 PNG 업로드 |
| Screenshots | 동작 화면 이미지 업로드 |

### Step 4: 코드 제출

배포할 파일 업로드:
- `dist/code.js`
- `dist/ui.html`
- `manifest.json`

### Step 5: Community 공개 심사 제출

**"Publish to Community"** 버튼 클릭 → Figma 팀 심사 시작

---

## Figma 심사 프로세스

| 단계 | 내용 | 소요 기간 |
|------|------|-----------|
| 제출 | Community 배포 신청 | 즉시 |
| 검토 중 | Figma 팀 심사 | 1–2주 |
| 피드백 | 수정 요청 또는 승인 | — |
| 공개 | Community에 노출 | 승인 후 즉시 |

### 심사 통과 핵심 조건

- `networkAccess.reasoning` 필드 작성됨 ✅ (이미 완료)
- API 키를 서버에 저장하지 않음 ✅ (사용자 로컬 저장)
- 허용된 도메인만 호출함 ✅ (Supabase + Gemini만)

---

## 배포 후 운영 주의사항

### Supabase 사용량 확인

현재 무료 티어 기준:
- Edge Function 호출: 월 **500,000회** 한도
- 공개 배포 후 사용자가 늘면 초과 가능 → Supabase 대시보드에서 모니터링

### 사용자 안내 필수 사항

플러그인 설명에 명확히 표기:
- **Notion Integration Token** 필요 (Notion → Settings → Connections에서 발급)
- **Gemini API Key** 필요 (Google AI Studio에서 무료 발급 가능)
- 두 키 모두 사용자의 기기에만 저장되며 외부로 전송되지 않음

### 업데이트 배포

코드 변경 시:
```bash
npm run build          # 재빌드
```
→ Figma Developer Console에서 새 버전 업로드 → 재심사 없이 즉시 반영

---

## 최종 배포 체크리스트

- [ ] 플러그인 이름 최종 확정
- [ ] `manifest.json` 이름 업데이트
- [ ] `npm run build` 실행 → `dist/` 파일 생성 확인
- [ ] 128×128 PNG 아이콘 제작
- [ ] 스크린샷 3–5장 준비
- [ ] 영문 설명문 작성
- [ ] Figma Developer Console에서 플러그인 생성
- [ ] 로컬 최종 테스트 (핵심 3가지 탭 모두 동작 확인)
- [ ] Community 심사 제출
- [ ] 심사 승인 → 공개 완료 🎉

---

## 로컬 최종 테스트 방법

Figma Desktop > Plugins > Development > **Import plugin from manifest**
→ 프로젝트의 `manifest.json` 선택

테스트 시나리오:
1. 설정 탭 → Notion 토큰 입력 → DB 검색 → DB 선택
2. 설정 탭 → Gemini API Key 입력 → 저장 확인
3. 텍스트 채우기 → Figma 프레임 선택 → Notion 데이터 적용
4. 텍스트 채우기 → AI 생성 → 프롬프트 입력 → 결과 적용
5. 검증 탭 → 가이드라인 설정 → 프레임 선택 → 검증 실행
