# 🎯 快速修复清单

## 第1步：重新加载扩展（30秒）

1. 打开新标签页，输入：`edge://extensions/`
2. 找到"多模型AI对话助手"
3. 点击刷新图标 🔄
4. 看到"已重新加载"提示

---

## 第2步：刷新豆包（20秒）

1. 关闭所有豆包标签页
2. 打开 https://www.doubao.com/chat/
3. 确保已登录
4. **按F12**（重要！）
5. 点击Console标签

---

## 第3步：检查初始化（10秒）

在Console中应该看到：
```
✅ [AI Plugin] ========== 开始初始化 ==========
✅ [AI Plugin] 检测到平台: doubao
✅ [AI Plugin] ✓ AIPlatformAdapter类存在
✅ [AI Plugin] ✓ 适配器创建成功
✅ [AI Plugin] ✓ platformAdapter已暴露到window对象
✅ [AI Plugin] ✓ 消息监听器已注册
✅ [AI Plugin] 初始化完成
```

**如果看到这些 → 继续**

**如果没看到 → 告诉我**

---

## 第4步：验证platformAdapter（5秒）

在豆包Console输入：
```
window.platformAdapter
```

**应该显示：**
```
AIPlatformAdapter {platform: 'doubao', selectors: {...}}
```

**如果显示undefined → 告诉我**

---

## 第5步：测试连接（1分钟）

1. 打开侧边栏（点击插件图标）
2. 点击"测试连接"按钮
3. **观察豆包页面**
   - 应该自动填入"测试连接"消息
   - 应该自动点击发送
   - 应该看到豆包回复

---

## ❌ 如果还是失败

### 告诉我：

**方法A：截图Console**
- 打开豆包
- 按F12
- 切换到Console标签
- 截图所有文字

**方法B：复制Console日志**
- 在Console中，右键 → Save as...
- 把文件发给我

**方法C：回答3个问题**
1. Console中看到"[AI Plugin]"开头的信息吗？（是/否）
2. 输入`window.platformAdapter`显示什么？（对象/undefined/错误）
3. 豆包页面有自动输入消息吗？（是/否）

---

## 🎯 成功标志

✅ Console有初始化日志
✅ window.platformAdapter是对象
✅ 豆包自动发送消息
✅ 侧边栏显示"连接成功"

---

**现在请按顺序操作，然后告诉我结果。**

我会根据你的反馈继续修复。
