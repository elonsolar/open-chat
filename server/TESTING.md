# Free AI WebSocket 集成测试指南

## 快速开始

### 1. 启动服务器

```bash
cd server
npm install
npm start
```

服务器将在以下端口运行：
- WebSocket 服务器: `ws://localhost:8080`
- HTTP API 服务器: `http://localhost:3000`

### 2. 浏览器插件设置

1. 打开 Chrome/Edge 扩展管理页面
2. 加载 `free-ai` 文件夹作为未打包的扩展
3. 点击扩展图标打开弹出窗口
4. 点击 "⚙️ 连接设置" 展开
5. 配置：
   - WebSocket 服务器地址: `ws://localhost:8080`
   - 启用 WebSocket 连接: ✅ 勾选
   - 点击 "保存设置"

### 3. 测试连接

#### 方法1：使用测试客户端

1. 在浏览器中打开 `server/test-client.html`
2. 页面会自动连接到 WebSocket 服务器
3. 点击 "发送测试消息" 按钮测试

#### 方法2：检查插件连接状态

1. 打开浏览器插件弹出窗口
2. 查看 WebSocket 状态指示器
3. 如果显示 "已连接"，说明插件成功连接到服务器

### 4. 测试 OpenAI API

#### 方法1：使用测试客户端

1. 在浏览器中打开 `server/test-api.html`
2. 配置：
   - API 端点: `http://localhost:3000/v1/chat/completions`
   - 模型名称: `gpt-4` (或其他支持的平台)
   - 用户消息: 输入测试内容
3. 点击 "发送请求"
4. 查看响应结果

#### 方法2：使用 cURL

```bash
# 非流式请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": false
  }'

# 流式请求
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

#### 方法3：使用 Python

```python
import requests

url = "http://localhost:3000/v1/chat/completions"
headers = {"Content-Type": "application/json"}
data = {
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "你好，请介绍一下自己"}],
    "stream": False
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

## 核心概念

### 模型名称 = 会话名称

在此系统中，API 请求中的 `model` 参数实际上是**插件会话的名称**，而不是 AI 模型名称。

- ❌ **错误理解**: `model: "gpt-4"` 表示调用 GPT-4 模型
- ✅ **正确理解**: `model: "我的对话"` 表示使用名为"我的对话"的会话

### 工作流程

1. 在插件中创建会话并命名（如："客服对话"、"技术支持"）
2. 为会话添加角色（可以选择不同的 AI 平台：DeepSeek、豆包、千问、Kimi）
3. API 请求时使用会话名称作为 `model` 参数
4. 系统自动使用该会话中配置的角色发送消息

## 快速开始

### 步骤 1: 在插件中创建会话

1. 打开浏览器插件
2. 创建新会话，命名为 "我的对话"（或任意名称）
3. 为会话添加至少一个角色：
   - 选择平台（如：豆包）
   - 选择模型（如：Doubao-pro）
   - 设置系统提示词（可选）
   - 点击保存

### 步骤 2: 启动服务器并连接插件

```bash
cd server
npm start
```

在插件设置中：
- WebSocket 服务器地址: `ws://localhost:8080`
- 启用 WebSocket 连接: ✅

### 步骤 3: 测试 API

使用会话名称 "我的对话"：

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "我的对话",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 使用场景示例

### 场景 1: 多模型协作

创建会话 "技术评审"，添加 3 个角色：
- DeepSeek（代码审查专家）
- 豆包（架构师）
- 千问（测试工程师）

API 调用：
```json
{
  "model": "技术评审",
  "messages": [{"role": "user", "content": "请评审这段代码"}]
}
```

系统会依次调用 3 个角色，返回综合意见。

### 场景 2: 不同对话风格

创建两个会话：
- "正式客服"（使用专业、礼貌的提示词）
- "休闲助手"（使用轻松、幽默的提示词）

根据场景调用不同会话。

## 故障排除

### 1. WebSocket 连接失败

**症状**: 插件状态显示 "未连接"

**解决方案**:
1. 确认服务器正在运行: `netstat -an | grep 8080`
2. 检查防火墙设置
3. 确认 WebSocket URL 格式正确: `ws://localhost:8080`
4. 查看浏览器控制台错误信息

### 2. API 请求失败

**症状**: 返回 500 或其他错误

**解决方案**:
1. 确认插件已连接到 WebSocket 服务器
2. 检查服务器日志: 查看控制台输出
3. 确认模型名称正确
4. 确保对应的 AI 平台标签页已打开

### 3. 没有收到 AI 响应

**症状**: API 请求成功但返回空内容或错误

**解决方案**:
1. 确保已登录对应的 AI 平台
2. 检查平台适配器是否正常工作
3. 查看服务器日志中的详细错误信息
4. 尝试手动在 AI 平台发送消息测试

## 架构说明

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   HTTP API  │────────▶│   Message    │────────▶│  WebSocket  │
│   Client    │         │   Router     │         │   Server    │
└─────────────┘         └──────────────┘         └─────────────┘
                                                              │
                                                              ▼
                                                       ┌─────────────┐
                                                       │   Browser   │
                                                       │  Extension  │
                                                       └─────────────┘
                                                              │
                                                              ▼
                                                       ┌─────────────┐
                                                       │  AI Platform│
                                                       │   (DeepSeek │
                                                       │   Doubao    │
                                                       │   Qianwen   │
                                                       │    Kimi)    │
                                                       └─────────────┘
```

### 数据流

1. HTTP 客户端发送请求到 `/v1/chat/completions`
2. API 服务器转换工具格式（如果需要）
3. Message Router 将请求转发给 WebSocket 连接的插件
4. 插件使用平台适配器发送消息到 AI 平台
5. AI 平台返回响应
6. 插件将响应通过 WebSocket 发回服务器
7. 服务器格式化为 OpenAI 标准响应返回 HTTP 客户端

## 开发模式

### 服务器开发模式

```bash
cd server
npm run dev
```

使用 nodemon 自动重启服务器。

### 插件开发

1. 修改代码后，在扩展管理页面点击 "重新加载"
2. 查看平台标签页的控制台日志
3. 查看服务器控制台输出

### 调试技巧

1. **服务器日志**: 查看所有 WebSocket 消息和 HTTP 请求
2. **浏览器控制台**: F12 打开开发者工具，查看网络请求和控制台输出
3. **WebSocket 测试**: 使用 `test-client.html` 测试连接
4. **API 测试**: 使用 `test-api.html` 测试完整流程

## 下一步

1. 实现更复杂的工具调用逻辑
2. 添加多轮对话支持
3. 实现会话管理
4. 添加用户认证
5. 优化错误处理和重试机制
