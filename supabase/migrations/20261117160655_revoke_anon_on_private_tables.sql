-- 관심/채팅은 로그인한 회원만: 비로그인(anon) 기본 권한 제거
revoke all on public.favorites, public.chat_rooms, public.chat_messages from anon;
-- 로그인 회원도 필요한 권한만 (기본으로 붙은 update/delete/truncate 등 제거)
revoke all on public.favorites, public.chat_rooms, public.chat_messages from authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert on public.chat_rooms, public.chat_messages to authenticated;
