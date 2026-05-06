# 🚨 紧急修复步骤

## 问题分析
- ✅ 之前：豆包能发送和接收（说明DOM操作有效）
- ❌ 现在：连发送都不工作了
- 根本原因：Content Script未正确暴露到window对象

## 已修复
1. ✅ content-script.js中添加了`window.platformAdapter = adapter`
2. ✅ 暴露了platformAdapter供background.js检测

## ⚡ 立即操作（按顺序）

### 第1步：重新加载扩展（必须！）
1. 打开 `edge://extensions/`
2. 找到"多模型AI对话助手"
3. 点击刷新图标🔄
4. **确保没有错误提示**

### 第2步：完全关闭豆包
1. 关闭所有豆包标签页
2. 等待3秒

### 第3步：重新打开豆包
1. 打开 https://www.doubao.com/chat/
2. 确保已登录
3. **按F12打开开发者工具**
4. 切换到Console标签
5. **应该看到**：
   ```
   [AI Plugin] 检测到平台: doubao
   [AI Plugin] platformAdapter已暴露到window对象
   [AI Plugin] 初始化完成
   ```

### 第4步：验证Content Script已就绪
在豆包Console中运行：
```javascript
window.platformAdapter
```

**应该返回一个对象，不是undefined**

### 第5步：测试插件
1. 点击插件图标打开侧边栏
2. 点击"测试连接"按钮
3. **观察豆包页面是否自动发送消息**

---

## 🔍 如果还是不行

### 在豆包Console运行诊断：
```javascript
// 检查1: platformAdapter是否存在
console.log('1. platformAdapter:', typeof window.platformAdapter);

// 检查2: 能否找到输入框
console.log('2. 输入框数量:', document.querySelectorAll('textarea').length);

// 检查3: 能否找到按钮
console.log('3. 按钮数量:', document.querySelectorAll('button').length);

// 检查4: 页面URL
console.log('4. 当前URL:', window.location.href);

// 检查5: chrome.runtime是否可用
console.log('5. chrome.runtime:', typeof chrome.runtime);
```

**把这些结果截图发给我**

---

## 🎯 成功标志

Console中应该看到：
```
✅ [AI Plugin] 检测到平台: doubao
✅ [AI Plugin] platformAdapter已暴露到window对象
✅ [AI Plugin] 初始化完成
```

豆包页面应该：
- 自动填入"测试连接"消息
- 自动点击发送
- 收到豆包回复

---

## 💡 常见问题

**Q: Console显示"AIPlatformAdapter is not defined"**
A: platform-adapter.js加载失败，检查manifest.json

**Q: Console什么都没有**
A: Content Script未注入，重新加载扩展

**Q: platformAdapter是undefined**
A: 刚刚修复了，重新加载扩展即可

---

**现在请：**
1. 重新加载扩展
2. 刷新豆包页面
3. 把Console的输出截图发给我
