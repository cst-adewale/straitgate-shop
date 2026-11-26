(() => {
  const root = document.documentElement;
  const key = 'straitgate-theme';
  let saved = null;
  try { saved = localStorage.getItem(key); } catch { /* Theme still works without storage. */ }
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (system.matches ? 'dark' : 'light');
  function update() {
    document.querySelectorAll('.theme-toggle').forEach(button => {
      const dark = current() === 'dark';
      button.textContent = dark ? '☀' : '☾';
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('title', dark ? 'Light mode' : 'Dark mode');
    });
    document.querySelectorAll('straitgate-auth-modal').forEach(modal => modal.setAttribute('theme', current()));
  }
  function closeMenus(except) {
    document.querySelectorAll('.sg-select-wrap.open').forEach(wrap => {
      if (wrap !== except) {
        wrap.classList.remove('open');
        wrap.querySelector('.sg-select-btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  }
  function syncSelect(select) {
    const wrap = select.closest('.sg-select-wrap');
    if (!wrap) return;
    const btn = wrap.querySelector('.sg-select-btn');
    const menu = wrap.querySelector('.sg-select-menu');
    if (!btn || !menu) return;
    const selected = select.options[select.selectedIndex] || select.options[0];
    const nextText = selected ? selected.textContent : '';
    const sig = Array.from(select.options).map((o, i) => `${i === select.selectedIndex ? '*' : ''}${o.value}:${o.textContent}`).join('|');
    if (wrap.dataset.sgSig === sig && btn.textContent === nextText) return;
    wrap.dataset.sgSig = sig;
    btn.textContent = nextText;
    menu.innerHTML = '';
    Array.from(select.options).forEach((opt, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sg-select-opt';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(idx === select.selectedIndex));
      item.textContent = opt.textContent;
      item.addEventListener('click', e => {
        e.stopPropagation();
        if (select.selectedIndex !== idx) {
          select.selectedIndex = idx;
          select.dispatchEvent(new Event('change', {bubbles: true}));
        }
        syncSelect(select);
        closeMenus();
      });
      menu.appendChild(item);
    });
  }
  function enhanceSelects(rootNode = document) {
    if (typeof document === 'undefined' || !document.createElement) return;
    rootNode.querySelectorAll?.('select:not(.sg-select-native)').forEach(select => {
      const wrap = document.createElement('div');
      const isAuto = select.classList.contains('sort-select') || select.hasAttribute('data-metric-period') || select.hasAttribute('data-qs') || select.id === 'iorder' || select.id === 'qp' || (select.getAttribute('style') || '').includes('width:auto');
      wrap.className = 'sg-select-wrap' + (isAuto ? ' sg-auto' : '');
      if (select.style.maxWidth) wrap.style.maxWidth = select.style.maxWidth;
      if (select.style.minWidth) wrap.style.minWidth = select.style.minWidth;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sg-select-btn';
      if (select.style.height) btn.style.height = select.style.height;
      if (select.style.fontSize) btn.style.fontSize = select.style.fontSize;
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      if (select.getAttribute('aria-label')) btn.setAttribute('aria-label', select.getAttribute('aria-label'));
      const menu = document.createElement('div');
      menu.className = 'sg-select-menu';
      menu.setAttribute('role', 'listbox');
      select.parentNode.insertBefore(wrap, select);
      select.classList.add('sg-select-native');
      select.tabIndex = -1;
      wrap.append(select, btn, menu);
      syncSelect(select);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const willOpen = !wrap.classList.contains('open');
        closeMenus(wrap);
        if (willOpen) syncSelect(select);
        wrap.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
      select.addEventListener('change', () => syncSelect(select));
    });
  }
  document.addEventListener('click', () => closeMenus());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch { /* Keep theme for this page. */ }
      update();
    }));
    update();
    enhanceSelects();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      let scheduled = false;
      const observer = new MutationObserver(mutations => {
        if (scheduled) return;
        const relevant = mutations.some(m => !m.target.closest?.('.sg-select-menu'));
        if (!relevant) return;
        scheduled = true;
        requestAnimationFrame(() => {
          observer.disconnect();
          try {
            enhanceSelects();
            document.querySelectorAll('select.sg-select-native').forEach(syncSelect);
          } finally {
            scheduled = false;
            observer.observe(document.body, {childList: true, subtree: true});
          }
        });
      });
      observer.observe(document.body, {childList: true, subtree: true});
    }
  });
  system.addEventListener('change', () => { if (!root.dataset.theme) update(); });
})();
