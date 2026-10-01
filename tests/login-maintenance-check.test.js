const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/login-maintenance-check.js'), 'utf8');
(async () => {
  for (const path of ['/', '/index.html']) {
    for (const response of [
      {status: 0, type: 'opaqueredirect', redirected: false, url: ''},
      {status: 302, redirected: false, url: 'https://example.test/maintaining.html'},
      {status: 200, redirected: true, url: 'https://example.test/index.html'},
      {status: 404, redirected: false, url: 'https://example.test/maintaining.html'},
      new Error('Network failure'),
    ]) {
      const location = {href: 'https://example.test' + path}; const original = location.href;
      await vm.runInNewContext(source, {URL, window: {location}, fetch: async (url, options) => {
        assert.equal(options.redirect, 'manual'); assert.equal(options.cache, 'no-store');
        if (response instanceof Error) throw response; return response;
      }});
      assert.equal(location.href, original, 'login must not navigate for redirects/errors');
    }
  }
  const location={href:'https://example.test/index.html'};
  await vm.runInNewContext(source,{URL,window:{location},fetch:async url=>({status:200,redirected:false,type:'basic',url})});
  assert.equal(location.href,'https://example.test/maintaining.html');
  console.log('PASS: maintenance success, login redirect, opaque redirect, 404 and network errors');
})();
