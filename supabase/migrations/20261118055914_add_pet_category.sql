-- 카테고리에 '반려동물' 추가 ('기타'는 계속 마지막)
alter table public.products drop constraint products_category_check;
alter table public.products add constraint products_category_check
  check (category in
    ('디지털기기', '가구/인테리어', '의류', '생활가전', '도서/티켓', '반려동물', '기타'));
