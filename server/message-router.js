const { v4: uuidv4 } = require('uuid');
const config = require('./config');

class MessageRouter {
  constructor() {
    this.pendingRequests = new Map();
    this.wsClients = new Set();
  }

  registerWebSocketClient(ws) {
    this.wsClients.add(ws);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleWebSocketMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[Router] WebSocket 客户端断开连接');
      this.wsClients.delete(ws);
      this.cleanupPendingRequests(ws);
    });

    ws.on('error', (error) => {
      console.error('[Router] WebSocket 客户端错误:', error);
      this.wsClients.delete(ws);
      this.cleanupPendingRequests(ws);
    });

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'welcome',
      message: '已连接到 OpenAI API 服务器',
      timestamp: Date.now()
    }));
  }

  handleWebSocketMessage(ws, message) {
    switch (message.type) {
      case 'connected':
        console.log('[Router] 浏览器插件已连接');
        break;

      case 'ai_response':
        if (message.requestId) {
          const pendingRequest = this.pendingRequests.get(message.requestId);
          
          if (pendingRequest) {
            console.log('[Router] 收到响应:', message.requestId);
            pendingRequest.resolve(message);
          } else {
            console.warn('[Router] 收到未知请求的响应:', message.requestId);
          }
        }
        break;

      case 'heartbeat':
        // 心跳消息，记录但不做特殊处理
        break;

      case 'error':
        console.error('[Router] 收到错误消息:', message);
        break;

      default:
        console.log('[Router] 未知消息类型:', message.type);
    }
  }

  cleanupPendingRequests(ws) {
    for (const [requestId, request] of this.pendingRequests.entries()) {
      if (request.wsClient === ws) {
        request.reject(new Error('WebSocket client disconnected'));
        this.pendingRequests.delete(requestId);
      }
    }
  }

  sendMessageToExtension(requestData) {
    return new Promise((resolve, reject) => {
      const requestId = requestData.requestId || uuidv4();
      const timeout = requestData.timeout || config.timeout;

      if (this.wsClients.size === 0) {
        return reject(new Error('No WebSocket clients connected'));
      }

      const message = {
        type: 'chat_request',
        requestId: requestId,
        model: requestData.model,
        messages: requestData.messages,
        timestamp: Date.now()
      };

      let clientSent = false;

      for (const ws of this.wsClients) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(message));
          clientSent = true;
          break;
        }
      }

      if (!clientSent) {
        return reject(new Error('No active WebSocket clients available'));
      }

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        wsClient: null,
        timestamp: Date.now()
      });
    });
  }

  sendMessageToAllExtensions(message) {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const ws of this.wsClients) {
      if (ws.readyState === 1) {
        ws.send(messageStr);
        sentCount++;
      }
    }

    return sentCount;
  }

  getConnectedClientsCount() {
    return this.wsClients.size;
  }

  getPendingRequestsCount() {
    return this.pendingRequests.size;
  }
}

module.exports = MessageRouter;
