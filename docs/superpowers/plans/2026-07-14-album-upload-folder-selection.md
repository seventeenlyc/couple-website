# Album Upload Folder Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the album upload dialog list every nested album folder and default to the folder currently being viewed.

**Architecture:** Add an opt-in complete-folder-list field to the existing folder API without changing its direct-child `folders` field. Use a small testable JavaScript helper to build safe, sorted select options and let `album.html` render them before selecting `currentPath`.

**Tech Stack:** PHP 8.2, browser JavaScript, Node.js built-in test runner.

## Global Constraints

- Preserve existing album browsing, folder CRUD, photo move, and upload submission behavior.
- Keep the root directory as the first upload destination.
- Display nested paths as `Date / 26.7 / 26.7.13` while submitting the original slash-delimited path.
- Deploy only files required for this bug fix after backing up their online versions.

---

### Task 1: Complete folder list API

**Files:**
- Modify: `includes/folder-helper.php`
- Modify: `api/folders.php`
- Create: `tests/folder-helper-test.php`

**Interfaces:**
- Produces: `getAllFolders(string $dataFile): array`
- Produces: optional JSON response property `all_folders` when `include_all_folders=1`

- [x] **Step 1: Write the failing PHP test**

Create a temporary album JSON document with `Date`, `Date/26.7`, and `Date/26.7/26.7.13`, call `getAllFolders()`, and assert that the returned paths contain all three values in path order.

- [x] **Step 2: Run the test and verify RED**

Run: `php tests/folder-helper-test.php`

Expected: failure because `getAllFolders()` is undefined.

- [x] **Step 3: Implement the helper and API field**

Add `getAllFolders()` to read the `folders` array, discard malformed entries without a string path, sort by natural case-insensitive path order, and return a reindexed array. In `handleList()`, add `all_folders` only when `$_GET['include_all_folders'] === '1'`; keep `folders` unchanged.

- [x] **Step 4: Run the PHP test and syntax checks**

Run: `php tests/folder-helper-test.php`, `php -l includes/folder-helper.php`, and `php -l api/folders.php`.

Expected: test passes and both files report no syntax errors.

### Task 2: Upload selector behavior

**Files:**
- Create: `assets/js/album-folder-select.js`
- Modify: `album.html`
- Create: `tests/album-folder-select.test.js`

**Interfaces:**
- Produces: `AlbumFolderSelect.buildOptions(folders, currentPath)` returning `{ options, selectedValue }`
- Consumes: API property `all_folders`

- [x] **Step 1: Write the failing JavaScript test**

Require `assets/js/album-folder-select.js`, pass an unsorted three-level folder list and current path `Date/26.7/26.7.13`, then assert that root is first, every path is present, the nested label is `Date / 26.7 / 26.7.13`, and `selectedValue` equals the current path. Add a second assertion that an unknown current path falls back to root.

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/album-folder-select.test.js`

Expected: failure because the helper module does not exist.

- [x] **Step 3: Implement the helper and wire the dialog**

Implement a browser/CommonJS helper that normalizes and sorts folder paths, builds root plus nested option descriptors, and selects only an existing current path. Load it before the album inline script. Change `refreshUploadFolders()` to request `include_all_folders=1`, render options with DOM `option` elements, and set the select value to `selectedValue`.

- [x] **Step 4: Run frontend and full local verification**

Run: `node --test tests/album-folder-select.test.js`, `php tests/folder-helper-test.php`, and PHP syntax checks for all modified PHP files.

Expected: all tests pass with zero failures and PHP reports no syntax errors.

### Task 3: Online deployment and verification

**Files:**
- Deploy: `includes/folder-helper.php`
- Deploy: `api/folders.php`
- Deploy: `assets/js/album-folder-select.js`
- Deploy: `album.html`

**Interfaces:**
- Consumes: the live site's existing authenticated album session and album folder data.
- Produces: a live upload selector containing all nested folders with the current folder selected.

- [x] **Step 1: Identify and compare the live site root**

Reconnect over SSH, locate the Nginx document root, and compare checksums/diffs for the four target paths. Stop if unrelated online-only edits overlap the changed sections.

- [x] **Step 2: Back up and deploy only target files**

Create timestamped sibling backups on the server, upload the four files, preserve ownership and permissions, and run server-side PHP syntax checks.

- [x] **Step 3: Verify the live behavior**

Open `Date/26.7/26.7.13`, open the upload dialog, confirm all folder levels are listed and the current path is selected. Upload a small test image only if a disposable fixture is available; otherwise verify the submitted `folder_path` through the browser request payload without creating user content.

- [x] **Step 4: Final regression check**

Confirm root-level upload still defaults to root and normal folder navigation still returns only direct children. If any check fails, restore timestamped backups.
