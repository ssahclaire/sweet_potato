/* =========================================================
   고구마 공통 데이터 & 유틸
   - 상품 목록은 Supabase(products + profiles)에서 읽어 옵니다. (js/config.js)
   - 글쓰기는 로그인한 회원만, 본인 프로필 이름으로 DB에 저장됩니다. (js/auth.js, js/write.js)
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

  // ---------- Supabase에서 상품 불러오기 ----------
  const CFG = window.GOGUMA_CONFIG || {};

  // 사진이 없는 상품은 카테고리별 기본 이미지
  const CATEGORY_ART = {
    '디지털기기':    ['📱', '#efe4fa', '#c3a0e6'],
    '가구/인테리어': ['🪑', '#f6eefb', '#d9c2ec'],
    '의류':          ['🧥', '#f1edf5', '#c8bcd6'],
    '생활가전':      ['🔌', '#f8e6f2', '#dcaed0'],
    '도서/티켓':     ['🎟️', '#ebe6fb', '#b9a9ec'],
    '기타':          ['📦', '#f3eafa', '#cfb3e8'],
  };
  const AVATAR_ART = [
    ['🍠', '#efe4fa', '#dcc6f2'], ['🍇', '#f8e6f2', '#e2b8d6'], ['🌙', '#ebe6fb', '#c9bdf0'],
    ['🌷', '#f6eefb', '#dcc6f2'], ['🫐', '#ebe6fb', '#c3a0e6'],
  ];

  function productImage(row) {
    if (row.image_path) {
      return `${CFG.SUPABASE_URL}/storage/v1/object/public/${CFG.PRODUCT_IMAGE_BUCKET}/` +
        row.image_path.split('/').map(encodeURIComponent).join('/');
    }
    const art = CATEGORY_ART[row.category] || ['🍠', '#efe4fa', '#dcc6f2'];
    return placeholderImage(...art);
  }

  function avatarImage(profile) {
    if (profile && profile.avatar_url) return profile.avatar_url;
    // 닉네임으로 늘 같은 기본 아바타가 나오게
    const name = (profile && profile.nickname) || '';
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return placeholderImage(...AVATAR_ART[h % AVATAR_ART.length]);
  }

  // DB 행 → 화면에서 쓰는 상품 모양
  function fromRow(row) {
    const s = row.seller || {};
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      price: Number(row.price),
      description: row.description,
      location: row.location,
      status: row.status,
      favoriteCount: Number(row.favorite_count) || 0,
      imagePath: row.image_path || null,
      createdAt: new Date(row.created_at).getTime(),
      image: productImage(row),
      seller: { id: s.id || null, nickname: s.nickname || '알 수 없음', region: s.region || '', avatar: avatarImage(s) },
    };
  }

  const products = [];
  // 'loading' | 'ready' | 'error'
  let loadState = 'loading';

  async function loadProducts() {
    loadState = 'loading';
    listeners.forEach((fn) => fn(products));
    try {
      const url = `${CFG.SUPABASE_URL}/rest/v1/products?select=${encodeURIComponent(PRODUCT_SELECT)}&order=created_at.desc`;
      const res = await fetch(url, { headers: { apikey: CFG.SUPABASE_PUBLISHABLE_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      products.splice(0, products.length, ...rows.map(fromRow));
      loadState = 'ready';
    } catch (err) {
      console.error('[고구마] 상품을 불러오지 못했어요:', err);
      loadState = 'error';
    }
    listeners.forEach((fn) => fn(products));
  }

  // ---------- 유틸 ----------
  function formatPrice(won) {
    if (won === 0) return '나눔 💜';
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

  // 방금 DB에 저장한 상품(행)을 목록 맨 앞에 추가
  function addProductRow(row) {
    const product = fromRow(row);
    products.unshift(product);
    listeners.forEach((fn) => fn(products));
    return product;
  }

  // 수정/상태 변경 후 DB에서 돌려받은 행으로 목록의 상품을 교체
  function replaceProductRow(row) {
    const product = fromRow(row);
    const i = products.findIndex((p) => p.id === product.id);
    if (i >= 0) products[i] = product; else products.unshift(product);
    listeners.forEach((fn) => fn(products));
    return product;
  }

  function removeProduct(id) {
    const i = products.findIndex((p) => p.id === id);
    if (i >= 0) products.splice(i, 1);
    listeners.forEach((fn) => fn(products));
  }

  // 상품 조회 시 판매자까지 함께 가져오는 select 구문 (글쓰기 저장 후에도 사용)
  const PRODUCT_SELECT = 'id,title,category,price,description,location,status,image_path,created_at,favorite_count,' +
    'seller:profiles!products_seller_id_fkey(id,nickname,avatar_url,region)';

  function getProduct(id) { return products.find((p) => p.id === id); }

  window.Goguma = {
    CATEGORIES, STATUSES, products,
    formatPrice, timeAgo, statusLabel, escapeHtml, placeholderImage,
    addProductRow, replaceProductRow, removeProduct, getProduct, onChange, PRODUCT_SELECT,
    loadProducts, getLoadState: () => loadState, productImage,
    // 각 화면 모듈이 여기에 자신을 등록합니다.
    list: null,   // { render() }
    detail: null, // { open(id), close() }
    write: null,  // { open(), close() }
  };
})();
