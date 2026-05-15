# OpenCode 集成配置示例

将以下配置添加到 `~/.config/opencode/opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "free-ai": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "FreeAI",
      "options": {
        "baseURL": "http://localhost:3000/v1",
        "apiKey": "any"
      },
      "models": {
        "free": {
          "name": "free",
          "description": "多模型AI对话 - 通过free-ai插件访问DeepSeek、豆包、千问、Kimi等"
        }
      }
    }
  }
}
```

## 使用步骤

1. **启动服务器**
   ```bash
   cd server
   npm install
   npm start
   ```

2. **配置插件**
   - 打开扩展弹窗
   - 设置WebSocket地址：`ws://localhost:8080`
   - 启用WebSocket连接

3. **在 opencode 中使用**
   - 选择提供商：`free-ai`
   - 选择模型：`free`
   - 开始对话

## 模型说明

- **模型名称**：`free`
- **支持平台**：DeepSeek、豆包、千问、Kimi
- **特点**：无需API密钥，通过浏览器扩展直接访问AI网站

## 高级配置

### 自定义会话名称

如果需要使用特定的会话名称，修改opencode配置：

```json
{
  "models": {
    "my-session": {
      "name": "my-session"
    }
  }
}
```

然后在API请求中使用 `x-session-affinity: my-session` 头部。
