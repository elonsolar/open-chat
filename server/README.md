# WebSocket服务器示例

这是一个简单的Node.js WebSocket服务器，用于接收Edge浏览器插件发送的消息。

## 安装

```bash
npm install
```

## 运行

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

服务器将在 `ws://localhost:8080` 上运行。

## 功能

- 接收插件发送的所有消息
- 记录消息到控制台
- 广播消息给其他连接的客户端
- 定期发送心跳消息
- 优雅关闭处理

## 接收的消息类型

### conversations
会话列表更新
```json
{
  "type": "conversations",
  "data": {
    "conversations": [...]
  },
  "timestamp": 1234567890
}
```

### roles
角色列表更新
```json
{
  "type": "roles",
  "data": {
    "roles": [...]
  },
  "timestamp": 1234567890
}
```

### message
新消息
```json
{
  "type": "message",
  "data": {
    "conversationId": "xxx",
    "message": {
      "id": "xxx",
      "roleId": "xxx",
      "content": "消息内容",
      "isUser": false,
      "timestamp": 1234567890
    }
  },
  "timestamp": 1234567890
}
```

## 扩展功能

你可以基于此服务器实现以下功能：

### 1. 消息持久化
将消息保存到数据库（MongoDB、PostgreSQL等）

### 2. 消息转发
将消息转发给其他服务或API

### 3. AI响应
接收到用户消息后，调用AI API生成回复

### 4. 多客户端支持
支持多个插件实例同时连接

### 5. 认证
添加WebSocket认证机制

### 6. HTTP API
添加REST API用于查询和管理数据

示例：添加AI响应

```javascript
async function handleUserMessage(conversationId, userMessage) {
  // 调用AI API
  const aiResponse = await callAIAPI(userMessage);

  // 发送回复给插件
  broadcastToAll({
    type: 'aiResponse',
    data: {
      conversationId,
      response: aiResponse
    },
    timestamp: Date.now()
  });
}

function callAIAPI(message) {
  // 实现你的AI API调用逻辑
  return Promise.resolve('这是AI的回复');
}
```

## 环境变量

可以创建 `.env` 文件配置环境变量：

```env
PORT=8080
NODE_ENV=development
```

## 部署

### 使用PM2部署

```bash
npm install -g pm2
pm2 start server.js --name open-chat-server
pm2 save
pm2 startup
```

### 使用Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

```bash
docker build -t open-chat-server .
docker run -p 8080:8080 open-chat-server
```

## 故障排除

### 端口被占用
如果端口8080被占用，可以修改 `server.js` 中的 PORT 变量。

### 连接失败
1. 检查服务器是否正在运行
2. 检查防火墙设置
3. 确认插件中的WebSocket地址正确

## 许可证

MIT License
