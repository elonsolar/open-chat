# 🔧 选择器更新和错误修复

## ✅ 已修复的问题

### 问题1: sidepanel.js 空元素引用
**错误**：`Cannot read properties of null (reading 'addEventListener')`

**原因**：bindEvents() 在元素存在之前就尝试绑定事件

**修复**：
- 添加了元素存在性检查
- 只在元素存在时才绑定事件

---

### 问题2: DeepSeek选择器不正确
**错误**：`元素 textarea[placeholder*="输入"] 未找到`

**原因**：DeepSeek的输入框没有使用这个特定的placeholder

**修复**：更新了DeepSeek的选择器为更通用的版本

---

## 📋 更新的选择器

### DeepSeek（已更新）

```javascript
{
  inputBox: 'textarea, div[contenteditable="true"], #prompt-textarea',
  sendButton: 'button[aria-label*="发送"], button[aria-label*="Send"], button[type="submit"], button[class*="send"]',
  messageList: '[class*="message"], [class*="chat"], [class*="conversation"]',
  userInput: '[class*="user"], [class*="human"], [data-message-author-role="user"]',
  aiResponse: '[class*="assistant"], [class*="ai"], [class*="bot"], [data-message-author-role="assistant"]'
}
```

**改进**：
- 使用多个备选选择器（用逗号分隔）
- 支持textarea、contenteditable div、#prompt-textarea
- 支持多种发送按钮类型
- 更多的消息列表选择器

---

### 其他平台

**豆包**：保持不变（已经能工作）
**千问**：保持不变
**ChatGPT**：保持不变

---

## 🚀 现在请执行

### 第1步：重新加载插件

```
1. 打开 edge://extensions/
2. 找到"多模型AI对话助手"
3. 点击刷新按钮 🔄
```

### 第2步：刷新AI网站

```
1. 完全关闭所有AI网站标签页
2. 重新打开：
   - DeepSeek: https://chat.deepseek.com
   - 豆包: https://www.doubao.com/chat/
   - 千问: https://www.qianwen.com
3. 确保已登录
4. 按F5刷新页面
5. 等待页面完全加载
```

### 第3步：验证Content Script

```
1. 在AI网站按F12
2. 打开Console标签
3. 查找日志：
   [AI Plugin] 检测到平台: deepseek
   [AI Plugin] 初始化完成
```

### 第4步：测试连接

```
1. 打开侧边栏 (Ctrl+Shift+S)
2. 创建角色（选择DeepSeek）
3. 点击"测试"按钮
```

---

## 🔍 如何验证修复

### 成功的标志

**在DeepSeek页面按F12，Console应该显示**：
```
[AI Plugin] 检测到平台: deepseek
[AI Plugin] 初始化完成
[deepseek] 找到元素: textarea...
[deepseek] 元素已出现: button...
```

**在Background控制台应该显示**：
```
[TabManager] Ping成功!
[TabManager] 向 deepseek 发送消息: sendMessage
```

**测试结果**：
```
✅ 连接成功！
```

---

## 🎯 如果还有问题

### 问题1: 还是找不到元素

**解决方案**：
1. 打开DeepSeek网站
2. 按F12打开开发者工具
3. 使用元素选择器（左上角箭头图标）
4. 点击输入框
5. 查看HTML结构
6. 告诉我具体的class或id

### 问题2: Content Script未注入

**解决方案**：
```
1. 重新加载插件
2. 刷新DeepSeek页面
3. 检查F12控制台
4. 确认有 [AI Plugin] 日志
```

### 问题3: 一直超时

**可能原因**：
- DeepSeek网站更新了页面结构
- 网络问题
- 页面还没完全加载

**解决方案**：
1. 等待页面完全加载
2. 刷新页面重试
3. 检查网络连接

---

## 📊 选择器说明

### 多选择器机制

使用逗号分隔的选择器会按顺序尝试：

```javascript
'textarea, div[contenteditable="true"], #prompt-textarea'
```

**逻辑**：
1. 先找 `textarea`
2. 找不到则找 `div[contenteditable="true"]`
3. 还找不到则找 `#prompt-textarea`
4. 都找不到则报错

### 优势

- ✅ 适应不同版本的AI网站
- ✅ 容错性更强
- ✅ 支持多种页面结构

---

## 💡 选择器调试技巧

### 手动测试选择器

在AI网站的Console中执行：

```javascript
// 测试输入框
document.querySelector('textarea')

// 测试发送按钮
document.querySelector('button[aria-label*="发送"]')

// 测试消息列表
document.querySelector('[class*="message"]')
```

**如果有返回值** → 选择器正确
**如果返回null** → 需要更新选择器

### 找到正确的选择器

```
1. 在AI网站按F12
2. 点击元素选择器（箭头图标）
3. 点击目标元素
4. 查看Elements标签中高亮的HTML
5. 复制class、id或aria-label
```

---

## 🔄 自动重试机制

插件现在有内置重试：

1. **等待页面加载**：最多3秒
2. **Ping检测**：尝试3次
3. **元素查找**：最长10秒
4. **AI回复**：最长60秒

---

## ⚠️ 重要提示

### 使用前确保

```
□ 插件已重新加载
□ AI网站已完全加载
□ 已登录AI网站
□ F12能看到 [AI Plugin] 日志
□ 页面状态栏显示"完成"
```

### 如果失败

1. **查看F12控制台** - 看具体错误
2. **刷新页面** - 重新加载页面
3. **重新测试** - 再次尝试连接

---

## 📞 需要帮助？

如果还有选择器问题：

1. 打开AI网站
2. 按F12找到元素
3. 截图HTML结构
4. 告诉我具体的选择器

---

**现在DeepSeek应该能正常工作了！** 🎉

试试重新加载插件和刷新DeepSeek页面，然后测试连接。
