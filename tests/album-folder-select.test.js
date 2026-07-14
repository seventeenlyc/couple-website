const test = require('node:test');
const assert = require('node:assert/strict');
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
