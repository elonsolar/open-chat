# 更新日志

## [1.0.0] - 2026-05-06

### 🎉 首次发布

#### ✨ 新功能

- **多AI平台支持**
  - DeepSeek (https://chat.deepseek.com)
  - 豆包/Coze (https://www.coze.com)
  - 千问 (https://tongyi.aliyun.com)
  - ChatGPT (https://chatgpt.com)

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
