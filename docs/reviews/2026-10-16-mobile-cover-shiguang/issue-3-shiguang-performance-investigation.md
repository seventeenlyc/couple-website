# Issue 3: 拾光对话历史加载性能调查

## 目标
测量并修复拾光对话历史显示/检索的慢速问题,区分聊天历史加载、检索操作和模型响应各自的耗时。

## 当前进度 (2026-10-16)

### ✅ 已完成

1. **前端调查**
   - 位置:`h5/js/app.js` 行 3238-3400
   - 发现:`agentChatHistory` 是纯内存数组(行40),无独立历史加载机制
   - API调用:`h5/js/api-client.js` 行 1391-1406,简单POST到 `/api/agent/chat`
   - **结论**:前端无性能瓶颈,历史记录直接随请求发送,无缓存或优化

2. **后端定位**
   - 找到处理函数:`server/src/modules/ai/ai.service.js` `chatWithCoupleAgent` 行 599-839
   - 路由位置:`server/src/compat/content-routes.js` 行 846

3. **性能埋点添加** ✅
   - 在 `chatWithCoupleAgent` 函数开始位置添加计时器初始化(行 599-605):
     ```javascript
     const perfStart = Date.now();
     const perfLog = { setup: 0, retrieval: 0, local: 0, total: 0 };
     ```
   
   - Setup阶段计时(行 641-644):
     ```javascript
     perfLog.setup = Date.now() - perfStart;
     const retrievalStart = Date.now();
     ```
   
   - Retrieval阶段计时(行 726-729):
     ```javascript
     perfLog.retrieval = Date.now() - retrievalStart;
     const localStart = Date.now();
     ```
   
   - 各分支出口计时:
     - 留言草稿(行 750-753)
     - 找到回忆(行 795)
     - 未找到回忆(行 809)
     - 约会规划(行 829)
     - 情绪共情(行 848)
     - 疲惫安慰(行 863)
     - 默认指引(行 869)
   
   - 日志格式:
     ```javascript
     console.log(`[Shiguang Performance] total=${perfLog.total}ms setup=${perfLog.setup}ms retrieval=${perfLog.retrieval}ms local=${perfLog.local}ms (local:branch_name)`);
     ```

4. **测试脚本创建** ✅
   - 位置:`server/test-shiguang-perf.js`
   - 测试四种查询类型:
     - default_guide: 你好
     - memory_search: 找一段厦门旅行的照片
     - whisper_draft: 帮我写一句想念的话
     - date_plan: 想想周末怎么过
   - **要求**:需要从浏览器DevTools提取 `couple_session` cookie
   - 使用方法:
     ```bash
     SESSION_COOKIE=<your-cookie> node test-shiguang-perf.js
     ```

### 🔄 待完成

1. **基线性能测量**
   - [ ] 在浏览器登录后提取session cookie
   - [ ] 运行测试脚本获取基线性能数据
   - [ ] 记录四种查询类型的 total/setup/retrieval/local 耗时分布
   - [ ] 识别主要瓶颈在哪个阶段

2. **性能优化**
   - [ ] 根据测量结果选择优化策略:
     - 如果 retrieval 慢:考虑添加索引、缓存相册/故事数据
     - 如果 local 慢:优化意图判断逻辑、草稿生成
     - 如果 setup 慢:优化上下文准备、数据库查询
   - [ ] 实施优化方案
   - [ ] 重新测量验证改进效果

3. **文档记录**
   - [ ] 记录优化前后性能对比
   - [ ] 说明采用的优化策略和原理
   - [ ] 更新到总报告

## 技术要点

### 性能分解
```
┌─────────────────────────────────────────────────────────┐
│ Total Response Time                                     │
├─────────────┬─────────────────┬─────────────────────────┤
│ Setup       │ Retrieval       │ Local Processing        │
│             │                 │                         │
│ • 用户验证  │ • 相册照片查询  │ • 意图判断              │
│ • 上下文准备│ • 故事事件查询  │ • 草稿生成              │
│ • 情侣信息  │ • 关键词匹配    │ • 回复组装              │
│ • 纪念日计算│ • 匹配质量评估  │                         │
└─────────────┴─────────────────┴─────────────────────────┘
```

### 无LLM调用
当前实现是**纯本地规则引擎**,不涉及外部AI模型调用:
- 意图判断:关键词匹配(`/留言|想说|悄悄话/`, `/周末|约会|出去玩/`等)
- 检索:直接SQL查询相册和故事表
- 回复生成:模板字符串拼接
- **因此不存在"模型响应时间"维度**

### 潜在优化点
根据代码结构分析,可能的性能瓶颈:
1. **Retrieval阶段**:
   - `searchMemoryByKeyword()` 可能执行多次数据库查询
   - 未发现缓存机制
   - 全表扫描相册照片和故事事件
2. **Setup阶段**:
   - `getCoupleData()` 每次重新查询
   - `calculateAnniversaryDays()` 可能有重复计算
3. **Local阶段**:
   - 意图判断正则串行执行
   - 草稿生成模板字符串拼接开销小

## 下一步
**需要用户操作**:
1. 在浏览器访问 http://127.0.0.1:19085 并登录
2. 打开DevTools > Application > Cookies
3. 复制 `couple_session` cookie值
4. 运行:`SESSION_COOKIE=<cookie值> node test-shiguang-perf.js`
5. 提供测试结果以便分析瓶颈
