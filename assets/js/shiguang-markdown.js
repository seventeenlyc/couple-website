(function (root) {
  'use strict';

  const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const parser = root.marked ? new root.marked.Marked({
    gfm: true,
    breaks: true,
    async: false,
    renderer: {
      // 回复中的 HTML 和图片只作文字显示，不执行或请求外部资源。
      html: token => escapeHtml(token.text),
      image: token => escapeHtml(token.text || '图片')
    }
  }) : null;

  function render(container, markdown) {
    const source = typeof markdown === 'string' ? markdown : '';
    container.classList.add('shiguang-markdown');
    if (!parser || !root.DOMPurify) {
      container.textContent = source;
      container.style.whiteSpace = 'pre-wrap';
      return;
    }
    try {
      const fragment = root.DOMPurify.sanitize(parser.parse(source), {
        RETURN_DOM_FRAGMENT: true,
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'],
        ALLOWED_ATTR: ['href', 'title', 'start'],
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false
      });
      for (const link of fragment.querySelectorAll('a[href]')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      container.style.removeProperty('white-space');
      container.replaceChildren(fragment);
    } catch (_) {
      container.textContent = source;
      container.style.whiteSpace = 'pre-wrap';
    }
  }

  root.ShiguangMarkdown = Object.freeze({ render });
})(window);
