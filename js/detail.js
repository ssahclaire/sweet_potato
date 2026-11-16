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

            <section class="detail-seller" aria-label="판매자 정보">
              <img class="detail-seller-avatar" src="${esc(seller.avatar || '')}" alt="" />
              <div class="detail-seller-info">
                <span class="detail-seller-name">${esc(seller.nickname || '알 수 없음')}</span>
                <span class="detail-seller-region">${esc(seller.region || '')}</span>
              </div>
            </section>
          </div>

          <div class="detail-actions">
            <button type="button" class="btn btn-outline btn-lg detail-action" data-detail-like>♡ 관심 추가</button>
            <button type="button" class="btn btn-primary btn-lg detail-action" data-detail-chat
              ${isSold ? 'disabled aria-disabled="true" title="거래가 완료된 상품이에요"' : ''}>채팅 시작하기</button>
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
    if (e.target.closest('[data-detail-like]') || e.target.closest('[data-detail-chat]')) {
      showToast('준비 중이에요');
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

    el.innerHTML = template(p);
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

    document.body.classList.remove('no-scroll');
    if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  G.detail = { open, close: () => close() };
})();
