# 🍠 고구마 – 우리 동네 중고 거래

빌드 도구 없이 바로 열리는 정적 웹 화면(HTML / CSS / JS)에 **Supabase**(데이터베이스, 로그인, 사진 저장소)를 붙인 중고 거래 서비스입니다.

- 상품 목록 / 상세 / 글쓰기 (사진 업로드)
- 이메일 + 비밀번호 로그인, 프로필(닉네임, 동네)
- 관심 추가, 상품별 1:1 실시간 채팅
- 내 글 관리: 판매 상태 변경(판매중 / 예약중 / 거래 완료), 수정, 삭제

## 실행

```bash
node server.js
```

브라우저에서 http://localhost:5500 을 엽니다. Windows에서는 `start.bat`을 더블클릭해도 됩니다.

> 상품은 Supabase에서 불러오므로 인터넷 연결이 필요합니다.

---

## Supabase 설정

이미 연결된 프로젝트(`js/config.js`)를 그대로 쓴다면 이 과정은 필요 없습니다.
**새 Supabase 프로젝트에 처음부터 다시 만들 때** 아래 순서대로 진행하세요.

### 1. 프로젝트 만들기

1. [supabase.com](https://supabase.com/dashboard) → **New project**
2. 이름과 데이터베이스 비밀번호를 정하고, 리전은 가까운 곳(예: Northeast Asia)을 고릅니다.

### 2. 사진 저장소(버킷) 만들기

**Storage → New bucket**

| 항목 | 값 |
| --- | --- |
| Name | `product-images` (철자 주의) |
| Public bucket | 켜기 |

용량 제한(5MB)과 허용 형식(JPG, PNG, WebP, GIF)은 다음 단계의 SQL이 설정합니다.

### 3. 데이터베이스 만들기 (SQL)

**SQL Editor**에서 `supabase/migrations/` 폴더의 파일을 **이름 순서대로 하나씩** 붙여넣고 **Run** 합니다.

| 순서 | 파일 | 내용 |
| --- | --- | --- |
| 1 | `..._create_profiles_and_products.sql` | 판매자 프로필, 상품 테이블 |
| 2 | `..._enable_rls_profiles_products.sql` | 보안 규칙 (보기는 누구나, 쓰기는 본인만) |
| 3 | `..._product_images_storage_rules.sql` | 사진 저장소 규칙 (2단계 버킷이 먼저 있어야 함) |
| 4 | `..._seed_sample_sellers_and_products.sql` | 예시 판매자 3명, 상품 6개 (선택) |
| 5 | `..._favorites_and_chat.sql` | 관심 추가, 채팅 테이블과 규칙, 실시간 설정 |
| 6 | `..._revoke_anon_on_private_tables.sql` | 관심·채팅 권한 정리 |

> Supabase CLI를 쓴다면 `supabase link` 후 `supabase db push`로 한 번에 적용할 수도 있습니다.

### 4. 로그인 설정

**Authentication → Sign In / Providers → Email**

| 항목 | 개발할 때 | 실제 서비스 |
| --- | --- | --- |
| Email 로그인 | 켜기 | 켜기 |
| Confirm email (이메일 인증) | **끄기** | 켜기 + 메일 서버(SMTP) 연결 |

- 이메일 인증을 켠 채로 개발하면 가입할 때마다 인증 메일이 나가고, Supabase 기본 메일은 **시간당 몇 통만** 보낼 수 있어 금방 막힙니다.
- **Authentication → URL Configuration**의 Site URL을 `http://localhost:5500`(실제 서비스라면 그 주소)으로 맞춰 두면 인증 메일 링크가 올바른 곳으로 돌아옵니다.
- 실제 서비스 전에는 **유출된 비밀번호 차단(Leaked password protection)**도 켜는 것을 권장합니다.

### 5. 화면에 프로젝트 연결 (`js/config.js`)

**Project Settings → API Keys**에서 값을 복사해 `js/config.js`에 넣습니다.

```js
window.GOGUMA_CONFIG = {
  SUPABASE_URL: 'https://<프로젝트ref>.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_...',
  PRODUCT_IMAGE_BUCKET: 'product-images',
};
```

### 🔐 키 사용 규칙

| 키 | 어디에 | 비고 |
| --- | --- | --- |
| **publishable key** (`sb_publishable_...`) | `js/config.js` | 브라우저에 공개돼도 괜찮습니다. 실제 권한은 보안 규칙(RLS)이 막습니다. |
| **service_role key** | `.env`에만 | 모든 보안 규칙을 무시하는 관리자 키. **절대 `js/` 파일이나 GitHub에 올리지 마세요.** |
| **access token** (`sbp_...`) | `.env`에만 | Supabase 계정 전체를 다루는 개인 토큰. 노출되면 바로 Revoke 하세요. |

`.env`는 `.gitignore`에 들어 있어 GitHub에 올라가지 않습니다.

### 6. (선택) Claude Code에서 Supabase MCP 연결

Claude 데스크톱 앱이라면 **Settings → Connectors**에서 Supabase를 연결하는 것이 가장 간단합니다(토큰 입력 불필요).
CLI를 쓴다면:

```bash
claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=<프로젝트ref>"
```

---

## 데이터 구조

```
auth.users (로그인 정보 – Supabase가 관리)
   └─ profiles (닉네임, 동네)
        ├─ products (상품)            ← product-images 버킷의 사진 경로
        ├─ favorites (관심 추가)
        └─ chat_rooms (채팅방)
             └─ chat_messages (메시지)
```

| 테이블 | 누가 볼 수 있나 | 누가 쓸 수 있나 |
| --- | --- | --- |
| `profiles` | 누구나 | 본인 |
| `products` | 누구나 | 본인 글만 등록 / 수정 / 삭제 |
| `favorites` | 본인만 (관심 수는 `products.favorite_count`로 공개) | 본인 |
| `chat_rooms`, `chat_messages` | 그 방의 구매자와 판매자만 | 그 방의 참여자 |

- 이메일, 전화번호, 실명은 우리 테이블에 저장하지 않습니다. 이메일은 `auth.users`에만 있습니다.
- 회원을 삭제하면 그 회원의 프로필, 상품, 관심, 채팅이 함께 지워집니다. 올린 사진 파일은 Storage에서 따로 지워야 합니다.
- 예시 판매자(보라고구마 등)는 로그인 계정이 없는 예시 데이터라 채팅에 답장할 수 없습니다.

## 파일

| 내용 | 파일 |
| --- | --- |
| 상품 목록 (검색, 카테고리, 거래 가능만 보기) | `js/list.js`, `css/list.css` |
| 상세 팝업 (관심 추가, 채팅, 내 글 관리) | `js/detail.js`, `css/detail.css` |
| 글쓰기 / 글 수정 | `js/write.js`, `css/write.css` |
| 로그인 / 회원가입 / 프로필 만들기 | `js/auth.js`, `css/auth.css` |
| 채팅 목록 / 채팅방 | `js/chat.js`, `css/chat.css` |
| Supabase 접속 정보 | `js/config.js` |
| 상품 불러오기 & 공통 유틸 (`window.Goguma`) | `js/data.js` |
| 공통 디자인 (색, 버튼, 배지, 입력칸, 모달) | `css/base.css` |
| 데이터베이스 SQL | `supabase/migrations/` |

## 문제 해결

| 증상 | 원인과 해결 |
| --- | --- |
| 회원가입 시 "인증 메일을 보낼 수 있는 횟수를 넘었어요" | 이메일 인증이 켜져 있어 메일 한도에 걸림 → 4단계에서 Confirm email 끄기 |
| 가입 시 이메일 형식 오류 | `@example.com` 같은 예시 도메인은 받지 않음 → 실제 이메일 사용 |
| Table Editor에 테이블이 안 보임 | 왼쪽 위 schema가 `public`인지 확인, 새로고침 |
| "상품을 불러오지 못했어요" | 인터넷 연결, `js/config.js`의 URL과 publishable key 확인 |
| 사진 업로드 실패 | 5MB 이하 JPG / PNG / WebP / GIF인지, 버킷 이름이 `product-images`인지 확인 |
| 글쓰기가 저장되지 않음 | 로그인과 프로필 만들기를 마쳤는지 확인 (비로그인은 읽기만 가능) |
