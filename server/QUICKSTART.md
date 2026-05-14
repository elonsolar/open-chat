# 5分钟快速开始指南

## 前置条件

- Node.js 已安装
- Chrome/Edge 浏览器
- AI 平台账号（至少一个：DeepSeek、豆包、千问、Kimi）

## 第一步：启动服务器（1分钟）

```bash
cd server
npm install
npm start
```

看到以下输出表示成功：
```
WebSocket服务器运行在 ws://localhost:8080
OpenAI API server running on http://localhost:3000
```

## 第二步：加载浏览器插件（1分钟）

1. 打开 Chrome/Edge，访问 `chrome://extensions/` 或 `edge://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录 `free-ai`

## 第三步：配置插件连接（30秒）

1. 点击浏览器工具栏的插件图标
2. 点击 "⚙️ 连接设置"
3. 确认配置：
   - WebSocket 服务器地址: `ws://localhost:8080`
   - ✅ 启用 WebSocket 连接
4. 点击"保存设置"
5. 状态应显示为 "✅ 已连接"

## 第四步：创建测试会话（1分钟）

1. 在插件中点击 "侧边栏" 或访问 `chat/chat.html`
2. 点击 "新建会话"
3. 输入会话名称：`测试会话`
4. 点击 "添加角色"
5. 配置角色：
   - 名称：`测试助手`
   - 平台：选择一个（如：豆包）
   - 模型：选择一个（如：Doubao-pro-32k）
   - 系统提示词：`你是一个友好的AI助手`
6. 点击"保存角色"
7. 确保"测试助手"已添加到会话
8. 点击"创建会话"

## 第五步：测试 API（30秒）

### 方法1：使用测试页面

1. 在浏览器打开 `server/test-api.html`
2. 会话名称输入：`测试会话`
3. 消息输入：`你好，请介绍一下你自己`
4. 点击"发送请求"
5. 等待响应（可能需要10-30秒）

### 方法2：使用 cURL

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "测试会话",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 方法3：使用 Python

```python
import requests

response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    json={
        'model': '测试会话',
        'messages': [{'role': 'user', 'content': '你好'}]
    }
)

print(response.json())
```

## ✅ 成功标志

如果看到以下输出，说明配置成功：

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "你好！我是测试助手..."
    }
  }]
}
```

## 🔄 自动重连功能（新增）

插件现在支持 WebSocket **自动重连**，无需手动干预：

### 重连特性

- ✅ **自动重连**: 服务器重启后自动恢复连接
- ✅ **指数退避**: 重连间隔从 2 秒开始，逐渐增加到最多 30 秒
- ✅ **心跳机制**: 每 30 秒发送心跳，及时发现连接问题
- ✅ **状态显示**: 实时显示连接状态和重连进度
- ✅ **手动重连**: 提供"立即重连"按钮跳过等待

### 状态说明

在插件弹出窗口中，你会看到：

- 🟢 **已连接**: 一切正常
- 🔵 **重连中 (3次) 8s**: 正在尝试第 3 次重连，8 秒后重试
- 🔴 **未连接**: 连接断开（会自动重连或点击"立即重连"）

### 测试自动重连

1. 启动服务器后，插件应该显示"🟢 已连接"
2. 停止服务器（Ctrl+C）
3. 插件会显示"🔵 重连中..."
4. 重启服务器（`npm start`）
5. 插件自动恢复为"🟢 已连接"

📖 详细说明请查看 [WEBSOCKET_RECONNECT.md](WEBSOCKET_RECONNECT.md)

## 🔧 常见问题

### Q: 提示"会话不存在"
**A**: 检查会话名称是否完全匹配（区分大小写）。先在插件中确认会话已创建。

### Q: 插件显示"未连接"
**A**: 
1. 确认服务器正在运行（`npm start`）
2. 检查 WebSocket 地址是否正确：`ws://localhost:8080`
3. 点击"保存设置"后查看状态

### Q: API 调用超时
**A**:
1. 确保已登录对应的 AI 平台
2. 检查网络连接
3. 查看插件会话页面，确认消息已发送
4. 默认超时30秒，大型响应可能需要更长时间

### Q: 收到空响应
**A**:
1. 在插件中手动测试会话是否能正常工作
2. 检查角色配置是否正确
3. 查看浏览器控制台（F12）的错误信息

### Q: 想使用多个 AI 平台
**A**:
在会话中添加多个角色即可。系统会依次调用所有角色，然后合并响应。

## 🎯 下一步

现在你已经完成了基本配置，可以：

1. **创建更多会话**：为不同场景创建专用会话
2. **添加多个角色**：在一个会话中添加不同 AI 平台的角色
3. **测试流式响应**：在请求中添加 `"stream": true`
4. **集成到应用**：使用标准的 OpenAI SDK 调用接口

## 📚 更多信息

- 完整文档：查看 `TESTING.md`
- API 参考：查看 `README.md`
- 问题反馈：GitHub Issues
