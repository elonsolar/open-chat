# 多模型AI对话助手 - Edge浏览器插件

一个功能强大的Edge浏览器插件，通过**操作AI网页版**实现免费对话，无需API密钥！

## ⭐ 核心特性

- 🎯 **白嫖AI服务** - 通过操作网页版实现，无需API密钥，完全免费
- 🤖 **多模型支持** - DeepSeek、豆包、千问、ChatGPT等多个AI平台
- 👥 **角色管理** - 创建自定义角色，配置不同的AI模型和提示词
- 💬 **会话管理** - 创建、删除会话，每个会话可以选择多个角色同时回答
- 🔄 **自动操作** - 自动在后台打开AI网站，模拟用户输入和点击
- 📱 **侧边栏界面** - 方捷的侧边栏操作，不影响正常浏览
- 💾 **本地存储** - 使用chrome.storage本地存储数据

## 🎯 实现原理

本插件采用 **Content Script + DOM操作** 的方式实现：

```
用户输入消息
    ↓
插件 (background)
    ↓ 打开AI网站标签页
AI网站 (deepseek.com等)
    ↓ 注入 Content Script
content-script.js
    ↓ DOM操作（输入、点击）
网页元素 (输入框、发送按钮)
    ↓ 获取回复内容
MutationObserver 监听
    ↓ 返回结果
插件 (存储到会话)
```

**核心技术：**
- `chrome.tabs` - 管理AI网站标签页
- `chrome.scripting` - 注入Content Script
- `MutationObserver` - 监听页面变化，等待AI回复
- DOM操作 - 模拟用户输入、点击、获取内容

## 📦 安装方法

1. 下载或克隆此项目
2. 生成图标（可选）：双击 `icons/生成图标.bat`
3. 打开Edge浏览器，输入 `edge://extensions/`
4. 启用"开发人员模式"
5. 点击"加载解压缩的扩展"
6. 选择项目根目录

## 🚀 快速开始

### 第一步：登录AI网站

在浏览器中打开并登录你想使用的AI网站：
- DeepSeek: https://chat.deepseek.com
- 豆包: https://www.coze.com
- 千问: https://tongyi.aliyun.com
- ChatGPT: https://chatgpt.com

### 第二步：创建角色

1. 打开插件侧边栏
2. 切换到"角色"标签
3. 点击"新建角色"
4. 填写角色信息：
   - 角色名称：例如"DeepSeek助手"
   - 服务提供商：选择对应的平台
   - 模型：例如"deepseek-chat"
   - 系统提示词：例如"你是一个专业的编程助手"
5. 点击"创建"
6. **重要**：点击"测试"按钮验证连接

### 第三步：创建会话并开始对话

1. 切换到"会话"标签
2. 点击"新建会话"
3. 输入会话名称，例如"编程问题咨询"
4. 选择要参与对话的角色（可多选多个AI）
5. 点击"创建"
6. 在打开的聊天页面中输入消息
7. 所有选中的AI都会同时回答！

## 🔧 支持的AI平台

| 平台 | 网址 | 状态 |
|------|------|------|
| DeepSeek | https://chat.deepseek.com | ✅ 已支持 |
| 豆包 (Coze) | https://www.coze.com | ✅ 已支持 |
| 千问 (通义千问) | https://tongyi.aliyun.com | ✅ 已支持 |
| ChatGPT | https://chatgpt.com | ✅ 已支持 |

## 📋 使用说明

### 创建角色

- **角色名称**：给角色起个名字，例如"代码助手"、"写作助手"
- **服务提供商**：选择AI平台（DeepSeek、豆包、千问等）
- **模型**：填写对应的模型名称（可选）
- **系统提示词**：设置角色的行为和风格

### 测试连接

创建角色后，点击"测试"按钮：
- ✅ 成功：表示插件已成功连接到AI网站
- ❌ 失败：请检查是否已在浏览器中登录对应网站

### 创建会话

- 一个会话可以选择多个角色
- 发送消息时，所有选中的角色都会同时回答
- 每个角色的回答会独立显示在聊天记录中

### 重要提示

⚠️ **使用前请务必：**
1. 在浏览器中登录对应的AI网站
2. 不要关闭AI网站的标签页
3. 首次使用时建议先测试连接

## 🛠️ 项目结构

```
open-chat/
├── manifest.json              # 插件配置
├── background/
│   └── background.js          # 后台脚本（数据管理、标签页管理）
├── utils/
│   ├── platform-adapter.js    # AI平台适配器（DOM操作）
│   ├── content-script.js      # Content Script（注入到AI网站）
│   ├── tab-manager.js         # 标签页管理器
│   └── storage.js             # 存储工具
├── sidepanel/
│   ├── sidepanel.html         # 侧边栏界面
│   └── sidepanel.js           # 侧边栏逻辑
├── chat/
│   ├── chat.html              # 聊天页面
│   └── chat.js                # 聊天逻辑
├── popup/
│   └── popup.html             # 弹出页面
├── styles/
│   ├── sidepanel.css          # 侧边栏样式
│   └── chat.css               # 聊天页面样式
├── icons/                     # 图标资源
└── server/                    # （已弃用）WebSocket服务器
```

## 🔍 工作原理详解

### 1. 标签页管理

当用户发送消息时，插件会：
1. 检查是否已打开对应AI网站的标签页
2. 如果没有，在后台打开新标签页
3. 等待页面加载完成

### 2. Content Script注入

插件会自动将Content Script注入到AI网站：
- 监听来自插件的消息
- 执行DOM操作
- 获取页面内容

### 3. DOM操作

通过以下步骤模拟用户操作：
1. 找到输入框元素
2. 设置输入框的值
3. 触发input和change事件
4. 点击发送按钮
5. 使用MutationObserver监听页面变化
6. 等待AI回复出现
7. 提取回复内容

### 4. 跨页面通信

使用Chrome Extension Messaging API：
- `chrome.runtime.sendMessage` - 从content script发送消息到background
- `chrome.tabs.sendMessage` - 从background发送消息到content script

## 🐛 常见问题

### Q: 提示"测试失败"怎么办？
A: 请确保：
- 已在浏览器中登录对应AI网站
- AI网站标签页已打开
- 网络连接正常

### Q: AI没有回复？
A: 可能原因：
- AI网站页面结构发生变化（选择器失效）
- 网络延迟
- AI服务暂时不可用

### Q: 如何添加新的AI平台？
A: 需要修改以下文件：
1. `utils/platform-adapter.js` - 添加新平台的选择器
2. `manifest.json` - 添加content_scripts匹配规则
3. `utils/tab-manager.js` - 添加平台URL

### Q: 数据会丢失吗？
A: 所有数据存储在浏览器本地存储中。清除浏览器数据或卸载插件会导致数据丢失。

### Q: 为什么不使用官方API？
A:
- 官方API需要付费和密钥
- 网页版通常是免费的（有额度限制）
- 本插件通过模拟浏览器操作实现，完全免费

## 🔐 隐私和安全

- ✅ 所有数据存储在本地，不上传到任何服务器
- ✅ 不收集用户信息
- ✅ 开源代码，可自行审查
- ⚠️ 消息会发送到对应的AI网站（通过网页版）

## 📝 开发说明

### 适配新AI平台

1. **分析目标网站**
   - 打开开发者工具（F12）
   - 找到输入框、发送按钮、消息列表的选择器

2. **修改platform-adapter.js**
   ```javascript
   getSelectors(platform) {
     const selectorMap = {
       newplatform: {
         inputBox: 'textarea#your-input',
         sendButton: 'button.send',
         // ...
       }
     };
   }
   ```

3. **更新manifest.json**
   ```json
   {
     "content_scripts": [{
       "matches": ["https://newplatform.com/*"],
       "js": ["utils/platform-adapter.js", "utils/content-script.js"]
     }]
   }
   ```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

## ⭐ Star History

如果这个项目对你有帮助，请给个Star支持一下！

## 📧 联系方式

如有问题或建议，请提交Issue。

---

**免责声明**：本插件仅用于学习和研究目的。请遵守各AI平台的使用条款和服务协议。
