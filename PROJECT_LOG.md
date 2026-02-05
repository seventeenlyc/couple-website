# 我们的小窝 - 项目开发日志

## 📅 项目时间线

**开发周期：** 2025年11月26日 - 2025年12月8日（13天）  
**项目状态：** ✅ 已完成部署上线  
**访问地址：** https://lyczwc520.site

---

## 🎯 项目概述

这是一个为情侣打造的温馨互动网站，记录两人在一起的美好时光。项目采用 PHP + JSON 的轻量级架构，实现了相册管理、虚拟商城、任务系统、成就系统等多个功能模块。

**技术栈：**
- 前端：HTML5, CSS3, JavaScript
- 后端：PHP 7.4+
- 数据存储：JSON 文件
- 服务器：Nginx + PHP-FPM
- 部署：阿里云 ECS + 宝塔面板

---

## 🎨 核心功能模块

### 1. 首页 - 恋爱计时器
**文件：** `home.php`, `index.php`

**功能特性：**
- 💕 实时显示在一起的天数计算
- 🎯 快捷导航卡片（相册、浪漫成就、隐私空间）
- 🌸 粉色温馨主题设计
- 📱 响应式布局，支持移动端

**设计亮点：**
- 大号粉色数字显示天数，视觉冲击力强
- 可爱的猫咪头像装饰
- 渐变背景营造浪漫氛围

---

### 2. 相册系统
**文件：** `album.php`, `api/upload-photo.php`, `includes/folder-helper.php`

**功能特性：**
- 📸 照片上传与管理
- 📁 文件夹分类组织
- 🏷️ 照片标签系统
- 💬 照片描述和备注
- 🗑️ 照片删除功能
- 🔍 照片搜索和筛选

**数据结构：**
```json
{
  "id": "unique_id",
  "filename": "photo.jpg",
  "upload_date": "2025-12-08",
  "folder_id": "folder_1",
  "tags": ["旅行", "美食"],
  "description": "美好的一天",
  "uploader": "shiqi"
}
```

**技术实现：**
- 文件上传使用 PHP `move_uploaded_file()`
- 图片存储在 `uploads/photos/` 目录
- 支持 JPG, PNG, GIF 格式
- 自动生成缩略图

---

### 3. 虚拟商城系统
**文件：** `shop.php`, `api/shop.php`, `includes/shop-helper.php`

**功能特性：**
- 🛍️ 虚拟商品展示
- 💰 虚拟货币系统（爱心币）
- 🛒 商品购买流程
- 📦 订单管理
- ⭐ 商品评价系统
- 🎁 我的物品展示

**商品数据结构：**
```json
{
  "id": 1,
  "name": "浪漫晚餐券",
  "description": "可兑换一次浪漫晚餐",
  "price": 50,
  "stock": 10,
  "category": "约会",
  "image": "dinner.jpg",
  "status": "available"
}
```

**货币系统：**
- 初始货币：每人 52 爱心币
- 获取方式：签到、完成任务
- 消费方式：购买虚拟商品

---

### 4. 任务系统
**文件：** `tasks.php`, `api/tasks.php`, `includes/task-helper.php`

**功能特性：**
- ✅ 任务创建与分配
- 📋 任务状态管理（待完成/进行中/已完成）
- 🎯 任务优先级设置
- 💎 任务奖励机制
- 📊 任务完成统计

**任务类型：**
- 日常任务：每日签到、互动留言
- 特殊任务：纪念日准备、惊喜策划
- 挑战任务：连续签到、完成目标

**奖励系统：**
- 完成任务获得爱心币
- 解锁成就徽章
- 积累经验值

---

### 5. 成就系统
**文件：** `achievements.php`, `api/achievements.php`

**功能特性：**
- 🏆 成就徽章收集
- 📈 进度追踪
- 🎖️ 成就等级系统
- 📜 成就历史记录

**成就类别：**
- 时间成就：在一起 100 天、365 天
- 互动成就：上传 50 张照片、完成 100 个任务
- 特殊成就：第一次旅行、第一个纪念日
- 隐藏成就：特殊日期解锁

---

### 6. 隐私空间
**文件：** `private.php`, `api/private-auth.php`, `api/private-notes.php`, `api/private-files.php`

**功能特性：**
- 🔐 独立密码保护
- 📝 私密笔记
- 📁 私密文件存储
- 💌 情话收藏
- 🎯 个人目标记录

**安全机制：**
- 每个用户独立密码
- Session 验证
- 数据加密存储
- 自动登出机制

**数据隔离：**
- 十七的空间：`data/private_shiqi.json`
- 十三的空间：`data/private_shisan.json`

---

### 7. AI 功能集成
**文件：** `includes/ai-helper.php`, `includes/ai-config.php`, `generate-quotes.php`

**功能特性：**
- 🤖 每日情话生成
- 💝 纪念日祝福语
- 📸 照片描述生成
- 🎨 智能推荐

**AI 服务商：**
- 主要：阿里云通义千问（qwen-turbo）
- 备用：DeepSeek

**使用统计：**
- 总调用：28 次
- 成功：20 次
- 缓存命中：19 次
- 最后调用：2025-12-07

---

### 8. 签到系统
**文件：** `api/checkin.php`, `includes/checkin-helper.php`

**功能特性：**
- 📅 每日签到
- 🔥 连续签到统计
- 💰 签到奖励

**奖励规则：**
- 普通签到：+2 爱心币
- 连续 7 天：+5 爱心币
- 连续 30 天：+20 爱心币

---

### 9. 订单系统
**文件：** `my-orders.php`, `api/orders.php`, `includes/order-helper.php`

**功能特性：**
- 📦 订单创建
- 📋 订单列表
- 🔍 订单详情
- ✅ 订单状态更新
- 💬 订单评价

**订单状态：**
- pending：待处理
- completed：已完成
- cancelled：已取消

---

### 10. 评价系统
**文件：** `api/reviews.php`, `includes/review-helper.php`

**功能特性：**
- ⭐ 5 星评分
- 💬 文字评价
- 📸 评价图片
- 👍 有用评价统计

---

## 🎨 UI/UX 设计

### 设计风格
- **主题色：** 粉色系（#ff69b4, #ffb6c1）
- **辅助色：** 白色、浅灰
- **字体：** 系统默认字体，优雅易读
- **图标：** 使用 Emoji 和自定义 SVG

### 响应式设计
- 桌面端：1200px+ 宽屏布局
- 平板端：768px-1199px 适配
- 移动端：<768px 单列布局

### 交互设计
- 平滑过渡动画
- 悬停效果反馈
- 加载状态提示
- 操作确认弹窗

---

## 📁 项目结构

```
project/
├── api/                      # API 接口
│   ├── achievements.php      # 成就 API
│   ├── checkin.php          # 签到 API
│   ├── daily-quote.php      # 每日情话 API
│   ├── folders.php          # 文件夹 API
│   ├── login.php            # 登录 API
│   ├── logout.php           # 登出 API
│   ├── orders.php           # 订单 API
│   ├── private-auth.php     # 隐私空间认证 API
│   ├── private-files.php    # 隐私文件 API
│   ├── private-notes.php    # 隐私笔记 API
│   ├── reviews.php          # 评价 API
│   ├── shop.php             # 商城 API
│   ├── tasks.php            # 任务 API
│   ├── upload-avatar.php    # 头像上传 API
│   ├── upload-photo.php     # 照片上传 API
│   └── virtual-items.php    # 虚拟物品 API
│
├── assets/                   # 静态资源
│   ├── css/                 # 样式文件
│   │   ├── custom.css       # 自定义样式
│   │   ├── shop.css         # 商城样式
│   │   └── ai-features.css  # AI 功能样式
│   ├── js/                  # JavaScript 文件
│   │   ├── folder-ui.js     # 文件夹 UI
│   │   ├── shop-effects.js  # 商城特效
│   │   ├── ai-features.js   # AI 功能
│   │   └── mobile-menu.js   # 移动端菜单
│   └── images/              # 图片资源
│
├── data/                     # 数据存储
│   ├── achievements.json    # 成就数据
│   ├── ai_config.json       # AI 配置
│   ├── album.json           # 相册数据
│   ├── config.json          # 系统配置
│   ├── orders.json          # 订单数据
│   ├── private_shiqi.json   # 十七隐私数据
│   ├── private_shisan.json  # 十三隐私数据
│   ├── products.json        # 商品数据
│   ├── reviews.json         # 评价数据
│   ├── tasks.json           # 任务数据
│   ├── user_currency.json   # 用户货币
│   ├── virtual_items.json   # 虚拟物品
│   ├── cache/               # 缓存目录
│   └── logs/                # 日志目录
│
├── includes/                 # 公共组件
│   ├── auth.php             # 认证逻辑
│   ├── session.php          # Session 管理
│   ├── config.php           # 配置文件
│   ├── header.php           # 页面头部
│   ├── footer.php           # 页面底部
│   ├── ai-helper.php        # AI 助手
│   ├── ai-config.php        # AI 配置
│   ├── avatar-helper.php    # 头像助手
│   ├── checkin-helper.php   # 签到助手
│   ├── currency-helper.php  # 货币助手
│   ├── folder-helper.php    # 文件夹助手
│   ├── json-helper.php      # JSON 助手
│   ├── order-helper.php     # 订单助手
│   ├── review-helper.php    # 评价助手
│   ├── shop-helper.php      # 商城助手
│   ├── task-helper.php      # 任务助手
│   └── virtual-item-helper.php  # 虚拟物品助手
│
├── uploads/                  # 上传文件
│   ├── photos/              # 照片
│   ├── avatars/             # 头像
│   └── private/             # 隐私文件
│
├── generated-icons/          # 生成的图标
│   ├── dog.svg              # 狗头图标
│   └── preview.html         # 图标预览
│
├── index.php                 # 登录页
├── home.php                  # 首页
├── album.php                 # 相册页
├── shop.php                  # 商城页
├── tasks.php                 # 任务页
├── achievements.php          # 成就页
├── private.php               # 隐私空间
├── my-orders.php             # 我的订单
├── my-items.php              # 我的物品
├── transaction-history.php   # 交易历史
├── generate-quotes.php       # 生成情话（CLI）
├── generate-quotes-web.php   # 生成情话（Web）
├── generate-icons.py         # 生成图标脚本
├── sync-now.php              # 同步脚本
├── README.md                 # 项目说明
└── .htaccess                 # Apache 配置
```

---

## 🚀 部署过程

### 1. 服务器准备
**时间：** 2025年12月8日  
**服务器：** 阿里云 ECS  
**配置：** 2核 CPU / 2GB 内存 / 20GB SSD

**操作步骤：**
1. 购买阿里云 ECS 服务器
2. 选择 Ubuntu 20.04 LTS 系统
3. 配置安全组规则（开放 22, 80, 443, 8888 端口）
4. 通过 SSH 连接服务器

### 2. 安装宝塔面板
```bash
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh
sudo bash install.sh
```

**安装结果：**
- 面板地址：http://服务器IP:8888
- 默认用户名和密码已记录

### 3. 安装 LNMP 环境
**组件版本：**
- Nginx 1.22
- MySQL 5.7
- PHP 7.4
- phpMyAdmin 5.2

**安装时间：** 约 15 分钟

### 4. 创建网站
1. 添加站点
2. 绑定域名：lyczwc520.site
3. 设置 PHP 版本：7.4
4. 配置网站根目录：/www/wwwroot/lyczwc520.site

### 5. 上传项目文件
**方式：** 宝塔面板文件管理器  
**操作：**
1. 压缩本地项目文件
2. 上传 ZIP 到服务器
3. 解压到网站根目录
4. 设置 data 目录权限为 775

### 6. 配置 SSL 证书
**证书类型：** Let's Encrypt 免费证书  
**验证方式：** 文件验证  
**操作：**
1. 在宝塔面板 SSL 设置中申请证书
2. 自动验证域名所有权
3. 部署证书
4. 强制 HTTPS 跳转

**结果：** ✅ 证书申请成功，网站支持 HTTPS 访问

### 7. 测试验证
- ✅ 网站可正常访问
- ✅ 登录功能正常
- ✅ 照片上传正常
- ✅ 商城功能正常
- ✅ 任务系统正常
- ✅ AI 功能正常
- ✅ 隐私空间正常

---

## 📊 项目统计

### 开发数据
- **开发天数：** 13 天
- **代码文件：** 60+ 个
- **代码行数：** 约 8,000+ 行
- **功能模块：** 10 个主要模块
- **API 接口：** 15+ 个

### 功能统计
- **页面数量：** 12 个
- **数据表（JSON）：** 11 个
- **上传功能：** 3 个（照片、头像、文件）
- **AI 集成：** 2 个服务商

### 使用数据（截至部署）
- **照片数量：** 待用户上传
- **任务完成：** 0 个
- **成就解锁：** 0 个
- **商品购买：** 0 笔
- **AI 调用：** 28 次

---

## 🎯 技术亮点

### 1. 轻量级架构
- 使用 JSON 文件存储，无需数据库
- 减少服务器资源消耗
- 便于备份和迁移

### 2. 模块化设计
- 功能模块独立
- Helper 类封装业务逻辑
- API 接口统一规范

### 3. 安全性
- Session 认证机制
- 密码加密存储
- 文件上传验证
- XSS 防护
- CSRF 防护

### 4. 用户体验
- 响应式设计
- 流畅的动画效果
- 友好的错误提示
- 加载状态反馈

### 5. AI 集成
- 智能情话生成
- 多服务商备份
- 缓存机制优化
- 失败降级处理

---

## 🔧 技术难点与解决方案

### 1. 文件上传大小限制
**问题：** PHP 默认上传限制 2MB  
**解决：** 修改 php.ini 配置
```ini
upload_max_filesize = 10M
post_max_size = 10M
```

### 2. JSON 文件并发写入
**问题：** 多用户同时操作可能导致数据丢失  
**解决：** 使用文件锁机制
```php
$fp = fopen($file, 'c+');
flock($fp, LOCK_EX);
// 写入操作
flock($fp, LOCK_UN);
fclose($fp);
```

### 3. AI API 调用失败
**问题：** 网络波动导致 API 调用失败  
**解决：** 
- 实现重试机制
- 配置备用服务商
- 提供降级方案（预设情话）

### 4. 图片存储优化
**问题：** 大量图片占用存储空间  
**解决：**
- 图片压缩
- 生成缩略图
- 定期清理未使用图片

### 5. Session 管理
**问题：** 多用户登录状态管理  
**解决：**
- 使用 Session 存储用户信息
- 设置合理的过期时间
- 实现记住登录功能

---

## 🌟 特色功能

### 1. 狗头表情包
- 使用 Python 生成 SVG 狗头图标
- 替换原有的 Emoji 表情
- 增加趣味性和个性化

### 2. 虚拟货币系统
- 爱心币作为虚拟货币
- 通过签到、任务获取
- 用于购买虚拟商品

### 3. 成就系统
- 多维度成就设计
- 进度可视化
- 激励用户持续使用

### 4. AI 每日情话
- 每天生成新的情话
- 缓存机制避免重复调用
- 失败时使用预设情话

### 5. 隐私空间
- 独立密码保护
- 数据完全隔离
- 安全可靠

---

## 📝 待优化项目

### 功能优化
- [ ] 添加消息通知系统
- [ ] 实现实时聊天功能
- [ ] 增加视频上传支持
- [ ] 添加日历视图
- [ ] 实现数据导出功能

### 性能优化
- [ ] 图片懒加载
- [ ] CDN 加速
- [ ] 数据库迁移（MySQL）
- [ ] Redis 缓存
- [ ] 前端资源压缩

### 用户体验
- [ ] 添加引导教程
- [ ] 优化移动端体验
- [ ] 增加主题切换
- [ ] 添加音效反馈
- [ ] 实现离线访问

### 安全加固
- [ ] 实现 API 限流
- [ ] 添加验证码
- [ ] 日志审计
- [ ] 定期安全扫描
- [ ] 数据备份自动化

---

## 💡 经验总结

### 开发经验
1. **需求明确很重要** - 清晰的需求能大大提高开发效率
2. **模块化设计** - 便于维护和扩展
3. **代码复用** - Helper 类减少重复代码
4. **版本控制** - Git 管理代码变更
5. **测试驱动** - 边开发边测试，及时发现问题

### 部署经验
1. **宝塔面板很方便** - 可视化操作，降低部署难度
2. **安全组配置** - 必须正确配置端口
3. **SSL 证书** - Let's Encrypt 免费且自动续期
4. **文件权限** - data 目录需要写权限
5. **备份重要** - 定期备份数据和代码

### 协作经验
1. **沟通很重要** - 及时沟通需求和问题
2. **文档完善** - 便于后期维护
3. **代码规范** - 统一的代码风格
4. **迭代开发** - 小步快跑，快速迭代
5. **用户反馈** - 根据使用情况优化功能

---

## 🎉 项目成果

### 技术成果
- ✅ 完整的 Web 应用开发经验
- ✅ PHP 后端开发能力提升
- ✅ 前端交互设计经验
- ✅ 服务器部署运维经验
- ✅ AI 接口集成经验

### 产品成果
- ✅ 功能完整的情侣互动网站
- ✅ 美观的 UI 设计
- ✅ 流畅的用户体验
- ✅ 稳定的线上运行
- ✅ 可持续的维护方案

### 情感成果
- ❤️ 记录两人的美好时光
- ❤️ 增进彼此的了解
- ❤️ 创造共同的回忆
- ❤️ 见证爱情的成长
- ❤️ 留下珍贵的纪念

---

## 📞 联系方式

**项目负责人：** 十七 & 十三  
**开发时间：** 2025年11月26日 - 2025年12月8日  
**部署时间：** 2025年12月8日  
**网站地址：** https://lyczwc520.site

---

## 📜 版权声明

本项目为个人学习和使用项目，所有代码和设计归项目开发者所有。

**开发工具：** Kiro AI 辅助开发  
**AI 服务：** 阿里云通义千问、DeepSeek  
**部署平台：** 阿里云 ECS  
**域名注册：** 阿里云

---

## 🙏 致谢

感谢 Kiro AI 在开发过程中提供的帮助和支持！  
感谢阿里云提供稳定的服务器和 AI 服务！  
感谢彼此的陪伴，让这个项目充满意义！

---

**最后更新：** 2025年12月8日  
**文档版本：** v1.0

💕 愿我们的爱情如同这个网站，永远温馨美好！ 💕
