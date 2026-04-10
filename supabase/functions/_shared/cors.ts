// CORS 헤더 공통 모듈
// Figma 플러그인 UI는 null origin의 sandboxed iframe에서 실행됨.
// 특정 출처를 지정하면 Figma에서 요청이 차단되므로 '*' 가 불가피함.
// 대신 x-plugin-secret 헤더로 무단 호출을 방어함.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-plugin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
