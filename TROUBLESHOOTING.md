# 🔧 故障排查指南

## 常见错误及解决方案

### 错误1：TabManager is not defined

✅ **已解决**

**原因**：类定义在外部文件中，但 service worker 无法引用。

**解决方案**：已将所有类合并到 `background.js` 中。

---

### 错误2：测试连接失败

**现象**：
```
❌ 测试失败
```

**可能原因**：
1. 未在浏览器中登录AI网站
2. AI网站标签页被关闭
3. Content Script未正确注入

**解决步骤**：

1. **检查登录状态**
   ```
   打开 https://chat.deepseek.com
   确认已登录账号
   ```

2. **刷新AI网站页面**
   ```
   在 DeepSeek 标签页按 F5 刷新
   ```

3. **重新加载插件**
   ```
   打开 edge://extensions/
   找到"多模型AI对话助手"
   点击刷新按钮 🔄
   ```

4. **查看控制台日志**
   ```
   打开 DeepSeek 网站
   按 F12 打开开发者工具
   切换到 Console 标签
   查找 [AI Plugin] 开头的日志
   ```

**预期日志**：
```
[AI Plugin] 检测到平台: deepseek
[AI Plugin] 初始化完成
[Background] 收到页面就绪通知: deepseek
```

---

### 错误3：发送消息后没有回复

**现象**：
- 点击发送后一直显示"发送中..."
- 聊天记录中没有AI回复

**可能原因**：
1. AI网站页面结构变化（选择器失效）
2. AI服务响应慢
3. 网络连接问题

**解决步骤**：

1. **手动检查AI网站**
   ```
   打开 DeepSeek 标签页
   查看是否有错误提示
   尝试手动输入消息看能否正常回复
   ```

2. **检查选择器**
   ```
   在 DeepSeek 页面按 F12
   使用 Elements 选择器（左上角箭头图标）
   点击输入框，查看其 class 或 id
   对比 utils/platform-adapter.js 中的选择器
   ```

3. **更新选择器**（如果页面结构变化）

   编辑 `utils/platform-adapter.js`：

   ```javascript
   deepseek: {
     inputBox: '新的输入框选择器',
     sendButton: '新的发送按钮选择器',
     messageList: '新的消息列表选择器',
     aiResponse: '新的AI回复选择器'
   }
   ```

4. **增加等待时间**

   如果AI响应慢，可以修改等待时间：

   ```javascript
   // 在 utils/content-script.js 中
   waitForResponse(timeout = 120000) // 从60秒增加到120秒
   ```

---

### 错误4：Content Script 未注入

**现象**：
```
[Background] 向标签页发送消息失败: Error: Could not establish connection
```

**原因**：Content Script 未注入到AI网站

**解决方案**：

1. **检查 manifest.json**
   ```json
   "content_scripts": [{
     "matches": ["https://chat.deepseek.com/*"],
     "js": ["utils/platform-adapter.js", "utils/content-script.js"],
     "run_at": "document_idle"
   }]
   ```

2. **手动刷新AI网站**
   - 关闭AI网站标签页
   - 重新打开插件，让它自动创建标签页

3. **检查文件路径**
   - 确认 `utils/platform-adapter.js` 存在
   - 确认 `utils/content-script.js` 存在

---

### 错误5：插件无法加载

**现象**：
```
edge://extensions/ 显示"已损坏"或错误
```

**可能原因**：
1. manifest.json 语法错误
2. 缺少必要的文件
3. 图标文件缺失

**解决方案**：

1. **检查 manifest.json**
   ```json
   {
     "manifest_version": 3,
     "name": "多模型AI对话助手",
     "version": "1.0.0"
     // 确保没有语法错误（逗号、引号等）
   }
   ```

2. **生成图标**（如果缺失）
   ```
   双击 icons\生成图标.bat
   下载所有图标到 icons 目录
   ```

3. **重新加载插件**
   ```
   在 edge://extensions/ 中
   移除插件
   重新加载
   ```

---

### 错误6：数据丢失

**现象**：会话和角色突然消失

**原因**：清除浏览器数据

**解决方案**：

1. **定期备份**
   ```javascript
   // 在控制台执行
   chrome.storage.local.get(null, (data) => {
     console.log(JSON.stringify(data, null, 2));
   });
   ```

2. **导出数据**
   - 复制上面的 JSON 数据
   - 保存到文本文件

3. **导入数据**（如果需要恢复）
   ```javascript
   chrome.storage.local.set({
     conversations: [...],
     roles: [...]
   });
   ```

---

## 调试技巧

### 1. 查看 Background 日志

```
1. 打开 edge://extensions/
2. 找到"多模型AI对话助手"
3. 点击"检查视图：service worker"
4. 查看控制台日志
```

### 2. 查看 Content Script 日志

```
1. 打开AI网站（如 DeepSeek）
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 查找 [AI Plugin] 开头的日志
```

### 3. 测试单个功能

**测试标签页管理**：
```javascript
// 在 Background 控制台执行
tabManager.openPlatformTab('deepseek')
  .then(tab => console.log('成功:', tab))
  .catch(err => console.error('失败:', err));
```

**测试消息发送**：
```javascript
// 在 Background 控制台执行
tabManager.sendMessage('deepseek', '你好')
  .then(res => console.log('回复:', res))
  .catch(err => console.error('失败:', err));
```

### 4. 清除存储

```javascript
// 在 Background 控制台执行
chrome.storage.local.clear();
```

### 5. 重置插件

```javascript
// 在 Background 控制台执行
// 1. 清除数据
chrome.storage.local.clear();

// 2. 重新初始化
init();
```

---

## 性能问题

### 问题1：响应慢

**优化方案**：

1. **减少等待时间**
   ```javascript
   // 在 utils/tab-manager.js 中
   await this.sleep(1000); // 从2000减少到1000
   ```

2. **并行发送消息**
   ```javascript
   // 在 background.js 中
   const promises = roles.map(role =>
     this.tabManager.sendMessage(role.provider, userMessage)
   );
   await Promise.all(promises);
   ```

### 问题2：内存占用高

**优化方案**：

1. **限制聊天历史长度**
   ```javascript
   // 保留最近100条消息
   if (conversation.messages.length > 100) {
     conversation.messages = conversation.messages.slice(-100);
   }
   ```

2. **定期清理**
   ```javascript
   // 删除超过30天的会话
   const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
   conversations = conversations.filter(c => c.updatedAt > thirtyDaysAgo);
   ```

---

## 获取帮助

如果以上方法都无法解决问题：

1. **收集信息**
   - 浏览器版本
   - 插件版本
   - 错误截图
   - 控制台日志

2. **提交Issue**
   - 描述问题
   - 复现步骤
   - 预期结果
   - 实际结果

3. **查看社区**
   - GitHub Issues
   - 讨论区

---

## 预防措施

1. **定期备份数据**
2. **保持插件更新**
3. **及时登录AI网站**
4. **不要关闭AI网站标签页**
5. **定期测试连接**

---

祝你使用顺利！🎉
