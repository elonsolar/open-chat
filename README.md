# 多模型AI对话助手 - 免费多模型协作浏览器扩展

> 🚀 一款强大的浏览器扩展，让你免费使用多个 AI 模型进行协作对话。无需 API 密钥，支持 DeepSeek、千问、豆包、Kimi 等主流国内 AI 平台。

## 项目简介

free-ai 是一款创新的浏览器扩展，通过自动化操作 AI 网页版，实现多模型协作对话，完全免费使用。它打破了单一 AI 的限制，让你可以同时使用多个 AI 模型进行协作、对比和创意激发。

### 为什么选择 free-ai？

- **💰 完全免费**：无需购买 API 密钥，直接使用网页版 AI
- **🤖 多模型协作**：让 DeepSeek、千问、豆包、Kimi 同时为你工作
- **🔧 开发者友好**：通过 OpenAI 兼容 API 集成到 VS Code、Cursor 等工具
- **🎯 提高效率**：并行、顺序、随机接龙三种协作模式
- **🔒 隐私安全**：所有数据存储在本地，不上传到第三方
- **⚡ 即装即用**：无需配置，安装后即可使用

### 核心价值

1. **降低 AI 使用门槛**：让所有人都能免费使用多个 AI 模型
2. **提升工作效率**：多 AI 协作，快速获得多角度反馈
3. **激发创意灵感**：不同 AI 的碰撞，产生意想不到的创意
4. **辅助开发工作**：集成到开发工具，成为强大的编程助手
5. **对比 AI 能力**：直观对比不同 AI 在相同任务上的表现

**标签**：`浏览器扩展` `多模型AI` `DeepSeek` `千问` `豆包` `Kimi` `AI对话` `AI协作` `免费AI` `Chrome扩展` `Edge扩展` `无需API` `AI工具` `多平台` `代码助手` `OpenAI兼容` `opencode集成` `AI插件` `多AI协作` `AI工作流` `AI助手` `开发工具` `OpenAI替代` `国内AI` `中文AI` `免费大模型` `多AI聊天` `AI聚合器` `免费LLM` `AI协作平台` `开源AI工具` `AI编程助手` `AI生产力`

**相关搜索**：免费 AI 工具、多 AI 平台、AI 浏览器插件、无需 API 密钥、AI 对话助手、多模型协作、免费 GPT 替代、DeepSeek 客户端、千问浏览器插件、豆包扩展、Kimi 助手、免费大模型、国内 AI 工具、中文 AI 助手、AI 聚合器、多 AI 聊天、AI 对比工具、OpenAI 替代品、VS Code AI 插件、Cursor AI 集成、AI 编程助手、免费 LLM、开源 AI 工具、AI 协作平台、多模型对话、AI 工作流、AI 生产力工具

---

**📚 快速导航**：[快速开始](#快速开始) | [应用场景](#应用场景) | [支持的平台](#支持的平台) | [常见问题](#常见问题) | [贡献指南](#贡献指南)

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**

## 目录

- [核心特性](#核心特性) | [快速开始](#快速开始) | [应用场景](#应用场景)
- [支持的平台](#支持的平台) | [功能说明](#功能说明) | [技术架构](#技术架构)
- [常见问题](#常见问题) | [相关项目](#相关项目) | [贡献指南](#贡献指南)
- [更新日志](#更新日志) | [路线图](#路线图) | [License](#license)

## 核心特性

- 🚀 **多平台支持** - DeepSeek、千问、豆包、Kimi，无需API密钥
- 🤖 **多模型协作** - 支持并行、顺序、随机接龙三种模式
- 🔧 **本地工具集成** - 通过OpenAI API格式集成本地工具
- 💾 **灵活上下文** - 独享/共享模式，适应不同对话场景
- 🎯 **智能响应** - 自动检测AI回复完成，支持代码块渲染

## 快速开始

### 1. 安装扩展

```bash
# 克隆项目
git clone https://github.com/yourusername/free-ai.git
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
| Kimi | https://kimi.moonshot.cn |

### 3. 创建角色

**侧边栏** → **角色** → **新建角色**

配置参数：
- **名称**：角色显示名称（如"代码助手"、"翻译专家"）
- **提供商**：选择 AI 平台（DeepSeek/千问/豆包/Kimi）
- **系统提示词**：设定角色定位和行为模式
- **昵称**：会话中的显示名称（可选）
- **额外提示**：针对特定会话的补充指令（可选）

**示例角色配置**：
- 代码助手：精通多种编程语言，擅长代码审查和调试
- 翻译专家：精通中英文翻译，保持原文风格
- 创意写作：富有想象力，擅长故事创作

### 4. 开始多模型对话

**侧边栏** → **会话** → **新建会话**

1. 选择多个角色参与会话
2. 选择上下文模式：
   - **独享模式**：每个角色独立对话，互不干扰
   - **共享模式**：所有角色共享对话历史，支持协作
3. 输入消息开始多模型协作

### 5. 切换发送模式

在聊天输入框输入 `/mode` 或点击模式徽章：

- **并行**：所有角色同时回答，快速获得多个视角
- **顺序接龙**：按顺序依次回答，后续角色可见前面的回复
- **随机接龙**：随机打乱顺序接龙，增加创意

### 6. 集成 opencode（可选）

通过 OpenAI API 格式将 free-ai 集成到 opencode，实现本地工具调用。

**步骤 1：启动服务器**

```bash
cd server
npm install
npm start
```

服务器将启动两个端口：
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

**步骤 4：在 opencode 中使用**

在 opencode 中选择 `free-ai` 提供商和 `free` 模型，即可通过扩展访问多个 AI 模型。

**工作流程**：

```
opencode → API 服务器 (localhost:3000) → 扩展 → AI 网站
                    ↓
WebSocket ← 实时通信 ← 扩展 (localhost:8080)
```

## 应用场景

### 开发者场景
- **代码审查**：让多个 AI 同时审查代码，获得多角度反馈
- **调试助手**：并行请求不同模型，快速定位问题
- **技术选型**：对比不同 AI 对技术方案的建议
- **API 设计**：多个角色协作设计 RESTful API
- **文档编写**：协作生成技术文档和注释

### 内容创作场景
- **文章写作**：不同角色负责不同章节，协作创作
- **翻译工作**：多个翻译师对比，选择最佳翻译
- **创意激发**：随机接龙模式突破思维定势
- **文案优化**：并行生成多个版本的营销文案
- **故事创作**：角色接龙，共创精彩故事

### 学习研究场景
- **概念理解**：从多个角度理解复杂概念
- **问题讨论**：模拟专家小组进行问题讨论
- **方案对比**：让不同 AI 给出解决方案并对比
- **知识整合**：综合多个 AI 的回答，形成全面理解

### 商业应用场景
- **客户服务**：多个 AI 角色协作处理客户咨询
- **市场分析**：从不同维度分析市场趋势
- **竞品分析**：让 AI 从不同角度分析竞品
- **决策支持**：获得多个 AI 的决策建议
- **风险评估**：多角度评估项目风险

## 支持的平台

| 平台 | 状态 | 官网 | 特色 |
|------|------|------|------|
| DeepSeek | ✅ 已支持 | https://chat.deepseek.com | 强大的代码生成能力 |
| 豆包 | ✅ 已支持 | https://www.doubao.com/chat | 字节出品，中文优化 |
| 千问 | ✅ 已支持 | https://www.qianwen.com | 阿里云大模型 |
| Kimi | ✅ 已支持 | https://kimi.moonshot.cn | 长文本处理能力强 |

## 功能说明

### 多模型协作模式

**并行模式**：所有角色同时回答，适合需要多个独立观点的场景
- 用例：头脑风暴、多角度分析

**顺序接龙模式**：角色依次回答，后续角色可见前面的回复
- 用例：协作创作、代码审查接力

**随机接龙模式**：随机打乱顺序，增加创意和不可预测性
- 用例：创意激发、打破思维定势

### 上下文管理

**独享模式**：每个角色维护独立的对话历史
- 适合：对比不同模型的表现、独立任务处理

**共享模式**：所有角色共享完整对话历史
- 适合：协作讨论、接力创作

### 聊天命令

- `/clear` - 清空当前会话的所有消息
- `/mode` - 打开模式选择器，切换发送模式和上下文模式

## 技术架构

### 核心技术栈
- **浏览器扩展**：Chrome Extension Manifest V3
- **前端框架**：原生 JavaScript，无构建工具
- **通信协议**：WebSocket + Chrome Runtime Messaging
- **API 兼容**：OpenAI API 格式
- **存储方案**：Chrome Storage API

### 工作原理
1. **平台适配器**：每个 AI 平台独立的适配器，负责消息发送和响应检测
2. **消息流程**：用户输入 → Background → Content Script → AI 网站
3. **响应检测**：MutationObserver 监听 DOM 变化，自动识别 AI 回复完成
4. **状态管理**：Chrome Storage 持久化会话和角色配置

### 架构优势
- ✅ **无需 API 密钥**：直接操作网页版 AI，完全免费
- ✅ **平台解耦**：适配器模式，易于添加新平台
- ✅ **本地优先**：所有数据存储在本地，保护隐私
- ✅ **轻量级**：无外部依赖，加载速度快
- ✅ **可扩展**：支持工具调用和自定义集成

### 系统要求
- **浏览器**：Chrome 88+、Edge 88+ 或其他 Chromium 浏览器
- **网络**：需要访问对应 AI 平台的网站
- **权限**：需要访问网站权限和存储权限
- **服务器（可选）**：Node.js 14+ 用于 opencode 集成

## 相关项目

### 类似工具
- [ChatALL](https://github.com/sunner/ChatALL) - 多 AI 模型聊天客户端
- [Cherry Studio](https://github.com/kangfenmao/cherry-studio) - AI 助手桌面应用
- [Page Assist](https://github.com/n4ze3m/page-assist) - 浏览器 AI 助手
- [Open WebUI](https://github.com/open-webui/open-webui) - Web AI 界面

### 相关技术
- [OpenAI API](https://platform.openai.com/docs/api-reference) - API 格式参考
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/) - 扩展开发文档
- [opencode](https://opencode.ai) - AI 编程助手

### 集成示例
- **VS Code 集成**：通过 opencode 在编辑器中使用
- **API 集成**：通过本地服务器集成到其他应用
- **工作流集成**：结合自动化工具实现 AI 工作流

## 常见问题

### 安装与使用

**Q: 是否需要 API 密钥？**

A: 不需要。本扩展直接操作 AI 网页版，无需 API 密钥，完全免费使用。

**Q: 支持哪些浏览器？**

A: 支持 Chrome、Edge 以及其他基于 Chromium 的浏览器。

**Q: 如何添加新的 AI 平台？**

A: 目前支持 DeepSeek、千问、豆包、Kimi。更多平台支持正在开发中。

**Q: 可以同时使用多个 AI 平台吗？**

A: 可以。你可以创建不同平台的角色，并在一个会话中同时使用它们。

### 隐私与安全

**Q: 扩展会收集我的对话内容吗？**

A: 不会。所有对话都直接在浏览器和 AI 平台之间进行，扩展不存储任何对话内容。

**Q: 对话内容安全吗？**

A: 扩展只是浏览器自动化工具，不存储、不上传任何对话内容。安全性取决于你使用的 AI 平台。

**Q: 需要联网吗？**

A: 需要。扩展需要访问对应 AI 平台的网站，但不会上传数据到第三方服务器。

### 功能与性能

**Q: 多个 AI 同时响应会慢吗？**

A: 并行模式下，所有 AI 同时工作，不会比单个 AI 更慢。顺序模式会依次等待。

**Q: 支持代码高亮吗？**

A: 支持。扩展使用 marked.js 渲染 Markdown，支持代码块和语法高亮。

**Q: 可以导出对话记录吗？**

A: 当前版本暂不支持导出，对话记录保存在浏览器本地存储中。

**Q: 支持文件上传吗？**

A: 文件上传功能取决于各个 AI 平台本身是否支持。

### 集成与开发

**Q: 如何集成到自己的应用？**

A: 通过本地服务器的 OpenAI 兼容 API，可以集成到任何支持 OpenAI 格式的应用。

**Q: 支持 opencode 以外的工具吗？**

A: 支持。任何兼容 OpenAI API 格式的工具都可以集成，如 Cursor、Continue 等。

**Q: 可以自定义角色吗？**

A: 可以。你可以创建任意数量的角色，为每个角色设置独立的系统提示词。

**Q: 如何调试扩展？**

A: 在 `chrome://extensions/` 页面点击"检查视图"可以查看后台脚本和内容脚本的日志。

### 对比与选择

**Q: 和直接使用 AI 网站有什么区别？**

A: 主要优势：多模型协作、统一界面、上下文管理、本地工具集成、无 API 费用。

**Q: 和 ChatALL 有什么区别？**

A: free-ai 专注于免费国内 AI 平台，无需 API，支持浏览器扩展集成，更轻量级。

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

## 路线图

- [ ] 支持更多 AI 平台（文心一言、讯飞星火等）
- [ ] 对话记录导出功能
- [ ] 对话搜索和历史管理
- [ ] 自定义主题和界面定制
- [ ] 语音输入和输出
- [ ] 多语言界面支持
- [ ] 移动端浏览器支持
- [ ] 云端同步会话配置

## 致谢

感谢以下开源项目的启发：
- [ChatALL](https://github.com/sunner/ChatALL) - 多 AI 聊天的先驱
- [Page Assist](https://github.com/n4ze3m/page-assist) - 浏览器 AI 助手
- [marked.js](https://marked.js.org/) - Markdown 解析器

## 联系方式

- **问题反馈**：[GitHub Issues](https://github.com/yourusername/free-ai/issues)
- **功能建议**：[GitHub Discussions](https://github.com/yourusername/free-ai/discussions)
- **邮箱**：641620192@qq.com

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=elonsolar/free-ai&type=Date)](https://star-history.com/#elonsolar/free-ai&Date)

## License
MIT
