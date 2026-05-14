const config = require('./config');

class ToolConverter {
  constructor() {
    this.toolBlockLang = 'tool_call';
  }

  /**
   * 将 OpenAI tools 格式转换为文本说明（供 AI 理解可用工具）
   */
  convertToolsToText(tools) {
    if (!tools || !Array.isArray(tools)) {
      return '';
    }

    return tools.map(tool => {
      if (tool.type !== 'function') {
        return '';
      }

      const func = tool.function;
      const schema = func.parameters || {};
      const properties = schema.properties || {};
      const required = schema.required || [];

      // 构建参数说明
      let paramsDesc = '';
      if (Object.keys(properties).length > 0) {
        paramsDesc = Object.entries(properties).map(([paramName, paramInfo]) => {
          const isRequired = required.includes(paramName) ? ' (必需)' : ' (可选)';
          const paramDesc = paramInfo.description || paramInfo.type || 'unknown';
          return `        - ${paramName}${isRequired}: ${paramDesc}`;
        }).join('\n');
      } else {
        paramsDesc = '        (无参数)';
      }

      return `**${func.name}**
${func.description || '无描述'}
参数：
${paramsDesc}`;
    }).join('\n\n');
  }

  /**
   * 从 AI 响应文本中提取工具调用
   * 支持 ```tool_call 代码块格式
   */
  convertTextToToolCalls(text) {
    if (!text) {
      return [];
    }

    const toolCalls = [];
    // 匹配 ```tool_call ... ``` 代码块（使用贪婪匹配确保捕获完整内容）
    const toolRegex = /```tool_call\s*\n([\s\S]*?)\n```/g;
    let match;
    let callIndex = 0;

    while ((match = toolRegex.exec(text)) !== null) {
      let jsonText = match[1].trim();

      // 尝试提取完整的 JSON 对象（处理跨行情况）
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      try {
        const toolData = JSON.parse(jsonText);

        // 验证必需字段
        if (!toolData.name) {
          console.warn('[ToolConverter] 工具调用缺少 name 字段:', jsonText);
          continue;
        }

        // 标准化为 OpenAI 格式
        toolCalls.push({
          id: `call_${Date.now()}_${callIndex++}`,
          type: 'function',
          function: {
            name: toolData.name,
            arguments: typeof toolData.arguments === 'string'
              ? toolData.arguments
              : JSON.stringify(toolData.arguments || {})
          }
        });
      } catch (error) {
        console.warn('[ToolConverter] 解析工具调用 JSON 失败:', jsonText.substring(0, 100), error.message);
        // 继续处理其他匹配项
      }
    }

    return toolCalls;
  }

  /**
   * 为用户消息添加工具使用指令
   */
  appendToolInstruction(userMessage, tools) {
    if (!tools || tools.length === 0) {
      return userMessage;
    }

    const toolsText = this.convertToolsToText(tools);

    return `${userMessage}\n\n你可以使用以下工具：\n\n${toolsText}\n\n如果需要调用工具，请使用以下格式：\n\`\`\`tool_call\n{"name": "工具名称", "arguments": {"参数名": "参数值"}}\n\`\`\`\n\n参数 arguments 必须是 JSON 对象格式。`;
  }
}

module.exports = ToolConverter;
