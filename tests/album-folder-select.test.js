const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildOptions } = require('../assets/js/album-folder-select.js');

const folders = [
    { name: '26.7.13', path: 'Date/26.7/26.7.13' },
    { name: 'Date', path: 'Date' },
    { name: '26.7', path: 'Date/26.7' },
];

test('lists every folder level and selects the current nested folder', () => {
    const result = buildOptions(folders, 'Date/26.7/26.7.13');

    assert.deepEqual(result.options, [
        { value: '', label: '根目录' },
        { value: 'Date', label: 'Date' },
        { value: 'Date/26.7', label: 'Date / 26.7' },
        { value: 'Date/26.7/26.7.13', label: 'Date / 26.7 / 26.7.13' },
    ]);
    assert.equal(result.selectedValue, 'Date/26.7/26.7.13');
});

test('falls back to root when the current path is unavailable', () => {
    const result = buildOptions(folders, 'Missing/Folder');

    assert.equal(result.selectedValue, '');
});

test('refreshes the current album folder after a successful upload', () => {
    const albumHtml = fs.readFileSync(path.join(__dirname, '..', 'album.html'), 'utf8');
    const submitUpload = albumHtml.match(/async function submitUpload\(\) \{[\s\S]*?\n        \}/);

    assert.ok(submitUpload, 'submitUpload function should exist');
    assert.match(submitUpload[0], /setTimeout\(\(\) => loadAlbum\(currentPath\), 600\)/);
    assert.doesNotMatch(submitUpload[0], /location\.reload\(\)/);
});
