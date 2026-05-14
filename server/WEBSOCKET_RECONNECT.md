# WebSocket 自动重连功能

## 功能说明

从现在开始，浏览器插件的 WebSocket 连接支持**自动重连**，无需手动干预。

### ✨ 主要特性

1. **自动重连**: 连接断开后自动尝试重连
2. **指数退避**: 重连间隔从 2 秒开始，每次失败后加倍（最多 30 秒）
3. **无限重试**: 默认无限次重连，直到连接成功或用户手动禁用
4. **心跳机制**: 每 30 秒发送心跳消息，确保连接活跃
5. **状态显示**: 实时显示连接状态和重连进度
6. **手动重连**: 提供"立即重连"按钮，跳过等待时间

### 🎯 使用场景

- 服务器重启后自动恢复连接
- 网络波动后自动重新连接
- 浏览器休眠后自动恢复连接
- 插件更新后自动重新建立连接

## 界面说明

### 状态指示器

在插件弹出窗口的设置区域，你会看到连接状态：

- **🟢 已连接**: 一切正常
- **🔵 重连中 (3次) 8s**: 正在尝试重连（第 3 次，8 秒后重试）
- **🔴 未连接**: 连接断开，等待自动重连或手动重连

### 立即重连按钮

当连接断开时，会显示"立即重连"按钮：

```
┌─────────────────────────┐
│ [保存设置] [立即重连]   │
└─────────────────────────┘
```

点击后：
1. 取消当前的重连等待
2. 立即尝试建立连接
3. 按钮显示"重连中..."状态
4. 失败后继续自动重连流程

## 工作原理

### 1. 连接建立

```javascript
// 用户保存设置
wsManager.connect(url);
```

### 2. 连接成功

```javascript
ws.onopen = () => {
  connected = true;
  reconnectAttempts = 0;
  startHeartbeat(); // 启动心跳
};
```

### 3. 连接断开

```javascript
ws.onclose = () => {
  connected = false;
  stopHeartbeat();
  
  if (shouldReconnect) {
    scheduleReconnect(url);
  }
};
```

### 4. 重连计划

```javascript
scheduleReconnect(url) {
  const delay = Math.min(
    2000 * Math.pow(2, reconnectAttempts - 1),
    30000
  );
  
  setTimeout(() => {
    reconnect(url);
  }, delay);
}
```

### 5. 重连尝试

| 次数 | 等待时间 | 总耗时 |
|------|----------|--------|
| 1 | 2s | 2s |
| 2 | 4s | 6s |
| 3 | 8s | 14s |
| 4 | 16s | 30s |
| 5 | 30s | 60s |
| 6+ | 30s | 继续尝试 |

## 心跳机制

为了及时检测死连接，系统每 30 秒发送心跳消息：

```javascript
// 插件 → 服务器
{ type: 'heartbeat', timestamp: 1234567890 }
```

服务器收到心跳后不做特殊处理，但：
- 如果心跳发送失败，说明连接已断开
- 触发 `onclose` 事件
- 启动自动重连流程

## 配置选项

### 在 background.js 中调整

```javascript
class WebSocketManager {
  constructor() {
    // 是否自动重连
    this.shouldReconnect = true;

    // 最大重连次数（Infinity = 无限）
    this.maxReconnectAttempts = Infinity;

    // 初始重连延迟（毫秒）
    this.baseReconnectDelay = 2000;

    // 最大重连延迟（毫秒）
    this.maxReconnectDelay = 30000;

    // 心跳间隔（毫秒）
    this.heartbeatInterval = 30000;
  }
}
```

## 调试信息

### 控制台日志

打开 Service Worker 控制台查看详细日志：

```
[WS] 正在连接到: ws://localhost:8080
[WS] 连接成功
[WS] 连接关闭, code: 1006, reason: 
[WS] 2秒后尝试重连 (1次)...
[WS] 正在连接到: ws://localhost:8080
[WS] 连接成功
```

### 获取当前状态

在 popup 中每秒查询一次状态：

```javascript
const status = await chrome.runtime.sendMessage({ 
  action: 'getWSStatus' 
});

console.log(status);
// {
//   connected: false,
//   shouldReconnect: true,
//   reconnectAttempts: 3,
//   reconnectDelay: 8000,
//   isReconnecting: true
// }
```

## 禁用自动重连

### 方法 1: 关闭 WebSocket 开关

在插件弹出窗口中：
1. 点击"设置"区域
2. 取消勾选"启用 WebSocket 连接"
3. 点击"保存设置"

### 方法 2: 主动断开

```javascript
// 在 background.js 中
wsManager.disconnect(); // 停止自动重连
```

## 最佳实践

### 1. 服务器重启时的处理

```bash
# 重启服务器
cd server
npm start
```

插件会自动检测到连接断开并重连：
- 通常在 2-8 秒内完成重连
- 不影响正在进行的 API 请求（新请求会等待连接恢复）

### 2. 开发时的处理

如果你频繁修改代码并重启服务器：

```javascript
// 在 background.js 中，减小重连延迟
this.baseReconnectDelay = 1000; // 1 秒后重连
```

### 3. 生产环境的处理

```javascript
// 使用默认配置即可
this.baseReconnectDelay = 2000;  // 2 秒开始
this.maxReconnectDelay = 30000;  // 最多 30 秒
this.maxReconnectAttempts = Infinity;  // 无限重试
```

## 常见问题

### Q: 为什么连接总是断开？

可能原因：
1. 服务器未运行 → 启动服务器: `cd server && npm start`
2. WebSocket 地址错误 → 检查设置中的 URL
3. 网络问题 → 查看浏览器控制台错误信息

### Q: 重连失败了怎么办？

1. 点击"立即重连"按钮手动触发
2. 检查服务器是否正常运行
3. 查看 Service Worker 控制台错误日志

### Q: 如何知道当前重连了几次？

在弹出窗口的状态指示器中显示：
```
🔵 重连中 (5次) 16s
```

### Q: 重连会消耗多少资源？

- 内存：几乎无影响（只保留连接对象）
- CPU：重连间隔期间无操作
- 网络：仅在连接建立时产生流量

## 技术细节

### 指数退避算法

```javascript
const delay = Math.min(
  baseDelay * Math.pow(2, attempts - 1),
  maxDelay
);
```

示例：
- 第 1 次: `min(2000 * 1, 30000) = 2000ms`
- 第 2 次: `min(2000 * 2, 30000) = 4000ms`
- 第 3 次: `min(2000 * 4, 30000) = 8000ms`
- 第 4 次: `min(2000 * 8, 30000) = 16000ms`
- 第 5 次: `min(2000 * 16, 30000) = 30000ms`
- 第 6+ 次: `30000ms` (达到上限)

### 状态管理

```javascript
enum ConnectionState {
  CONNECTING,    // 连接中
  CONNECTED,     // 已连接
  DISCONNECTED,  // 已断开
  RECONNECTING   // 重连中
}
```

## 更新日志

### 2024-XX-XX
- ✅ 添加自动重连功能
- ✅ 实现指数退避策略
- ✅ 添加心跳机制
- ✅ 优化状态显示
- ✅ 添加立即重连按钮

---

**需要帮助？** 查看 [QUICKSTART.md](QUICKSTART.md) 或 [FLOW.md](FLOW.md)
