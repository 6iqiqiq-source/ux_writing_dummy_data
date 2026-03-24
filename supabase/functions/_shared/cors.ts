// CORS 헤더 공통 모듈
// Figma 플러그인 UI(null origin iframe)에서의 요청을 허용하기 위해 '*' 사용
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
