# 多模型AI对话助手 - 免费多模型协作浏览器扩展

> 🚀 一款强大的浏览器扩展，让你免费使用多个 AI 模型进行协作对话。无需 API 密钥，支持 DeepSeek、千问、豆包、Kimi 等主流国内 AI 平台。

## ✨ 为什么选择 free-ai？

- **💰 完全免费**：无需购买 API 密钥，直接使用网页版 AI
- **🤖 多模型协作**：让 DeepSeek、千问、豆包、Kimi 同时为你工作
- **🔧 开发者友好**：通过 OpenAI 兼容 API 集成到 VS Code、Cursor 等工具
- **🎯 提高效率**：并行、顺序、随机接龙三种协作模式
- **🔒 隐私安全**：所有数据存储在本地，不上传到第三方
- **⚡ 即装即用**：无需配置，安装后即可使用

---

**📚 快速导航**：[快速开始](#快速开始) | [核心功能](#核心功能) | [进阶使用](#进阶使用) | [常见问题](#常见问题)

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**

## 快速开始

### 1. 安装扩展

```bash
# 克隆项目
git clone https://github.com/elonsolar/free-ai.git
cd free-ai
```

**加载到浏览器**：

1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录

### 2. 登录 AI 平台

首次使用前，请在浏览器中登录对应平台：

| 平台 | 登录网址 |
|------|----------|
| DeepSeek | https://chat.deepseek.com |
| 千问 | https://www.qianwen.com |
| 豆包 | https://www.doubao.com/chat |
| Kimi | https://www.kimi.com |

### 3. 创建会话

**侧边栏** → **角色** → **新建角色**

配置参数：
- **名称**：角色显示名称（如"代码助手"、"翻译专家"）
- **提供商**：选择 AI 平台（DeepSeek/千问/豆包/Kimi）
- **系统提示词**：设定角色定位和行为模式

**侧边栏** → **会话** → **新建会话**

1. 选择多个角色参与会话
2. 选择上下文模式：
   - **独享模式**：每个角色独立对话，互不干扰
   - **共享模式**：所有角色共享对话历史，支持协作
3. 输入消息开始多模型协作

### 4. 切换协作模式

在聊天输入框输入 `/mode` 或点击模式徽章：

- **并行**：所有角色同时回答，快速获得多个视角
- **顺序接龙**：按顺序依次回答，后续角色可见前面的回复
- **随机接龙**：随机打乱顺序接龙，增加创意

## 核心功能

### 支持的平台

| 平台 | 状态 | 特色 |
|------|------|------|
| DeepSeek | ✅ 已支持 | 强大的代码生成能力 |
| 豆包 | ✅ 已支持 | 字节出品，中文优化 |
| 千问 | ✅ 已支持 | 阿里云大模型 |
| Kimi | ✅ 已支持 | 长文本处理能力强 |

### 多模型协作模式

**并行模式**：所有角色同时回答，适合需要多个独立观点的场景（头脑风暴、多角度分析）

**顺序接龙模式**：角色依次回答，后续角色可见前面的回复（协作创作、代码审查接力）

**随机接龙模式**：随机打乱顺序，增加创意和不可预测性（创意激发、打破思维定势）

### 上下文管理

**独享模式**：每个角色维护独立的对话历史，适合对比不同模型的表现

**共享模式**：所有角色共享完整对话历史，适合协作讨论、接力创作

### 聊天命令

- `/clear` - 清空当前会话的所有消息并删除平台会话
- `/mode` - 打开模式选择器，切换发送模式和上下文模式

### 应用场景

- **代码审查**：让多个 AI 同时审查代码，获得多角度反馈，并行请求不同模型快速定位问题
- **创意写作**：不同角色负责不同章节协作创作，随机接龙模式突破思维定势
- **学习研究**：从多个角度理解复杂概念，模拟专家小组进行问题讨论

### 技术亮点

- ✅ **无需 API 密钥**：直接操作网页版 AI，完全免费
- ✅ **平台解耦**：适配器模式，易于添加新平台
- ✅ **本地优先**：所有数据存储在本地，保护隐私
- ✅ **轻量级**：无外部依赖，加载速度快
- ✅ **可扩展**：支持工具调用和自定义集成

## 进阶使用

### 集成 opencode（可选）

通过 OpenAI API 格式将 free-ai 集成到 opencode，实现本地工具调用。

**步骤 1：启动服务器**

```bash
cd server
npm install
npm start
```

服务器将启动：
- **API 服务**：`http://localhost:3000` - OpenAI 兼容的 API 端点
- **WebSocket 服务**：`ws://localhost:8080` - 用于实时通信

**步骤 2：配置扩展连接**

1. 点击扩展图标打开弹窗
2. 展开"连接设置"
3. 填写 WebSocket 地址：`ws://localhost:8080`
4. 勾选"启用 WebSocket 连接"
5. 点击"保存设置"

**步骤 3：配置 opencode**

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "free-ai": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "FreeAI",
      "options": {
        "baseURL": "http://localhost:3000/v1",
        "apiKey": "any"
      },
      "models": {
        "free": {
          "name": "任意会话名称"
        }
      }
    }
  }
}
```

在 opencode 中选择 `free-ai` 提供商和 `free` 模型，即可通过扩展访问多个 AI 模型。

### 集成到其他工具

支持任何兼容 OpenAI API 格式的工具，如 Cursor、Continue 等。

### 系统要求

- **浏览器**：Chrome 88+、Edge 88+ 或其他 Chromium 浏览器
- **网络**：需要访问对应 AI 平台的网站
- **权限**：需要访问网站权限和存储权限
- **服务器（可选）**：Node.js 14+ 用于 opencode 集成

## 常见问题

### 安装与使用

**Q: 是否需要 API 密钥？**

A: 不需要。本扩展直接操作 AI 网页版，无需 API 密钥，完全免费使用。

**Q: 支持哪些浏览器？**

A: 支持 Chrome、Edge 以及其他基于 Chromium 的浏览器。

**Q: 可以同时使用多个 AI 平台吗？**

A: 可以。你可以创建不同平台的角色，并在一个会话中同时使用它们。

### 隐私与安全

**Q: 扩展会收集我的对话内容吗？**

A: 不会。所有对话都直接在浏览器和 AI 平台之间进行，扩展不存储任何对话内容。

**Q: 对话内容安全吗？**

A: 扩展只是浏览器自动化工具，不存储、不上传任何对话内容。安全性取决于你使用的 AI 平台。

### 功能与性能

**Q: 多个 AI 同时响应会慢吗？**

A: 并行模式下，所有 AI 同时工作，不会比单个 AI 更慢。顺序模式会依次等待。

**Q: 支持代码高亮吗？**

A: 支持。扩展使用 marked.js 渲染 Markdown，支持代码块和语法高亮。

**Q: 如何集成到自己的应用？**

A: 通过本地服务器的 OpenAI 兼容 API，可以集成到任何支持 OpenAI 格式的应用。

### 对比与选择

**Q: 和直接使用 AI 网站有什么区别？**

A: 主要优势：多模型协作、统一界面、上下文管理、本地工具集成、无 API 费用。

**Q: 为什么选择 free-ai？**

A:
- ✅ 完全免费，无需 API
- ✅ 支持国内 AI 平台
- ✅ 浏览器扩展，使用方便
- ✅ 多模型协作，提高效率
- ✅ 可集成到开发工具
- ✅ 开源，可自定义扩展

## 贡献指南

欢迎贡献代码、报告问题或提出新功能建议！

### 如何贡献
1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 添加新平台支持
1. 在 `utils/platforms/` 创建新的适配器文件
2. 继承 `BasePlatformAdapter` 类
3. 实现必需方法：`sendMessage()`、`waitForResponse()`、`getConversationHistory()`
4. 在 `manifest.json` 添加 URL 匹配规则
5. 在 `content-script.js` 注册平台检测
6. 在 `background.js` 添加平台映射

### 代码规范
- 使用原生 JavaScript，避免外部依赖
- 遵循现有的代码风格和命名规范
- 添加必要的注释说明
- 确保在 Chrome 和 Edge 上都能正常运行

## 更新日志

### v1.1.0 (最新)
- ✨ 新增跨平台会话删除功能，清除会话时自动删除各平台会话

### v1.0.0
- ✨ 支持 DeepSeek、千问、豆包、Kimi 四个平台
- ✨ 实现多模型协作（并行、顺序、随机接龙）
- ✨ 支持上下文管理（独享/共享模式）
- ✨ 集成 opencode 支持
- ✨ 侧边栏 UI 和全屏聊天界面
- ✨ 角色管理和会话管理
- ✨ Markdown 渲染和代码高亮
- ✨ 聊天命令支持（`/clear`、`/mode`）

## 联系方式

- **问题反馈**：[GitHub Issues](https://github.com/elonsolar/free-ai/issues)
- **功能建议**：[GitHub Discussions](https://github.com/elonsolar/free-ai/discussions)
- **邮箱**：641620192@qq.com

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=elonsolar/free-ai&type=Date)](https://star-history.com/#elonsolar/free-ai&Date)

## License

MIT
