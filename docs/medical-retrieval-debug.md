# 拾光中文资料检索台

日期：2026-10-15。当前阶段：本地只读检索调试；没有接入医疗回答生成或外部医疗智能体。

## 运行

在项目根目录运行：

```powershell
node server/scripts/medical-debug.js
```

浏览器访问 http://127.0.0.1:19086 。默认读取 `server/data/medical-knowledge.db`，不改写资料库。主站19085端口不受影响。

可选模型改写实验沿用本地已有模型配置，密钥不发给浏览器：

```powershell
node server/scripts/medical-debug.js --config-db server/data/couple.db
```

只将当前输入问题发送到已配置模型；不发送情侣资料、正文、数据库路径或完整聊天。模型只返回英文检索概念；失败、截断或不合法JSON会显示错误，不静默切回本地检索。

## 检索行为与限制

- 本地基线使用显式中英医学概念词表、SQLite FTS5 Porter词干检索。不同概念使用AND，同义词使用OR。未覆盖的中文表达明确返回unmapped。仅有“饮食／治疗”等通用意图而没有识别到疾病或症状时，不执行宽泛检索。
- 所有候选先按标题/URL识别的人群过滤，再做来源去重和前5条截断。人群支持常见儿童、青少年和明确岁数／月龄表达；婴幼儿等模糊范围要求澄清。未标明不等于已确认适用；资料适用地区未知时保留null。
- 分片标题与正文都参与检索，标题概念覆盖、人群匹配作为排序因素。词典与临床试验页面降低一般问题中的优先级；主题首页与all-content版本合并展示。
- 排名分数不代表医学正确率。全文与片段位置来自原资料库，模型不改写正文。
- 页面显示片段、来源和完整Markdown正文。当前只读显示Markdown源文，不生成中文医疗建议。
- 仅绑定127.0.0.1，拒绝其他Host和跨站Origin；只暴露固定静态文件和资料API。不适合作为公网服务直接部署。
- 尚未实现向量检索、召回结果是否足以回答的判断、医学事实核验或医学内容审核。

## 固定开发集

```powershell
cd server
node --test tests/medical-search.test.js tests/medical-debug-http.test.js tests/medical-rewrite.test.js tests/medical-debug-dom.test.js
node scripts/evaluate-medical-search.js data/medical-knowledge.db
```

数据集在 `server/tests/fixtures/medical-queries.json`，共30题，包含25题人工指定期望来源、4题未覆盖/无匹配表达、1题人群冲突。来源标签是开发者指定的文档URL，不是医生审核的医学结论。不能将这组开发集成绩作为独立测试集或医疗准确率。

固定集第一版前5条命中18/25。调整词形处理、标题覆盖和来源去重后，前5条命中20/25、首条命中17/25。21/25的期望章节URL在库，另4个未收录；缺少具体URL不等同完全没有相关正文。保留缺口，不用更宽泛的来源标签替代失败题。高血压饮食仍存在排序不足。

`server/data/medical-debug-evaluation.json`保存完整排名、改写词、缺口与状态判断，页面可查看。模型改写只做少量真实HTTP连通性检查，尚未跑同一30题对比；向量方案没有评估成绩。

后续应补齐具体来源章节、审核人群与地区、增加独立口语测试集，再比较模型改写和跨语言向量检索。之后才接入强制检索的医疗回答链路。
