/**
 * Motion Engine (MSD - Motion State Driver 动效状态驱动模式)
 * 
 * 核心架构四层体系：
 * 1. Tokens Layer: 统一定义物理曲线、时间标尺与无障碍偏好检测。
 * 2. State Guard Layer: 有限状态机控制 (FSM)，防止快速点击打断、状态错乱与 DOM 提前销毁。
 * 3. Driver Layer: 零依赖封装原生 Web Animations API (WAAPI)、FLIP 布局过渡与高性能对象池。
 * 4. Choreographer & Declarative Layer: 声明式 HTML 属性绑定与时间轴编排。
 */

const Motion = (() => {
  'use strict';

  // ── 1. 动效设计令牌 (Tokens) ──────────────────────────────────
  const tokens = {
    duration: {
      instant: 100,
      fast: 180,
      normal: 260,
      slow: 400,
      deliberate: 650
    },
    ease: {
      standard: 'cubic-bezier(0.25, 1, 0.5, 1)',
      out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      in: 'cubic-bezier(0.7, 0, 0.84, 0)',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  };

  /**
   * 检查用户是否开启了系统级的“减少动态效果”偏好
   */
  function isReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── 2. 底层 WAAPI 驱动与动画追踪 ──────────────────────────────
  const activeAnimations = new WeakMap();

  /**
   * 基于 Web Animations API 执行硬件加速动画
   * @param {HTMLElement} element 目标元素
   * @param {Array<Object>|Object} keyframes 关键帧序列
   * @param {Object} options 动画配置
   * @returns {Promise<Animation>} 动画完成的 Promise
   */
  function animate(element, keyframes, options = {}) {
    if (!element || !(element instanceof Element)) {
      return Promise.resolve(null);
    }

    // 无障碍优先：若用户偏好减少动效，瞬间跳至最终帧
    if (isReducedMotion()) {
      const finalFrame = Array.isArray(keyframes) ? keyframes[keyframes.length - 1] : keyframes;
      Object.assign(element.style, finalFrame);
      return Promise.resolve(null);
    }

    const {
      duration = tokens.duration.normal,
      easing = tokens.ease.out,
      delay = 0,
      fill = 'forwards',
      cancelPrevious = true
    } = options;

    if (cancelPrevious && activeAnimations.has(element)) {
      const prev = activeAnimations.get(element);
      try {
        prev.cancel();
      } catch (e) {
        // 忽略已被取消的动画异常
      }
    }

    return new Promise((resolve) => {
      try {
        const anim = element.animate(keyframes, {
          duration,
          easing,
          delay,
          fill
        });

        activeAnimations.set(element, anim);

        anim.onfinish = () => {
          if (activeAnimations.get(element) === anim) {
            activeAnimations.delete(element);
          }
          // 将最终关键帧固化至 style，防止 fill: forwards 引发样式层叠优先级陷阱
          const finalFrame = Array.isArray(keyframes) ? keyframes[keyframes.length - 1] : keyframes;
          if (fill === 'forwards' && finalFrame) {
            Object.assign(element.style, finalFrame);
            anim.cancel();
          }
          resolve(anim);
        };

        anim.oncancel = () => {
          if (activeAnimations.get(element) === anim) {
            activeAnimations.delete(element);
          }
          resolve(null);
        };
      } catch (err) {
        console.warn('[Motion] WAAPI not supported or failed:', err);
        resolve(null);
      }
    });
  }

  // ── 3. 有限状态机 (State Machine Guard) ────────────────────────
  const STATE = {
    UNMOUNTED: 'unmounted',
    ENTERING: 'entering',
    ENTERED: 'entered',
    EXITING: 'exiting',
    EXITED: 'exited'
  };

  /**
   * 为 UI 元素绑定有限状态机控制器
   * 彻底解决：快速点击导致的动画闪烁、退场动画未播完 DOM 即被删除等常见缺陷
   */
  function createStateController(element, config = {}) {
    let currentState = config.initialState || (element.offsetParent ? STATE.ENTERED : STATE.EXITED);
    let transitionLock = false;

    const {
      enterFrames = [
        { opacity: 0, transform: 'scale(0.95) translateY(10px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' }
      ],
      exitFrames = [
        { opacity: 1, transform: 'scale(1) translateY(0)' },
        { opacity: 0, transform: 'scale(0.95) translateY(10px)' }
      ],
      enterDuration = tokens.duration.normal,
      exitDuration = tokens.duration.fast,
      enterEase = tokens.ease.out,
      exitEase = tokens.ease.in,
      onEntered = null,
      onExited = null
    } = config;

    return {
      getState: () => currentState,
      isBusy: () => transitionLock,

      async enter() {
        if (currentState === STATE.ENTERED || currentState === STATE.ENTERING) return;
        currentState = STATE.ENTERING;
        transitionLock = true;

        element.style.display = config.display || '';
        element.removeAttribute('hidden');

        await animate(element, enterFrames, {
          duration: enterDuration,
          easing: enterEase
        });

        currentState = STATE.ENTERED;
        transitionLock = false;
        if (typeof onEntered === 'function') onEntered(element);
      },

      async exit() {
        if (currentState === STATE.EXITED || currentState === STATE.EXITING) return;
        currentState = STATE.EXITING;
        transitionLock = true;

        await animate(element, exitFrames, {
          duration: exitDuration,
          easing: exitEase
        });

        element.style.display = 'none';
        currentState = STATE.EXITED;
        transitionLock = false;
        if (typeof onExited === 'function') onExited(element);
      },

      toggle() {
        if (currentState === STATE.ENTERED || currentState === STATE.ENTERING) {
          return this.exit();
        } else {
          return this.enter();
        }
      }
    };
  }

  // ── 4. FLIP 布局过渡模式 (First, Last, Invert, Play) ──────────
  /**
   * 捕获并平滑播放 DOM 结构变更（如列表增删、排序、网格展开）时的位移动画
   * @param {HTMLElement|Array<HTMLElement>} targets 监控的元素或容器
   * @param {Function} mutateAction 执行 DOM 变更的同步回调
   * @param {Object} options 过渡配置
   */
  async function flip(targets, mutateAction, options = {}) {
    const elements = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    if (!elements.length || isReducedMotion()) {
      mutateAction();
      return;
    }

    // 1. First: 记录变更前的边界矩形
    const firstRects = new Map();
    elements.forEach(el => firstRects.set(el, el.getBoundingClientRect()));

    // 2. Mutate: 执行布局变更
    mutateAction();

    // 3. Last & Invert & Play
    const animations = elements.map(el => {
      const first = firstRects.get(el);
      const last = el.getBoundingClientRect();
      if (!first) return Promise.resolve();

      const deltaX = first.left - last.left;
      const deltaY = first.top - last.top;

      // 如果位置没有变化则跳过
      if (deltaX === 0 && deltaY === 0) return Promise.resolve();

      // Invert: 逆位移
      const keyframes = [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' }
      ];

      return animate(el, keyframes, {
        duration: options.duration || tokens.duration.normal,
        easing: options.easing || tokens.ease.spring
      });
    });

    await Promise.all(animations);
  }

  // ── 5. 高性能对象池 (Particle Object Pool) ─────────────────────
  /**
   * 针对高频粒子爆发特效（碎星、爱心、金币），使用对象池技术避免频繁垃圾回收与掉帧
   */
  class ParticlePool {
    constructor(maxSize = 60) {
      this.maxSize = maxSize;
      this.pool = [];
      this.active = new Set();
      this.container = null;
    }

    _ensureContainer() {
      if (!this.container || !document.body.contains(this.container)) {
        this.container = document.createElement('div');
        this.container.id = 'motion-particle-container';
        this.container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;overflow:hidden;';
        document.body.appendChild(this.container);
      }
      return this.container;
    }

    acquire() {
      this._ensureContainer();
      let node;
      if (this.pool.length > 0) {
        node = this.pool.pop();
      } else if (this.active.size < this.maxSize) {
        node = document.createElement('div');
        node.className = 'motion-particle';
        this.container.appendChild(node);
      } else {
        // 超出池上限时直接复用最早的活跃节点
        node = this.active.values().next().value;
        this.active.delete(node);
      }
      this.active.add(node);
      node.style.display = 'block';
      return node;
    }

    release(node) {
      if (!node) return;
      this.active.delete(node);
      node.style.display = 'none';
      node.style.transform = '';
      node.style.opacity = '';
      if (this.pool.length < this.maxSize) {
        this.pool.push(node);
      } else {
        node.remove();
      }
    }
  }

  const particlePool = new ParticlePool();

  /**
   * 在指定坐标生成物理爆炸粒子特效
   * @param {number} x 视口 X 坐标
   * @param {number} y 视口 Y 坐标
   * @param {Object} options 配置项 (preset, count, spread)
   */
  function burst(x, y, options = {}) {
    if (isReducedMotion()) return;

    const presets = {
      stars: ['✨', '🌸', '🤍', '⭐'],
      hearts: ['💕', '💖', '💗', '❤️'],
      coins: ['🪙', '✨', '💎']
    };

    const type = options.preset || 'stars';
    const glyphs = presets[type] || [options.glyph || '✨'];
    const count = options.count || 8;
    const distance = options.distance || 60;

    for (let i = 0; i < count; i++) {
      const node = particlePool.acquire();
      node.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.fontSize = `${12 + Math.random() * 8}px`;

      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
      const dist = distance * (0.6 + Math.random() * 0.8);
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist + 15; // 加上微弱重力沉降

      const anim = node.animate([
        { transform: 'translate(-50%, -50%) scale(0.6) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.1) rotate(${Math.random() * 120 - 60}deg)`, opacity: 0.8, offset: 0.6 },
        { transform: `translate(calc(-50% + ${tx * 1.15}px), calc(-50% + ${ty + 20}px)) scale(0.4) rotate(${Math.random() * 180}deg)`, opacity: 0 }
      ], {
        duration: tokens.duration.slow + Math.random() * 200,
        easing: tokens.ease.out
      });

      anim.onfinish = () => particlePool.release(node);
      anim.oncancel = () => particlePool.release(node);
    }
  }

  // ── 6. 动效编排器 (Choreographer / Timeline) ───────────────────
  class Timeline {
    constructor() {
      this.tasks = [];
    }

    add(element, keyframes, options = {}) {
      this.tasks.push({ element, keyframes, options, stagger: 0 });
      return this;
    }

    stagger(elements, keyframes, options = {}, staggerInterval = 60) {
      const list = Array.isArray(elements) ? elements : Array.from(elements || []);
      list.forEach((el, index) => {
        const itemOpts = Object.assign({}, options, {
          delay: (options.delay || 0) + index * staggerInterval
        });
        this.tasks.push({ element: el, keyframes, options: itemOpts });
      });
      return this;
    }

    async play() {
      const promises = this.tasks.map(task => 
        animate(task.element, task.keyframes, task.options)
      );
      this.tasks = [];
      return Promise.all(promises);
    }
  }

  function timeline() {
    return new Timeline();
  }

  // ── 7. 声明式 HTML 属性驱动与全局挂载 ─────────────────────────
  /**
   * 自动解析 DOM 中的 data-motion 属性并启动智能观察者 (Scroll Reveal / Click Burst)
   */
  function init(root = document) {
    // 1. 滚动入场 (Scroll Reveal)
    if ('IntersectionObserver' in window && !isReducedMotion()) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const motionType = el.getAttribute('data-motion') || 'fade-up';
            const delay = parseInt(el.getAttribute('data-motion-delay') || '0', 10);

            if (motionType === 'fade-up') {
              animate(el, [
                { opacity: 0, transform: 'translateY(24px)' },
                { opacity: 1, transform: 'translateY(0)' }
              ], {
                duration: tokens.duration.normal,
                easing: tokens.ease.out,
                delay
              });
            } else if (motionType === 'scale-in') {
              animate(el, [
                { opacity: 0, transform: 'scale(0.9)' },
                { opacity: 1, transform: 'scale(1)' }
              ], {
                duration: tokens.duration.fast,
                easing: tokens.ease.spring,
                delay
              });
            }
            obs.unobserve(el);
          }
        });
      }, { threshold: 0.1 });

      root.querySelectorAll('[data-motion]').forEach(el => observer.observe(el));
    }

    // 2. 声明式微交互点击粒子
    root.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-motion-burst]');
      if (trigger) {
        const preset = trigger.getAttribute('data-motion-burst') || 'stars';
        burst(e.clientX, e.clientY, { preset });
      }
    }, { passive: true });
  }

  // 页面加载完成后自动初始化声明式驱动
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      init();
    }
  }

  // ── 暴露公共 API ─────────────────────────────────────────────
  return {
    tokens,
    isReducedMotion,
    animate,
    createStateController,
    flip,
    burst,
    timeline,
    init
  };
})();

// 挂载到全局
if (typeof window !== 'undefined') {
  window.Motion = Motion;
}
