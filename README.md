# 🍠 고구마 – 우리 동네 중고 거래

빌드 도구 없이 바로 열리는 정적 웹 화면(HTML / CSS / JS)입니다.
지금은 저장 기능 없이 가짜 상품 6개로만 동작하고, 직접 등록한 글은 새로고침하면 사라집니다.

## 실행

```bash
node server.js
```

브라우저에서 http://localhost:5500 을 엽니다. Windows에서는 `start.bat`을 더블클릭해도 됩니다.

## 화면

| 화면 | 파일 |
| --- | --- |
| 1. 상품 목록 (검색, 카테고리, 거래 가능만 보기) | `js/list.js`, `css/list.css` |
| 2. 상세 팝업 | `js/detail.js`, `css/detail.css` |
| 3. 글쓰기 | `js/write.js`, `css/write.css` |
| 공통 디자인 (색, 버튼, 배지, 입력칸, 모달) | `css/base.css` |
| 가짜 데이터 & 유틸 (`window.Goguma`) | `js/data.js` |
