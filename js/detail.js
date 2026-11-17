/* =========================================================
   [화면2] 상품 상세 팝업(모달)
   Goguma.detail = { open(id), close() }
   ========================================================= */
(function () {
  const G = window.Goguma;
  const esc = G.escapeHtml;

  let root = null;          // #detail-root
  let lastFocused = null;   // 닫힐 때 포커스를 돌려줄 요소
  let toastTimer = null;

  function getRoot() {
    if (!root) root = document.getElementById('detail-root');
    return root;
  }

  // 목록에서 data-id(문자열)로 넘어와도 찾을 수 있게 숫자도 시도합니다.
  function findProduct(id) {
    return G.getProduct(id) || G.getProduct(Number(id));
  }

  let current = null;       // 지금 열린 상품
  let liked = false;
  let likeBusy = false;

  function myProfile() { return G.auth && G.auth.getProfile(); }
  function isMine(p) {
    const me = myProfile();
    return !!(me && p.seller && p.seller.id === me.id);
  }

  function likeLabel(on, count) {
    const n = Number(count) || 0;
    return `${on ? '♥' : '♡'} 관심${on ? ' 추가됨' : ' 추가'}${n ? ` · ${n}` : ''}`;
  }

  function renderLike() {
    const btn = getRoot().querySelector('[data-detail-like]');
    if (!btn || !current) return;
    btn.innerHTML = esc(likeLabel(liked, current.favoriteCount));
    btn.setAttribute('aria-pressed', String(liked));
    btn.classList.toggle('is-liked', liked);
    btn.disabled = likeBusy;
  }

  // 로그인한 경우: 내가 이 상품을 관심 추가했는지 불러오기
  async function loadLiked(p) {
    liked = false;
    const me = myProfile();
    if (!me) { renderLike(); return; }
    const { data, error } = await G.auth.client
      .from('favorites').select('product_id')
      .eq('profile_id', me.id).eq('product_id', p.id).maybeSingle();
    if (current !== p) return; // 그사이 다른 상품을 열었으면 무시
    if (error) console.error('[고구마] 관심 상태를 불러오지 못했어요:', error);
    liked = !!data;
    renderLike();
  }

  async function toggleLike() {
    if (likeBusy || !current) return;
    const p = current;
    const me = myProfile();
    const sb = G.auth.client;
    const next = !liked;
    likeBusy = true;
    // 먼저 화면에 반영하고, 실패하면 되돌림
    liked = next;
    p.favoriteCount = Math.max(0, (p.favoriteCount || 0) + (next ? 1 : -1));
    renderLike();
    const { error } = next
      ? await sb.from('favorites').insert({ profile_id: me.id, product_id: p.id })
      : await sb.from('favorites').delete().eq('profile_id', me.id).eq('product_id', p.id);
    likeBusy = false;
    if (error && error.code !== '23505') { // 23505: 이미 추가됨 → 성공으로 취급
      console.error('[고구마] 관심 추가를 저장하지 못했어요:', error);
      liked = !next;
      p.favoriteCount = Math.max(0, p.favoriteCount + (next ? -1 : 1));
      showToast('저장하지 못했어요. 다시 시도해 주세요.');
    } else {
      showToast(next ? '관심 목록에 추가했어요 💜' : '관심을 취소했어요');
    }
    if (current === p) renderLike();
  }

  // ---------- 내 글 관리 (판매 상태 변경 / 수정 / 삭제) ----------
  let ownerBusy = false;

  function ownerHtml(p) {
    const chips = G.STATUSES.map((s) => {
      const on = s.key === p.status;
      return `<button type="button" class="chip detail-status-chip${on ? ' is-active' : ''}" role="radio"
        aria-checked="${on}" data-status="${esc(s.key)}">${esc(s.label)}</button>`;
    }).join('');
    return `
      <section class="detail-owner" aria-label="내 글 관리">
        <p class="detail-owner-title">내 글 관리</p>
        <div class="detail-owner-status" role="radiogroup" aria-label="판매 상태">${chips}</div>
        <div class="detail-owner-buttons">
          <button type="button" class="btn btn-outline" data-detail-edit>✏️ 수정</button>
          <button type="button" class="btn btn-ghost detail-delete" data-detail-delete>🗑️ 삭제</button>
        </div>
      </section>`;
  }

  async function changeStatus(status) {
    const p = current;
    if (!p || ownerBusy || status === p.status) return;
    ownerBusy = true;
    getRoot().querySelectorAll('.detail-owner .btn, .detail-owner .chip').forEach((b) => { b.disabled = true; });
    const { data, error } = await G.auth.client.from('products')
      .update({ status }).eq('id', p.id)
      .select(G.PRODUCT_SELECT).single();
    ownerBusy = false;
    if (error) {
      console.error('[고구마] 판매 상태를 바꾸지 못했어요:', error);
      if (current === p) {
        getRoot().querySelectorAll('.detail-owner .btn, .detail-owner .chip').forEach((b) => { b.disabled = false; });
        showToast('상태를 바꾸지 못했어요. 다시 시도해 주세요.');
      }
      return;
    }
    const updated = G.replaceProductRow(data); // 목록 카드 배지도 함께 바뀜
    if (current === p) {
      open(updated.id);
      showToast(`'${G.statusLabel(updated.status)}'(으)로 바꿨어요`);
    }
  }

  async function deleteProduct() {
    const p = current;
    if (!p || ownerBusy) return;
    const ok = window.confirm(
      `'${p.title}' 글을 삭제할까요?\n\n삭제하면 되돌릴 수 없고, 이 글에 온 관심과 채팅도 함께 지워져요.`);
    if (!ok) return;
    ownerBusy = true;
    const sb = G.auth.client;
    const { error } = await sb.from('products').delete().eq('id', p.id);
    ownerBusy = false;
    if (error) {
      console.error('[고구마] 글을 삭제하지 못했어요:', error);
      showToast('삭제하지 못했어요. 다시 시도해 주세요.');
      return;
    }
    if (p.imagePath) {
      sb.storage.from(window.GOGUMA_CONFIG.PRODUCT_IMAGE_BUCKET).remove([p.imagePath]).catch(() => {});
    }
    close();
    G.removeProduct(p.id);
    if (G.toast) G.toast('글을 삭제했어요');
  }

  function template(p) {
    const seller = p.seller || {};
    const isSold = p.status === 'sold';
    const titleId = 'detail-title-' + esc(p.id);

    return `
      <div class="modal-backdrop detail-backdrop" data-detail-backdrop>
        <div class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
          <button type="button" class="btn btn-icon modal-close" aria-label="닫기" data-detail-close>✕</button>

          <div class="detail-image-wrap">
            <img class="detail-image" src="${esc(p.image || '')}" alt="${esc(p.title)}" />
          </div>

          <div class="detail-body">
            <div class="detail-badges">
              <span class="badge badge-${esc(p.status)}">${esc(G.statusLabel(p.status))}</span>
              <span class="badge badge-category">${esc(p.category || '기타')}</span>
            </div>

            <h2 class="detail-title" id="${titleId}">${esc(p.title)}</h2>

            <p class="detail-meta">
              ${esc(p.location || '')}<span class="detail-dot" aria-hidden="true">·</span>${esc(G.timeAgo(p.createdAt))}
            </p>

            <p class="detail-price">${esc(G.formatPrice(p.price))}</p>

            <p class="detail-desc">${esc(p.description || '')}</p>

            ${isMine(p) ? ownerHtml(p) : ''}

            <section class="detail-seller" aria-label="판매자 정보">
              <img class="detail-seller-avatar" src="${esc(seller.avatar || '')}" alt="" />
              <div class="detail-seller-info">
                <span class="detail-seller-name">${esc(seller.nickname || '알 수 없음')}</span>
                <span class="detail-seller-region">${esc(seller.region || '')}</span>
              </div>
            </section>
          </div>

          <div class="detail-actions">
            <button type="button" class="btn btn-outline btn-lg detail-action detail-like" data-detail-like
              aria-pressed="false">${likeLabel(false, p.favoriteCount)}</button>
            ${isMine(p)
              ? `<button type="button" class="btn btn-primary btn-lg detail-action" data-detail-chatlist>받은 채팅 보기</button>`
              : `<button type="button" class="btn btn-primary btn-lg detail-action" data-detail-chat
                  ${isSold ? 'disabled aria-disabled="true" title="거래가 완료된 상품이에요"' : ''}>채팅 시작하기</button>`}
          </div>

          <div class="detail-toast" role="status" aria-live="polite"></div>
        </div>
      </div>`;
  }

  function showToast(msg) {
    const el = getRoot().querySelector('.detail-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 1800);
  }

  function onClick(e) {
    // 배경(모달 바깥)을 직접 클릭했을 때만 닫기
    if (e.target.hasAttribute && e.target.hasAttribute('data-detail-backdrop')) { close(); return; }
    if (e.target.closest('[data-detail-close]')) { close(); return; }
    if (e.target.closest('[data-detail-like]')) {
      if (myProfile()) { toggleLike(); return; }
      const p = current;
      G.auth.requireProfile(() => {
        if (current !== p) return;
        // 방금 로그인했으면: 버튼(내 상품 여부)을 다시 그리고, 아직 관심 추가 전이면 추가
        open(p.id);
        loadLiked(p).then(() => { if (current === p && !liked) toggleLike(); });
      }, '관심 추가는 로그인 후에 할 수 있어요.');
      return;
    }
    if (e.target.closest('[data-detail-chat]')) {
      const p = current;
      G.auth.requireProfile(() => {
        if (isMine(p)) { open(p.id); return; }
        close();
        G.chat.startForProduct(p);
      }, '채팅은 로그인 후에 할 수 있어요.');
      return;
    }
    const statusChip = e.target.closest('.detail-status-chip');
    if (statusChip) { changeStatus(statusChip.dataset.status); return; }
    if (e.target.closest('[data-detail-delete]')) { deleteProduct(); return; }
    if (e.target.closest('[data-detail-edit]')) {
      const p = current;
      close();
      G.write.open(p); // 수정 모드로 열기
      return;
    }
    if (e.target.closest('[data-detail-chatlist]')) {
      const p = current;
      close();
      G.chat.openList({ productId: p.id, productTitle: p.title }); // 이 상품에 받은 채팅만
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }

    // 간단한 포커스 가두기: Tab 이 모달 밖으로 나가지 않게
    if (e.key === 'Tab') {
      const modal = getRoot().querySelector('.modal');
      if (!modal) return;
      const items = Array.from(modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function open(id) {
    const p = findProduct(id);
    const el = getRoot();
    if (!p || !el) return;

    if (el.firstChild) close(true); // 이미 열려 있으면 내용만 교체
    else lastFocused = document.activeElement;

    current = p;
    liked = false;
    likeBusy = false;
    el.innerHTML = template(p);
    loadLiked(p);
    el.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.body.classList.add('no-scroll');

    const btn = el.querySelector('.modal-close');
    if (btn) btn.focus();
  }

  function close(keepFocusTarget) {
    const el = getRoot();
    if (!el) return;
    el.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeydown);
    clearTimeout(toastTimer);
    el.innerHTML = '';
    if (keepFocusTarget === true) return;
    current = null;

    document.body.classList.remove('no-scroll');
    if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  G.detail = { open, close: () => close() };
})();
