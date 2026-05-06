# ⚡ 快速修复 - 3步解决所有问题

## 🎯 你的问题

1. ❌ `Cannot read properties of null` - sidepanel错误
2. ❌ DeepSeek找不到输入框
3. ❌ 豆包/DeepSeek超时

---

## ✅ 已修复内容

1. **sidepanel.js** - 添加空元素检查
2. **DeepSeek选择器** - 更新为通用版本
3. **错误处理** - 更详细的日志

---

## 🚀 3步解决

### 第1步：重新加载插件

```
1. 打开 edge://extensions/
2. 找到"多模型AI对话助手"
3. 点击刷新按钮 🔄
4. 等待2秒
```

### 第2步：刷新所有AI网站

```
1. 关闭所有AI网站标签页
2. 重新打开并登录：
   • DeepSeek: https://chat.deepseek.com
   • 豆包: https://www.doubao.com/chat/
   • 千问: https://www.qianwen.com
3. 按F5刷新页面
4. 等待完全加载
```

### 第3步：验证并测试

```
1. 在AI网站按F12
2. 查看Console标签
3. 确认有这个日志：
   [AI Plugin] 检测到平台: deepseek
4. 打开侧边栏
5. 创建角色并测试
```

---

## ✅ 成功标志

**F12控制台显示**：
```
✅ [AI Plugin] 检测到平台: deepseek
✅ [AI Plugin] 初始化完成
```

**测试连接显示**：
```
✅ 连接成功！
```

---

## ❌ 如果还失败

### 检查清单

```
□ 插件已重新加载
□ AI网站已完全加载
□ 已登录AI网站
□ F12有 [AI Plugin] 日志
□ 页面状态显示"完成"
```

### 手动测试选择器

在DeepSeek网站按F12，Console输入：

```javascript
// 查找输入框
document.querySelector('textarea')

// 查找发送按钮
document.querySelector('button[type="submit"]')
```

**如果有返回值** → 选择器正确
**返回null** → 需要进一步调试

---

## 🎉 总结

**最重要的2件事**：
1. ✅ 重新加载插件
2. ✅ 刷新AI网站

**然后就可以正常使用了！**

---

现在试试吧！应该能解决所有问题。🚀
