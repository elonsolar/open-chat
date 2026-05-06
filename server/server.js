// 简单的WebSocket服务器示例
// 用于接收Edge浏览器插件的消息

const WebSocket = require('ws');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket服务器运行在 ws://localhost:${PORT}`);

// 存储所有连接的客户端
const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientId = req.socket.remoteAddress;
  console.log(`新客户端连接: ${clientId}`);
  clients.add(ws);

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'connected',
    data: { message: '已连接到服务器' },
    timestamp: Date.now()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[${new Date().toLocaleTimeString()}] 收到消息:`, data.type);

      // 根据消息类型处理
      switch (data.type) {
        case 'conversations':
          console.log('  会话列表更新:', data.data.conversations.length, '个会话');
          break;

        case 'roles':
          console.log('  角色列表更新:', data.data.roles.length, '个角色');
          break;

        case 'message':
          console.log('  新消息:', {
            conversationId: data.data.conversationId,
            isUser: data.data.message.isUser,
            content: data.data.message.content.substring(0, 50) + '...'
          });

          // 可以在这里处理消息，例如：
          // - 保存到数据库
          // - 转发给其他客户端
          // - 触发其他操作
          broadcastToOthers(ws, data);
          break;

        default:
          console.log('  未知消息类型:', data.type);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  });

  ws.on('close', () => {
    console.log(`客户端断开连接: ${clientId}`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error(`客户端错误: ${clientId}`, error);
    clients.delete(ws);
  });
});

// 广播消息给其他客户端
function broadcastToOthers(sender, message) {
  clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// 广播消息给所有客户端
function broadcastToAll(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// 示例：定期发送心跳
setInterval(() => {
  broadcastToAll({
    type: 'heartbeat',
    data: { time: new Date().toISOString() },
    timestamp: Date.now()
  });
}, 30000); // 每30秒

// 处理服务器关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  wss.clients.forEach(client => {
    client.close();
  });
  wss.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
