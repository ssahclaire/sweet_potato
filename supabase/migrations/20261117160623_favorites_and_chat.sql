-- 고구마: 관심 추가 + 채팅
-- 누가 무엇을 관심 추가했는지는 본인만 볼 수 있고, 관심 수만 공개한다.
-- 채팅방과 메시지는 그 방의 구매자와 판매자만 볼 수 있다.

-- ---------- 공용 도우미 (API로 노출되지 않는 private 스키마) ----------
create schema if not exists private;
grant usage on schema private to authenticated;

-- 로그인한 사람의 프로필 id
create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = auth.uid()
$$;
revoke all on function private.current_profile_id() from public;
grant execute on function private.current_profile_id() to authenticated;

-- ---------- 관심 추가 ----------
create table public.favorites (
  profile_id  uuid   not null references public.profiles (id) on delete cascade,
  product_id  bigint not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, product_id)
);
comment on table public.favorites is '관심 추가. 본인 것만 조회 가능';
create index favorites_product_id_idx on public.favorites (product_id);

-- 상품별 관심 수 (공개용 숫자)
alter table public.products
  add column favorite_count integer not null default 0 check (favorite_count >= 0);
comment on column public.products.favorite_count is '관심 수. favorites 트리거가 관리';

create or replace function private.sync_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set favorite_count = favorite_count + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set favorite_count = greatest(favorite_count - 1, 0) where id = old.product_id;
  end if;
  return null;
end;
$$;
revoke all on function private.sync_favorite_count() from public;

create trigger favorites_sync_count
  after insert or delete on public.favorites
  for each row execute function private.sync_favorite_count();

-- 판매자도 관심 수(favorite_count)는 직접 못 바꾸도록 수정 가능한 칸을 제한
revoke update on public.products from authenticated;
grant update (title, category, price, description, location, status, image_path)
  on public.products to authenticated;

alter table public.favorites enable row level security;
grant select, insert, delete on public.favorites to authenticated;

create policy "favorites: 본인 것만 조회"
  on public.favorites for select to authenticated
  using (profile_id = (select private.current_profile_id()));
create policy "favorites: 본인 이름으로 추가"
  on public.favorites for insert to authenticated
  with check (profile_id = (select private.current_profile_id()));
create policy "favorites: 본인 것만 취소"
  on public.favorites for delete to authenticated
  using (profile_id = (select private.current_profile_id()));

-- ---------- 채팅방 ----------
create table public.chat_rooms (
  id               bigint generated always as identity primary key,
  product_id       bigint not null references public.products (id) on delete cascade,
  buyer_id         uuid   not null references public.profiles (id) on delete cascade,
  seller_id        uuid   not null references public.profiles (id) on delete cascade,
  last_message     text,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (product_id, buyer_id),
  check (buyer_id <> seller_id)
);
comment on table public.chat_rooms is '상품 하나당 구매자 한 명과 판매자의 채팅방';
create index chat_rooms_buyer_idx  on public.chat_rooms (buyer_id, last_message_at desc);
create index chat_rooms_seller_idx on public.chat_rooms (seller_id, last_message_at desc);

-- ---------- 채팅 메시지 ----------
create table public.chat_messages (
  id          bigint generated always as identity primary key,
  room_id     bigint not null references public.chat_rooms (id) on delete cascade,
  sender_id   uuid   not null references public.profiles (id) on delete cascade,
  body        text   not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
comment on table public.chat_messages is '채팅 메시지. 방의 구매자/판매자만 조회 가능';
create index chat_messages_room_idx   on public.chat_messages (room_id, created_at);
create index chat_messages_sender_idx on public.chat_messages (sender_id);

-- 방 참여자인지 확인
create or replace function private.is_room_member(rid bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_rooms r
    where r.id = rid
      and (select private.current_profile_id()) in (r.buyer_id, r.seller_id)
  )
$$;
revoke all on function private.is_room_member(bigint) from public;
grant execute on function private.is_room_member(bigint) to authenticated;

-- 새 메시지가 오면 채팅방의 마지막 메시지/시간 갱신
create or replace function private.touch_chat_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_rooms
     set last_message = left(new.body, 100),
         last_message_at = new.created_at
   where id = new.room_id;
  return null;
end;
$$;
revoke all on function private.touch_chat_room() from public;

create trigger chat_messages_touch_room
  after insert on public.chat_messages
  for each row execute function private.touch_chat_room();

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
grant select, insert on public.chat_rooms, public.chat_messages to authenticated;

create policy "chat_rooms: 참여자만 조회"
  on public.chat_rooms for select to authenticated
  using ((select private.current_profile_id()) in (buyer_id, seller_id));

-- 구매자 본인이 만들고, 판매자는 실제 그 상품의 판매자여야 함
create policy "chat_rooms: 구매자가 생성"
  on public.chat_rooms for insert to authenticated
  with check (
    buyer_id = (select private.current_profile_id())
    and seller_id = (select p.seller_id from public.products p where p.id = product_id)
  );

create policy "chat_messages: 참여자만 조회"
  on public.chat_messages for select to authenticated
  using ((select private.is_room_member(room_id)));

create policy "chat_messages: 참여자가 본인 이름으로 전송"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select private.current_profile_id())
    and (select private.is_room_member(room_id))
  );

-- 실시간 채팅: 새 메시지를 바로 받기 (RLS가 그대로 적용됨)
alter publication supabase_realtime add table public.chat_messages;
