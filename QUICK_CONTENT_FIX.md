# ⚡ 快速修复指南 - 3步解决问题

## 🎯 你的错误

```
错误: Cannot read properties of undefined (reading 'error')
```

**原因**：Content Script没有注入到AI网站

---

## 🚀 3步快速修复

### 第1步：重新加载插件

```
1. 打开 edge://extensions/
2. 找到"多模型AI对话助手"
3. 点击刷新按钮 🔄
```

### 第2步：刷新AI网站

```
1. 完全关闭所有AI网站标签页
2. 重新打开并登录：
   - https://chat.deepseek.com
   - https://www.doubao.com/chat/
   - https://www.qianwen.com
3. 按F5刷新页面
4. 等待页面完全加载
```

### 第3步：测试连接

```
1. 打开侧边栏 (Ctrl+Shift+S)
2. 创建角色
3. 点击"测试"按钮
```

---

## ✅ 成功标志

你应该看到：
```
✅ 连接成功！
```

---

## ❌ 如果还失败

### 检查Content Script

```
1. 打开AI网站（如DeepSeek）
2. 按F12打开开发者工具
3. 查看Console标签
4. 找这个日志：
   [AI Plugin] 检测到平台: deepseek
```

**如果有这个日志** → Content Script已注入，继续排查

**如果没有这个日志** → Content Script未注入，执行以下操作：

```
1. 完全关闭浏览器
2. 重新打开浏览器
3. 重新加载插件
4. 打开AI网站
5. 按F5刷新页面
6. 再次检查日志
```

---

## 🎯 完整检查清单

使用前确保：

```
□ 插件已重新加载
□ AI网站已完全加载
□ 已登录AI网站
□ F12能看到 [AI Plugin] 日志
□ 页面底部状态栏显示"完成"
```

---

## 💡 为什么会这样？

1. **网址更新了** → 插件配置需要重新加载
2. **页面没加载完** → Content Script还没注入
3. **浏览器缓存** → 旧配置还在内存中

**解决方案**：刷新插件 + 刷新页面

---

## 🔧 高级排查

### 查看Background日志

```
1. 打开 edge://extensions/
2. 找到插件
3. 点击"检查视图：service worker"
4. 查看Console
```

**正常日志**：
```
[TabManager] Ping成功!
```

**错误日志**：
```
[TabManager] Ping失败，Content Script可能未注入
```

---

## 📞 还是不行？

### 完全重置

```
1. 移除插件
2. 关闭浏览器
3. 重新打开浏览器
4. 重新加载插件
5. 重新登录AI网站
6. 测试连接
```

---

## 🎉 记住

**每次使用前**：
1. ✅ 刷新插件
2. ✅ 刷新AI网站
3. ✅ 检查Content Script日志
4. ✅ 然后再使用

---

**现在试试重新加载插件和刷新网站，应该就能工作了！** 🚀

如果还有问题，查看详细文档：`CONTENT_SCRIPT_FIX.md`
