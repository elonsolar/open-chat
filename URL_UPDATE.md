# 🔗 网址更新说明

## ✅ 已更新的网址

根据用户反馈，已将豆包和千问的网址更新为官方网址。

---

## 📋 正确的网址

### 各AI平台官方网址

| 平台 | 网址 | 说明 |
|------|------|------|
| **DeepSeek** | https://chat.deepseek.com | 无变化 ✅ |
| **豆包** | https://www.doubao.com/chat/ | ✅ 已更新 |
| **千问** | https://www.qianwen.com | ✅ 已更新 |
| **ChatGPT** | https://chatgpt.com | 无变化 ✅ |

---

## 🔧 更新的文件

### 代码文件

1. **background/background.js**
   - ✅ 更新了 `openPlatformTab` 方法中的URL
   - ✅ 更新了 `findPlatformTab` 方法中的域名

2. **manifest.json**
   - ✅ 更新了 `content_scripts` 匹配规则
   - 移除了旧的网址（coze.com, tongyi.aliyun.com）
   - 添加了新的网址（doubao.com, qianwen.com）

### 文档文件

3. **USER_GUIDE.md**
   - ✅ 更新了登录步骤中的网址

4. **MODEL_REFERENCE.md**
   - ✅ 更新了豆包和千问的网址

5. **MODEL_QUICK_REF.html**
   - ✅ 更新了模型卡片中的网址

---

## 🚀 现在请执行

### 第1步：重新加载插件（必须！）

```
1. 打开 edge://extensions/
2. 找到"多模型AI对话助手"
3. 点击刷新按钮 🔄
```

**重要**：不重新加载插件，新的网址配置不会生效！

---

### 第2步：登录正确的AI网站

#### DeepSeek
```
https://chat.deepseek.com
```

#### 豆包（新地址）
```
https://www.doubao.com/chat/
```

#### 千问（新地址）
```
https://www.qianwen.com
```

#### ChatGPT
```
https://chatgpt.com
```

---

### 第3步：创建角色时选择正确的平台

```
1. 打开侧边栏（Ctrl+Shift+S）
2. 点击"角色"标签
3. 点击"新建角色"
4. 选择服务提供商：
   - DeepSeek
   - 豆包
   - 千问
   - ChatGPT
5. 模型会自动填充
6. 点击"创建"
```

---

## 📊 变更对照表

### 豆包

| 项目 | 旧地址 | 新地址 |
|------|--------|--------|
| 网址 | https://www.coze.com | https://www.doubao.com/chat/ |
| 说明 | 曾使用Coze平台 | 官方豆包网站 |

### 千问

| 项目 | 旧地址 | 新地址 |
|------|--------|--------|
| 网址 | https://tongyi.aliyun.com | https://www.qianwen.com |
| 说明 | 通义千问阿里云版 | 官方千问网站 |

---

## ⚠️ 重要提示

### 使用前请确认

1. **重新加载插件** - 否则新配置不生效
2. **访问正确的网址** - 使用上面列出的官方网址
3. **先登录再使用** - 必须在AI网站登录后才能使用插件

### 测试连接

创建角色后，务必点击"测试"按钮：
```
✅ 成功 → 可以使用
❌ 失败 → 检查是否登录了正确的网站
```

---

## 🔍 如何验证更新成功

### 方法1：查看插件配置

```
1. 打开 edge://extensions/
2. 找到插件
3. 点击"详细信息"
4. 查看"权限"和"内容脚本"
```

应该能看到新的网址权限：
- ✅ https://www.doubao.com/*
- ✅ https://www.qianwen.com/*

### 方法2：测试连接

```
1. 创建一个豆包角色
2. 点击"测试"按钮
3. 应该能自动打开 https://www.doubao.com/chat/
```

---

## 📝 完整操作示例

### 示例：使用豆包

```
第1步：登录豆包
  → 打开 https://www.doubao.com/chat/
  → 登录账号

第2步：重新加载插件
  → edge://extensions/
  → 刷新插件

第3步：创建豆包角色
  → 侧边栏 → 角色标签
  → 新建角色
  → 服务提供商：豆包
  → 模型：（自动填充 doubao-pro）
  → 点击"创建"

第4步：测试连接
  → 点击角色卡片上的"测试"按钮
  → 应该能连接到豆包网站

第5步：开始使用
  → 创建会话
  → 选择豆包角色
  → 开始对话
```

---

## 🎯 总结

### 关键变化

1. **豆包**：从 coze.com 更改为 doubao.com
2. **千问**：从 tongyi.aliyun.com 更改为 qianwen.com
3. **必须**：重新加载插件才能使用新配置

### 下一步

1. ✅ 重新加载插件
2. ✅ 登录正确的AI网站
3. ✅ 创建角色并测试
4. ✅ 开始使用

---

**更新完成后，你就可以正常使用豆包和千问了！** 🎉

如有问题，请查看：
- `USER_GUIDE.md` - 完整使用指南
- `MODEL_REFERENCE.md` - 模型参考手册
- `TROUBLESHOOTING.md` - 故障排查指南
