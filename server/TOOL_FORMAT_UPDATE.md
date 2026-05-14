# Tool Call 格式更新

## 更改概述

将 tool call 格式从 XML 标签改为 Markdown 代码块格式，以解决 HTML/XML 标签被浏览器解析和 `textContent` 提取时丢失标签的问题。

## 旧格式（已废弃）

```xml
<tool><name>get_weather</name><params><param><name>city</name><value>北京</value></param></params></tool>
```

**问题**：
- XML 标签会被浏览器解析为 HTML 元素
- 平台适配器使用 `textContent` 提取时，标签会被剥离
- 导致 tool call 信息丢失

## 新格式（当前）

````markdown
```tool_call
{"name": "get_weather", "arguments": {"city": "北京", "unit": "celsius"}}
```
````

**优点**：
- Markdown 代码块不会被浏览器渲染为 HTML
- `textContent` 可以正确提取代码块内容
- 代码块是结构化数据的自然载体
- AI 更容易理解这种格式
- 易于正则表达式匹配和解析

## 实现细节

### 1. 工具定义转换

`convertToolsToText(tools)` 将 OpenAI 工具定义转换为易读的文本：

```
**get_weather**
查询指定城市的天气情况
参数：
        - city (必需): 要查询的城市名称
        - unit (可选): 温度单位
```

### 2. 工具调用解析

`convertTextToToolCalls(text)` 从 AI 响应中提取工具调用：

```javascript
// 正则表达式匹配 ```tool_call 代码块
const toolRegex = /```tool_call\s*\n([\s\S]*?)\n```/g;

// 提取并解析 JSON
{"name": "get_weather", "arguments": {"city": "北京"}}
```

### 3. 用户消息增强

`appendToolInstruction(userMessage, tools)` 添加工具使用说明：

```
你可以使用以下工具：

**get_weather**
查询天气...

如果需要调用工具，请使用以下格式：
```tool_call
{"name": "工具名称", "arguments": {"参数名": "参数值"}}
```
```

## 文件更改

### 修改的文件

1. **server/tool-converter.js** - 完全重写
   - 移除 XML 格式相关代码
   - 实现代码块格式解析
   - 简化参数处理逻辑

2. **server/config.js** - 简化
   - 移除 `toolFormat` 配置对象
   - 新格式不需要复杂的标签配置

3. **server/README.md** - 更新文档
   - 更新"工具格式转换"章节
   - 使用新格式的示例

4. **server/FLOW.md** - 更新流程图
   - 更新步骤 2 中的格式说明

### 新增文件

5. **server/test-tool-converter.js** - 测试脚本
   - 测试工具定义转换
   - 测试工具调用解析
   - 测试各种边界情况

## 测试结果

运行 `node test-tool-converter.js` 验证：

✅ 工具定义 → 文本说明转换
✅ 工具指令附加到用户消息
✅ 单个工具调用解析
✅ 多个工具调用解析
✅ 无效 JSON 容错处理
✅ 空内容处理
✅ 混合文本内容提取
✅ arguments 字符串格式支持

## 兼容性

- ✅ 不影响现有平台适配器（它们继续使用 `textContent`）
- ✅ 不影响 HTTP API 接口（仍返回标准 OpenAI 格式）
- ✅ 不影响 WebSocket 消息协议
- ✅ 只需要重启服务器即可生效

## 使用示例

### 发送请求

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "我的会话",
    "messages": [{"role": "user", "content": "查北京天气"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "查询天气",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {"type": "string", "description": "城市"}
          },
          "required": ["city"]
        }
      }
    }]
  }'
```

### AI 响应（在插件中显示）

```
我帮你查询北京的天气。

```tool_call
{"name": "get_weather", "arguments": {"city": "北京"}}
```

稍等片刻...
```

### API 返回（标准 OpenAI 格式）

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "我帮你查询北京的天气。\n\n```tool_call\n{\"name\": \"get_weather\", \"arguments\": \"{\\\"city\\\": \\\"北京\\\"}\"}\n```\n\n稍等片刻...",
      "tool_calls": [{
        "id": "call_1234567890_0",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"city\":\"北京\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

## 注意事项

1. AI 需要理解新的代码块格式
2. 确保提示词中包含格式说明
3. 代码块语言标识必须是 `tool_call`（区分大小写）
4. JSON 必须有效，否则会被忽略并记录警告

## 未来改进

- [ ] 添加对 `json` 语言代码块的支持（更通用）
- [ ] 添加对多行 JSON 的更好支持
- [ ] 添加对 TypeScript/JSDoc 格式的工具定义支持
- [ ] 添加对工具调用结果格式的支持
