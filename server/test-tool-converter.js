const ToolConverter = require('./tool-converter');

// 测试数据
const testTools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询指定城市的天气情况',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '要查询的城市名称'
          },
          unit: {
            type: 'string',
            description: '温度单位',
            enum: ['celsius', 'fahrenheit']
          }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description: '搜索信息',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词'
          }
        },
        required: ['query']
      }
    }
  }
];

console.log('=== 测试工具转换器 ===\n');

const converter = new ToolConverter();

// 测试 1: 转换工具为文本
console.log('1. 工具定义 → 文本说明:');
const toolsText = converter.convertToolsToText(testTools);
console.log(toolsText);
console.log('\n---\n');

// 测试 2: 附加工具指令
console.log('2. 附加工具指令到用户消息:');
const userMessage = '帮我查一下北京的天气';
const enhancedMessage = converter.appendToolInstruction(userMessage, testTools);
console.log(enhancedMessage);
console.log('\n---\n');

// 测试 3: 解析工具调用（成功）
console.log('3. 解析工具调用（成功）:');
const aiResponse1 = `我帮你查询一下北京的天气。

\`\`\`tool_call
{"name": "get_weather", "arguments": {"city": "北京", "unit": "celsius"}}
\`\`\`

稍等片刻...`;

const toolCalls1 = converter.convertTextToToolCalls(aiResponse1);
console.log('提取到的工具调用:', JSON.stringify(toolCalls1, null, 2));
console.log('\n---\n');

// 测试 4: 解析工具调用（多个）
console.log('4. 解析工具调用（多个）:');
const aiResponse2 = `我先搜索一下相关信息，再查询天气。

\`\`\`tool_call
{"name": "search", "arguments": {"query": "北京今日天气"}}
\`\`\`

然后：

\`\`\`tool_call
{"name": "get_weather", "arguments": {"city": "北京"}}
\`\`\``;

const toolCalls2 = converter.convertTextToToolCalls(aiResponse2);
console.log('提取到的工具调用:', JSON.stringify(toolCalls2, null, 2));
console.log('\n---\n');

// 测试 5: 解析工具调用（失败 - 无效 JSON）
console.log('5. 解析工具调用（失败 - 无效 JSON）:');
const aiResponse3 = `这里有一个错误的格式：

\`\`\`tool_call
{"name": "get_weather", "arguments": {"city": "北京"
\`\`\``;

const toolCalls3 = converter.convertTextToToolCalls(aiResponse3);
console.log('提取到的工具调用:', toolCalls3);
console.log('\n---\n');

// 测试 6: 解析工具调用（空内容）
console.log('6. 解析工具调用（空内容）:');
const toolCalls4 = converter.convertTextToToolCalls('');
console.log('提取到的工具调用:', toolCalls4);
console.log('\n---\n');

// 测试 7: 解析工具调用（包含其他文本）
console.log('7. 解析工具调用（包含其他文本）:');
const aiResponse4 = `你好！我可以帮你：

1. 查询天气
2. 搜索信息

\`\`\`tool_call
{"name": "get_weather", "arguments": {"city": "上海", "unit": "celsius"}}
\`\`\`

请问还有其他需要吗？`;

const toolCalls5 = converter.convertTextToToolCalls(aiResponse4);
console.log('提取到的工具调用:', JSON.stringify(toolCalls5, null, 2));
console.log('\n---\n');

// 测试 8: arguments 字符串格式
console.log('8. 解析工具调用（arguments 为字符串）:');
const aiResponse5 = `\`\`\`tool_call
{"name": "get_weather", "arguments": "{\\"city\\": \\"广州\\", \\"unit\\": \\"celsius\\"}"}
\`\`\``;
console.log('原始响应:', JSON.stringify(aiResponse5));

const toolCalls6 = converter.convertTextToToolCalls(aiResponse5);
console.log('提取到的工具调用:', JSON.stringify(toolCalls6, null, 2));

console.log('\n=== 测试完成 ===');
