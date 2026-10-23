# 2026-10-16 Mobile Cover & Shiguang 部署记录

## 部署时间
2026-10-16

## 修复内容

### Issue 1: 移动端封面选择器堆叠问题 ✅
**问题**: 封面选择器弹窗中照片网格堆叠,无法正常滚动浏览

**根因**: `.h5-bottom-sheet` 基础类的 `overflow-y: auto` 与子元素的滚动区域冲突,导致父子同时竞争滚动控制权

**修复**: `h5/index.html` 第 575 行
- 在封面选择器的 `.h5-bottom-sheet` 元素内联样式中添加 `overflow-y: hidden;`
- 确保只有内部的 `#heroPickerGrid` 网格容器处理滚动

```html
<!-- Before -->
<div class="h5-bottom-sheet" style="max-height: 82vh; display: flex; flex-direction: column;">

<!-- After -->
<div class="h5-bottom-sheet" style="max-height: 82vh; display: flex; flex-direction: column; overflow-y: hidden;">
```

**验证**: 
- 打开移动端首页
- 点击封面照片进入封面选择器
- 确认照片网格不再堆叠,可正常滚动选择

---

### Issue 2: 照片查看器添加"设为封面"按钮 ✅
**需求**: 在照片查看器顶部添加快捷按钮,一键将当前照片设为首页封面

**实现**: `h5/index.html` 第 604 行
- 将原 "封面设置" 按钮改为 "设为封面"
- onclick 从 `openHeroChangeMenu()` 改为 `setAsHeroPhoto()`
- 利用已有的 `setAsHeroPhoto()` 函数 (位于 `h5/js/app.js` 第 668-676 行)

```html
<!-- Before -->
<button class="topbar-action-btn" style="color:#ffd166; font-size:13px;" onclick="openHeroChangeMenu()" id="viewerHeroBtn">封面设置</button>

<!-- After -->
<button class="topbar-action-btn" style="color:#ffd166; font-size:13px;" onclick="setAsHeroPhoto()" id="viewerSetCoverBtn">设为封面</button>
```

**验证**:
- 打开任意相册照片进入全屏查看器
- 点击顶部 "设为封面" 按钮
- 确认 toast 提示 "已设为首页封面 ✨"
- 返回首页验证封面已更新

---

### Issue 3: 拾光对话性能监测埋点 🔄
**需求**: 为拾光助手添加性能测量,识别响应延迟瓶颈(历史加载 vs 检索 vs 模型响应)

**实现**: `server/src/modules/ai/ai.service.js` `chatWithCoupleAgent()` 函数
- 添加四阶段计时: setup / retrieval / llm / local
- 在每次响应时输出性能日志

**埋点位置**:
1. **Setup phase** (第 604-625 行): 设备验证、用户查询解析、上下文准备
2. **Retrieval phase** (第 628-631 行): 照片/记忆检索 `searchMemories()`
3. **LLM phase** (第 658-737 行): 大模型API调用
4. **Local phase** (第 741-837 行): 本地引擎响应(悄悄话/约会规划/记忆回顾)

**日志格式**:
```
[Shiguang Performance] total=XXXms setup=XXms retrieval=XXms llm=XXms
[Shiguang Performance] total=XXXms setup=XXms retrieval=XXms local=XXms (local:whisper)
```

**状态**: 
- ✅ 代码埋点已完成
- 🔄 性能基线测量待收集 (需浏览器实测)
- ⏳ 性能优化待后续根据数据实施

**测试指南**: 见 `docs/reviews/2026-10-16-mobile-cover-shiguang/MANUAL-TEST-GUIDE.md`

---

### Issue 4: 移动端首页文案修改 ✅
**修改**: `h5/index.html` 第 145 行
- "九月的几个瞬间" → "日常的几个瞬间"

```html
<!-- Before -->
<span>九月的几个瞬间</span>

<!-- After -->
<span>日常的几个瞬间</span>
```

**验证**: 打开移动端首页,确认章节标题显示 "日常的几个瞬间"

---

## 部署范围

### 前端文件
- `h5/index.html` - 移动端主页 (Issues 1, 2, 4)

### 后端文件
- `server/src/modules/ai/ai.service.js` - AI服务性能埋点 (Issue 3)

### 不相关文件 (保留但不包含在此次部署)
- `assets/js/api-client.js` - 登录画廊相关修改 (其他功能)
- `desktop/login.html` - 桌面端登录 (其他功能)
- `index.html` - 桌面端主页 (其他功能)
- `design/`, `docs/`, `server/test-*.js` - 设计稿、文档、测试脚本 (非生产代码)

---

## 部署步骤

### 1. 提交本地修改
```bash
git add h5/index.html server/src/modules/ai/ai.service.js
git commit -m "fix: mobile cover picker overflow and add quick set-cover button

- Fix h5 cover picker photo grid stacking by preventing parent overflow
- Add 'Set as Cover' button in photo viewer for one-click hero photo update
- Update homepage chapter heading from '九月的几个瞬间' to '日常的几个瞬间'
- Add performance instrumentation to Shiguang chat (setup/retrieval/llm/local timing)

Issues: #1 #2 #3 #4
"
```

### 2. 推送到远程仓库
```bash
git push origin codex/production-login-compat
```

### 3. 生产环境部署
```bash
# SSH 到生产服务器
ssh user@production-server

# 拉取最新代码
cd /opt/couple-website
git fetch origin
git checkout codex/production-login-compat
git pull

# 重启服务 (如使用 PM2)
pm2 restart couple-website

# 验证服务状态
pm2 status
```

### 4. 生产验证清单
- [ ] 移动端访问 https://your-domain.com (或生产URL)
- [ ] 测试封面选择器:打开封面选择器,确认照片不堆叠,可滚动
- [ ] 测试照片查看器:打开任意照片,点击"设为封面",确认成功
- [ ] 检查首页文案:确认显示"日常的几个瞬间"
- [ ] 测试拾光对话:发送一条消息,检查服务器日志是否输出性能数据
- [ ] 回归测试:验证其他功能(相册上传、删除、移动等)未受影响

---

## 回滚方案

如遇问题,执行以下步骤回滚:

```bash
# 方案1: 回滚到上一个稳定commit
cd /opt/couple-website
git log --oneline -5  # 查看最近commits
git checkout <上一个稳定的commit-hash>
pm2 restart couple-website

# 方案2: 切换回主分支
git checkout main
git pull
pm2 restart couple-website
```

---

## 后续工作

### Issue 3 性能优化
根据实际测量数据,实施针对性优化:

**如果 retrieval > 500ms**:
- 添加数据库索引 (photos 表的 date, folder_id, tag 列)
- 优化 `searchMemories()` 查询逻辑
- 实现检索结果缓存

**如果 llm > 2000ms**:
- 实现流式响应UI
- 提前显示"正在思考..."状态
- 考虑使用更快的模型或本地模型

**如果 local > 300ms**:
- 优化本地引擎的数据查询
- 缓存高频访问的相册数据

---

## 技术细节

### CSS Overflow 冲突诊断
弹窗布局结构:
```
.h5-overlay (fixed, full viewport)
└── .h5-bottom-sheet (flex column, max-height: 82vh, overflow-y: auto ← 问题源头)
    ├── .sheet-pill-bar (固定)
    ├── .sheet-title-row (固定)
    └── #heroPickerGrid (flex-grow: 1, overflow-y: auto ← 预期滚动区)
```

**冲突原因**: 父元素 `.h5-bottom-sheet` 的 `overflow-y: auto` 导致:
1. 父子同时可滚动,浏览器渲染引擎无法确定滚动目标
2. `#heroPickerGrid` 的 `flex-grow: 1` 无法正确计算剩余高度
3. 照片网格内容溢出但无法正常触发子元素滚动

**解决方案**: 添加 `overflow-y: hidden` 到父元素内联样式,强制禁用父元素滚动,确保只有子元素 `#heroPickerGrid` 处理滚动事件。

### 照片ID获取逻辑
```javascript
// h5/js/app.js lines 668-676
function setAsHeroPhoto() {
  if (!viewerPhotoList || viewerPhotoList.length === 0) return;
  const photo = viewerPhotoList[currentViewerIndex]; // ← 正确获取当前照片
  if (!photo || !photo.id) return;
  localStorage.setItem('couple_h5_hero_photo_id', photo.id);
  localStorage.removeItem('couple_h5_hero_carousel_ids');
  showToast('已设为首页封面 ✨');
  renderDailyPhotos();
}
```

关键变量:
- `viewerPhotoList`: 当前查看器的照片数组 (来自日常相册或其他相册)
- `currentViewerIndex`: 当前显示照片的索引
- 持久化到 `localStorage` 的 `couple_h5_hero_photo_id` 键

---

## 部署负责人
Claude Code / seventeenlyc

## 部署日期
2026-10-16
