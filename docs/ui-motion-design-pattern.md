# 前端 UI 与动效设计模式规范：MSD (Motion State Driver)

> **版本**：1.0.0  
> **适用范围**：Web 前端界面交互、组件微动效、页面转场、列表重排与粒子反馈系统  
> **设计目标**：高帧率（60/120fps）、状态确定性（防止并发重入与跳闪）、无障碍（自动支持 `prefers-reduced-motion`）、零外部重型依赖。

---

## 1. 行业现存模式与方案调研（现成可用性评估）

在设计新模式之前，我们对业界主流的 UI/动效模式与开源方案进行了全面梳理与可用性评估：

| 模式/方案类型 | 代表产品 / 原理 | 核心优势 | 在当前技术栈（Vanilla HTML/JS + Tailwind）下的局限 |
| :--- | :--- | :--- | :--- |
| **FLIP 模式**<br>*(First, Last, Invert, Play)* | GSAP Flip, Vue TransitionGroup 原理 | 完美解决 DOM 结构变动（增删、重排、折叠展开）时的跳动，保持 60fps GPU 逆变换平滑过渡。 | 原理优秀，但原生标准中没有开箱即用的轻量封装，通常需依赖大型第三方库。 |
| **FSM 有限状态机模式** | XState, Stately, 状态设计模式 | 将 UI 组件的可见性与动画生命周期严格约束在 `entering -> active -> exiting -> exited` 互斥态，杜绝快速点击导致的状态冲突。 | 独立使用时概念偏重，需要针对 UI 动效提取轻量级状态控制器。 |
| **Timeline / Choreographer 模式** | GSAP Timeline | 将时间轴从 DOM 节点中解耦，支持交错（Stagger）、链式序列与并行编排。 | GSAP 体积较大（核心及插件 >60KB），有商业授权考量；社区小型库质量参差不齐。 |
| **Object Pool (对象池模式)** | 游戏引擎粒子系统 | 针对点击碎星、爱心雨、飘落物等高频粒子，复用 DOM/Canvas 节点，避免连续 `createElement` 和 GC 垃圾回收卡顿。 | 绝大多数前端业务通常粗暴使用 `setTimeout` 增删 DOM，缺乏标准化封装。 |
| **Framer Motion** | React 专属动效库 | 声明式语法友好，布局动画自动计算。 | 强依赖 React 虚拟 DOM 生态，无法直接用于原生 JS/现代多页应用。 |
| **Tailwind Motion / Animate.css** | 纯 CSS 类库 | 极轻量，直接挂载 CSS 类。 | 无法处理“需要等待退场动画播放完毕再卸载 DOM”的动态交互，无法获取动态坐标。 |
| **Web Animations API (WAAPI)** | 现代浏览器内置原生标准 | 零依赖、直接运行在合成器线程（Compositor Thread），不占主线程 JS 时间片，性能最佳。 | 原生 API 较底层，缺乏状态生命周期和声明式绑定的业务外壳。 |

### 结论与决策
现成方案中：
- **纯 CSS 方案**太弱（无法控制生命周期与退出卸载）；
- **大型第三方库（如 GSAP/Framer Motion）**过重或与当前轻量栈不契合；
- **核心模式（FLIP、FSM 状态机、对象池、WAAPI）**各自解决了局部痛点，但缺乏一套**统一的、轻量的、面向前端工程的整合设计模式**。

因此，我们融合各家之长，新建 **MSD（Motion State Driver，动效状态驱动模式）**。

---

## 2. MSD 模式架构设计

MSD 模式采用 **4 层分离架构**，遵循**单向数据流与分层职责解耦**原则：

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Token Layer (动效设计令牌)                                 │
│    - 时间标尺 (Instant: 100ms, Normal: 260ms, Slow: 400ms)   │
│    - 物理缓动曲线 (Spring, Decelerate Out, Accelerate In)      │
│    - 浏览器无障碍偏好 (prefers-reduced-motion) 自动降级      │
└──────────────────────────────┬──────────────────────────────┘
                               │ 提供参数契约
┌──────────────────────────────▼──────────────────────────────┐
│ 2. State Machine Layer (FSM 动效状态守卫)                   │
│    - 状态流转: UNMOUNTED -> ENTERING -> PRESENT -> EXITING  │
│    - 防重入锁、反转播放、生命周期钩子 (onEntered, onExited)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ 驱动底层变换
┌──────────────────────────────▼──────────────────────────────┐
│ 3. Driver & Engine Layer (底层执行与性能引擎)                │
│    - WAAPI 硬件加速驱动 (Compositor 线程优化)                │
│    - FLIP 布局重排算法 (First -> Last -> Invert -> Play)      │
│    - Particle Object Pool (粒子对象池，零 GC 抖动)           │
└──────────────────────────────┬──────────────────────────────┘
                               │ 暴露调用接口
┌──────────────────────────────▼──────────────────────────────┐
│ 4. Choreographer & Declarative Layer (编排与声明式消费层)    │
│    - HTML 声明式属性: data-motion, data-motion-burst         │
│    - IntersectionObserver 滚动懒执行                         │
│    - Timeline 编排: .add().stagger().play()                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 落地实施文件清单

工作区已落地核心规范与轻量驱动引擎：

1. **样式与令牌层**：[`assets/css/motion-tokens.css`](../assets/css/motion-tokens.css)
   - 定义 CSS 变量（`--motion-duration-*`、`--motion-ease-*`、`--motion-distance-*`）。
   - 内置无障碍适配：系统开启“减少动画”时自动将时长置为 `0.01ms`。
2. **状态与驱动引擎**：[`assets/js/motion-engine.js`](../assets/js/motion-engine.js)
   - 暴露全局单例 `window.Motion`。
   - 体积仅约 5KB，原生零依赖。

---

## 4. 核心使用范式与模式对比

### 场景 1：弹窗/面板的进场与退场（解决打断与提前销毁）

#### ❌ 传统混乱写法：
```javascript
// 极易因重复点击导致样式错乱；关闭时 DOM 直接被隐藏，看不到退场动画
openBtn.onclick = () => modal.classList.add('show');
closeBtn.onclick = () => modal.classList.remove('show');
```

#### ✅ MSD 状态机模式写法：
```javascript
const modalController = Motion.createStateMachine(modalElement, {
  enterDuration: Motion.tokens.duration.normal,
  exitDuration: Motion.tokens.duration.fast,
  enterEase: Motion.tokens.ease.spring,
  exitEase: Motion.tokens.ease.in,
  onExited: (el) => console.log('完全退场并安全隐藏')
});

openBtn.onclick = () => modalController.enter();
closeBtn.onclick = () => modalController.exit();
```

---

### 场景 2：列表增删与排序（FLIP 平滑重排）

#### ❌ 传统写法：
```javascript
// 列表直接瞬移跳变，视觉极为生硬
container.appendChild(newCard);
```

#### ✅ MSD FLIP 模式写法：
```javascript
const items = Array.from(container.children);

// 自动测量前后位置，并由 GPU transform 完成丝滑补间动画
await Motion.flip(items, () => {
  container.prepend(newCard); // 执行真实的 DOM 操作
}, {
  duration: Motion.tokens.duration.normal,
  easing: Motion.tokens.ease.spring
});
```

---

### 场景 3：点击微交互与粒子爆发（对象池防卡顿）

#### ❌ 传统写法（如原 `shop-effects.js`）：
```javascript
// 每次点击生成 8~12 个 div，几百毫秒后 remove()
// 高频连续点击时触发高频内存分配与垃圾回收(GC)，导致掉帧
for (let i = 0; i < 8; i++) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}
```

#### ✅ MSD 对象池模式写法：
```html
<!-- 方式 A：纯 HTML 声明式，零 JS 代码 -->
<button class="btn-primary" data-motion-burst="stars">点赞</button>
<button class="btn-danger" data-motion-burst="hearts">兑换奖励</button>
```
```javascript
// 方式 B：JS 编程式调用（自动走内部 60 个节点的粒子对象池，零 DOM 抖动）
Motion.burst(e.clientX, e.clientY, { preset: 'hearts', count: 10 });
```

---

### 场景 4：多卡片交错入场编排 (Choreographer Stagger)

```javascript
const cards = document.querySelectorAll('.gallery-card');

// 交错入场编排：每个元素延迟 60ms，形成如水波般的入场节奏
Motion.timeline()
  .stagger(cards, [
    { opacity: 0, transform: 'translateY(30px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], {
    duration: Motion.tokens.duration.normal,
    easing: Motion.tokens.ease.out
  }, 60)
  .play();
```

---

## 5. 验收标准与性能指标

1. **帧率保障**：所有关键过渡均使用 `transform` 与 `opacity` 硬件加速属性，避免触发 Layout/Reflow，维持 60fps/120fps。
2. **状态安全**：在任意生命周期（连续快速双击、动画中途关闭）下，元素不发生重影、位移偏移或无法关闭。
3. **无障碍规范**：在操作系统开启“减少动态效果”（`prefers-reduced-motion: reduce`）后，所有动画自动跳过过渡，直接呈现实体状态，粒子系统自动静默。
