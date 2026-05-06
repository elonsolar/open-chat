# 🔧 Content Script 注入问题诊断

## ❌ 你遇到的错误

```
错误: Cannot read properties of undefined (reading 'error')
```

这个错误说明：**插件的Content Script没有成功注入到AI网站页面中**。

---

## 🔍 问题原因

### 最常见的原因

1. **manifest.json 的content_scripts配置不匹配**
   - AI网站URL更新了，但插件配置还是旧的
   - 刚刚更新了网址，但插件还没重新加载

2. **AI网站页面未完全加载**
   - 页面还在加载中就尝试发送消息
   - 网络慢导致页面加载超时

3. **Content Script被阻止**
   - 某些扩展可能阻止了Content Script
   - 浏览器安全策略限制

---

## ✅ 解决方案

### 方案1：重新加载插件（必须！）

```
1. 完全关闭所有AI网站标签页
2. 打开 edge://extensions/
3. 找到"多模型AI对话助手"
4. 点击刷新按钮 🔄
5. 等待2秒
```

---

### 方案2：手动刷新AI网站

```
1. 打开DeepSeek: https://chat.deepseek.com
2. 确认已登录
3. 按F5刷新页面
4. 等待页面完全加载
5. 再次测试连接
```

对豆包和千问重复以上步骤。

---

### 方案3：检查Content Script是否注入

**步骤**：

1. 打开AI网站（如DeepSeek）
2. 按 F12 打开开发者工具
3. 切换到 "Console" 标签
4. 查找带有 `[AI Plugin]` 前缀的日志

**应该看到**：
```
[AI Plugin] 检测到平台: deepseek
[AI Plugin] 初始化完成
```

**如果没看到**：
- 说明Content Script没有注入
- 需要重新加载插件

---

### 方案4：检查Background日志

**步骤**：

1. 打开 edge://extensions/
2. 找到"多模型AI对话助手"
3. 点击"检查视图：service worker"
4. 查看控制台日志

**正常日志**：
```
[Background] 初始化...
[TabManager] 打开 deepseek 标签页: xxx
[TabManager] 标签页 xxx 已加载完成
[TabManager] Ping成功!
```

**错误日志**：
```
[TabManager] Ping失败，Content Script可能未注入
[TabManager] 与 deepseek 通信失败
```

---

### 方案5：清除缓存并重试

```
1. 完全关闭浏览器
2. 重新打开浏览器
3. 打开 edge://extensions/
4. 重新加载插件
5. 打开AI网站并测试
```

---

## 📋 完整排查流程

### 步骤1：确认插件已重新加载

```
□ 已更新了manifest.json
□ 已点击刷新按钮
□ 看到插件重新加载的动画
```

### 步骤2：确认AI网站URL正确

```
DeepSeek: https://chat.deepseek.com
豆包:      https://www.doubao.com/chat/
千问:      https://www.qianwen.com
```

### 步骤3：确认AI网站已登录

```
□ 在新标签页打开AI网站
□ 已登录账号
□ 能看到聊天界面
□ 页面完全加载完成
```

### 步骤4：测试Content Script

```
□ 打开AI网站
□ 按F12打开开发者工具
□ Console标签有 [AI Plugin] 日志
□ 看到"检测到平台"消息
```

### 步骤5：测试连接

```
□ 打开侧边栏
□ 创建角色
□ 点击"测试"按钮
□ 看到"连接成功"提示
```

---

## 🚨 如果还是失败

### 最后的手段

**完全重置插件**：

```
1. 打开 edge://extensions/
2. 完全移除"多模型AI对话助手"
3. 关闭所有浏览器窗口
4. 重新打开浏览器
5. 重新加载插件
6. 打开AI网站
7. 创建角色并测试
```

---

## 🎯 预防措施

### 使用前检查

1. **每次使用前**
   - 确保插件已加载
   - 确认AI网站已登录
   - 确认页面已完全加载

2. **定期刷新**
   - 每天第一次使用时刷新插件
   - AI网站更新后刷新插件

3. **查看日志**
   - 遇到问题立即查看控制台
   - 记录错误信息

---

## 💡 快速自检

### 每次使用前运行这个检查

```
□ 插件已刷新
□ AI网站已打开
□ AI网站已登录
□ 页面已完全加载（底部状态栏显示"完成"）
□ F12控制台有 [AI Plugin] 日志
```

如果所有项都打勾，说明可以正常使用了。

---

## 📞 如果问题仍然存在

### 收集以下信息

1. **Background日志**
   ```
   edge://extensions/ → 检查视图：service worker → Console
   截图所有日志
   ```

2. **Content Script日志**
   ```
   AI网站 → F12 → Console
   截图所有 [AI Plugin] 相关日志
   ```

3. **浏览器版本**
   ```
   打开 edge://version
   截图版本信息
   ```

4. **插件版本**
   ```
   打开 edge://extensions/
   找到插件版本号
   ```

### 提交问题时附上

- 所有截图
- 具体操作步骤
- 期望结果
- 实际结果

---

## 🎉 成功的标志

当一切正常时，你应该看到：

```
✅ [AI Plugin] 检测到平台: deepseek
✅ [AI Plugin] 初始化完成
✅ [Background] 收到页面就绪通知: deepseek
✅ [TabManager] Ping成功!
✅ 测试连接成功
```

---

**最重要的一点**：每次使用前确保插件已重新加载！🔄

现在试试上面的解决方案，应该能解决问题了。如果还有问题，按照"收集以下信息"部分收集日志并告诉我。
