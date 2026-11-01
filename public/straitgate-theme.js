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
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch { /* Keep theme for this page. */ }
      update();
    }));
    update();
  });
  system.addEventListener('change', () => { if (!root.dataset.theme) update(); });
})();
