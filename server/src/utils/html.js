/**
 * HTML escaping shared by the compat layer.
 *
 * Escapes `& < > " '` so a value is safe both in HTML text positions and inside
 * quoted attributes. This mirrors the legacy PHP `sanitizeInput()` helper, which
 * stored escaped metadata rather than raw text.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
