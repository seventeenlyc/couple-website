/**
 * 手账本 API Client
 * Shared module for all HTML pages - handles CSRF, auth, and API communication.
 */
const API = (() => {
  let csrfToken = null;
  let currentUser = null;
  let userId = null;

  // ── CSRF ──────────────────────────────────────────────
  async function fetchCSRFToken() {
    try {
      const res = await fetch('api/csrf-token.php', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.success) {
        csrfToken = data.csrf_token;
        if (data.user) {
          currentUser = data.user;
          userId = data.user_id;
        }
      }
      return csrfToken;
    } catch (e) {
      console.warn('Failed to fetch CSRF token:', e);
      return null;
    }
  }

  async function getCSRFToken() {
    if (!csrfToken) await fetchCSRFToken();
    return csrfToken;
  }

  // ── Core request helpers ──────────────────────────────
  async function get(url) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.status === 401) return { redirect: 'login' };
      return await res.json();
    } catch (e) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  }

  async function post(url, data = {}) {
    try {
      const token = await getCSRFToken();
      if (token) data.csrf_token = token;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });
      if (res.status === 401) return { redirect: 'login' };
      return await res.json();
    } catch (e) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  }

  /** Form-encoded POST (for login which reads $_POST) */
  async function postForm(url, data = {}) {
    try {
      const token = await getCSRFToken();
      if (token) data.csrf_token = token;

      const body = new URLSearchParams(data);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'same-origin',
        body: body.toString()
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  }

  // ── Auth ──────────────────────────────────────────────
  async function checkAuth() {
    const data = await get('api/ping.php');
    await fetchCSRFToken(); // also loads user if logged in
    return { loggedIn: !!currentUser, user: currentUser, userId: userId };
  }

  function isLoggedIn() { return !!currentUser; }
  function getUser() { return currentUser; }
  function getUserId() { return userId; }

  // ── Toast (uses page's existing showAlert if present) ─
  function toast(msg) {
    if (typeof showAlert === 'function') {
      showAlert(msg);
    } else {
      // Fallback toast
      const el = document.createElement('div');
      el.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-stone-200 font-serif-sc text-stone-700 text-sm transition-all duration-300';
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translate(-50%, -10px)'; }, 1800);
      setTimeout(() => el.remove(), 2200);
    }
  }

  // ── Init ──────────────────────────────────────────────
  async function init() {
    await fetchCSRFToken();
    // Redirect to login if not on login page and not logged in
    const onLoginPage = location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname.endsWith('/');
    if (!onLoginPage && !currentUser) {
      const check = await checkAuth();
      if (!check.loggedIn) {
        window.location.href = 'index.html';
      }
    }
  }

  return { get, post, postForm, checkAuth, isLoggedIn, getUser, getUserId, getCSRFToken, init, toast };
})();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => API.init());
