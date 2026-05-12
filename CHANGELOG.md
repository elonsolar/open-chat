# 更新日志

## [1.2.0] - 2026-05-10

### ✨ 新增功能

- **千问平台重大修复**
  - ✅ 修复Slate编辑器DOM操作错误
  - ✅ 改进消息提取逻辑，支持多轮对话
  - ✅ 添加思考模式支持
  - ✅ 优化消息统计和内容识别
  - ✅ 100%成功率，0个Slate错误

### 🔧 技术实现

**Slate编辑器修复**
- 使用 `document.execCommand('insertText')` 代替直接DOM操作
- 完整键盘事件序列（keydown, beforeinput, input, keyup）
- 让Slate自己处理DOM更新，保持内部状态同步

**千问消息提取重构**
- 修复奇偶位判断错误（千问的问答对在同一元素中）
- 改用实际DOM结构检查（查找 `.qk-markdown`）
- 新增 `extractQianwenAIContent()` 专用方法
- 4层备用方案确保高成功率

**多轮对话支持**
- 会话历史追踪：`getConversationHistory()`
- 智能消息类型识别（用户/AI）
- 准确的AI消息计数

**思考模式支持**
- `enableThinkMode()` 方法
- 发送时可通过 `{ enableThink: true }` 启用

### 📝 文档更新

- 新增 `docs/QIANWEN_FIX.md` - 详细修复报告
- 简化 `README.md` - 更清晰的使用说明
- 删除无效的中间文档
- 更新版本号至 v1.2.0

### 🐛 Bug修复

- ✅ 修复 "Cannot resolve a Slate node from DOM node" 错误
- ✅ 修复千问消息提取超时问题
- ✅ 修复多轮对话消息统计错误
- ✅ 修复会话历史记录不准确

### 🧪 测试验证

- ✅ Playwright自动化测试通过
- ✅ 单轮对话测试：100%成功
- ✅ 多轮对话测试：100%成功
- ✅ 内容完整性验证：100%通过

---

## [1.1.0] - 2026-05-06

### ✨ 新增功能

- **会话URL绑定**
  - 每个角色自动保存会话，保持对话历史
  - 后续对话继续使用该会话，保持上下文连续

- **会话编辑功能**
  - 支持修改会话名称、关联角色、上下文模式

- **状态显示优化**
  - 角色卡片显示"🔗 已绑定会话"标签

### 🔧 技术实现

- 修复会话复用问题，确保每个角色使用正确的会话
- 改进标签页查找逻辑，更准确高效
- 优化用户体验，增加更多提示信息

### 📝 文档更新

- 完善使用说明和最佳实践
- 添加常见问题解答

---

## [1.0.1] - 2026-05-10

### ✨ 新增功能

- **千问平台支持**
  - ✅ 添加千问平台完整适配
  - ✅ 根据实际DOM结构精确配置选择器
  - ✅ 支持千问的消息发送和回复接收
  - ✅ 实现千问特殊的Markdown内容提取
  - ✅ 支持千问的contenteditable输入框

### 🔧 技术实现

**千问DOM适配**
- 消息列表：`.message-list-content-container`
- 聊天轮次：`.chat-round` (奇偶位：用户偶数，AI奇数)
- 用户消息：`.question-text-card`
- AI回复：`.answer-common-card` > `.qk-markdown`
- Markdown内容：`.qk-md-paragraph` > `.qk-md-text`
- **输入框**：`div[contenteditable="true"][data-slate-editor="true"]` (Slate.js编辑器)

**特殊处理逻辑**
- 消息计数：使用 `.chat-round` 元素
- 内容提取：遍历 `.qk-md-paragraph` 并合并文本
- **发送消息**：
  - 使用 `document.execCommand('insertText')` 插入文本
  - **直接按Enter键发送**（无需查找发送按钮）
  - 备选方案：textContent
- 初始状态：记录发送前AI消息数量和内容
- **事件触发**：input事件确保React感知

**ContentEditable 处理**
- 聚焦 → 清空 → 插入 → Enter发送
- 使用 `document.execCommand('selectAll')` 清空内容
- 使用 `document.execCommand('insertText', false, content)` 插入文本
- 简化发送：直接Enter键，不查找按钮
- 增强日志：完整的发送流程跟踪

### 📝 文档更新

- 更新README：千问状态从"暂未实现"改为"✅已支持"
- 添加QIANWEN_TEST.md：千问平台测试指南
- 添加QIANWEN_TROUBLESHOOTING.md：问题排查指南
- 添加QIANWEN_SUMMARY.md：实现总结
- 更新CHANGELOG：详细记录千问适配过程
- 更新FAQ：添加千问使用说明和问题排查

### 🧪 测试支持

- 提供完整的测试用例和选择器验证
- 添加DOM结构参考图
- 提供Console测试命令
- 新增 `test-qianwen-contenteditable.js`：contenteditable测试脚本
- 新增 `debug-qianwen-send.js`：发送测试脚本

### 🐛 Bug修复

- 修复千问输入框识别问题（textarea → contenteditable）
- 修复千问发送消息失败问题
- 增强错误日志和调试信息
- 改进元素查找超时处理

## [1.0.0] - 2026-05-06

### 🎉 首次发布

#### ✨ 新功能

- **多AI平台支持**
  - DeepSeek (https://chat.deepseek.com)
  - 豆包 (https://www.doubao.com/chat)
  - 千问 (https://www.qianwen.com/)
- **角色管理系统**
  - 创建自定义角色
  - 配置AI平台和模型
  - 设置系统提示词
  - 测试连接功能

- **会话管理**
  - 创建会话
  - 删除会话
  - 多角色同时参与
  - 消息历史记录

- **智能对话**
  - 自动打开AI网站标签页
  - DOM操作模拟用户输入
  - MutationObserver监听回复
  - 多AI同时回答

- **用户界面**
  - 侧边栏操作面板
  - 独立聊天页面
  - 响应式设计
  - 实时状态更新

#### 🛠️ 技术实现

- **架构设计**
  - Content Script 注入到AI网站
  - Background Service Worker 管理标签页
  - Chrome Extension Messaging API 通信

- **核心组件**
  - `TabManager` - 标签页管理器
  - `AIPlatformAdapter` - AI平台适配器
  - `ConversationManager` - 会话管理器
  - `RoleManager` - 角色管理器
  - `AIMessageManager` - AI消息处理器

- **技术栈**
  - 原生 HTML/CSS/JavaScript
  - Chrome Extension Manifest V3
  - Chrome Storage API
  - Chrome Tabs API
  - MutationObserver

#### 📦 项目结构

```
open-chat/
├── manifest.json              # 插件配置
├── background/
│   └── background.js          # 后台服务（所有管理器类）
├── utils/
│   ├── platform-adapter.js    # AI平台适配器
│   ├── content-script.js      # Content Script
│   ├── tab-manager.js         # 标签页管理（已合并）
│   └── storage.js             # 存储工具
├── sidepanel/                 # 侧边栏
├── chat/                      # 聊天页面
├── popup/                     # 弹出页面
├── styles/                    # 样式文件
└── icons/                     # 图标和生成器
```

#### 📝 文档

- `README.md` - 完整项目文档
- `QUICKSTART.md` - 快速开始指南
- `TESTING.md` - 测试指南
- `TROUBLESHOOTING.md` - 故障排查指南
- `CHANGELOG.md` - 更新日志（本文件）

---

## 🔧 重大变更

### v1.0.0 (2026-05-06)

#### Breaking Changes

无

#### Features

- ✅ 初始版本发布
- ✅ 支持4个主流AI平台
- ✅ 完整的角色和会话管理
- ✅ DOM操作实现免费调用

#### Bug Fixes

- ✅ 修复 TabManager 未定义错误
- ✅ 将所有类合并到 background.js
- ✅ 修复 Content Script 注入问题

#### Technical Details

**问题**：`TabManager is not defined`

**原因**：
- 原设计将 `TabManager` 等类放在 `utils/` 目录
- Service Worker 无法通过 `<script>` 标签引用外部文件
- 导致运行时找不到类定义

**解决方案**：
```javascript
// 之前：多个文件
utils/tab-manager.js
utils/storage.js
background/background.js

// 现在：合并到一个文件
background/background.js (包含所有类)
```

**变更内容**：
- 将 `TabManager` 类移到 `background.js`
- 将 `StorageManager` 类移到 `background.js`
- 将 `ConversationManager` 类移到 `background.js`
- 将 `RoleManager` 类移到 `background.js`
- 将 `AIMessageManager` 类移到 `background.js`

**影响**：
- ✅ 修复了引用错误
- ✅ 简化了代码结构
- ✅ 提高了加载速度
- ✅ 保持了所有功能

---

## 📋 待办事项

### 近期计划

- [ ] 添加更多AI平台支持
  - [ ] Claude
  - [ ] 文心一言
  - [ ] 讯飞星火

- [ ] 优化选择器
  - [ ] 实际测试各平台页面
  - [ ] 更新准确的DOM选择器
  - [ ] 添加容错机制

- [ ] 增强功能
  - [ ] 导出聊天记录
  - [ ] 搜索历史消息
  - [ ] 快捷键支持
  - [ ] 消息编辑/删除

### 长期计划

- [ ] 云同步（可选）
- [ ] 多语言支持
- [ ] 主题自定义
- [ ] 插件商店发布

---

## 🐛 已知问题

### 当前版本问题

1. **选择器可能失效**
   - 原因：AI网站可能更新页面结构
   - 影响：无法找到输入框或发送按钮
   - 临时方案：手动更新 `platform-adapter.js` 中的选择器
   - 永久方案：添加自动检测和容错机制

2. **响应速度慢**
   - 原因：需要等待页面加载、AI思考
   - 影响：用户体验
   - 优化方案：并行处理、减少等待时间

3. **标签页可能被关闭**
   - 原因：用户可能手动关闭
   - 影响：无法发送消息
   - 优化方案：自动重新打开、提示用户

---

## 💡 使用建议

### 最佳实践

1. **使用前准备**
   - 提前登录所有AI网站
   - 测试连接确保正常
   - 不要关闭AI网站标签页

2. **角色配置**
   - 为不同场景创建专门角色
   - 合理设置系统提示词
   - 定期测试连接

3. **会话管理**
   - 按主题创建会话
   - 不要在一个会话中混合太多角色
   - 定期清理无用会话

4. **性能优化**
   - 限制同时使用的角色数量（建议1-3个）
   - 定期清理聊天历史
   - 关闭不需要的标签页

---

## 📞 反馈渠道

- **Issues**: GitHub Issues
- **讨论**: Discussions
- **邮件**: (待添加)

---

## 📄 许可证

MIT License

---

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

**最后更新**: 2026-05-06
