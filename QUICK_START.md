# OpenCode 集成快速指南

## 完整配置流程

### 1. 启动 Free-AI 服务器

```bash
cd server
npm install
npm start
```

**服务器信息：**
- API服务：`http://localhost:3000`
- WebSocket服务：`ws://localhost:8080`

### 2. 配置浏览器扩展

1. 点击浏览器工具栏中的 Free-AI 图标
2. 在弹窗中展开"连接设置"
3. 填写配置：
   - WebSocket 地址：`ws://localhost:8080`
   - 勾选"启用 WebSocket 连接"
4. 点击"保存设置"
5. 等待连接状态变为绿色（已连接）

### 3. 配置 OpenCode

编辑配置文件 `~/.config/opencode/opencode.json`：

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
          "name": "free"
        }
      }
    }
  }
}
```

### 4. 在 OpenCode 中使用

1. 打开 OpenCode
2. 在模型选择中选择：
   - 提供商：`free-ai`
   - 模型：`free`
3. 开始对话

## 工作原理

```
OpenCode → HTTP请求 → API服务器 → WebSocket → 浏器扩展 → AI网站
                                    ↓
                              DeepSeek/豆包/千问/Kimi
```

## 支持的AI平台

- DeepSeek (https://chat.deepseek.com)
- 豆包 (https://www.doubao.com/chat)
- 千问 (https://www.qianwen.com)
- Kimi (https://kimi.moonshot.cn)

**注意：** 使用前需要先在浏览器中登录对应的AI平台。

## 故障排查

### 连接失败
1. 检查服务器是否启动：`http://localhost:3000/health`
2. 确认WebSocket地址配置正确
3. 查看浏览器控制台是否有错误

### AI不回复
1. 确保已登录AI平台网站
2. 检查扩展是否有权限访问AI网站
3. 尝试刷新AI网站页面

### 配置不生效
1. 重启OpenCode
2. 检查JSON格式是否正确
3. 查看OpenCode日志输出

## 高级用法

### 自定义会话名称

在 `~/.config/opencode/opencode.json` 中添加多个模型配置：

```json
{
  "models": {
    "free": {"name": "free"},
    "coding": {"name": "coding"},
    "writing": {"name": "writing"}
  }
}
```

每个模型对应一个独立的会话，可以分别配置不同的角色和设置。

### 环境变量配置

在服务器目录创建 `.env` 文件：

```env
API_PORT=3000
WS_PORT=8080
REQUEST_TIMEOUT=300000
```

## 示例对话

**用户：** 请帮我写一个Python函数来计算斐波那契数列

**Free-AI：** [通过DeepSeek/豆包等模型生成回答]

这样可以充分利用多个AI模型的能力，获得更好的回答质量。
