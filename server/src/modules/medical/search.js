import Database from 'better-sqlite3';

// Explicit bilingual query expansion: a measurable baseline, not a diagnosis model.
const CONCEPTS = [
  [/胃食管反流|反酸|烧心|酸水/g,['reflux','gerd','gastroesophageal']],
  [/高血压|血压高|血压升高/g,['hypertension','high blood pressure']],
  [/糖尿病/g,['diabetes','diabetic']],
  [/低血糖|血糖低/g,['hypoglycemia','low blood glucose']],
  [/糖化血红蛋白|糖化|A1C|HbA1c/gi,['a1c','hemoglobin']],
  [/胰岛素抵抗|糖尿病前期/g,['prediabetes','insulin resistance']],
  [/胰岛素/g,['insulin']],
  [/肾病|肾功能|肾脏|肾衰/g,['kidney','renal']],
  [/脚麻|脚痛|脚部|足部|糖尿病足/g,['foot','feet','neuropathy']],
  [/甲状腺/g,['thyroid']],
  [/贫血/g,['anemia']],
  [/哮喘/g,['asthma']],
  [/慢阻肺|慢性阻塞性肺/g,['copd']],
  [/腹泻|拉肚子/g,['diarrhea']],
  [/便秘/g,['constipation']],
  [/幽门螺杆菌/g,['helicobacter pylori','h pylori']],
  [/胃镜/g,['upper gi endoscopy']],
  [/消化道出血|黑便|吐血/g,['gastrointestinal bleeding']],
  [/胃溃疡|消化性溃疡/g,['peptic ulcer']],
  [/心脏病|冠心病/g,['coronary heart disease']],
  [/中风|脑卒中/g,['stroke']],
  [/胸痛/g,['chest pain','angina','heart attack']],
  [/胆固醇|血脂/g,['cholesterol']],
  [/肥胖|减肥|超重/g,['obesity','overweight','weight loss']],
  [/脂肪肝/g,['fatty liver']],
  [/尿路感染|膀胱炎/g,['urinary tract infection','bladder infection']],
  [/酮症酸中毒/g,['ketoacidosis']],
  [/多囊/g,['polycystic']],
  [/睡眠呼吸暂停|打鼾/g,['sleep apnea']],
  [/失眠/g,['insomnia']],
  [/骨质疏松/g,['osteoporosis']],
  [/乳糜泻/g,['celiac']],
  [/肠易激/g,['irritable bowel']],
  [/克罗恩/g,['crohn']],
  [/溃疡性结肠炎/g,['ulcerative colitis']],
  [/恶心|呕吐/g,['nausea','vomiting']],
  [/腹痛|肚子痛|胃痛/g,['abdominal pain']],
  [/头晕/g,['dizziness']],
  [/乏力|疲劳/g,['fatigue']],
  [/心衰/g,['heart failure']],
  [/脱水/g,['dehydration']],
  [/用药|吃什么药/g,['medicines','medications','drugs'],'intent'],
  [/治疗/g,['treatment','treat','therapy'],'intent'],
  [/症状|表现/g,['symptoms'],'intent'],
  [/诊断|确诊|检测|检查/g,['diagnosis','tests','diagnose','testing'],'intent'],
  [/饮食|吃饭|食物|忌口/g,['diet','eating','nutrition'],'intent'],
  [/运动|锻炼/g,['physical activity','exercise'],'intent'],
  [/原因|为什么|病因/g,['causes','cause'],'intent'],
];

function populationOf(doc) {
  const value=`${doc.title} ${doc.url}`.toLowerCase();
  if (/pregnan|gestational|preeclamp/.test(value)) return 'pregnancy';
  if (/infant|newborn/.test(value)) return 'infant';
  if (/children|childhood|pediatric|adolescent|\bchild\b/.test(value)) return 'child';
  if (/\badults?\b/.test(value)) return 'adult';
  return 'unspecified';
}

function requestedPopulation(query, selected='auto') {
  const ages=[...query.matchAll(/(\d{1,3})\s*(岁|个月|月龄)/g)].map(([,n,unit])=>unit==='岁'?(Number(n)<1?'infant':Number(n)<18?'child':'adult'):(Number(n)<12?'infant':'child'));
  const ageScopes=[...new Set(ages)];
  if(selected==='auto'&&ageScopes.length>1) return {conflict:true,message:'问题涉及不同年龄人群，请明确这次要查谁的资料。'};
  if(/婴幼儿|幼儿/.test(query)&&!ageScopes.length) {
    if(['child','infant'].includes(selected)) return {value:selected};
    return {conflict:true,message:'请补充具体年龄，或明确选择儿童／婴儿人群后再检索。'};
  }
  const wordScope=/婴儿|新生儿|宝宝/.test(query)?'infant':/青少年|未成年|小朋友|小孩|孩子|儿童|小学生|中学生|学龄前/.test(query)?'child':/成人|成年人/.test(query)?'adult':null;
  const inferred=/孕|妊娠/.test(query)?'pregnancy':ageScopes[0]||wordScope;
  if (selected!=='auto' && inferred && selected!==inferred) return {conflict:true,inferred};
  return {value:selected==='auto'?(inferred||'general'):selected};
}

function safeGroup(group) {
  if (!Array.isArray(group)) throw new Error('检索改写格式不合法');
  const words=group.filter(v=>typeof v==='string').map(v=>v.toLowerCase().match(/[a-z0-9]+/g)?.slice(0,5).join(' ')).filter(Boolean);
  return [...new Set(words)].slice(0,5);
}

export function createMedicalSearch(corpus,{rewrite}={}) {
  const docs=new Map(corpus.prepare('SELECT * FROM medical_documents').all().map(d=>[d.id,{...d,meta:JSON.parse(d.metadata_json),population:populationOf(d)}]));
  const index=new Database(':memory:');
  index.exec(`CREATE VIRTUAL TABLE chunk_fts USING fts5(chunk_id UNINDEXED, title, body, tokenize='porter unicode61');`);
  const chunks=new Map();
  const insert=index.prepare('INSERT INTO chunk_fts VALUES (?,?,?)');
  index.transaction(()=>{for(const c of corpus.prepare('SELECT * FROM medical_chunks').all()) {
    const d=docs.get(c.document_id); if(!d) continue;
    chunks.set(c.id,c); insert.run(c.id,d.title,c.body);
  }})();
  // Do not cap candidates before applying population filters: otherwise a large
  // adult corpus can hide relevant child/infant material further down the list.
  const queryIndex=index.prepare('SELECT chunk_id, bm25(chunk_fts,0,4,1) AS rank FROM chunk_fts WHERE chunk_fts MATCH ? ORDER BY rank');
  const publicDoc=d=>({id:d.id,title:d.title,url:d.url,population:d.population,region:d.meta.applicable_region??null,reviewedAt:d.meta.clinical_reviewed_at??null,clinicalReviewStatus:d.clinical_review_status,source:d.meta.source||new URL(d.url).hostname,language:d.meta.language||'en'});
  return {
    stats:()=>({documents:docs.size,chunks:chunks.size,populations:Object.fromEntries(['adult','child','infant','pregnancy','unspecified'].map(p=>[p,[...docs.values()].filter(d=>d.population===p).length])),modelRewriteAvailable:!!rewrite,clinicalReviewPerformed:false}),
    document:id=>{const d=docs.get(id);return d?{...publicDoc(d),body:d.body_markdown}:null;},
    async search({query='',population='auto',mode='local',limit=5}={}) {
      if(typeof query!=='string'||!query.trim()||query.length>500) throw new Error('请输入1至500字的问题');
      if(!['auto','general','adult','child','infant','pregnancy'].includes(population)) throw new Error('人群选项不合法');
      if(!['local','model'].includes(mode)) throw new Error('检索模式不合法');
      query=query.trim();
      const started=performance.now();const scope=requestedPopulation(query,population);
      const trace={mode,population:scope.value||null,scopeBasis:'由标题与来源URL识别专属人群；未标明不代表确认适用',ftsQuery:'',groups:[],excluded:0,elapsedMs:0};
      if(scope.conflict) return {status:'clarify',message:scope.message||'问题中的人群与筛选条件冲突，请调整后重试。',hits:[],trace};
      let groups;
      if(mode==='model') {
        if(!rewrite) throw new Error('模型改写未配置，请使用本地词表模式');
        const rewritten=await rewrite(query);
        if(!Array.isArray(rewritten.groups)||rewritten.groups.length>6) throw new Error('检索改写格式不合法');
        groups=rewritten.groups.map(safeGroup).filter(g=>g.length);
        trace.rewriteModel=rewritten.model;
      } else {
        const matches=CONCEPTS.filter(([pattern])=>{pattern.lastIndex=0;return pattern.test(query);});
        // An intent such as diet or treatment is not an identified disease.
        // Never hide an unknown Chinese condition by searching that intent alone.
        groups=matches.some(([, ,kind])=>kind!=='intent')?matches.map(([,terms])=>terms):[];
        if(!groups.length && !/[\u3400-\u9fff]/.test(query)) groups=query.toLowerCase().match(/[a-z0-9]+/g)?.slice(0,12).map(x=>[x])||[];
      }
      groups=[...new Map(groups.map(g=>[g.join('|'),g])).values()].slice(0,6);
      if(!groups.length) return {status:'unmapped',message:mode==='model'?'模型改写未识别到可检索的医学概念。':'本地词表未覆盖这个中文表达。可换一种说法或选择模型改写实验。',hits:[],trace};
      trace.groups=groups;
      trace.ftsQuery=groups.map(g=>`(${g.map(t=>`"${t}"`).join(' OR ')})`).join(' AND ');
      const rows=queryIndex.all(trace.ftsQuery);trace.candidateChunks=rows.length;
      const hits=[];const seen=new Set();
      for(const row of rows) {
        const c=chunks.get(row.chunk_id),d=docs.get(c.document_id);
        const allowed=scope.value==='general'?['unspecified','adult'].includes(d.population):['unspecified',scope.value].includes(d.population);
        if(!allowed) {trace.excluded++;continue;}
        const title=d.title.toLowerCase();
        const lexical=-row.rank;
        let score=lexical/(1+lexical);
        // Reward documents whose titles cover several independent concepts;
        // short glossary definitions should not dominate substantive articles.
        score+=groups.filter(g=>g.some(t=>title.includes(t))).length*2;
        if(d.population===scope.value) score+=0.5;
        if(/^dictionary/i.test(title)) score*=0.35;
        if(/clinical trials/i.test(title)&&!/试验|trial/i.test(query)) score*=0.4;
        hits.push({...publicDoc(d),documentId:d.id,chunkId:c.id,text:c.body,start:c.start_offset,end:c.end_offset,score});
      }
      hits.sort((a,b)=>b.score-a.score);
      const unique=hits.filter(h=>{const key=h.url.replace(/\/all-content\/?$/,'').replace(/\/$/,'');if(seen.has(key)) return false;seen.add(key);return true;}).slice(0,Math.max(1,Math.min(10,Number(limit)||5)));
      trace.elapsedMs=Math.round(performance.now()-started);trace.scoreMeaning='BM25加标题概念覆盖与人群倾向的排序分数，不代表医学正确率或置信度';
      return {status:unique.length?'found':'not_found',message:unique.length?'找到相关资料，仍需核对适用条件。':'没有找到同时满足检索词与人群条件的正文。',hits:unique,trace};
    },
    close:()=>index.close()
  };
}
