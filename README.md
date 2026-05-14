# 多模型AI对话助手

免费多模型对话，无需 API 密钥。通过操作 AI 网页版实现多模型协作和本地工具集成。

## 核心特性

- 🚀 **多平台支持** - DeepSeek、千问、豆包、Kimi，无需API密钥
- 🤖 **多模型协作** - 支持并行、顺序、随机接龙三种模式
- 🔧 **本地工具集成** - 通过OpenAI API格式集成本地工具
- 💾 **灵活上下文** - 独享/共享模式，适应不同对话场景
- 🎯 **智能响应** - 自动检测AI回复完成，支持代码块渲染

## 使用指南

### 方式一：扩展页面（推荐）

点击扩展图标，即可在侧边栏中进行多模型会话聊天。

#### 1. 创建角色

- **侧边栏** → **角色** → **新建角色**
- 配置角色参数：
  - **名称**：角色显示名称（如"代码助手"）
  - **提供商**：选择AI平台（DeepSeek/千问/豆包/Kimi）
  - **系统提示词**：设定角色定位和行为模式
  - **昵称**：会话中的显示名称（可选）
  - **额外提示**：针对特定会话的补充指令（可选）

#### 2. 创建多模型会话

- **侧边栏** → **会话** → **新建会话**
- 选择多个角色参与会话
- 选择上下文模式：
  - **独享模式**：每个角色独立对话，互不干扰
  - **共享模式**：所有角色共享对话历史，支持协作
- 开始对话，体验多模型协作

#### 3. 切换发送模式（共享模式）

在聊天输入框输入 `/mode` 或点击模式徽章：

- **并行**：所有角色同时回答
- **顺序接龙**：按顺序依次回答，后续角色可见前面的回复
- **随机接龙**：随机打乱顺序接龙

### 方式二：集成本地工具

通过OpenAI API格式集成本地工具，让AI模型能够调用外部功能。

#### 示例：集成 opencode 工具

**服务器端配置**（server/openai-api-server.js）：

```javascript
// 1. 定义工具列表
const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取文件内容',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件路径'
          }
        },
        required: ['path']
      }
    }
  }
];

// 2. 发送请求时包含tools
await axios.post('https://api.openai.com/v1/chat/completions', {
  model: 'gpt-4',
  messages: messages,
  tools: tools
});
```

**客户端调用**：

```bash
# 设置会话ID（用于保持上下文）
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-session-affinity: session-123" \
  -d '{
    "model": "deepseek",
    "messages": [
      {"role": "system", "content": "你是文件助手，可以读取和分析文件"},
      {"role": "user", "content": "请读取 package.json 文件"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "read_file",
          "description": "读取文件内容",
          "parameters": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "description": "文件路径"}
            },
            "required": ["path"]
          }
        }
      }
    ]
  }'
```

**工作流程**：

1. 用户发送消息（包含工具定义）
2. AI模型决定是否调用工具
3. 扩展解析工具调用请求
4. 服务器执行实际工具操作
5. 结果返回给AI模型继续处理

#### 启动服务器

```bash
cd server
npm install
npm start
```

服务器将在 `http://localhost:3000` 启动。

## 支持的平台

| 平台 | 状态 | 网址 |
|------|------|------|
| DeepSeek | ✅ 已支持 | https://chat.deepseek.com |
| 豆包 | ✅ 已支持 | https://www.doubao.com/chat |
| 千问 | ✅ 已支持 | https://www.qianwen.com |
| Kimi | ✅ 已支持 | https://kimi.moonshot.cn |

## 安装

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/free-ai.git
cd free-ai

# 2. 安装服务器依赖（可选）
cd server
npm install
```

### 加载扩展

1. 打开 `edge://extensions/` 或 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"，选择项目根目录

### 登录 AI 平台

首次使用前，请在浏览器中登录对应平台：

| 平台 | 网址 |
|------|------|
| DeepSeek | https://chat.deepseek.com |
| 千问 | https://www.qianwen.com |
| 豆包 | https://www.doubao.com/chat |
| Kimi | https://kimi.moonshot.cn |

## 项目结构

```
free-ai/
├── background/           # 后台服务（Service Worker）
├── sidepanel/           # 侧边栏UI
├── popup/               # 扩展弹窗
├── chat/                # 全屏聊天界面
├── utils/
│   ├── platforms/       # 平台适配器
│   ├── content-script.js # 内容脚本
│   └── storage.js       # 存储工具
├── server/              # 可选的API服务器
│   ├── openai-api-server.js
│   └── tool-converter.js
└── manifest.json        # 扩展配置
```

## 技术实现

### 平台适配器

每个AI平台有独立的适配器，负责：

- **消息发送**：自动填充输入框并提交
- **响应检测**：监听DOM变化，识别AI回复完成
- **内容提取**：解析代码块、表格等格式化内容
- **错误处理**：超时重试和异常恢复

### 消息流程

```
用户输入 → Background → Content Script → AI网站
                                        ↓
AI回复 ← 解析响应 ← 检测完成 ← MutationObserver
```

### 工具调用流程

```
用户请求 → API服务器 → 工具定义转换 → 扩展
                            ↓
AI决策 ← 结果返回 ← 工具执行 ← 扩展
```

## 开发说明

### 添加新平台支持

1. 创建 `utils/platforms/<name>-adapter.js`
2. 继承 `BasePlatformAdapter` 类
3. 实现必需方法：
   - `sendMessage()` - 发送消息
   - `waitForAIResponse()` - 等待响应
4. 在 `manifest.json` 添加URL匹配规则
5. 在 `content-script.js` 注册平台检测

### 自定义工具

在服务器端定义工具函数，通过OpenAI Function Calling格式提供给AI模型。

## License

MIT
