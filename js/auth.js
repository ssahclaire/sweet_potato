/* =========================================================
   로그인 – 이메일 + 비밀번호 (Supabase Auth)
   - 이메일/비밀번호는 Supabase 로그인 저장소(auth.users)에만 저장됩니다.
   - 우리 테이블(profiles)에는 닉네임과 동네만 저장합니다.
   - 모든 클래스는 .auth- 접두사
   ========================================================= */
(function () {
  const G = window.Goguma;
  const CFG = window.GOGUMA_CONFIG || {};
  const esc = G.escapeHtml;

  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  let session = null;
  let profile = null;
  let ready = false;
  const listeners = [];

  function emit() { listeners.forEach((fn) => fn(api)); }

  async function loadProfile() {
    if (!session) { profile = null; return; }
    const { data, error } = await sb
      .from('profiles')
      .select('id, nickname, avatar_url, region')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) console.error('[고구마] 프로필을 불러오지 못했어요:', error);
    profile = data || null;
  }

  // onAuthStateChange 안에서 바로 Supabase를 다시 부르면 멈출 수 있어 다음 틱으로 미룸
  sb.auth.onAuthStateChange((_event, s) => {
    session = s;
    setTimeout(async () => {
      await loadProfile();
      ready = true;
      emit();
    }, 0);
  });

  // ---------- 오류 문구 ----------
  function friendlyError(err) {
    const code = err && (err.code || '');
    const msg = (err && err.message) || '';
    if (code === 'invalid_credentials' || /Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 맞지 않아요.';
    if (code === 'user_already_exists' || /already registered/i.test(msg)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
    if (code === 'email_not_confirmed' || /Email not confirmed/i.test(msg)) return '이메일 인증이 아직 안 됐어요. 메일함을 확인해 주세요.';
    if (code === 'weak_password' || /Password should be/i.test(msg)) return '비밀번호는 6자 이상으로 정해 주세요.';
    if (code === 'email_address_invalid' || /invalid format|Unable to validate email/i.test(msg)) return '이메일 주소 형식을 확인해 주세요.';
    if (code === 'over_email_send_rate_limit') return '인증 메일을 보낼 수 있는 횟수를 넘었어요. 1시간쯤 뒤에 다시 시도해 주세요.';
    if (code === 'over_request_rate_limit') return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
    if (code === 'signup_disabled') return '지금은 회원가입을 받을 수 없어요.';
    if (code === '23505') return '이미 쓰고 있는 닉네임이에요. 다른 닉네임을 정해 주세요.';
    if (code === '23514') return '닉네임은 2~12자, 동네는 2~30자로 입력해 주세요.';
    return '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
  }

  // ---------- 모달 ----------
  let root = null;
  let backdrop = null;
  let mode = 'login';      // 'login' | 'signup' | 'profile' | 'sent'
  let reason = '';
  let onDone = null;
  let lastFocus = null;

  const TITLES = { login: '로그인', signup: '회원가입', profile: '프로필 만들기', sent: '메일을 확인해 주세요' };

  function bodyHtml() {
    const reasonHtml = reason && mode !== 'sent'
      ? `<p class="auth-reason">${esc(reason)}</p>` : '';

    if (mode === 'sent') {
      return `
        <div class="auth-body">
          <p class="auth-sent-icon" aria-hidden="true">💌</p>
          <p class="auth-desc">가입 인증 메일을 보냈어요.<br />메일의 링크를 누른 뒤 다시 로그인해 주세요.</p>
          <button type="button" class="btn btn-primary btn-lg btn-block" data-go="login">로그인하러 가기</button>
        </div>`;
    }

    if (mode === 'profile') {
      return `
        <form class="auth-form" novalidate>
          <div class="auth-body">
            ${reasonHtml}
            <p class="auth-desc">다른 사람에게는 닉네임과 동네만 보여요. 실명이나 전화번호는 적지 마세요.</p>
            <div class="auth-field">
              <label class="label" for="auth-nickname">닉네임</label>
              <input id="auth-nickname" class="input" type="text" maxlength="12"
                     placeholder="예) 보라고구마" autocomplete="nickname" />
              <p class="auth-help">2~12자</p>
            </div>
            <div class="auth-field">
              <label class="label" for="auth-region">내 동네</label>
              <input id="auth-region" class="input" type="text" maxlength="30"
                     placeholder="예) 마포구 망원동" autocomplete="off" />
              <p class="auth-help">구와 동까지만 적어 주세요.</p>
            </div>
            <p class="auth-error" role="alert"></p>
            <button type="submit" class="btn btn-primary btn-lg btn-block">시작하기</button>
          </div>
        </form>`;
    }

    const isSignup = mode === 'signup';
    return `
      <form class="auth-form" novalidate>
        <div class="auth-body">
          ${reasonHtml}
          <div class="auth-field">
            <label class="label" for="auth-email">이메일</label>
            <input id="auth-email" class="input" type="email" inputmode="email"
                   placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="auth-field">
            <label class="label" for="auth-password">비밀번호</label>
            <input id="auth-password" class="input" type="password" minlength="6"
                   placeholder="${isSignup ? '6자 이상' : '비밀번호'}"
                   autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
          </div>
          <p class="auth-error" role="alert"></p>
          <button type="submit" class="btn btn-primary btn-lg btn-block">${isSignup ? '가입하기' : '로그인'}</button>
          <p class="auth-switch">
            ${isSignup ? '이미 계정이 있나요?' : '고구마가 처음이세요?'}
            <button type="button" class="auth-link" data-go="${isSignup ? 'login' : 'signup'}">
              ${isSignup ? '로그인' : '회원가입'}
            </button>
          </p>
        </div>
      </form>`;
  }

  function template() {
    return `
      <div class="modal-backdrop auth-backdrop">
        <div class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <header class="auth-header">
            <h2 id="auth-title" class="auth-title">${esc(TITLES[mode])}</h2>
            <button type="button" class="btn btn-icon modal-close" aria-label="닫기">✕</button>
          </header>
          <div class="auth-content">${bodyHtml()}</div>
        </div>
      </div>`;
  }

  const $ = (sel) => backdrop.querySelector(sel);

  function setError(msg) {
    const el = $('.auth-error');
    if (el) el.textContent = msg || '';
  }

  function setBusy(on, label) {
    const btn = $('button[type="submit"]');
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || '잠시만요…'; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
    btn.disabled = on;
    backdrop.querySelectorAll('input').forEach((i) => { i.disabled = on; });
  }

  function switchMode(next) {
    mode = next;
    $('.auth-title').textContent = TITLES[mode];
    $('.auth-content').innerHTML = bodyHtml();
    bindForm();
    const first = $('.auth-content input, .auth-content .btn');
    if (first) first.focus({ preventScroll: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'profile') {
      const nickname = $('#auth-nickname').value.trim();
      const region = $('#auth-region').value.trim();
      if (nickname.length < 2) return setError('닉네임을 2자 이상 입력해 주세요.');
      if (region.length < 2) return setError('내 동네를 입력해 주세요. 예) 마포구 망원동');
      setBusy(true);
      const { data, error } = await sb
        .from('profiles')
        .insert({ user_id: session.user.id, nickname, region })
        .select('id, nickname, avatar_url, region')
        .single();
      setBusy(false);
      if (error) return setError(friendlyError(error));
      profile = data;
      emit();
      finish();
      if (G.toast) G.toast(`${profile.nickname}님, 환영해요 🍠`);
      return;
    }

    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    if (!email) return setError('이메일을 입력해 주세요.');
    if (password.length < 6) return setError('비밀번호는 6자 이상이어야 해요.');

    setBusy(true);
    if (mode === 'signup') {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      setBusy(false);
      if (error) return setError(friendlyError(error));
      if (!data.session) return switchMode('sent'); // 이메일 인증이 켜져 있는 경우
      session = data.session;
      await loadProfile();
      return afterSignIn();
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    session = data.session;
    await loadProfile();
    afterSignIn();
  }

  function afterSignIn() {
    emit();
    if (!profile) { switchMode('profile'); return; }
    finish();
    if (G.toast) G.toast(`${profile.nickname}님, 반가워요 🍠`);
  }

  // 로그인/프로필이 모두 끝났을 때
  function finish() {
    const cb = onDone;
    close();
    if (cb) cb();
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && backdrop) { e.preventDefault(); close(); }
  }

  function bindForm() {
    const form = $('.auth-form');
    if (form) form.addEventListener('submit', onSubmit);
  }

  function bind() {
    $('.modal-close').addEventListener('click', () => close());
    let downOnBackdrop = false;
    backdrop.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === backdrop; });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && downOnBackdrop) close();
      downOnBackdrop = false;
    });
    // 로그인 ↔ 회원가입 전환 (내용이 바뀌어도 동작하도록 위임)
    $('.auth-content').addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) switchMode(go.dataset.go);
    });
    bindForm();
    document.addEventListener('keydown', onKeydown);
  }

  // opts: { mode, reason, onDone }
  function open(opts) {
    opts = opts || {};
    root = root || document.getElementById('auth-root');
    if (!root) return;
    if (backdrop) close();
    mode = opts.mode || (session ? 'profile' : 'login');
    reason = opts.reason || '';
    onDone = opts.onDone || null;
    lastFocus = document.activeElement;
    root.innerHTML = template();
    backdrop = root.querySelector('.modal-backdrop');
    document.body.classList.add('no-scroll');
    bind();
    const first = $('.auth-content input, .auth-content .btn');
    if (first) first.focus({ preventScroll: true });
  }

  function close() {
    if (!backdrop) return;
    document.removeEventListener('keydown', onKeydown);
    root.innerHTML = '';
    backdrop = null;
    onDone = null;
    const otherOpen = document.querySelector('#detail-root .modal-backdrop, #write-root .modal-backdrop');
    if (!otherOpen) document.body.classList.remove('no-scroll');
    if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
  }

  // 로그인 + 프로필이 있어야 하는 동작 (예: 글쓰기)
  function requireProfile(cb, why) {
    if (session && profile) { cb(); return; }
    open({
      mode: session ? 'profile' : 'login',
      reason: why || '로그인이 필요해요.',
      onDone: cb,
    });
  }

  async function signOut() {
    await sb.auth.signOut();
    session = null;
    profile = null;
    emit();
    if (G.toast) G.toast('로그아웃했어요');
  }

  const api = {
    client: sb,
    isReady: () => ready,
    getSession: () => session,
    getUser: () => (session ? session.user : null),
    getProfile: () => profile,
    onChange: (fn) => { listeners.push(fn); },
    open, close, requireProfile, signOut,
  };

  G.auth = api;
})();
