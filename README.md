# 情侣专属网站 💕

一个为情侣打造的私人网站，包含相册、商城、任务系统、纪念日提醒等功能。

## 功能特色

- 📸 **相册系统** - 支持文件夹管理、标签筛选、缩略图生成
- 🛒 **爱心商城** - 虚拟商品购买、订单管理
- 🎯 **任务系统** - 日常任务、成就系统
- 📅 **纪念日提醒** - 自动计算恋爱天数、生日提醒
- 🔒 **隐私空间** - 私人文件存储
- 💬 **AI功能** - 智能对话（需配置API）
- 🎨 **主题定制** - 可自定义颜色主题

## 环境要求

- PHP 7.4+
- Web服务器（Apache/Nginx）
- GD扩展（用于图片处理）

## 安装步骤

1. 克隆项目到你的Web目录
```bash
git clone https://github.com/yourusername/couple-website.git
cd couple-website
```

2. 设置目录权限
```bash
chmod 755 uploads/
chmod 755 data/
chmod 777 uploads/photos/thumbs/
```

3. 配置用户信息
编辑 `data/config.json`，修改用户名、密码等信息：
```json
{
    "users": {
        "name1": {
            "id": "id1",
            "partner": "name2",
            "privatePassword": "password1",
            "birthday": "01-01",
            "name": "name1"
        },
        "name2": {
            "id": "id2", 
            "partner": "name1",
            "privatePassword": "password2",
            "birthday": "02-14",
            "name": "name2"
        }
    }
}
```

4. 配置AI功能（可选）
编辑 `data/ai_config.json`，添加你的API密钥：
```json
{
    "enabled": true,
    "api_key": "your_api_key_here",
    "model": "gpt-3.5-turbo",
    "base_url": "https://api.openai.com/v1"
}
```

5. 访问网站
在浏览器中打开你的网站地址即可开始使用。

## 目录结构

```
couple-website/
├── api/                    # API接口
├── assets/                 # 静态资源
├── data/                   # 数据文件
├── includes/               # 公共函数
├── uploads/                # 上传文件
├── index.php              # 登录页面
├── home.php               # 主页
├── album-fixed.php        # 相册
├── shop.php               # 商城
├── private.php            # 隐私空间
└── README.md              # 说明文档
```

## 安全建议

1. 修改默认密码
2. 设置强密码
3. 定期备份数据文件
4. 限制文件上传类型和大小
5. 使用HTTPS

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 支持

如果这个项目对你有帮助，请给个⭐️支持一下！