#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图标生成器
生成爱心、小猫、小狗的SVG图标
"""

import os

def create_directory(path):
    """创建目录"""
    if not os.path.exists(path):
        os.makedirs(path)

def generate_heart_svg():
    """生成爱心SVG - 心动日常风格"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <radialGradient id="heartGradient" cx="40%" cy="35%">
      <stop offset="0%" style="stop-color:#ff9eb5;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#ff6b9d;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ff1744;stop-opacity:1" />
    </radialGradient>
  </defs>
  <!-- 爱心主体 - 更圆润的心动日常风格 -->
  <path d="M50,88 C50,88 12,68 12,42 C12,28 20,18 32,18 C40,18 46,23 50,30 C54,23 60,18 68,18 C80,18 88,28 88,42 C88,68 50,88 50,88 Z" 
        fill="url(#heartGradient)" 
        stroke="none"/>
  <!-- 外层描边 -->
  <path d="M50,88 C50,88 12,68 12,42 C12,28 20,18 32,18 C40,18 46,23 50,30 C54,23 60,18 68,18 C80,18 88,28 88,42 C88,68 50,88 50,88 Z" 
        fill="none"
        stroke="#ff1744" 
        stroke-width="1.5"
        opacity="0.6"/>
  <!-- 高光效果 - 更明显 -->
  <ellipse cx="32" cy="28" rx="14" ry="20" fill="white" opacity="0.35" transform="rotate(-15 32 28)"/>
  <ellipse cx="38" cy="26" rx="8" ry="12" fill="white" opacity="0.5" transform="rotate(-15 38 26)"/>
  <!-- 小高光点 -->
  <circle cx="42" cy="24" r="3" fill="white" opacity="0.8"/>
</svg>'''

def generate_cat_svg():
    """生成小猫SVG - 布偶猫（参考照片），深蓝色眼睛，深棕色重点色"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <radialGradient id="catGradient" cx="50%" cy="40%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="70%" style="stop-color:#f8f8f8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1" />
    </radialGradient>
    <radialGradient id="blueEyeGradient" cx="40%" cy="40%">
      <stop offset="0%" style="stop-color:#5ba3d0;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2171a3;stop-opacity:1" />
    </radialGradient>
    <linearGradient id="pointGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#5d4a3a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3d2f24;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- 左耳 - 深棕色 -->
  <path d="M25,30 L18,8 L38,24 Z" fill="url(#pointGradient)" stroke="#3d2f24" stroke-width="2"/>
  <!-- 右耳 - 深棕色 -->
  <path d="M75,30 L82,8 L62,24 Z" fill="url(#pointGradient)" stroke="#3d2f24" stroke-width="2"/>
  <!-- 头部 - 白色 -->
  <circle cx="50" cy="52" r="32" fill="url(#catGradient)" stroke="#e0e0e0" stroke-width="2"/>
  <!-- 脸部深棕色面具 - 覆盖眼睛周围 -->
  <ellipse cx="38" cy="46" rx="12" ry="16" fill="url(#pointGradient)" opacity="0.7"/>
  <ellipse cx="62" cy="46" rx="12" ry="16" fill="url(#pointGradient)" opacity="0.7"/>
  <!-- 鼻子和嘴巴区域保持白色 -->
  <ellipse cx="50" cy="60" rx="16" ry="12" fill="white"/>
  <!-- 左眼 - 深蓝色 -->
  <ellipse cx="38" cy="46" rx="6" ry="9" fill="url(#blueEyeGradient)"/>
  <ellipse cx="39" cy="44" rx="2.5" ry="3.5" fill="#87ceeb"/>
  <ellipse cx="39.5" cy="42" rx="1.5" ry="2" fill="white"/>
  <!-- 右眼 - 深蓝色 -->
  <ellipse cx="62" cy="46" rx="6" ry="9" fill="url(#blueEyeGradient)"/>
  <ellipse cx="63" cy="44" rx="2.5" ry="3.5" fill="#87ceeb"/>
  <ellipse cx="63.5" cy="42" rx="1.5" ry="2" fill="white"/>
  <!-- 鼻子 - 粉色 -->
  <path d="M50,54 L47,59 L53,59 Z" fill="#ffb6c1"/>
  <!-- 嘴巴 -->
  <path d="M50,59 Q45,62 42,60" stroke="#999" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M50,59 Q55,62 58,60" stroke="#999" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- 胡须 - 白色 -->
  <line x1="22" y1="50" x2="10" y2="48" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="22" y1="56" x2="10" y2="56" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="22" y1="62" x2="10" y2="64" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="50" x2="90" y2="48" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="56" x2="90" y2="56" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="62" x2="90" y2="64" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>'''

def generate_dog_svg():
    """生成小狗SVG - 只有头部，参考图片风格，米黄色，聪明的眼神，大椭圆耳朵"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <radialGradient id="dogHeadGradient" cx="50%" cy="40%">
      <stop offset="0%" style="stop-color:#f5e6c8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e8d4a8;stop-opacity:1" />
    </radialGradient>
  </defs>
  <!-- 左耳 - 大椭圆耳朵 -->
  <ellipse cx="25" cy="25" rx="10" ry="18" fill="#e8d4a8" stroke="#2c3e50" stroke-width="3" transform="rotate(-20 25 25)"/>
  <!-- 右耳 - 大椭圆耳朵 -->
  <ellipse cx="75" cy="25" rx="10" ry="18" fill="#e8d4a8" stroke="#2c3e50" stroke-width="3" transform="rotate(20 75 25)"/>
  <!-- 头部 - 大圆头 -->
  <circle cx="50" cy="50" r="35" fill="url(#dogHeadGradient)" stroke="#2c3e50" stroke-width="3"/>
  <!-- 左眼 - 有神的眼睛 -->
  <circle cx="38" cy="45" r="5" fill="#2c3e50"/>
  <circle cx="39.5" cy="43.5" r="2" fill="white"/>
  <!-- 右眼 - 有神的眼睛 -->
  <circle cx="62" cy="45" r="5" fill="#2c3e50"/>
  <circle cx="63.5" cy="43.5" r="2" fill="white"/>
  <!-- 鼻子 - 黑色三角形 -->
  <path d="M50,55 L45,61 L55,61 Z" fill="#2c3e50"/>
  <!-- 嘴巴 - 开心的笑容 -->
  <path d="M50,61 Q42,67 38,65" stroke="#2c3e50" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M50,61 Q58,67 62,65" stroke="#2c3e50" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 舌头 - 粉红色 -->
  <ellipse cx="50" cy="71.2" rx="6" ry="8" fill="#ff8fab"/>
  <ellipse cx="50" cy="71.2" rx="4" ry="6" fill="#ffb3c6"/>
</svg>'''

def generate_heart_emoji():
    """生成爱心Emoji样式 - 心动日常风格加强版"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <radialGradient id="heartEmojiGradient" cx="35%" cy="30%">
      <stop offset="0%" style="stop-color:#ffb3c6;stop-opacity:1" />
      <stop offset="40%" style="stop-color:#ff8fab;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ff1744;stop-opacity:1" />
    </radialGradient>
  </defs>
  <!-- 爱心主体 - 更饱满圆润 -->
  <path d="M50,92 C50,92 8,65 8,38 C8,20 18,10 30,10 C38,10 45,15 50,24 C55,15 62,10 70,10 C82,10 92,20 92,38 C92,65 50,92 50,92 Z" 
        fill="url(#heartEmojiGradient)"/>
  <!-- 主高光 -->
  <ellipse cx="28" cy="24" rx="16" ry="22" fill="white" opacity="0.4" transform="rotate(-20 28 24)"/>
  <ellipse cx="35" cy="22" rx="10" ry="14" fill="white" opacity="0.6" transform="rotate(-20 35 22)"/>
  <!-- 小高光点 -->
  <circle cx="40" cy="20" r="4" fill="white" opacity="0.9"/>
  <circle cx="46" cy="18" r="2" fill="white" opacity="0.8"/>
</svg>'''

def generate_cat_emoji():
    """生成小猫Emoji样式 - 布偶猫（参考照片），深蓝色眼睛，深棕色重点色"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <radialGradient id="catEmojiGradient" cx="50%" cy="40%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="70%" style="stop-color:#f8f8f8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1" />
    </radialGradient>
    <radialGradient id="blueEyeEmojiGradient" cx="40%" cy="40%">
      <stop offset="0%" style="stop-color:#5ba3d0;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2171a3;stop-opacity:1" />
    </radialGradient>
    <linearGradient id="pointEmojiGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#5d4a3a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3d2f24;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- 左耳 - 深棕色 -->
  <path d="M25,30 L18,8 L38,24 Z" fill="url(#pointEmojiGradient)" stroke="#3d2f24" stroke-width="2"/>
  <!-- 右耳 - 深棕色 -->
  <path d="M75,30 L82,8 L62,24 Z" fill="url(#pointEmojiGradient)" stroke="#3d2f24" stroke-width="2"/>
  <!-- 头部 - 白色 -->
  <circle cx="50" cy="52" r="32" fill="url(#catEmojiGradient)" stroke="#e0e0e0" stroke-width="2"/>
  <!-- 脸部深棕色面具 - 覆盖眼睛周围 -->
  <ellipse cx="38" cy="46" rx="12" ry="16" fill="url(#pointEmojiGradient)" opacity="0.7"/>
  <ellipse cx="62" cy="46" rx="12" ry="16" fill="url(#pointEmojiGradient)" opacity="0.7"/>
  <!-- 鼻子和嘴巴区域保持白色 -->
  <ellipse cx="50" cy="60" rx="16" ry="12" fill="white"/>
  <!-- 脸颊红晕 -->
  <ellipse cx="28" cy="58" rx="8" ry="6" fill="#ffb6c1" opacity="0.3"/>
  <ellipse cx="72" cy="58" rx="8" ry="6" fill="#ffb6c1" opacity="0.3"/>
  <!-- 左眼 - 深蓝色 -->
  <ellipse cx="38" cy="46" rx="6" ry="9" fill="url(#blueEyeEmojiGradient)"/>
  <ellipse cx="39" cy="44" rx="2.5" ry="3.5" fill="#87ceeb"/>
  <ellipse cx="39.5" cy="42" rx="1.5" ry="2" fill="white"/>
  <!-- 右眼 - 深蓝色 -->
  <ellipse cx="62" cy="46" rx="6" ry="9" fill="url(#blueEyeEmojiGradient)"/>
  <ellipse cx="63" cy="44" rx="2.5" ry="3.5" fill="#87ceeb"/>
  <ellipse cx="63.5" cy="42" rx="1.5" ry="2" fill="white"/>
  <!-- 鼻子 - 粉色 -->
  <path d="M50,54 L47,59 L53,59 Z" fill="#ffb6c1"/>
  <!-- 嘴巴 -->
  <path d="M50,59 Q45,62 42,60" stroke="#999" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M50,59 Q55,62 58,60" stroke="#999" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- 胡须 - 白色 -->
  <line x1="22" y1="50" x2="10" y2="48" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="22" y1="56" x2="10" y2="56" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="22" y1="62" x2="10" y2="64" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="50" x2="90" y2="48" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="56" x2="90" y2="56" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="78" y1="62" x2="90" y2="64" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>'''

def generate_dog_emoji():
    """生成小狗Emoji样式 - 只有头部，参考图片风格，米黄色，聪明的眼神，大椭圆耳朵（Emoji版）"""
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <radialGradient id="dogEmojiHeadGradient" cx="50%" cy="40%">
      <stop offset="0%" style="stop-color:#f5e6c8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e8d4a8;stop-opacity:1" />
    </radialGradient>
  </defs>
  <!-- 左耳 - 大椭圆耳朵 -->
  <ellipse cx="25" cy="25" rx="10" ry="18" fill="#e8d4a8" stroke="#2c3e50" stroke-width="3" transform="rotate(-20 25 25)"/>
  <!-- 右耳 - 大椭圆耳朵 -->
  <ellipse cx="75" cy="25" rx="10" ry="18" fill="#e8d4a8" stroke="#2c3e50" stroke-width="3" transform="rotate(20 75 25)"/>
  <!-- 头部 - 大圆头 -->
  <circle cx="50" cy="50" r="35" fill="url(#dogEmojiHeadGradient)" stroke="#2c3e50" stroke-width="3"/>
  <!-- 脸颊红晕 -->
  <ellipse cx="25" cy="52" rx="7" ry="5" fill="#ffb3c6" opacity="0.5"/>
  <ellipse cx="75" cy="52" rx="7" ry="5" fill="#ffb3c6" opacity="0.5"/>
  <!-- 左眼 - 有神的眼睛 -->
  <circle cx="38" cy="45" r="5" fill="#2c3e50"/>
  <circle cx="39.5" cy="43.5" r="2" fill="white"/>
  <!-- 右眼 - 有神的眼睛 -->
  <circle cx="62" cy="45" r="5" fill="#2c3e50"/>
  <circle cx="63.5" cy="43.5" r="2" fill="white"/>
  <!-- 鼻子 - 黑色三角形 -->
  <path d="M50,55 L45,61 L55,61 Z" fill="#2c3e50"/>
  <!-- 嘴巴 - 开心的笑容 -->
  <path d="M50,61 Q42,67 38,65" stroke="#2c3e50" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M50,61 Q58,67 62,65" stroke="#2c3e50" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 舌头 - 粉红色 -->
  <ellipse cx="50" cy="71.2" rx="6" ry="8" fill="#ff8fab"/>
  <ellipse cx="50" cy="71.2" rx="4" ry="6" fill="#ffb3c6"/>
</svg>'''

def save_svg(filename, content):
    """保存SVG文件"""
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✓ 已生成: {filename}")

def generate_html_preview():
    """生成HTML预览页面"""
    html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>图标预览</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            margin: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 40px;
        }
        .section {
            margin-bottom: 50px;
        }
        .section h2 {
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .icon-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 30px;
            margin-bottom: 20px;
        }
        .icon-item {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 15px;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .icon-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .icon-item img {
            width: 120px;
            height: 120px;
            margin-bottom: 15px;
        }
        .icon-item h3 {
            margin: 0;
            color: #333;
            font-size: 16px;
        }
        .note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-top: 30px;
            border-radius: 5px;
        }
        .note strong {
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 图标预览</h1>
        
        <div class="section">
            <h2>💕 爱心图标</h2>
            <div class="icon-grid">
                <div class="icon-item">
                    <img src="heart.svg" alt="爱心">
                    <h3>标准爱心</h3>
                </div>
                <div class="icon-item">
                    <img src="heart-emoji.svg" alt="爱心Emoji">
                    <h3>Emoji爱心</h3>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🐱 小猫图标</h2>
            <div class="icon-grid">
                <div class="icon-item">
                    <img src="cat.svg" alt="小猫">
                    <h3>标准小猫</h3>
                </div>
                <div class="icon-item">
                    <img src="cat-emoji.svg" alt="小猫Emoji">
                    <h3>Emoji小猫</h3>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🐶 小狗图标</h2>
            <div class="icon-grid">
                <div class="icon-item">
                    <img src="dog.svg" alt="小狗">
                    <h3>标准小狗</h3>
                </div>
                <div class="icon-item">
                    <img src="dog-emoji.svg" alt="小狗Emoji">
                    <h3>Emoji小狗</h3>
                </div>
            </div>
        </div>
        
        <div class="note">
            <strong>📝 说明：</strong>
            <ul>
                <li>所有图标都是SVG格式，可以无损缩放</li>
                <li>每种图标提供两个版本：标准版和Emoji风格版</li>
                <li>颜色使用渐变效果，更加生动</li>
                <li>可以直接在网页中使用，或导出为PNG格式</li>
            </ul>
        </div>
    </div>
</body>
</html>'''
    return html

def main():
    """主函数"""
    print("=" * 50)
    print("🎨 图标生成器")
    print("=" * 50)
    print()
    
    # 创建输出目录
    output_dir = "generated-icons"
    create_directory(output_dir)
    
    # 生成SVG文件
    icons = {
        "heart.svg": generate_heart_svg(),
        "heart-emoji.svg": generate_heart_emoji(),
        "cat.svg": generate_cat_svg(),
        "cat-emoji.svg": generate_cat_emoji(),
        "dog.svg": generate_dog_svg(),
        "dog-emoji.svg": generate_dog_emoji(),
    }
    
    for filename, content in icons.items():
        filepath = os.path.join(output_dir, filename)
        save_svg(filepath, content)
    
    # 生成预览页面
    preview_html = generate_html_preview()
    preview_path = os.path.join(output_dir, "preview.html")
    save_svg(preview_path, preview_html)
    
    print()
    print("=" * 50)
    print("✅ 所有图标生成完成！")
    print(f"📁 输出目录: {output_dir}/")
    print(f"🌐 预览页面: {preview_path}")
    print("=" * 50)
    print()
    print("💡 提示：")
    print("   1. 在浏览器中打开 preview.html 查看所有图标")
    print("   2. 检阅后告诉我，我将替换前端的图标")
    print()

if __name__ == "__main__":
    main()
