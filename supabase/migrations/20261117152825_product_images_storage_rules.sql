-- 주의: 이 파일은 product-images 버킷을 만들지 않고 설정만 바꿉니다.
--       새 프로젝트라면 먼저 대시보드 Storage에서 product-images 버킷(공개)을 만들어 두세요.

-- product-images 버킷: 이미지 형식 오타(images/*) 수정, 5MB 제한 유지
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
       file_size_limit    = 5242880,
       public             = true
 where id = 'product-images';

-- 업로드/수정/삭제: 로그인한 회원이 자기 폴더(회원번호/...)에만
-- 공개 버킷이라 사진 보기는 공개 주소로 가능하므로 목록 조회 정책은 두지 않음
create policy "product-images: 본인 폴더에 업로드"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product-images: 본인 파일 수정"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product-images: 본인 파일 삭제"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
