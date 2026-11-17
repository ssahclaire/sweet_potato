/* =========================================================
   [화면3] 글쓰기 – "내 물건 팔기" 모달
   로그인한 회원만 열 수 있고, [작성 완료] 시 사진은 Storage(product-images),
   글은 products 테이블에 저장합니다.
   ========================================================= */
(function () {
  const G = window.Goguma;
  const esc = G.escapeHtml;
  const CONFIRM_MSG = '작성 중인 내용이 사라져요. 닫을까요?';
  const MAX_PRICE_DIGITS = 10;
  const MAX_DESC_LENGTH = 500;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // product-images 버킷 제한과 같게
  const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

  let root = null;        // #write-root
  let backdrop = null;    // 현재 열린 .modal-backdrop
  let state = null;       // 폼 상태
  let lastFocus = null;   // 닫은 뒤 포커스를 돌려줄 요소

  function freshState() {
    // editing: 수정 중인 상품 (null 이면 새 글), original: 수정 전 입력값 (바뀌었는지 비교용)
    return { category: '', status: 'selling', imageUrl: undefined, imageFile: null, saving: false,
      editing: null, original: null };
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
                <textarea id="write-desc" class="textarea" name="description" rows="6" maxlength="${MAX_DESC_LENGTH}"
                          placeholder="예) 구매 시기, 사용 기간, 하자 여부, 구성품 등을 적어주세요.&#10;자세히 쓸수록 거래가 빨라져요 🍠"></textarea>
                <div class="write-meta">
                  <p class="write-error" aria-live="polite"></p>
                  <span class="write-count"><span data-count="description">0</span>/${MAX_DESC_LENGTH}</span>
                </div>
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
              <p class="write-error write-submit-error" role="alert"></p>
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
    if (state.editing) return snapshot() !== state.original;
    const v = values();
    const locationChanged = v.location && v.location !== (state.defaultLocation || '');
    return !!(v.title || v.category || v.priceDigits || v.description || locationChanged ||
      state.imageUrl || state.status !== 'selling');
  }

  function snapshot() {
    return JSON.stringify({ ...values(), status: state.status, newImage: !!state.imageFile });
  }

  // 수정 모드: 기존 글 내용으로 채우기
  function fillForm(p) {
    state.editing = p;
    state.category = p.category;
    state.status = p.status;
    $('.write-title').textContent = '글 수정하기';
    $('.write-footer .btn').textContent = '수정 완료';

    $('#write-title-input').value = p.title || '';
    $('#write-desc').value = p.description || '';
    $('#write-location').value = p.location || '';
    $('#write-price').value = formatDigits(String(p.price ?? ''));
    $('.write-share-hint').classList.toggle('hidden', String(p.price) !== '0');
    // 글자 수 표시 갱신
    $('#write-title-input').dispatchEvent(new Event('input'));
    $('#write-desc').dispatchEvent(new Event('input'));

    selectRadio($('.write-chips'), 'data-category', p.category);
    selectRadio($('.write-status'), 'data-status', p.status);

    if (p.image) {
      const img = $('.write-upload-preview');
      img.src = p.image;
      img.classList.remove('hidden');
      $('.write-upload-empty').classList.add('hidden');
      $('.write-upload-change').classList.remove('hidden');
      $('.write-upload').classList.add('has-image');
    }
    state.original = snapshot();
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
    if (file.size > MAX_IMAGE_BYTES) {
      e.target.value = '';
      window.alert('사진은 5MB 이하만 올릴 수 있어요.');
      return;
    }
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = URL.createObjectURL(file);
    state.imageFile = file;

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

  function setSaving(on) {
    state.saving = on;
    const btn = $('.write-footer .btn');
    btn.disabled = on;
    btn.textContent = on
      ? (state.editing ? '저장하는 중…' : '올리는 중…')
      : (state.editing ? '수정 완료' : '작성 완료');
  }

  // 사진 업로드 → 상품 저장. 저장에 실패하면 올린 사진은 지움
  async function onSubmit(e) {
    e.preventDefault();
    if (state.saving) return;
    $('.write-submit-error').textContent = '';
    const errors = validate();
    if (errors.length) {
      focusField(errors[0]);
      return;
    }
    const sb = G.auth.client;
    const user = G.auth.getUser();
    const profile = G.auth.getProfile();
    if (!user || !profile) {
      $('.write-submit-error').textContent = '로그인이 풀렸어요. 다시 로그인한 뒤 작성 완료를 눌러 주세요.';
      G.auth.requireProfile(() => {}, '다시 로그인해 주세요.');
      return;
    }

    const v = values();
    setSaving(true);
    let imagePath = null;
    try {
      if (state.imageFile) {
        const ext = IMAGE_EXT[state.imageFile.type] || 'jpg';
        // 원래 파일 이름은 쓰지 않음 (실명 등이 들어 있을 수 있음)
        imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from(window.GOGUMA_CONFIG.PRODUCT_IMAGE_BUCKET)
          .upload(imagePath, state.imageFile, { contentType: state.imageFile.type, upsert: false });
        if (up.error) throw Object.assign(up.error, { step: 'upload' });
      }

      const fields = {
        title: v.title,
        category: v.category,
        price: Number(v.priceDigits),
        description: v.description,
        location: v.location,
        status: state.status,
      };
      const editing = state.editing;
      const query = editing
        // 수정: 새 사진을 골랐을 때만 사진 경로를 바꿈
        ? sb.from('products').update(imagePath ? { ...fields, image_path: imagePath } : fields).eq('id', editing.id)
        : sb.from('products').insert({ ...fields, seller_id: profile.id, image_path: imagePath });
      const { data, error } = await query.select(G.PRODUCT_SELECT).single();
      if (error) throw Object.assign(error, { step: 'save' });

      if (editing) {
        // 사진을 바꿨으면 예전 사진 파일은 지움
        if (imagePath && editing.imagePath) {
          sb.storage.from(window.GOGUMA_CONFIG.PRODUCT_IMAGE_BUCKET).remove([editing.imagePath]).catch(() => {});
        }
        G.replaceProductRow(data);
        close(true);
        showToast('글을 수정했어요 ✏️');
      } else {
        G.addProductRow(data);
        close(true);
        showToast('글이 등록되었어요 🍠');
      }
    } catch (err) {
      console.error('[고구마] 글을 저장하지 못했어요:', err);
      if (imagePath) {
        sb.storage.from(window.GOGUMA_CONFIG.PRODUCT_IMAGE_BUCKET).remove([imagePath]).catch(() => {});
      }
      if (!backdrop) return;
      setSaving(false);
      $('.write-submit-error').textContent = err.step === 'upload'
        ? '사진을 올리지 못했어요. 5MB 이하의 JPG, PNG, WebP, GIF인지 확인해 주세요.'
        : '글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
    }
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

    // 자세한 설명: 최대 500자 (maxlength가 입력·붙여넣기를 막고, 여기서는 글자 수만 표시)
    const descInput = $('#write-desc');
    descInput.addEventListener('input', () => {
      if (descInput.value.length > MAX_DESC_LENGTH) {
        descInput.value = descInput.value.slice(0, MAX_DESC_LENGTH);
      }
      const n = descInput.value.length;
      $('[data-count="description"]').textContent = n;
      $('.write-field[data-field="description"] .write-count')
        .classList.toggle('is-max', n >= MAX_DESC_LENGTH);
    });

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
  // product 를 넘기면 수정 모드, 없으면 새 글
  function open(product) {
    root = root || document.getElementById('write-root');
    if (!root || backdrop) return;
    lastFocus = document.activeElement;
    state = freshState();
    root.innerHTML = template();
    backdrop = root.querySelector('.modal-backdrop');
    document.body.classList.add('no-scroll');
    bind();
    if (product) {
      fillForm(product);
      $('#write-title-input').focus({ preventScroll: true });
      return;
    }
    // 거래 동네는 내 프로필 동네로 미리 채워 둠 (바꿀 수 있음)
    const profile = G.auth && G.auth.getProfile();
    if (profile && profile.region) {
      $('#write-location').value = profile.region;
      state.defaultLocation = profile.region;
    }
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
  G.toast = showToast;
})();
