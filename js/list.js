/* =========================================================
   [화면1] 상품 목록
   - 첫 render(): 헤더 / 필터 뼈대를 그리고 이벤트를 바인딩
   - 이후 상태 변화(검색, 카테고리, 토글, 새 글)는 카드 그리드만 다시 그림
   ========================================================= */
(function () {
  const G = window.Goguma;
  const ALL = '전체';

  const state = {
    query: '',
    category: ALL,
    availableOnly: false,
  };

  let root = null;
  let gridEl = null;
  let countEl = null;
  let mounted = false;

  // ---------- 필터 ----------
  function getFiltered() {
    const q = state.query.trim().toLowerCase();
    return G.products.filter((p) => {
      if (state.category !== ALL && p.category !== state.category) return false;
      if (state.availableOnly && p.status === 'sold') return false;
      if (q) {
        const hay = `${p.title || ''} ${p.location || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ---------- 템플릿 ----------
  function shellHtml() {
    const chips = [ALL, ...G.CATEGORIES].map((c) => {
      const active = c === state.category;
      return `<button type="button" class="chip${active ? ' is-active' : ''}" data-category="${G.escapeHtml(c)}" aria-pressed="${active}">${G.escapeHtml(c)}</button>`;
    }).join('');

    return `
      <header class="list-header">
        <div class="container list-header-inner">
          <a class="list-logo" href="#" aria-label="고구마 홈">🍠 고구마</a>
          <div class="list-search">
            <span class="list-search-icon" aria-hidden="true">🔍</span>
            <input class="input list-search-input" type="search" id="list-search"
              placeholder="상품명이나 동네를 검색해 보세요" aria-label="상품 검색" autocomplete="off" />
          </div>
          <div class="list-actions">
            <span class="list-user hidden" title="내 닉네임"></span>
            <button type="button" class="btn btn-outline hidden" data-action="chat">채팅</button>
            <button type="button" class="btn btn-primary" data-action="write">글쓰기</button>
            <button type="button" class="btn btn-outline" data-action="login">로그인</button>
          </div>
        </div>
      </header>

      <main class="container list-main">
        <div class="list-filters">
          <div class="list-chips" role="group" aria-label="카테고리">${chips}</div>
          <label class="list-toggle">
            <input type="checkbox" role="switch" class="list-toggle-input" id="list-available"
              aria-checked="false" />
            <span class="list-toggle-track" aria-hidden="true"><span class="list-toggle-thumb"></span></span>
            <span class="list-toggle-text">거래 가능만 보기</span>
          </label>
        </div>

        <p class="list-count" aria-live="polite"></p>
        <div class="list-grid"></div>
      </main>
    `;
  }

  function cardHtml(p) {
    const e = G.escapeHtml;
    const sold = p.status === 'sold';
    return `
      <button type="button" class="list-card${sold ? ' is-sold' : ''}" data-id="${e(p.id)}">
        <span class="list-card-thumb">
          <img src="${e(p.image)}" alt="${e(p.title)}" loading="lazy" />
        </span>
        <span class="list-card-body">
          <span class="list-card-title">${e(p.title)}</span>
          <span class="list-card-meta">${e(p.location)} · ${e(G.timeAgo(p.createdAt))}</span>
          <span class="list-card-bottom">
            <span class="list-card-price">${e(G.formatPrice(p.price))}</span>
            <span class="badge badge-${e(p.status)}">${e(G.statusLabel(p.status))}</span>
          </span>
        </span>
      </button>
    `;
  }

  function emptyHtml() {
    return `
      <div class="list-empty">
        <p class="list-empty-icon" aria-hidden="true">🍠</p>
        <p class="list-empty-title">조건에 맞는 고구마가 없어요 🍠</p>
        <p class="list-empty-desc">검색어를 바꾸거나 다른 카테고리를 골라 보세요.</p>
      </div>
    `;
  }

  function loadingHtml() {
    return `
      <div class="list-empty" role="status">
        <p class="list-empty-icon" aria-hidden="true">🍠</p>
        <p class="list-empty-title">고구마를 불러오는 중이에요…</p>
      </div>
    `;
  }

  function errorHtml() {
    return `
      <div class="list-empty" role="alert">
        <p class="list-empty-icon" aria-hidden="true">😢</p>
        <p class="list-empty-title">상품을 불러오지 못했어요</p>
        <p class="list-empty-desc">인터넷 연결을 확인하고 다시 시도해 주세요.</p>
        <button type="button" class="btn btn-outline list-retry" data-action="retry">다시 시도</button>
      </div>
    `;
  }

  // ---------- 그리기 ----------
  function renderGrid() {
    if (!gridEl) return;
    const loadState = G.getLoadState ? G.getLoadState() : 'ready';
    if (loadState !== 'ready' && !G.products.length) {
      countEl.textContent = '';
      gridEl.classList.add('is-empty');
      gridEl.setAttribute('aria-busy', String(loadState === 'loading'));
      gridEl.innerHTML = loadState === 'error' ? errorHtml() : loadingHtml();
      return;
    }
    gridEl.removeAttribute('aria-busy');
    const items = getFiltered();
    countEl.textContent = items.length ? `고구마 ${items.length}개` : '';
    if (!items.length) {
      gridEl.classList.add('is-empty');
      gridEl.innerHTML = emptyHtml();
      return;
    }
    gridEl.classList.remove('is-empty');
    gridEl.innerHTML = items.map(cardHtml).join('');
  }

  function bindEvents() {
    // 헤더 버튼
    root.querySelector('.list-header').addEventListener('click', (ev) => {
      const logo = ev.target.closest('.list-logo');
      if (logo) {
        ev.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'chat') {
        if (G.chat) G.chat.openList();
      } else if (btn.dataset.action === 'write') {
        if (G.write) G.auth.requireProfile(() => G.write.open(), '글을 쓰려면 로그인해 주세요.');
      } else if (btn.dataset.action === 'login') {
        if (G.auth.getSession()) {
          if (window.confirm('로그아웃할까요?')) G.auth.signOut();
        } else {
          G.auth.open({ mode: 'login' });
        }
      }
    });

    // 검색 (실시간)
    root.querySelector('#list-search').addEventListener('input', (ev) => {
      state.query = ev.target.value;
      renderGrid();
    });

    // 카테고리 칩
    const chipsEl = root.querySelector('.list-chips');
    chipsEl.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.chip');
      if (!chip) return;
      state.category = chip.dataset.category;
      chipsEl.querySelectorAll('.chip').forEach((c) => {
        const on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      renderGrid();
    });

    // 거래 가능만 보기 토글
    const toggle = root.querySelector('#list-available');
    toggle.addEventListener('change', () => {
      state.availableOnly = toggle.checked;
      toggle.setAttribute('aria-checked', String(toggle.checked));
      renderGrid();
    });

    // 카드 클릭 → 상세
    gridEl.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-action="retry"]')) {
        G.loadProducts();
        return;
      }
      const card = ev.target.closest('.list-card');
      if (!card) return;
      const id = Number(card.dataset.id);
      if (G.detail) G.detail.open(id);
    });
  }

  function render() {
    root = document.getElementById('list-screen');
    if (!root) return;
    if (!mounted) {
      root.innerHTML = shellHtml();
      gridEl = root.querySelector('.list-grid');
      countEl = root.querySelector('.list-count');
      bindEvents();
      mounted = true;
    }
    renderAuth();
    renderGrid();
  }

  // 헤더: 로그인 상태 표시
  function renderAuth() {
    if (!root || !mounted) return;
    const userEl = root.querySelector('.list-user');
    const loginBtn = root.querySelector('[data-action="login"]');
    const session = G.auth.getSession();
    const profile = G.auth.getProfile();
    loginBtn.textContent = session ? '로그아웃' : '로그인';
    userEl.textContent = profile ? `🍠 ${profile.nickname}` : '';
    userEl.classList.toggle('hidden', !profile);
    root.querySelector('[data-action="chat"]').classList.toggle('hidden', !profile);
  }

  // 새 글 등록 시 목록 갱신
  G.onChange(() => renderGrid());
  G.auth.onChange(() => renderAuth());

  G.list = { render };
})();
