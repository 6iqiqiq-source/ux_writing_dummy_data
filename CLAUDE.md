# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 규칙
- 응답, 코드 주석, 커밋 메시지, 문서: 한국어
- 변수명/함수명: 영어

## 프로젝트 개요
Notion 데이터베이스와 연동하여 Figma 디자인에 더미 데이터를 자동 채우는 Figma 플러그인.

## 아키텍처
Figma 플러그인은 두 스레드로 분리 실행됨:
- **Plugin 스레드** (`src/plugin/`): Figma API 접근 가능, 네트워크/DOM 불가. `figma.clientStorage`로 영구 저장.
- **UI 스레드** (`src/ui/`): React UI, 네트워크 가능, Figma API 불가. `postMessage`로 Plugin과 통신.

CORS 제약으로 Notion API 직접 호출 불가 → **Supabase Edge Function**을 프록시로 사용:
```
Figma Plugin UI → Supabase Edge Function → Notion API
```

## 빌드 및 개발
```bash
npm install          # 의존성 설치
npm run build        # 프로덕션 빌드 (dist/code.js + dist/ui.html)
npm run watch        # 개발 감시 모드
```

Figma에서 테스트: Figma Desktop > Plugins > Development > Import plugin from manifest

## Supabase Edge Function
```bash
supabase functions serve notion-proxy   # 로컬 테스트
supabase functions deploy notion-proxy  # 배포
```

## 주요 제약사항
- Figma는 UI를 **단일 HTML 파일**로 요구 → Webpack + `html-inline-script-webpack-plugin`으로 JS 인라인
- 텍스트 노드 수정 전 반드시 `figma.loadFontAsync(node.fontName)` 호출
- `manifest.json`의 `networkAccess.allowedDomains`에 허용 도메인 등록 필요
- Notion API Rate Limit: 초당 3회 → 429 에러 시 지수 백오프 재시도
- `figma.clientStorage`는 Plugin 스레드에서만 접근 가능 (UI에서는 postMessage 경유)
