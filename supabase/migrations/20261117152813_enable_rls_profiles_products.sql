-- 보안 규칙: 누구나 볼 수 있고, 쓰기는 로그인한 본인 것만
alter table public.profiles enable row level security;
alter table public.products enable row level security;

-- 기본 권한 정리: 비로그인(anon)은 읽기만
revoke all on public.profiles, public.products from anon, authenticated;
grant select on public.profiles, public.products to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.products to authenticated;

-- profiles
create policy "profiles: 누구나 조회"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles: 본인 프로필 생성"
  on public.profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "profiles: 본인 프로필 수정"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- products
create policy "products: 누구나 조회"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "products: 본인 이름으로만 등록"
  on public.products for insert
  to authenticated
  with check (
    seller_id in (select p.id from public.profiles p where p.user_id = (select auth.uid()))
  );

create policy "products: 본인 상품만 수정"
  on public.products for update
  to authenticated
  using (
    seller_id in (select p.id from public.profiles p where p.user_id = (select auth.uid()))
  )
  with check (
    seller_id in (select p.id from public.profiles p where p.user_id = (select auth.uid()))
  );

create policy "products: 본인 상품만 삭제"
  on public.products for delete
  to authenticated
  using (
    seller_id in (select p.id from public.profiles p where p.user_id = (select auth.uid()))
  );
