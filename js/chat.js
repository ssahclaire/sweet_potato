/* =========================================================
   채팅 – 상품 하나당 구매자 1명 ↔ 판매자 채팅방
   - 목록: 내가 참여한 채팅방 (구매/판매 모두)
   - 방: 메시지 보기 / 보내기, 새 메시지는 실시간으로 받음
   - 방과 메시지는 데이터베이스 규칙(RLS)상 참여자 두 사람만 볼 수 있음
   - 모든 클래스는 .chat- 접두사
   ========================================================= */
(function () {
  const G = window.Goguma;
  const esc = G.escapeHtml;
  const MAX_BODY = 1000;

  const ROOM_SELECT =
    'id,buyer_id,seller_id,last_message,last_message_at,' +
    'product:products(id,title,price,status,category,image_path),' +
    'buyer:profiles!chat_rooms_buyer_id_fkey(id,nickname,avatar_url),' +
    'seller:profiles!chat_rooms_seller_id_fkey(id,nickname,avatar_url)';

  let root = null;
  let backdrop = null;
  let view = null;          // 'list' | 'room'
  let room = null;          // 지금 열린 방
  let channel = null;       // 실시간 구독
  let messageIds = new Set();
  let lastFocus = null;
  let sending = false;
  // 목록 필터: null 이면 전체, { productId, productTitle } 이면 그 상품에 받은 채팅만
  let listFilter = null;

  const sb = () => G.auth.client;
  const me = () => G.auth.getProfile();
  const $ = (sel) => backdrop && backdrop.querySelector(sel);

  function other(r) {
    const mine = me();
    return mine && r.buyer && r.buyer.id === mine.id ? r.seller : r.buyer;
  }

  function avatarOf(p) {
    return (p && p.avatar_url) || G.placeholderImage('🍠', '#efe4fa', '#dcc6f2');
  }

  function clock(ts) {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const hm = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }

  // ---------- 모달 틀 ----------
  function shell(title, withBack) {
    return `
      <div class="modal-backdrop chat-backdrop">
        <div class="modal chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
          <header class="chat-header">
            ${withBack ? '<button type="button" class="btn btn-icon btn-ghost chat-back" aria-label="채팅 목록으로">‹</button>' : ''}
            <h2 id="chat-title" class="chat-title">${esc(title)}</h2>
            <button type="button" class="btn btn-icon modal-close" aria-label="닫기">✕</button>
          </header>
          <div class="chat-content"></div>
        </div>
      </div>`;
  }

  function mount(html) {
    root = root || document.getElementById('chat-root');
    if (!root) return false;
    if (!backdrop) lastFocus = document.activeElement;
    root.innerHTML = html;
    backdrop = root.querySelector('.modal-backdrop');
    document.body.classList.add('no-scroll');

    $('.modal-close').addEventListener('click', () => close());
    const back = $('.chat-back');
    // 방에서 뒤로 가면 들어왔던 목록(전체 또는 이 상품의 받은 채팅)으로
    if (back) back.addEventListener('click', () => openList(listFilter));
    let downOnBackdrop = false;
    backdrop.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === backdrop; });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && downOnBackdrop) close();
      downOnBackdrop = false;
    });
    document.removeEventListener('keydown', onKeydown);
    document.addEventListener('keydown', onKeydown);
    return true;
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && backdrop) { e.preventDefault(); close(); }
  }

  function stateHtml(icon, title, desc, retry) {
    return `
      <div class="chat-state">
        <p class="chat-state-icon" aria-hidden="true">${icon}</p>
        <p class="chat-state-title">${esc(title)}</p>
        ${desc ? `<p class="chat-state-desc">${esc(desc)}</p>` : ''}
        ${retry ? '<button type="button" class="btn btn-outline chat-retry">다시 시도</button>' : ''}
      </div>`;
  }

  async function leaveRoom() {
    if (channel) {
      const ch = channel;
      channel = null;
      try { await sb().removeChannel(ch); } catch (_) { /* 무시 */ }
    }
    room = null;
    messageIds = new Set();
  }

  // ---------- 채팅 목록 ----------
  // filter 없음: 내 채팅 전체 (구매 + 판매)
  // filter = { productId, productTitle }: 내 상품에 다른 사람이 보낸 채팅만 (내가 판매자인 방)
  async function openList(filter) {
    filter = filter && filter.productId ? filter : null;
    if (!me()) { G.auth.requireProfile(() => openList(filter), '채팅은 로그인 후에 볼 수 있어요.'); return; }
    await leaveRoom();
    view = 'list';
    listFilter = filter;
    const title = filter ? `받은 채팅 · ${filter.productTitle || '내 상품'}` : '채팅';
    if (!mount(shell(title, false))) return;
    const content = $('.chat-content');
    content.innerHTML = stateHtml('💬', '채팅방을 불러오는 중이에요…');
    $('.modal-close').focus({ preventScroll: true });

    let query = sb().from('chat_rooms').select(ROOM_SELECT);
    if (filter) query = query.eq('product_id', filter.productId).eq('seller_id', me().id);
    const { data, error } = await query.order('last_message_at', { ascending: false });
    if (view !== 'list' || !backdrop) return;
    if (error) {
      console.error('[고구마] 채팅 목록을 불러오지 못했어요:', error);
      content.innerHTML = stateHtml('😢', '채팅 목록을 불러오지 못했어요', '잠시 후 다시 시도해 주세요.', true);
      content.querySelector('.chat-retry').addEventListener('click', () => openList(filter));
      return;
    }
    if (!data.length) {
      content.innerHTML = filter
        ? stateHtml('💬', '아직 이 상품에 온 채팅이 없어요', '구매하고 싶은 분이 [채팅 시작하기]를 누르면 여기에 나타나요.')
        : stateHtml('💬', '아직 채팅이 없어요', '마음에 드는 고구마의 상세 화면에서 [채팅 시작하기]를 눌러 보세요.');
      return;
    }

    const mine = me();
    content.innerHTML = `<ul class="chat-list">${data.map((r) => {
      const o = other(r) || {};
      const prod = r.product || {};
      const role = r.seller_id === mine.id ? '판매' : '구매';
      return `
        <li>
          <button type="button" class="chat-list-item" data-room="${esc(r.id)}">
            <img class="chat-avatar" src="${esc(avatarOf(o))}" alt="" />
            <span class="chat-list-main">
              <span class="chat-list-top">
                <span class="chat-list-name">${esc(o.nickname || '알 수 없음')}</span>
                <span class="chat-role chat-role-${role === '판매' ? 'sell' : 'buy'}">${role}</span>
                <span class="chat-list-time">${esc(G.timeAgo(new Date(r.last_message_at).getTime()))}</span>
              </span>
              <span class="chat-list-product">${esc(prod.title || '삭제된 상품')}</span>
              <span class="chat-list-last">${esc(r.last_message || '아직 메시지가 없어요')}</span>
            </span>
            <img class="chat-list-thumb" src="${esc(G.productImage(prod))}" alt="" />
          </button>
        </li>`;
    }).join('')}</ul>`;

    content.querySelector('.chat-list').addEventListener('click', (e) => {
      const item = e.target.closest('[data-room]');
      if (item) openRoom(Number(item.dataset.room));
    });
  }

  // ---------- 채팅방 ----------
  function messageHtml(m) {
    const mine = me() && m.sender_id === me().id;
    return `
      <li class="chat-msg ${mine ? 'is-mine' : 'is-theirs'}" data-msg="${esc(m.id)}">
        <p class="chat-bubble">${esc(m.body)}</p>
        <time class="chat-time" datetime="${esc(m.created_at)}">${esc(clock(m.created_at))}</time>
      </li>`;
  }

  function addMessage(m) {
    if (!m || messageIds.has(m.id) || !room || m.room_id !== room.id) return;
    messageIds.add(m.id);
    const list = $('.chat-messages');
    if (!list) return;
    const empty = $('.chat-empty');
    if (empty) empty.remove();
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.insertAdjacentHTML('beforeend', messageHtml(m));
    if (nearBottom || (me() && m.sender_id === me().id)) list.scrollTop = list.scrollHeight;
  }

  async function openRoom(roomId) {
    if (!me()) { G.auth.requireProfile(() => openRoom(roomId), '채팅은 로그인 후에 볼 수 있어요.'); return; }
    await leaveRoom();
    view = 'room';
    if (!mount(shell('채팅', true))) return;
    const content = $('.chat-content');
    content.innerHTML = stateHtml('💬', '채팅을 불러오는 중이에요…');

    const [roomRes, msgRes] = await Promise.all([
      sb().from('chat_rooms').select(ROOM_SELECT).eq('id', roomId).single(),
      sb().from('chat_messages').select('id,room_id,sender_id,body,created_at')
        .eq('room_id', roomId).order('created_at', { ascending: true }).limit(300),
    ]);
    if (view !== 'room' || !backdrop) return;
    if (roomRes.error || msgRes.error) {
      console.error('[고구마] 채팅방을 불러오지 못했어요:', roomRes.error || msgRes.error);
      content.innerHTML = stateHtml('😢', '채팅방을 불러오지 못했어요', '잠시 후 다시 시도해 주세요.', true);
      content.querySelector('.chat-retry').addEventListener('click', () => openRoom(roomId));
      return;
    }

    room = roomRes.data;
    const o = other(room) || {};
    const prod = room.product || {};
    $('.chat-title').textContent = o.nickname || '채팅';

    content.innerHTML = `
      <div class="chat-product">
        <img class="chat-product-thumb" src="${esc(G.productImage(prod))}" alt="" />
        <div class="chat-product-info">
          <span class="chat-product-title">${esc(prod.title || '삭제된 상품')}</span>
          <span class="chat-product-meta">
            <span class="badge badge-${esc(prod.status || 'sold')}">${esc(G.statusLabel(prod.status || 'sold'))}</span>
            <strong>${esc(G.formatPrice(prod.price || 0))}</strong>
          </span>
        </div>
      </div>
      <p class="chat-notice">🔒 전화번호, 계좌번호 같은 개인정보는 채팅에 남기지 않는 게 안전해요.</p>
      <ul class="chat-messages" aria-live="polite">
        ${msgRes.data.length ? '' : '<li class="chat-empty">첫 메시지를 보내 보세요 🍠</li>'}
      </ul>
      <form class="chat-form" novalidate>
        <label class="chat-sr" for="chat-input">메시지</label>
        <textarea id="chat-input" class="textarea chat-input" rows="1" maxlength="${MAX_BODY}"
                  placeholder="메시지를 입력하세요" autocomplete="off"></textarea>
        <button type="submit" class="btn btn-primary chat-send">보내기</button>
      </form>
      <p class="chat-error" role="alert"></p>`;

    msgRes.data.forEach(addMessage);
    const list = $('.chat-messages');
    list.scrollTop = list.scrollHeight;

    const input = $('#chat-input');
    $('.chat-form').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    input.addEventListener('keydown', (e) => {
      // 한글 조합 중 Enter는 무시, Shift+Enter는 줄바꿈
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    input.focus({ preventScroll: true });

    // 상대가 보낸 새 메시지를 실시간으로 받기
    const rid = room.id;
    channel = sb().channel(`chat-room-${rid}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${rid}` },
        (payload) => addMessage(payload.new))
      .subscribe();
  }

  async function send() {
    if (sending || !room) return;
    const input = $('#chat-input');
    const body = input.value.trim();
    if (!body) return;
    const err = $('.chat-error');
    err.textContent = '';
    sending = true;
    $('.chat-send').disabled = true;
    const { data, error } = await sb().from('chat_messages')
      .insert({ room_id: room.id, sender_id: me().id, body })
      .select('id,room_id,sender_id,body,created_at')
      .single();
    sending = false;
    if (!backdrop || view !== 'room') return;
    $('.chat-send').disabled = false;
    if (error) {
      console.error('[고구마] 메시지를 보내지 못했어요:', error);
      err.textContent = '메시지를 보내지 못했어요. 다시 시도해 주세요.';
      return;
    }
    input.value = '';
    input.style.height = 'auto';
    addMessage(data);
    input.focus({ preventScroll: true });
  }

  // 상세 화면의 [채팅 시작하기]: 이 상품의 내 채팅방을 찾거나 새로 만들고 열기
  async function startForProduct(p) {
    const mine = me();
    if (!mine) { G.auth.requireProfile(() => startForProduct(p), '채팅은 로그인 후에 할 수 있어요.'); return; }
    if (!p.seller || !p.seller.id || p.seller.id === mine.id) return;

    await leaveRoom();
    listFilter = null; // 이 방에서 뒤로 가면 전체 채팅 목록
    view = 'starting';
    if (!mount(shell('채팅', true))) return;
    $('.chat-content').innerHTML = stateHtml('💬', '채팅방을 여는 중이에요…');

    const find = () => sb().from('chat_rooms').select('id')
      .eq('product_id', p.id).eq('buyer_id', mine.id).maybeSingle();

    let { data, error } = await find();
    if (!error && !data) {
      const ins = await sb().from('chat_rooms')
        .insert({ product_id: p.id, buyer_id: mine.id, seller_id: p.seller.id })
        .select('id').single();
      if (ins.error && ins.error.code === '23505') ({ data, error } = await find()); // 동시에 만들어진 경우
      else ({ data, error } = ins);
    }
    if (error || !data) {
      console.error('[고구마] 채팅방을 만들지 못했어요:', error);
      if (backdrop) {
        $('.chat-content').innerHTML = stateHtml('😢', '채팅방을 열지 못했어요', '잠시 후 다시 시도해 주세요.', true);
        $('.chat-retry').addEventListener('click', () => startForProduct(p));
      }
      return;
    }
    openRoom(data.id);
  }

  function close() {
    if (!backdrop) return;
    leaveRoom();
    view = null;
    document.removeEventListener('keydown', onKeydown);
    root.innerHTML = '';
    backdrop = null;
    const otherOpen = document.querySelector('#detail-root .modal-backdrop, #write-root .modal-backdrop');
    if (!otherOpen) document.body.classList.remove('no-scroll');
    if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
  }

  // 로그아웃하면 열린 채팅 닫기
  G.auth.onChange(() => { if (!G.auth.getSession() && backdrop) close(); });

  G.chat = { openList, openRoom, startForProduct, close };
})();
