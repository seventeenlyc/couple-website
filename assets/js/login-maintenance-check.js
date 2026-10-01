(async () => {
  try {
    const target = new URL('maintaining.html', window.location.href);
    const response = await fetch(target.href, { method: 'HEAD', redirect: 'manual', cache: 'no-store' });
    // A login redirect is not evidence that a maintenance page exists.
    if (response.status === 200 && !response.redirected && response.type !== 'opaqueredirect' && response.url === target.href) {
      window.location.href = target.href;
    }
  } catch (_) { /* A failed availability check must never block login. */ }
})();
