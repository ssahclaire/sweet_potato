-- 예시 판매자 3명 (로그인 회원 아님: user_id = null)
insert into public.profiles (nickname, region) values
  ('보라고구마', '마포구 망원동'),
  ('군고구마왕', '성동구 성수동'),
  ('책읽는밤',   '서대문구 연희동');

-- 예시 상품 6개 (js/data.js 와 같은 내용, 이미지는 화면의 기본 이미지 사용)
insert into public.products
  (seller_id, title, category, price, description, location, status, created_at)
select p.id, v.title, v.category, v.price, v.description, v.location, v.status, now() - v.ago
from (values
  ('보라고구마', '아이폰 14 프로 256GB 딥퍼플', '디지털기기', 890000,
   E'1년 정도 케이스 끼고 사용했어요.\n배터리 효율 89%, 기스 거의 없습니다.\n박스, 충전 케이블 함께 드려요. 망원역 근처 직거래 원해요.',
   '마포구 망원동', 'selling', interval '12 minutes'),
  ('군고구마왕', '원목 4인용 식탁 + 의자 세트', '가구/인테리어', 150000,
   E'이사 때문에 내놓습니다. 원목이라 튼튼하고 상판 오일 마감 상태 좋아요.\n직접 가져가셔야 해요 (1층, 엘리베이터 X).',
   '성동구 성수동', 'reserved', interval '3 hours'),
  ('책읽는밤', '오버핏 울 코트 (M, 차콜)', '의류', 45000,
   E'작년 겨울에 두세 번 입었어요. 드라이클리닝 완료했습니다.\n실측 사이즈 문의 주세요.',
   '서대문구 연희동', 'selling', interval '1 day'),
  ('보라고구마', '미니 에어프라이어 3.5L', '생활가전', 30000,
   E'자취할 때 쓰던 에어프라이어예요. 고구마 굽기 최고입니다 🍠\n바스켓 코팅 멀쩡해요.',
   '마포구 합정동', 'sold', interval '2 days'),
  ('책읽는밤', '뮤지컬 티켓 2매 (토요일 저녁, R석)', '도서/티켓', 220000,
   E'갑자기 일정이 생겨서 양도합니다. 정가 그대로 드려요.\n연석이고 모바일 티켓 전달 가능합니다.',
   '종로구 혜화동', 'selling', interval '40 minutes'),
  ('군고구마왕', '캠핑용 접이식 의자 2개', '기타', 25000,
   E'캠핑 두 번 다녀왔어요. 수납 가방 포함입니다.\n두 개 같이만 판매해요.',
   '성동구 금호동', 'reserved', interval '5 days')
) as v(nickname, title, category, price, description, location, status, ago)
join public.profiles p on p.nickname = v.nickname and p.user_id is null;
