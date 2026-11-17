-- 고구마: 판매자 프로필 + 상품
-- 개인 식별 정보(이메일, 전화번호, 실명)는 담지 않는다. 로그인 정보는 auth.users 에만 있다.

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) 판매자 프로필
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  -- 로그인 회원과 연결. null 이면 로그인 없는 예시(샘플) 판매자
  user_id     uuid unique references auth.users (id) on delete cascade,
  nickname    text not null unique
              check (char_length(btrim(nickname)) between 2 and 12),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  region      text not null
              check (char_length(btrim(region)) between 2 and 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is '판매자 공개 프로필. 이메일/전화번호/실명은 저장하지 않음';
comment on column public.profiles.user_id is 'auth.users.id. null 이면 예시 판매자';
comment on column public.profiles.region is '판매 지역 (구 + 동 단위까지만)';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2) 상품
create table public.products (
  id           bigint generated always as identity primary key,
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  image_path   text check (image_path is null or char_length(image_path) <= 300),
  title        text not null check (char_length(btrim(title)) between 1 and 40),
  category     text not null check (category in
                 ('디지털기기', '가구/인테리어', '의류', '생활가전', '도서/티켓', '기타')),
  price        bigint not null check (price between 0 and 9999999999),
  description  text not null check (char_length(btrim(description)) between 1 and 500),
  location     text not null check (char_length(btrim(location)) between 2 and 30),
  status       text not null default 'selling'
                 check (status in ('selling', 'reserved', 'sold')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.products is '중고 거래 상품';
comment on column public.products.image_path is 'product-images 버킷 안의 파일 경로. null 이면 기본 이미지';
comment on column public.products.price is '원 단위. 0 이면 나눔';
comment on column public.products.location is '거래 동네 (구 + 동 단위까지만)';
comment on column public.products.status is 'selling=판매중, reserved=예약중, sold=거래 완료';

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- 목록 화면: 최신순, 카테고리, 거래 가능만 보기, 판매자별
create index products_created_at_idx on public.products (created_at desc);
create index products_category_idx   on public.products (category);
create index products_status_idx     on public.products (status);
create index products_seller_id_idx  on public.products (seller_id);
