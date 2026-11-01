/*  <straitgate-auth-modal> – sign-in form; credentials are checked by the server.
 *
 *  Usage
 *    (load straitgate-auth-modal.js with a script tag)
 *    <straitgate-auth-modal id="auth" mode="login" theme="auto"></straitgate-auth-modal>
 *
 *  Attributes   mode="login"   theme="auto|light|dark"   brand="Straitgate"   product="Admin"
 *  Methods      open(mode?)  close()  setMode(m)  setError(msg)  setBusy(bool)
 *  Events       auth:submit  detail { mode, name?, email, password? }   (you verify it, then call close() or setError())
 *               auth:forgot  detail { email }
 *               auth:close
 *  Theming      override on the element: --bg --ink --mute --line --field --field-line --lime --on-lime --red --overlay --radius
 *  The component never stores or checks credentials; that belongs on your server.
 */
(function () {
  var LIGHT = '--bg:#fff;--ink:#0a0a0a;--mute:#8a8a8a;--line:#ddd;--field:#fff;--field-line:#9a9a9a;--lime:#ccf97c;--on-lime:#0a0a0a;--hover:#0a0a0a;--on-hover:#fff;--red:#e5271d;--overlay:rgba(10,10,10,.74);color-scheme:light;';
  var DARK = '--bg:#161616;--ink:#f2f2f2;--mute:#8f8f8f;--line:#2f2f2f;--field:#1d1d1d;--field-line:#4a4a4a;--lime:#ccf97c;--on-lime:#0a0a0a;--hover:#f2f2f2;--on-hover:#0a0a0a;--red:#ff5a4d;--overlay:rgba(0,0,0,.8);color-scheme:dark;';

  var CSS =
    ':host{' + LIGHT + '--radius:22px;font-family:"Inter Tight","Helvetica Neue",Helvetica,Arial,sans-serif;display:contents}' +
    ':host([theme=dark]){' + DARK + '}' +
    '@media (prefers-color-scheme:dark){:host(:not([theme=light])){' + DARK + '}}' +
    '*,*::before,*::after{box-sizing:border-box}' +
    '.ov{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:var(--overlay);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}' +
    '.ov[hidden]{display:none}' +
    '.box{position:relative;background:var(--bg);color:var(--ink);width:min(100%,420px);max-height:100%;overflow:auto;border-radius:var(--radius);padding:clamp(22px,4vw,36px)}' +
    '.brand{font-size:clamp(20px,2.4vw,26px);font-weight:500;letter-spacing:-.04em;margin-bottom:clamp(20px,4vw,32px)}' +
    '.brand small{font-size:11px;color:var(--mute);letter-spacing:0;margin-left:8px;font-weight:400}' +
    'h2{font-weight:400;font-size:clamp(30px,5vw,40px);letter-spacing:-.05em;line-height:1;margin:0 0 10px}' +
    '.desc{font-size:12px;color:var(--mute);margin:0 0 20px;line-height:1.4}' +
    '.fields{display:grid;gap:12px}' +
    'label{display:block;font-size:10px;color:var(--mute);margin:0 0 5px}' +
    'input[type=text],input[type=email],input[type=password]{width:100%;height:36px;border:1px solid var(--field-line);border-radius:999px;padding:0 14px;font:inherit;font-size:13px;background:var(--field);color:var(--ink)}' +
    'input::placeholder{color:var(--mute)}' +
    'input:focus-visible,button:focus-visible{outline:2px solid var(--lime);outline-offset:2px}' +
    '.show{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--mute);margin:0}' +
    '.show input{width:auto;height:auto;margin:0;accent-color:var(--lime)}' +
    '.err{color:var(--red);font-size:11px;min-height:16px;margin:10px 0 8px}' +
    '.go{width:100%;height:40px;border:0;border-radius:999px;background:var(--lime);color:var(--on-lime);font:inherit;font-size:12px;cursor:pointer;transition:background .2s,color .2s}' +
    '.go:hover{background:var(--hover);color:var(--lime)}.go[disabled]{opacity:.6;cursor:wait}' +
    '.alt{display:flex;justify-content:space-between;gap:12px;margin-top:14px;font-size:11px}' +
    '.alt button{border:0;background:none;padding:0;color:var(--mute);font:inherit;text-decoration:underline;cursor:pointer}.alt button:hover{color:var(--ink)}' +
    '.x{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--ink);font-size:16px;cursor:pointer}' +
    '.x:hover{background:var(--hover);color:var(--on-hover)}' +
    '@media (prefers-reduced-motion:no-preference){.box{animation:in .25s ease}@keyframes in{from{opacity:0;transform:translateY(12px)}}}';

  var COPY = {
    login:  ['Sign in', 'Enter your details to continue.', 'Sign in'],
    signup: ['Create account', 'Set up your access in a minute.', 'Create account'],
    forgot: ['Reset password', 'Enter your email and we will send you a reset link.', 'Send reset link']
  };
  var uid = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  class StraitgateAuthModal extends HTMLElement {
    static get observedAttributes() { return ['mode', 'brand', 'product', 'theme']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._id = 'dam' + (++uid);
      this._open = false;
      this._busy = false;
      this._mode = 'login';
      this._onKey = this._onKey.bind(this);
    }

    connectedCallback() {
      this._mode = COPY[this.getAttribute('mode')] ? this.getAttribute('mode') : 'login';
      this._render();
      if (this.hasAttribute('open')) this.open();
    }
    disconnectedCallback() { document.removeEventListener('keydown', this._onKey, true); }
    attributeChangedCallback(n) { if (this.isConnected && n !== 'theme') this._render(); }

    /* public API */
    open(mode) {
      if (mode) this._mode = COPY[mode] ? mode : 'login';
      this._lastFocus = document.activeElement;
      this._open = true;
      this._render();
      document.addEventListener('keydown', this._onKey, true);
      this._prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      var f = this.shadowRoot.querySelector('input'); if (f) f.focus();
    }
    close() {
      if (!this._open) return;
      this._open = false;
      this._busy = false;
      this._render();
      document.removeEventListener('keydown', this._onKey, true);
      document.documentElement.style.overflow = this._prevOverflow || '';
      if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
      this.dispatchEvent(new CustomEvent('auth:close', { bubbles: true, composed: true }));
    }
    setMode(m) { this._mode = COPY[m] ? m : 'login'; this._render(); var f = this.shadowRoot.querySelector('input'); if (f) f.focus(); }
    setError(msg) { var e = this.shadowRoot.getElementById('err'); if (e) e.textContent = msg || ''; this.setBusy(false); }
    setBusy(b) { this._busy = !!b; var g = this.shadowRoot.getElementById('go'); if (g) g.disabled = this._busy; }

    /* internals */
    _render() {
      var m = this._mode, c = COPY[m], id = this._id, f = '';
      if (m === 'signup') f += this._f(id + 'n', 'Full name', 'text', 'name');
      f += this._f(id + 'e', 'Email', 'email', 'username');
      if (m !== 'forgot') f += this._f(id + 'p', m === 'signup' ? 'Password (8+ characters)' : 'Password', 'password', m === 'signup' ? 'new-password' : 'current-password');
      if (m === 'signup') f += this._f(id + 'q', 'Confirm password', 'password', 'new-password');
      if (m !== 'forgot') f += '<label class="show"><input type="checkbox" id="sp"> Show password</label>';

      var alt = '';

      this.shadowRoot.innerHTML =
        '<style>' + CSS + '</style>' +
        '<div class="ov"' + (this._open ? '' : ' hidden') + '>' +
        '<div class="box" role="dialog" aria-modal="true" aria-labelledby="t">' +
        (this.hasAttribute('closable') ? '<button type="button" class="x" id="cl" aria-label="Close">&times;</button>' : '') +
        '<div class="brand">' + esc(this.getAttribute('brand') || 'Straitgate') + (this.getAttribute('product') ? '<small>' + esc(this.getAttribute('product')) + '</small>' : '') + '</div>' +
        '<h2 id="t">' + c[0] + '</h2><p class="desc">' + c[1] + '</p>' +
        '<div class="fields">' + f + '</div>' +
        '<p class="err" id="err" role="alert"></p>' +
        '<button type="button" class="go" id="go"' + (this._busy ? ' disabled' : '') + '>' + c[2] + '</button>' +
        '<div class="alt">' + alt + '</div></div></div>';

      var r = this.shadowRoot;
      r.getElementById('go').onclick = this._submit.bind(this);
      var cl = r.getElementById('cl'); if (cl) cl.onclick = this.close.bind(this);
      r.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { this.setMode(b.dataset.m); }.bind(this); }, this);
      var sp = r.getElementById('sp');
      if (sp) sp.onchange = function () { r.querySelectorAll('input[type=password],input[data-pw]').forEach(function (i) { i.type = sp.checked ? 'text' : 'password'; i.setAttribute('data-pw', '1'); }); };
      r.querySelector('.ov').onclick = function (e) { if (e.target.classList.contains('ov') && this.hasAttribute('closable')) this.close(); }.bind(this);
    }

    _f(id, label, type, ac) {
      return '<div><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" autocomplete="' + ac + '"></div>';
    }

    _val(s) { var el = this.shadowRoot.getElementById(this._id + s); return el ? el.value : ''; }

    _submit() {
      if (this._busy) return;
      var m = this._mode, name = this._val('n').trim(), email = this._val('e').trim().toLowerCase(), pw = this._val('p'), pw2 = this._val('q');
      if (!/^\S+@\S+\.\S+$/.test(email)) return this.setError('Enter a valid email address.');
      if (m === 'signup' && !name) return this.setError('Enter your name.');
      if (m !== 'forgot' && !pw) return this.setError('Enter your password.');
      if (m === 'signup' && pw.length < 8) return this.setError('Use at least 8 characters for the password.');
      if (m === 'signup' && pw !== pw2) return this.setError('The passwords do not match.');
      this.setError('');
      this.setBusy(true);
      if (m === 'forgot') this.dispatchEvent(new CustomEvent('auth:forgot', { bubbles: true, composed: true, detail: { email: email } }));
      else this.dispatchEvent(new CustomEvent('auth:submit', { bubbles: true, composed: true, detail: { mode: m, name: name || undefined, email: email, password: pw } }));
    }

    _onKey(e) {
      if (!this._open) return;
      var r = this.shadowRoot;
      if (e.key === 'Escape' && this.hasAttribute('closable')) { e.stopPropagation(); this.close(); return; }
      if (e.key === 'Enter' && e.target === this && r.activeElement && r.activeElement.tagName === 'INPUT' && r.activeElement.type !== 'checkbox') { e.preventDefault(); this._submit(); return; }
      if (e.key === 'Tab') {
        var els = Array.prototype.slice.call(r.querySelectorAll('input,button')).filter(function (x) { return !x.disabled; });
        if (!els.length) return;
        var a = els[0], z = els[els.length - 1], cur = r.activeElement;
        if (!cur) { e.preventDefault(); a.focus(); }
        else if (e.shiftKey && cur === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
      }
    }
  }

  if (!customElements.get('straitgate-auth-modal')) customElements.define('straitgate-auth-modal', StraitgateAuthModal);
})();
