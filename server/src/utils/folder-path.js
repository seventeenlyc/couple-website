// Shared folder-path helpers.
//
// Legacy PHP data (album.json, private_<user>.json) stores folder paths without a
// leading slash ("legacy/child") while folders created through the Node API use a
// leading slash ("/legacy/child"). Until every stored value is migrated, every
// read/modify query must accept both spellings, and every write must use the
// canonical form produced by normalizeFolderPath().

export function normalizePath(p) {
  if (!p || p === '/' || p === '.') return '';
  return String(p).replace(/^\/+|\/+$/g, '');
}

/** Canonical database form: root is '/', everything else is '/a/b'. */
export function normalizeFolderPath(p) {
  const norm = normalizePath(p);
  return norm === '' ? '/' : `/${norm}`;
}

export function escapeLike(str) {
  return (str || '').replace(/([%_\\])/g, '\\$1');
}

/**
 * Every spelling a stored path for the same folder may use:
 * "legacy/child" (legacy PHP) and "/legacy/child" (Node API).
 */
export function folderPathVariants(p) {
  const norm = normalizePath(p);
  if (norm === '') return ['', '/'];
  return [...new Set([norm, `/${norm}`])];
}

/** Variants used to match photo/file rows, which historically also stored a trailing slash. */
export function filePathVariants(p) {
  const norm = normalizePath(p);
  if (norm === '') return ['', '/'];
  return [...new Set([norm, `/${norm}`, `/${norm}/`])];
}
