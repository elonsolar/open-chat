#!/usr/bin/env node

/**
 * WebSocket 自动重连测试脚本
 * 
 * 用途：测试浏览器插件的自动重连功能
 * 
 * 使用方法：
 * 1. 启动服务器: cd server && npm start
 * 2. 在另一个终端运行此脚本: node test-reconnect.js
 * 3. 观察重连行为
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8080';

console.log('🧪 WebSocket 自动重连测试\n');
console.log('========================================');
console.log('测试步骤：');
console.log('1. 连接到服务器');
console.log('2. 等待 5 秒');
console.log('3. 模拟服务器关闭（Ctrl+C 停止服务器）');
console.log('4. 观察客户端自动重连');
console.log('5. 重启服务器 (cd server && npm start)');
console.log('6. 观察客户端自动恢复连接');
console.log('========================================\n');

class TestClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.reconnectDelay = 2000;
  }

  connect() {
    console.log(`🔌 尝试连接到 ${this.url}...`);

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('✅ 连接成功！');
      this.reconnectAttempts = 0;
      this.sendTestMessage();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`📨 收到消息:`, message.type || message);
      } catch (error) {
        console.log(`📨 收到消息:`, data.toString());
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`❌ 连接关闭 (code: ${code}, reason: ${reason || '无'})`);

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.log(`⚠️ 连接错误: ${error.message}`);
    });
  }

  disconnect() {
    console.log('🛑 主动断开连接');
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    console.log(`🔄 ${delay / 1000}秒后尝试重连 (${this.reconnectAttempts}次)...`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendTestMessage() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'test',
        message: '这是一条测试消息',
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
      console.log('📤 已发送测试消息');
    }
  }

  sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'heartbeat',
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
    }
  }
}

// 创建测试客户端
const client = new TestClient(SERVER_URL);
client.connect();

// 每 30 秒发送心跳
const heartbeatInterval = setInterval(() => {
  client.sendHeartbeat();
}, 30000);

// 处理用户输入
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (key === '\u0003') { // Ctrl+C
    console.log('\n\n👋 退出测试');
    clearInterval(heartbeatInterval);
    client.disconnect();
    process.exit();
  } else if (key === 'r') {
    console.log('\n🔄 手动触发重连...');
    client.disconnect();
    client.shouldReconnect = true;
    client.connect();
  } else if (key === 's') {
    console.log('\n📤 发送测试消息...');
    client.sendTestMessage();
  } else if (key === 'h') {
    console.log('\n💓 发送心跳...');
    client.sendHeartbeat();
  }
});

console.log('\n控制台命令：');
console.log('  r - 手动重连');
console.log('  s - 发送测试消息');
console.log('  h - 发送心跳');
console.log('  Ctrl+C - 退出\n');

// 5 秒后发送第一条消息
setTimeout(() => {
  console.log('⏰ 5秒已过，发送测试消息...');
  client.sendTestMessage();
}, 5000);
