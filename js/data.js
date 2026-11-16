/* =========================================================
   고구마 공통 데이터 & 유틸 (저장 기능 없음 – 메모리에서만 동작)
   모든 화면은 window.Goguma 를 통해서만 데이터에 접근합니다.
   ========================================================= */
(function () {
  const CATEGORIES = ['디지털기기', '가구/인테리어', '의류', '생활가전', '도서/티켓', '기타'];

  // key는 CSS 배지 클래스(.badge-<key>)와 1:1로 맞춥니다.
  const STATUSES = [
    { key: 'selling',  label: '판매중' },
    { key: 'reserved', label: '예약중' },
    { key: 'sold',     label: '거래 완료' },
  ];

  // 외부 이미지 없이도 열리도록 SVG로 대표 이미지를 만듭니다.
  function placeholderImage(emoji, from, to) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
      `<rect width="400" height="400" fill="url(#g)"/>` +
      `<text x="200" y="230" font-size="150" text-anchor="middle">${emoji}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const now = Date.now();

  const sellers = {
    s1: { nickname: '보라고구마', region: '마포구 망원동', avatar: placeholderImage('🍠', '#efe4fa', '#dcc6f2') },
    s2: { nickname: '군고구마왕', region: '성동구 성수동', avatar: placeholderImage('🔥', '#fff2df', '#f2c38f') },
    s3: { nickname: '책읽는밤',   region: '서대문구 연희동', avatar: placeholderImage('🌙', '#e6eefc', '#c3d3f2') },
  };

  const products = [
    {
      id: 1, title: '아이폰 14 프로 256GB 딥퍼플', category: '디지털기기', price: 890000,
      location: '마포구 망원동', createdAt: now - 12 * MIN, status: 'selling',
      image: placeholderImage('📱', '#efe4fa', '#b58ae0'), seller: sellers.s1,
      description: '1년 정도 케이스 끼고 사용했어요.\n배터리 효율 89%, 기스 거의 없습니다.\n박스, 충전 케이블 함께 드려요. 망원역 근처 직거래 원해요.',
    },
    {
      id: 2, title: '원목 4인용 식탁 + 의자 세트', category: '가구/인테리어', price: 150000,
      location: '성동구 성수동', createdAt: now - 3 * HOUR, status: 'reserved',
      image: placeholderImage('🪑', '#fff2df', '#e8b67a'), seller: sellers.s2,
      description: '이사 때문에 내놓습니다. 원목이라 튼튼하고 상판 오일 마감 상태 좋아요.\n직접 가져가셔야 해요 (1층, 엘리베이터 X).',
    },
    {
      id: 3, title: '오버핏 울 코트 (M, 차콜)', category: '의류', price: 45000,
      location: '서대문구 연희동', createdAt: now - 1 * DAY, status: 'selling',
      image: placeholderImage('🧥', '#eeecf1', '#b9b0c4'), seller: sellers.s3,
      description: '작년 겨울에 두세 번 입었어요. 드라이클리닝 완료했습니다.\n실측 사이즈 문의 주세요.',
    },
    {
      id: 4, title: '미니 에어프라이어 3.5L', category: '생활가전', price: 30000,
      location: '마포구 합정동', createdAt: now - 2 * DAY, status: 'sold',
      image: placeholderImage('🍟', '#ffeede', '#f2a65a'), seller: sellers.s1,
      description: '자취할 때 쓰던 에어프라이어예요. 고구마 굽기 최고입니다 🍠\n바스켓 코팅 멀쩡해요.',
    },
    {
      id: 5, title: '뮤지컬 티켓 2매 (토요일 저녁, R석)', category: '도서/티켓', price: 220000,
      location: '종로구 혜화동', createdAt: now - 40 * MIN, status: 'selling',
      image: placeholderImage('🎟️', '#e6eefc', '#a9bdf0'), seller: sellers.s3,
      description: '갑자기 일정이 생겨서 양도합니다. 정가 그대로 드려요.\n연석이고 모바일 티켓 전달 가능합니다.',
    },
    {
      id: 6, title: '캠핑용 접이식 의자 2개', category: '기타', price: 25000,
      location: '성동구 금호동', createdAt: now - 5 * DAY, status: 'reserved',
      image: placeholderImage('⛺', '#e6f6ec', '#9fd4b2'), seller: sellers.s2,
      description: '캠핑 두 번 다녀왔어요. 수납 가방 포함입니다.\n두 개 같이만 판매해요.',
    },
  ];

  // ---------- 유틸 ----------
  function formatPrice(won) {
    if (won === 0) return '나눔 🧡';
    return Number(won).toLocaleString('ko-KR') + '원';
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < MIN) return '방금 전';
    if (diff < HOUR) return Math.floor(diff / MIN) + '분 전';
    if (diff < DAY) return Math.floor(diff / HOUR) + '시간 전';
    if (diff < 7 * DAY) return Math.floor(diff / DAY) + '일 전';
    return new Date(ts).toLocaleDateString('ko-KR');
  }

  function statusLabel(key) {
    const s = STATUSES.find((x) => x.key === key);
    return s ? s.label : key;
  }

  // XSS 방지용 (사용자 입력을 innerHTML로 넣을 때 반드시 사용)
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ---------- 데이터 변경 알림 ----------
  const listeners = [];
  function onChange(fn) { listeners.push(fn); }

  // 내가 쓴 글: 메모리에만 추가 (새로고침하면 사라짐)
  const ME = { nickname: '나', region: '내 동네', avatar: placeholderImage('🙂', '#efe4fa', '#dcc6f2') };
  function addProduct(input) {
    const product = {
      id: Date.now(),
      createdAt: Date.now(),
      seller: { ...ME, region: input.location || ME.region },
      image: input.image || placeholderImage('🍠', '#efe4fa', '#dcc6f2'),
      ...input,
    };
    if (!product.image) product.image = placeholderImage('🍠', '#efe4fa', '#dcc6f2');
    products.unshift(product);
    listeners.forEach((fn) => fn(products));
    return product;
  }

  function getProduct(id) { return products.find((p) => p.id === id); }

  window.Goguma = {
    CATEGORIES, STATUSES, products,
    formatPrice, timeAgo, statusLabel, escapeHtml, placeholderImage,
    addProduct, getProduct, onChange,
    // 각 화면 모듈이 여기에 자신을 등록합니다.
    list: null,   // { render() }
    detail: null, // { open(id), close() }
    write: null,  // { open(), close() }
  };
})();
