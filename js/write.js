/* =========================================================
   [화면3] 글쓰기 – "내 물건 팔기" 모달
   저장 기능 없음: Goguma.addProduct 로 메모리에만 추가합니다.
   ========================================================= */
(function () {
  const G = window.Goguma;
  const esc = G.escapeHtml;
  const CONFIRM_MSG = '작성 중인 내용이 사라져요. 닫을까요?';
  const MAX_PRICE_DIGITS = 10;

  let root = null;        // #write-root
  let backdrop = null;    // 현재 열린 .modal-backdrop
  let state = null;       // 폼 상태
  let lastFocus = null;   // 닫은 뒤 포커스를 돌려줄 요소

  function freshState() {
    return { category: '', status: 'selling', imageUrl: undefined };
  }

  // ---------- 템플릿 ----------
  function template() {
    const chips = G.CATEGORIES.map((c) => (
      `<button type="button" class="chip" role="radio" aria-checked="false" data-category="${esc(c)}">${esc(c)}</button>`
    )).join('');

    const statuses = G.STATUSES.map((s) => (
      `<button type="button" class="chip write-status-chip${s.key === 'selling' ? ' is-active' : ''}"` +
      ` role="radio" aria-checked="${s.key === 'selling'}" data-status="${esc(s.key)}">${esc(s.label)}</button>`
    )).join('');

    return `
      <div class="modal-backdrop write-backdrop">
        <div class="modal write-modal" role="dialog" aria-modal="true" aria-labelledby="write-title">
          <header class="write-header">
            <h2 id="write-title" class="write-title">내 물건 팔기</h2>
            <button type="button" class="btn btn-icon modal-close" aria-label="닫기">✕</button>
          </header>

          <form class="write-form" novalidate>
            <div class="write-body">

              <div class="write-field" data-field="image">
                <span class="label">상품 이미지</span>
                <label class="write-upload" for="write-image">
                  <input id="write-image" class="write-upload-input" type="file" accept="image/*" />
                  <span class="write-upload-empty">
                    <span class="write-upload-icon" aria-hidden="true">📷</span>
                    <span class="write-upload-text">사진 올리기</span>
                  </span>
                  <img class="write-upload-preview hidden" alt="선택한 상품 사진 미리보기" />
                  <span class="write-upload-change hidden">사진 바꾸기</span>
                </label>
                <p class="write-help">사진을 올리지 않으면 기본 이미지가 들어가요.</p>
              </div>

              <div class="write-field" data-field="title">
                <label class="label" for="write-title-input">상품명 <span class="write-req" aria-hidden="true">*</span></label>
                <input id="write-title-input" class="input" type="text" name="title" maxlength="40"
                       placeholder="예) 아이폰 14 프로 256GB" autocomplete="off" />
                <div class="write-meta">
                  <p class="write-error" aria-live="polite"></p>
                  <span class="write-count"><span data-count="title">0</span>/40</span>
                </div>
              </div>

              <div class="write-field" data-field="category">
                <span class="label" id="write-category-label">카테고리 <span class="write-req" aria-hidden="true">*</span></span>
                <div class="write-chips" role="radiogroup" aria-labelledby="write-category-label">${chips}</div>
                <p class="write-error" aria-live="polite"></p>
              </div>

              <div class="write-field" data-field="price">
                <label class="label" for="write-price">가격 <span class="write-req" aria-hidden="true">*</span></label>
                <div class="write-price">
                  <input id="write-price" class="input write-price-input" type="text" name="price"
                         inputmode="numeric" placeholder="0" autocomplete="off" />
                  <span class="write-price-unit" aria-hidden="true">원</span>
                </div>
                <p class="write-help write-share-hint hidden">💜 0원은 나눔으로 등록돼요.</p>
                <p class="write-error" aria-live="polite"></p>
              </div>

              <div class="write-field" data-field="description">
                <label class="label" for="write-desc">자세한 설명 <span class="write-req" aria-hidden="true">*</span></label>
                <textarea id="write-desc" class="textarea" name="description" rows="6"
                          placeholder="예) 구매 시기, 사용 기간, 하자 여부, 구성품 등을 적어주세요.&#10;자세히 쓸수록 거래가 빨라져요 🍠"></textarea>
                <p class="write-error" aria-live="polite"></p>
              </div>

              <div class="write-field" data-field="location">
                <label class="label" for="write-location">거래 동네 <span class="write-req" aria-hidden="true">*</span></label>
                <input id="write-location" class="input" type="text" name="location"
                       placeholder="예) 마포구 망원동" autocomplete="off" />
                <p class="write-error" aria-live="polite"></p>
              </div>

              <div class="write-field" data-field="status">
                <span class="label" id="write-status-label">판매 상태</span>
                <div class="write-status" role="radiogroup" aria-labelledby="write-status-label">${statuses}</div>
              </div>

            </div>

            <div class="write-footer">
              <button type="submit" class="btn btn-primary btn-lg btn-block">작성 완료</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  // ---------- 헬퍼 ----------
  const $ = (sel) => backdrop.querySelector(sel);
  const $$ = (sel) => Array.from(backdrop.querySelectorAll(sel));
  const field = (name) => $(`.write-field[data-field="${name}"]`);

  function digitsOnly(str) {
    return String(str).replace(/[^\d]/g, '');
  }

  function formatDigits(d) {
    if (d === '') return '';
    return Number(d).toLocaleString('ko-KR');
  }

  function setError(name, msg) {
    const f = field(name);
    if (!f) return;
    f.classList.toggle('is-error', !!msg);
    const el = f.querySelector('.write-error');
    if (el) el.textContent = msg || '';
    const ctrl = f.querySelector('.input, .textarea');
    if (ctrl) ctrl.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function values() {
    return {
      title: $('#write-title-input').value.trim(),
      category: state.category,
      priceDigits: digitsOnly($('#write-price').value),
      description: $('#write-desc').value.trim(),
      location: $('#write-location').value.trim(),
    };
  }

  function isDirty() {
    if (!backdrop) return false;
    const v = values();
    return !!(v.title || v.category || v.priceDigits || v.description || v.location ||
      state.imageUrl || state.status !== 'selling');
  }

  function selectRadio(group, attr, value) {
    group.querySelectorAll(`[${attr}]`).forEach((b) => {
      const on = b.getAttribute(attr) === value;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  // ---------- 유효성 검사 ----------
  function validate() {
    const v = values();
    const errors = [];
    const check = (name, ok, msg) => {
      setError(name, ok ? '' : msg);
      if (!ok) errors.push(name);
    };
    check('title', !!v.title, '상품명을 입력해 주세요.');
    check('category', !!v.category, '카테고리를 선택해 주세요.');
    check('price', v.priceDigits !== '', '가격을 입력해 주세요. 나눔이면 0을 입력하세요.');
    check('description', !!v.description, '자세한 설명을 입력해 주세요.');
    check('location', !!v.location, '거래 동네를 입력해 주세요.');
    return errors;
  }

  function focusField(name) {
    const f = field(name);
    if (!f) return;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const target = name === 'category'
      ? f.querySelector('.chip')
      : f.querySelector('.input, .textarea');
    if (target) target.focus({ preventScroll: true });
  }

  // ---------- 이벤트 ----------
  function onImageChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return; // 선택 취소 시 기존 사진 유지
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = URL.createObjectURL(file);

    const img = $('.write-upload-preview');
    img.src = state.imageUrl;
    img.classList.remove('hidden');
    $('.write-upload-empty').classList.add('hidden');
    $('.write-upload-change').classList.remove('hidden');
    $('.write-upload').classList.add('has-image');
  }

  function onPriceInput(e) {
    const input = e.target;
    // 커서 앞쪽 숫자 개수를 기억했다가 포맷 후 같은 위치로 복원
    const caret = input.selectionStart == null ? input.value.length : input.selectionStart;
    const digitsBefore = digitsOnly(input.value.slice(0, caret)).length;

    let d = digitsOnly(input.value).replace(/^0+(?=\d)/, '').slice(0, MAX_PRICE_DIGITS);
    const formatted = formatDigits(d);
    input.value = formatted;

    let pos = 0, seen = 0;
    while (pos < formatted.length && seen < Math.min(digitsBefore, d.length)) {
      if (/\d/.test(formatted[pos])) seen++;
      pos++;
    }
    try { input.setSelectionRange(pos, pos); } catch (_) { /* 무시 */ }

    $('.write-share-hint').classList.toggle('hidden', d !== '0');
    if (d !== '') setError('price', '');
  }

  function onSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (errors.length) {
      focusField(errors[0]);
      return;
    }
    const v = values();
    G.addProduct({
      title: v.title,
      category: v.category,
      price: Number(v.priceDigits),
      description: v.description,
      location: v.location,
      status: state.status,
      image: state.imageUrl || undefined,
    });
    state.imageUrl = undefined; // 등록된 상품이 계속 사용하므로 revoke 하지 않음
    close(true);
    showToast('글이 등록되었어요 🍠');
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && backdrop) {
      e.preventDefault();
      close();
    }
  }

  function bind() {
    $('.modal-close').addEventListener('click', () => close());

    // 배경 클릭 (모달 안에서 드래그하다 바깥에서 놓는 경우는 무시)
    let downOnBackdrop = false;
    backdrop.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === backdrop; });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && downOnBackdrop) close();
      downOnBackdrop = false;
    });

    $('#write-image').addEventListener('change', onImageChange);

    const titleInput = $('#write-title-input');
    titleInput.addEventListener('input', () => {
      $('[data-count="title"]').textContent = titleInput.value.length;
      if (titleInput.value.trim()) setError('title', '');
    });

    const chipGroup = $('.write-chips');
    chipGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.dataset.category;
      selectRadio(chipGroup, 'data-category', state.category);
      setError('category', '');
    });

    const statusGroup = $('.write-status');
    statusGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-status]');
      if (!btn) return;
      state.status = btn.dataset.status;
      selectRadio(statusGroup, 'data-status', state.status);
    });

    $('#write-price').addEventListener('input', onPriceInput);

    [['#write-desc', 'description'], ['#write-location', 'location']].forEach(([sel, name]) => {
      const el = $(sel);
      el.addEventListener('input', () => { if (el.value.trim()) setError(name, ''); });
    });

    $('.write-form').addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKeydown);
  }

  // ---------- 토스트 ----------
  let toastTimer = null;
  function showToast(msg) {
    let toast = document.querySelector('.write-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'write-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    // 다시 띄울 때도 애니메이션이 보이도록 리플로우 후 표시
    toast.classList.remove('is-show');
    void toast.offsetWidth;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 2000);
  }

  // ---------- 공개 API ----------
  function open() {
    root = root || document.getElementById('write-root');
    if (!root || backdrop) return;
    lastFocus = document.activeElement;
    state = freshState();
    root.innerHTML = template();
    backdrop = root.querySelector('.modal-backdrop');
    document.body.classList.add('no-scroll');
    bind();
    $('#write-title-input').focus({ preventScroll: true });
  }

  // force=true 이면 확인 없이 닫음 (등록 완료 시)
  function close(force) {
    if (!backdrop) return;
    if (force !== true && isDirty() && !window.confirm(CONFIRM_MSG)) return;

    if (state && state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    document.removeEventListener('keydown', onKeydown);
    root.innerHTML = '';
    backdrop = null;
    state = null;
    // 다른 모달(상세)이 열려 있으면 스크롤 잠금 유지
    const detailOpen = document.querySelector('#detail-root .modal-backdrop');
    if (!detailOpen) document.body.classList.remove('no-scroll');
    if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
  }

  G.write = { open, close };
})();
