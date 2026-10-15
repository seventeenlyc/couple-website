/**
 * 设备自适应路由
 * 统一入口：根据视口判断设备类型，记住用户手动选择，实现桌面端与移动端自动分流
 */
const DeviceRouter = (() => {
  const STORAGE_KEY = 'user_device_preference';
  const DESKTOP_MIN_WIDTH = 1024;

  /**
   * 检测当前设备类型（基于视口宽度）
   */
  function detectDeviceType() {
    return window.innerWidth >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile';
  }

  /**
   * 获取用户手动设置的偏好（如果有）
   */
  function getUserPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  /**
   * 保存用户手动选择的设备类型
   */
  function saveUserPreference(deviceType) {
    try {
      localStorage.setItem(STORAGE_KEY, deviceType);
      return true;
    } catch (e) {
      console.warn('无法保存设备偏好设置:', e);
      return false;
    }
  }

  /**
   * 清除用户偏好设置
   */
  function clearUserPreference() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('无法清除设备偏好设置:', e);
    }
  }

  /**
   * 严格校验是否为安全的站内相对路径，杜绝开放重定向及反斜杠跳往站外
   */
  function isSafeLocalRedirect(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    // 严禁包含反斜杠、连续斜杠、协议头或控制字符
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('://')) {
      return false;
    }
    if (/[\r\n\t\0]/.test(trimmed)) {
      return false;
    }
    try {
      const baseOrigin = typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : 'http://localhost';
      const parsed = new URL(trimmed, baseOrigin);
      if (parsed.origin !== baseOrigin) {
        return false;
      }
      if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//') || parsed.pathname.includes('\\')) {
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * 决定目标页面：优先用户偏好，其次自动检测
   */
  function getTargetPage() {
    const preference = getUserPreference();
    const detected = detectDeviceType();
    const finalType = preference || detected;
    
    return finalType === 'desktop' ? '/desktop/index.html' : '/h5/index.html';
  }

  /**
   * 登录成功后执行路由跳转
   * @param {string} customRedirect - 自定义跳转地址（可选）
   */
  function routeAfterLogin(customRedirect = null) {
    // 如果有安全合法的站内跳转地址（如设备授权页），直接跳转
    if (customRedirect && isSafeLocalRedirect(customRedirect)) {
      window.location.href = customRedirect;
      return;
    }

    // 否则根据设备类型路由
    const targetPage = getTargetPage();
    window.location.href = targetPage;
  }

  /**
   * 手动切换到指定设备版本
   * @param {string} deviceType - 'desktop' 或 'mobile'
   * @param {boolean} remember - 是否记住选择（默认 true）
   */
  function switchTo(deviceType, remember = true) {
    if (deviceType !== 'desktop' && deviceType !== 'mobile') {
      console.error('无效的设备类型:', deviceType);
      return;
    }

    if (remember) {
      saveUserPreference(deviceType);
    }

    const targetPage = deviceType === 'desktop' ? '/desktop/index.html' : '/h5/index.html';
    window.location.href = targetPage;
  }

  /**
   * 重置为自动检测模式（清除用户偏好）
   */
  function resetToAuto() {
    clearUserPreference();
    const targetPage = getTargetPage();
    window.location.href = targetPage;
  }

  /**
   * 获取当前使用的设备类型（考虑偏好设置）
   */
  function getCurrentDeviceType() {
    return getUserPreference() || detectDeviceType();
  }

  /**
   * 检查当前是否有用户手动设置
   */
  function hasUserPreference() {
    return !!getUserPreference();
  }

  return {
    isSafeLocalRedirect,
    routeAfterLogin,
    switchTo,
    resetToAuto,
    getCurrentDeviceType,
    detectDeviceType,
    getUserPreference,
    saveUserPreference,
    clearUserPreference,
    hasUserPreference
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceRouter;
}
if (typeof window !== 'undefined') {
  window.DeviceRouter = DeviceRouter;
}
