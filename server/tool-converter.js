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
   * 支持 ```tool_call 代码块格式和纯 JSON 格式
   */
  convertTextToToolCalls(text) {
    if (!text) {
      console.log('[ToolConverter] Input text is empty');
      return [];
    }

    console.log('[ToolConverter] ====== Parsing Tool Calls ======');
    console.log('[ToolConverter] Input text length:', text.length);
    console.log('[ToolConverter] Input text preview:', text.substring(0, 300));

    const toolCalls = [];
    let callIndex = 0;

    // 1. 首先匹配 ```tool_call ... ``` 代码块（使用贪婪匹配确保捕获完整内容）
    const toolRegex = /```tool_call\s*\n([\s\S]*?)\n```/g;
    let match;

    while ((match = toolRegex.exec(text)) !== null) {
      const jsonText = match[1].trim();
      const toolCall = this._parseToolCallJSON(jsonText, callIndex++);
      if (toolCall) {
        toolCalls.push(toolCall);
      }
    }

    // 2. 如果没有找到代码块，尝试匹配纯 JSON 对象
    if (toolCalls.length === 0) {
      const jsonObjects = this._extractCompleteJSONObjects(text);
      for (const jsonText of jsonObjects) {
        // 验证是否包含 tool call 必需字段
        if (jsonText.includes('"name"') && jsonText.includes('"arguments"')) {
          const toolCall = this._parseToolCallJSON(jsonText, callIndex++);
          if (toolCall) {
            toolCalls.push(toolCall);
          }
        }
      }
    }

    console.log('[ToolConverter] Total tool_calls parsed:', toolCalls.length);
    console.log('[ToolConverter] ====== End Parsing ======\n');
    return toolCalls;
  }

  _parseToolCallJSON(jsonText, callIndex) {
    console.log('[ToolConverter] Found tool_call JSON:', jsonText.substring(0, 100));

    try {
      const toolData = JSON.parse(jsonText);
      console.log('[ToolConverter] Parsed toolData:', JSON.stringify(toolData, null, 2));

      if (!toolData.name) {
        console.warn('[ToolConverter] 工具调用缺少 name 字段:', jsonText);
        return null;
      }

      const argsValue = toolData.arguments;
      const argsString = typeof argsValue === 'string'
        ? argsValue
        : JSON.stringify(argsValue || {});

      console.log('[ToolConverter] Arguments conversion:', {
        original_type: typeof argsValue,
        original_value: argsValue,
        result_type: typeof argsString,
        result_length: argsString.length,
        result_preview: argsString.substring(0, 100)
      });

      const toolCall = {
        id: toolData.id || `call_${Date.now()}_${callIndex}`,
        type: 'function',
        function: {
          name: toolData.name,
          arguments: argsString
        }
      };

      console.log('[ToolConverter] Generated tool_call:', JSON.stringify(toolCall, null, 2));
      return toolCall;

    } catch (error) {
      console.warn('[ToolConverter] 解析工具调用 JSON 失败:', jsonText.substring(0, 100), error.message);
      return null;
    }
  }

  _extractCompleteJSONObjects(text) {
    const jsonObjects = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      // 查找下一个 {
      const openBraceIndex = text.indexOf('{', startIndex);
      if (openBraceIndex === -1) {
        break;
      }

      // 从 { 开始，通过计数括号找到匹配的 }
      let braceCount = 0;
      let endIndex = openBraceIndex;
      let inString = false;
      let escapeNext = false;

      for (let i = openBraceIndex; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
      }

      if (endIndex > openBraceIndex) {
        const jsonText = text.substring(openBraceIndex, endIndex);
        jsonObjects.push(jsonText);
        startIndex = endIndex;
      } else {
        // 没找到匹配的括号，继续搜索
        startIndex = openBraceIndex + 1;
      }
    }

    return jsonObjects;
  }

  /**
   * 为用户消息添加工具使用指令
   */
  appendToolInstruction(userMessage, tools) {
    if (!tools || tools.length === 0) {
      return userMessage;
    }

    const toolsText = this.convertToolsToText(tools);

    return `${userMessage}\n\n你可以使用以下工具：\n\n${toolsText}\n\n如果需要调用工具，请使用以下格式：\n\`\`\`tool_call\n{"id": "唯一标识符", "name": "工具名称", "arguments": {"参数名": "参数值"}}\n\`\`\`\n\n重要：每个工具调用必须包含唯一的 id 字段（如 "call_1", "call_2"），用于关联工具执行结果。参数 arguments 必须是 JSON 对象格式。`;
  }

  /**
   * 将 assistant 消息中的 tool_calls 转换为文本格式（用于发送给 AI）
   */
  convertToolCallsToText(toolCalls) {
    if (!toolCalls || toolCalls.length === 0) {
      return '';
    }

    return toolCalls.map(call => {
      const id = call.id || '';
      const name = call.function?.name || '';
      const args = call.function?.arguments || '{}';

      return `\`\`\`tool_call\n{"id": "${id}", "name": "${name}", "arguments": ${args}}\n\`\`\``;
    }).join('\n\n');
  }

}

module.exports = ToolConverter;
