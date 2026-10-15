/**
 * 复审回归：内联事件处理器中的插值必须可被正确解析并收敛到唯一安全写法。
 *
 * 复审缺陷（P2）：原检查用的正则 /onclick\s*=\s*["'][^"']*\$\{/g 会在遇到 HTML 双引号
 * 属性内部的 JS 单引号时提前停止，因此漏报了 desktop 12 处、H5 15 处真实存在的插值，
 * 使“0 处变量插值”的断言与报告不成立。
 *
 * 本测试改为按 HTML 属性语义解析（引号种类决定属性边界），并验证：
 *   1. 内联处理器里出现的每一个 ${...} 都是 safeInlineArg(...) 包起来的；
 *   2. 传入的表达式只允许取记录 ID 字段，不允许把标题/名称/描述等自由文本拼进事件代码；
 *   3. 双端都定义了 safeInlineArg，且转义同时覆盖 JS 字符串与 HTML 属性两种上下文。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const TARGETS = [
  { name: 'desktop/js/app.js', file: 'desktop/js/app.js' },
  { name: 'h5/js/app.js', file: 'h5/js/app.js' }
];

/**
 * 按 HTML 属性语义扫描内联事件处理器：属性值从起始引号一直到下一个同种引号为止，
 * 因此双引号属性内部的单引号不会提前结束属性（这正是老正则漏报的原因）。
 */
function scanInlineHandlerAttributes(source) {
  const found = [];
  const head = /\bon[a-z]+\s*=\s*(["'])/g;
  let m;
  while ((m = head.exec(source)) !== null) {
    const quote = m[1];
    const valueStart = m.index + m[0].length;
    const valueEnd = source.indexOf(quote, valueStart);
    if (valueEnd === -1) continue;
    const value = source.slice(valueStart, valueEnd);
    found.push({
      attribute: source.slice(m.index, valueEnd + 1),
      value,
      line: source.slice(0, m.index).split('\n').length
    });
    head.lastIndex = valueEnd + 1;
  }
  return found;
}

test('Inline event handler interpolation is parsed correctly and constrained to safeInlineArg(id)', async (t) => {
  for (const target of TARGETS) {
    await t.test(`${target.name}: every inline-handler interpolation is safeInlineArg(<record id>)`, () => {
      const source = fs.readFileSync(path.join(rootDir, target.file), 'utf8');
      const handlers = scanInlineHandlerAttributes(source);
      const withInterpolation = handlers.filter((h) => h.value.includes('${'));

      // 老正则在这些文件上命中 0 处；正确解析必须能看到真实存在的插值。
      assert.ok(
        withInterpolation.length > 0,
        `${target.name}: parser must actually see the real inline interpolations`
      );

      const expressions = [];
      for (const handler of withInterpolation) {
        const matches = [...handler.value.matchAll(/\$\{([^{}]*)\}/g)];
        for (const match of matches) {
          expressions.push({ expr: match[1].trim(), line: handler.line, attribute: handler.attribute });
        }
      }

      assert.equal(
        expressions.length,
        (source.match(/safeInlineArg\(/g) || []).length - 1, // 减掉 safeInlineArg 的定义本身
        `${target.name}: every inline-handler interpolation must be wrapped exactly once`
      );

      for (const { expr, line, attribute } of expressions) {
        assert.match(
          expr,
          /^safeInlineArg\(\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\)$/,
          `${target.name}:${line} inline handler interpolation must use safeInlineArg(...): ${attribute}`
        );
        assert.match(
          expr,
          /\.(id|file_id|note_id|device_id|task_id)\s*\)$/,
          `${target.name}:${line} only record ID fields may be interpolated into inline handlers: ${attribute}`
        );
      }
    });
  }

  await t.test('both frontends define safeInlineArg with JS-string and HTML-attribute escaping', () => {
    for (const target of TARGETS) {
      const source = fs.readFileSync(path.join(rootDir, target.file), 'utf8');
      assert.match(
        source,
        /function safeInlineArg\(value\)\s*\{\s*return escapeForAttr\(escapeJsString\(value\)\);\s*\}/,
        `${target.name} must define safeInlineArg as escapeForAttr(escapeJsString(value))`
      );
      assert.match(source, /function escapeJsString\(/, `${target.name} must keep escapeJsString`);
      assert.match(source, /function escapeForAttr\(/, `${target.name} must keep escapeForAttr`);
    }
  });

  await t.test('safeInlineArg preserves the original value while removing quote/backslash/entity breakouts', () => {
    // 与产品实现完全一致的等价实现，用于验证转义语义（属性经 HTML 解码后仍需是合法 JS 字符串字面量）
    const escapeForAttr = (str) => String(str || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapeJsString = (str) => String(str || '')
      .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
      .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    const safeInlineArg = (value) => escapeForAttr(escapeJsString(value));

    const payloads = [
      "photo'+(window.__xss=1)+'",
      'a"b',
      'back\\slash',
      '&quot;&#39;',
      '<img src=x onerror=alert(1)>',
      'line\nbreak',
      '中文-正常_id.1'
    ];

    const htmlDecode = (s) => s
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    for (const payload of payloads) {
      const encoded = safeInlineArg(payload);
      // 1) 编码结果里不得再出现能提前闭合属性或字符串的裸字符
      assert.ok(!encoded.includes('"'), `must not leave a raw double quote: ${encoded}`);
      assert.ok(!encoded.includes("'"), `must not leave a raw single quote: ${encoded}`);
      assert.ok(!encoded.includes('\n'), 'must not leave a raw newline');
      // 2) 经 HTML 解码后，必须是一个合法的单引号 JS 字符串字面量，且值等于原始 payload
      const decoded = htmlDecode(encoded);
      const evaluated = Function(`"use strict"; return '${decoded}';`)();
      assert.equal(evaluated, payload, `round-trip must preserve the original value for ${JSON.stringify(payload)}`);
    }
  });
});
