// Static design assets only. No application imports, personal media, or API requests.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, 'artboards'), { recursive: true });
const c = { bg: '#F7F5F1', surface: '#FFFEFC', ink: '#252422', muted: '#68635E', accent: '#883E4A', line: '#DED9D2', subtle: '#EFECE6', border: '#938B83', success: '#34634B', warning: '#795318', danger: '#AA303C' };
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const txt = (x, y, value, size = 16, fill = c.ink, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const rect = (x, y, w, h, fill, rx = 0, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke = c.line) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}"/>`;
const btn = (x, y, w, label, primary = false) => rect(x, y, w, 44, primary ? c.accent : c.surface, 8, primary ? '' : `stroke="${c.border}"`) + txt(x + w / 2, y + 28, label, 16, primary ? '#FFFFFF' : c.ink, 'text-anchor="middle" font-weight="500"');
const arrow = (x, y, direction = 'right', fill = c.muted) => `<path d="${direction === 'right' ? 'M0 0l6 6-6 6' : 'M6 0L0 6l6 6'}" transform="translate(${x} ${y})" fill="none" stroke="${fill}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
const folderIcon = (x, y) => `<path d="M0 4V1h8l3 3h11v15H0Z" transform="translate(${x} ${y})" fill="none" stroke="${c.muted}" stroke-width="1.6" stroke-linejoin="round"/>`;
const photo = (x, y, w, h, motif = 'coast', radius = 4, contain = false) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid ${contain ? 'meet' : 'slice'}" style="border-radius:${radius}px;overflow:hidden"><use href="#${motif}"/></svg>`;
const defs = `<defs>
  <style>text{font-family:"Microsoft YaHei","PingFang SC",sans-serif} .serif{font-family:SimSun,"Songti SC",serif}</style>
  <g id="coast">
    <rect width="1000" height="640" fill="#D8E3E1"/>
    <circle cx="776" cy="148" r="56" fill="#EEE3CF"/>
    <path d="M0 365Q135 240 272 308T540 282L668 397H0Z" fill="#A5B8AF"/>
    <path d="M0 370Q300 351 600 374T1000 369V640H0Z" fill="#71908B"/>
    <path d="M-30 538Q213 447 432 484T1020 480V640H0Z" fill="#D9CAB6"/>
    <path d="M0 522Q203 434 431 468T1000 460" fill="none" stroke="#EBEAE0" stroke-width="12"/>
    <path d="M633 389l131-4m-331 23l66-2m278 26l142-3" stroke="#BFCFC9" stroke-width="3"/>
    <path d="M91 640l32-85 24 29 10-89 40 84 39-37 28 98" fill="#627B64"/>
  </g>
  <g id="street">
    <rect width="1000" height="640" fill="#D5DCCF"/>
    <rect y="495" width="1000" height="145" fill="#B2ADA1"/>
    <path d="M35 125h310v370H35Z" fill="#C7AB8D"/>
    <path d="M348 40h310v455H348Z" fill="#E1CFB3"/>
    <path d="M660 157h318v338H660Z" fill="#B69079"/>
    <path d="M0 496h1000" stroke="#8D8374" stroke-width="6"/>
    <path d="M86 195h72v109H86zm128 0h72v109h-72zm185-84h69v108h-69zm125 0h69v108h-69zm-125 159h69v108h-69zm125 0h69v108h-69zm194-44h76v116h-76zm130 0h76v116h-76z" fill="#5F716A"/>
    <path d="M117 397h101v98H117zm329 19h112v79H446zm283-5h154v84H729z" fill="#786F60"/>
    <path d="M15 544h970M60 596h880" stroke="#DAD2C3" stroke-width="3"/>
    <path d="M859 536V287" stroke="#5A6551" stroke-width="18"/>
    <ellipse cx="858" cy="259" rx="95" ry="100" fill="#798A68"/>
  </g>
  <g id="coffee">
    <rect width="1000" height="640" fill="#E5DBCD"/>
    <path d="M0 440L1000 96v544H0Z" fill="#B99979"/>
    <path d="M0 504L1000 161M0 573L1000 230" stroke="#A1866D" stroke-width="4"/>
    <ellipse cx="483" cy="412" rx="213" ry="103" fill="#D5C6B1"/>
    <path d="M632 294q147-44 143 51t-143 43" fill="none" stroke="#EEE8DE" stroke-width="28"/>
    <path d="M315 262v128q159 127 319 0V262" fill="#F1EBDF"/>
    <ellipse cx="474" cy="261" rx="159" ry="65" fill="#D2BE9F"/>
    <ellipse cx="474" cy="266" rx="134" ry="47" fill="#725947"/>
    <path d="M450 273q-60-38-24-50 24-8 48 26 27-34 54-24 32 14-53 55Z" fill="#DCC7A6"/>
    <path d="M156 474l65 72 87-91-62-75Z" fill="#EFE8DC"/>
    <path d="M759 24l-7 161" stroke="#6E7B58" stroke-width="7"/>
    <path d="M752 143q-107-75-60-102 76 13 60 102m5-52q33-117 93-89 6 76-93 89" fill="#8A9470"/>
  </g>
  <g id="flowers">
    <rect width="1000" height="640" fill="#D9DACE"/>
    <rect y="486" width="1000" height="154" fill="#B6B59E"/>
    <path d="M365 393h280l-42 215H410Z" fill="#BCA17F"/>
    <path d="M503 403L393 207m117 196L574 160m-61 237L709 267m-199 115L281 291" stroke="#6C7957" stroke-width="12"/>
    <path d="M461 328q-124-28-92 29 55 30 92-29m97-41q74-83 97-18-34 62-97 18m-162 40q-106-4-120-82 89-8 120 82" fill="#899476"/>
    <g fill="#AD6970"><circle cx="370" cy="190" r="43"/><circle cx="420" cy="190" r="43"/><circle cx="395" cy="151" r="43"/><circle cx="395" cy="227" r="43"/></g>
    <g fill="#E5D6B7"><circle cx="550" cy="140" r="42"/><circle cx="601" cy="140" r="42"/><circle cx="575" cy="105" r="42"/><circle cx="575" cy="179" r="42"/></g>
    <g fill="#C29682"><circle cx="686" cy="251" r="38"/><circle cx="733" cy="251" r="38"/><circle cx="710" cy="218" r="38"/><circle cx="710" cy="284" r="38"/></g>
    <circle cx="395" cy="190" r="18" fill="#D4B085"/><circle cx="575" cy="143" r="17" fill="#B29A70"/><circle cx="710" cy="251" r="16" fill="#B28C64"/>
  </g>
</defs>`;
const header = active => {
  let out = rect(0, 0, 1440, 80, c.bg) + line(0, 79.5, 1440, 79.5) + txt(160, 48, '我们之间', 22, c.ink, 'class="serif"');
  ['日常', '相册', '心愿', '我们'].forEach((label, i) => {
    const x = 568 + i * 88;
    out += txt(x, 48, label, 16, label === active ? c.accent : c.muted, `font-weight="${label === active ? 600 : 400}"`);
    if (label === active) out += rect(x, 64, 32, 2, c.accent, 1);
  });
  return out + btn(1160, 18, 120, '＋ 记录', true);
};
const editorHeader = () => rect(0, 0, 1440, 80, c.bg) + line(0, 79.5, 1440, 79.5) + txt(160, 48, '我们之间', 22, c.ink, 'class="serif"') + txt(1280, 48, '上传照片', 16, c.muted, 'text-anchor="end"');
const footer = code => txt(32, 946, `${code} · 1440 × 960 · 静态设计稿 / 全部内容为模拟`, 12, c.muted);
function save(name, title, body, bg = c.bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">桌面生活画廊静态样稿。文字、日期、人物和矢量场景均为设计模拟，不是实际业务记录。</desc>${defs}${rect(0, 0, 1440, 960, bg)}${body}</svg>`;
  writeFileSync(join(root, 'artboards', name), svg, 'utf8');
}

let daily = header('日常') + txt(380, 158, '我们的日常', 32, c.ink, 'class="serif"') + txt(380, 190, '把一起度过的日子，慢慢留在这里。', 14, c.muted);
daily += photo(380, 220, 680, 435.2, 'coast', 4, true) + txt(380, 689, '那天没有计划，只是一起走了很远。', 20) + txt(380, 719, '2026.09.28 · 海边的一个下午', 14, c.muted) + txt(1060, 719, '查看照片', 14, c.accent, 'text-anchor="end"');
daily += line(380, 747, 1060, 747) + txt(380, 780, '有一封给你的信', 16) + txt(1060, 780, '打开  ↗', 16, c.accent, 'text-anchor="end"') + line(380, 803, 1060, 803);
// The artboard captures the first viewport; the next pair continues below the fold.
daily += txt(380, 852, '九月的几个瞬间', 24, c.ink, 'class="serif"') + photo(380, 876, 328, 209.92, 'coffee', 4, true) + photo(732, 876, 328, 209.92, 'street', 4, true);
save('D01-daily.svg', 'D01 日常 · 居中阅读与照片展签', daily + footer('D01'));

let album = header('相册') + txt(160, 155, '相册', 32, c.ink, 'class="serif"') + txt(160, 189, '把照片放回它们所属的日子。', 14, c.muted) + btn(1040, 126, 88, '管理') + btn(1144, 126, 136, '上传照片', true);
album += txt(160, 241, '全部照片', 16, c.muted) + arrow(238, 229) + txt(260, 241, '2026年', 16, c.muted) + arrow(326, 229) + txt(348, 241, '厦门旅行', 16, c.ink, 'font-weight="500"');
['海边', '街巷', '一起吃饭'].forEach((label, i) => { const x = 160 + i * 156; album += rect(x, 268, 140, 44, c.subtle, 8) + folderIcon(x + 14, 279) + txt(x + 48, 295, label, 16); });
album += txt(1177, 295, '管理文件夹', 14, c.accent) + line(160, 338, 1280, 338);
['全部', '风景', '美食', '抓拍'].forEach((label, i) => { const x = 160 + i * 80; album += (i === 0 ? rect(x, 357, 64, 44, '#F1E4E6', 8) : '') + txt(x + 32, 385, label, 16, i === 0 ? c.accent : c.muted, 'text-anchor="middle"'); });
album += txt(1280, 385, '按已有照片顺序展示', 14, c.muted, 'text-anchor="end"');
const labels = ['海边的下午', '没有目的地的散步', '两杯刚好的咖啡', '带一束花回家'];
const motifs = ['coast', 'street', 'coffee', 'flowers'];
for (let i = 0; i < 4; i++) { const x = 160 + i * 286; album += photo(x, 426, 262, 327.5, motifs[i]) + txt(x, 783, labels[i], 18) + txt(x, 810, `2026.09.${28 - i} · 示意图`, 14, c.muted) + txt(x + 242, 782, '···', 20, c.muted); }
album += line(160, 849, 1280, 849) + txt(160, 884, '照片标题与操作始终位于图外；原图在查看时完整呈现。', 14, c.muted);
save('D03-album.svg', 'D03 相册 · 目录与四列照片', album + footer('D03'));

let viewer = rect(1120, 64, 320, 896, c.bg) + txt(32, 41, '厦门旅行', 16, '#E5E0D8') + txt(560, 41, '1 / 4', 14, '#E5E0D8', 'text-anchor="middle"') + rect(1364, 10, 44, 44, '#393633', 8) + txt(1386, 40, '×', 28, '#FFFFFF', 'text-anchor="middle"');
viewer += photo(108, 183, 904, 578.6, 'coast', 0, true) + rect(24, 445, 44, 44, '#393633', 8) + arrow(41, 461, 'left', '#918A83') + rect(1052, 445, 44, 44, '#393633', 8) + arrow(1071, 461, 'right', '#FFFFFF');
viewer += txt(1152, 129, '海边的下午', 24, c.ink, 'class="serif"') + txt(1152, 167, '2026.09.28', 14, c.muted) + line(1152, 195, 1408, 195) + txt(1152, 235, '那天没有计划，', 16) + txt(1152, 263, '只是一起走了很远。', 16);
viewer += txt(1152, 329, '所在目录', 14, c.muted) + txt(1152, 357, '全部照片 / 2026年 /', 16) + txt(1152, 385, '厦门旅行', 16) + rect(1152, 416, 64, 36, c.subtle, 8) + txt(1184, 440, '风景', 14, c.muted, 'text-anchor="middle"');
viewer += line(1152, 492, 1408, 492) + btn(1152, 516, 256, '移动到文件夹') + txt(1152, 603, '删除照片', 16, c.danger) + txt(1152, 637, '仅在当前身份允许时展示操作', 14, c.muted);
viewer += txt(108, 872, '← → 切换照片       Esc 关闭', 14, '#C7BFB4') + txt(108, 906, '完整比例显示 · 中性矢量示意图', 14, '#C7BFB4') + txt(1152, 910, 'D04 · 静态稿 / 模拟内容', 12, c.muted);
save('D04-viewer.svg', 'D04 大图查看 · 图片与独立信息栏', viewer, '#181716');

let upload = editorHeader() + txt(160, 130, '‹  返回相册', 14, c.accent) + txt(160, 180, '上传照片', 32, c.ink, 'class="serif"') + txt(160, 212, '先确认目的地，再把新的片段留在这里。', 14, c.muted);
upload += rect(160, 248, 704, 138, c.surface, 8, `stroke="${c.border}" stroke-dasharray="5 5"`) + txt(184, 290, '把照片拖到这里，或选择文件', 20) + txt(184, 325, '支持格式、大小与数量按站点实际限制显示', 14, c.muted) + btn(712, 286, 128, '选择照片', true);
upload += txt(160, 436, '已选照片', 20, c.ink, 'font-weight="600"') + txt(864, 436, '1 张已上传 · 1 张上传中 · 1 张失败', 14, c.muted, 'text-anchor="end"');
const queue = [
  { y: 460, name: '海边的下午.jpg', sub: '2.1 MB · 已保存到目标目录', status: '已上传', color: c.success, motif: 'coast' },
  { y: 588, name: '街角的咖啡.jpg', sub: '示例进度：1.8 MB / 2.6 MB · 69%', status: '上传中', color: c.warning, motif: 'coffee' },
  { y: 716, name: '一起走过的街道.jpg', sub: '网络中断 · 这张照片尚未确认上传成功', status: '失败', color: c.danger, motif: 'street' }
];
for (const item of queue) {
  upload += line(160, item.y, 864, item.y) + photo(160, item.y + 16, 72, 80, item.motif) + txt(252, item.y + 38, item.name, 16) + txt(252, item.y + 66, item.sub, 14, c.muted) + txt(864, item.y + 38, item.status, 14, item.color, 'text-anchor="end"');
  if (item.status === '上传中') upload += rect(252, item.y + 83, 480, 4, c.subtle, 2) + rect(252, item.y + 83, 331.2, 4, c.accent, 2);
  if (item.status === '失败') upload += btn(792, item.y + 56, 72, '重试');
}
upload += line(896, 248, 1280, 248) + txt(896, 290, '目标目录', 18, c.ink, 'font-weight="600"') + rect(896, 311, 384, 76, c.surface, 8, `stroke="${c.border}"`) + txt(912, 339, '全部照片 / 2026年 / 厦门旅行', 16) + txt(912, 368, '更改目录', 14, c.accent);
upload += txt(896, 425, '从相册进入，默认使用当前目录。', 14, c.muted) + txt(896, 453, '已上传项会保留，不会随重试再次上传。', 14, c.muted) + rect(896, 495, 384, 100, '#F6EEDC', 8) + txt(912, 530, '上传尚未全部完成', 16, c.warning) + txt(912, 562, '失败项可单独重试，其他文件继续处理。', 14, c.warning);
upload += btn(896, 627, 384, '返回相册核对结果') + txt(896, 709, '关闭页面与取消传输是不同的操作。', 14, c.muted) + txt(896, 737, '当前队列仅用于说明状态与恢复布局。', 14, c.muted);
save('D05-upload.svg', 'D05 上传 · 双区队列与部分失败状态', upload + footer('D05'));

let us = header('我们') + txt(280, 158, '我们', 32, c.ink, 'class="serif"') + txt(280, 192, '关于我们，也关于一起走过的时间。', 14, c.muted);
us += `<circle cx="326" cy="287" r="46" fill="#DDC5B7"/>` + txt(326, 296, '林', 24, '#624F43', 'text-anchor="middle"') + `<circle cx="426" cy="287" r="46" fill="#CCD3BF"/>` + txt(426, 296, '鹿', 24, '#4F624B', 'text-anchor="middle"');
us += txt(504, 272, '小林  &  小鹿', 24, c.ink, 'class="serif"') + txt(504, 309, '恋爱开始日期 · 2025.04.30', 16, c.muted) + line(280, 375, 1160, 375);
us += txt(280, 427, '重要的日子', 24, c.ink, 'class="serif"');
const dates = [['04.30', '在一起的纪念日', '每年这一天'], ['06.18', '小林的生日', '记得说一句生日快乐'], ['11.09', '小鹿的生日', '把这一天留给彼此']];
dates.forEach((row, i) => { const y = 480 + i * 98; us += txt(280, y, row[0], 22, c.ink, 'class="serif"') + txt(392, y, row[1], 18) + txt(392, y + 30, row[2], 14, c.muted) + line(280, y + 53, 800, y + 53); });
const entries = [['我们的故事', '按时间翻看照片与文字'], ['私密空间', '验证后进入自己的笔记与文件'], ['安全与设备', '查看授权与设备状态'], ['账户设置', '已有设置与退出入口']];
entries.forEach((row, i) => { const y = 434 + i * 98; us += txt(848, y, row[0], 18) + txt(848, y + 29, row[1], 14, c.muted) + arrow(1144, y - 12) + line(848, y + 51, 1160, y + 51); });
us += txt(280, 878, '人物、日期与文案均为模拟示例；真实页面使用现有配置与记录。', 14, c.muted);
save('D09-us.svg', 'D09 我们 · 关系信息与日期列表', us + footer('D09'));
console.log('Generated 5 desktop SVG artboards at 1440 × 960.');
