const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const ToolConverter = require('./tool-converter');
const MessageRouter = require('./message-router');

class OpenAIAPIServer {
  constructor(messageRouter) {
    this.app = express();
    this.messageRouter = messageRouter;
    this.toolConverter = new ToolConverter();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  setupRoutes() {
    this.app.post('/v1/chat/completions', this.handleChatCompletion.bind(this));
    
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        connected_clients: this.messageRouter.getConnectedClientsCount(),
        pending_requests: this.messageRouter.getPendingRequestsCount()
      });
    });

    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  async handleChatCompletion(req, res) {
    try {
      const { model, messages, tools, stream = false } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: {
            message: 'Invalid request: messages array is required',
            type: 'invalid_request_error'
          }
        });
      }

      const lastMessage = messages[messages.length - 1];
      const userContent = lastMessage.content || '';
      
      let enhancedMessage = userContent;
      if (tools && tools.length > 0) {
        enhancedMessage = this.toolConverter.appendToolInstruction(userContent, tools);
      }

      const requestData = {
        model: model || config.model, // 这里 model 实际上是会话名称
        messages: [
          ...messages.slice(0, -1),
          {
            role: lastMessage.role,
            content: enhancedMessage
          }
        ],
        tools: tools || null
      };

      if (stream) {
        await this.handleStreamingResponse(req, res, requestData);
      } else {
        await this.handleNonStreamingResponse(req, res, requestData);
      }

    } catch (error) {
      console.error('Error handling chat completion:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: error.message,
            type: 'server_error'
          }
        });
      }
    }
  }

  async handleNonStreamingResponse(req, res, requestData) {
    try {
      const response = await this.messageRouter.sendMessageToExtension(requestData);
      
      if (response.error) {
        return res.status(500).json({
          error: {
            message: response.content,
            type: 'server_error'
          }
        });
      }
      
      const toolCalls = this.toolConverter.convertTextToToolCalls(response.content);
      
      const result = {
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestData.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: toolCalls.length > 0 ? null : response.content,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
          },
          finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
        }],
        usage: {
          prompt_tokens: this.estimateTokens(requestData.messages),
          completion_tokens: this.estimateTokens([{ content: response.content }]),
          total_tokens: 0
        }
      };
      
      result.usage.total_tokens = result.usage.prompt_tokens + result.usage.completion_tokens;
      
      // 如果创建了新会话，在响应中包含会话 ID
      if (response.conversation_id) {
        result.conversation_id = response.conversation_id;
      }
      
      res.json(result);

    } catch (error) {
      console.error('Error in non-streaming response:', error);
      res.status(500).json({
        error: {
          message: error.message,
          type: 'server_error'
        }
      });
    }
  }

  async handleStreamingResponse(req, res, requestData) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const response = await this.messageRouter.sendMessageToExtension({
        ...requestData,
        requestId: requestId
      });

      const content = response.content || '';
      const toolCalls = this.toolConverter.convertTextToToolCalls(content);

      await this.streamChunk(res, {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: requestData.model,
        choices: [{
          index: 0,
          delta: {
            role: 'assistant'
          }
        }]
      });

      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          await this.streamChunk(res, {
            id: `chatcmpl-${requestId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(startTime / 1000),
            model: requestData.model,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: 0,
                  id: toolCall.id,
                  type: toolCall.type,
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments
                  }
                }]
              }
            }]
          });
        }
      } else {
        await this.streamChunk(res, {
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(startTime / 1000),
          model: requestData.model,
          choices: [{
            index: 0,
            delta: {
              content: content
            }
          }]
        });
      }

      await this.streamChunk(res, {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: requestData.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
        }]
      });

      res.write('data: [DONE]\n\n');

    } catch (error) {
      console.error('Error in streaming response:', error);
      
      await this.streamChunk(res, {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: requestData.model,
        choices: [{
          index: 0,
          delta: {
            content: `\n[Error: ${error.message}]`
          }
        }]
      });

      res.write('data: [DONE]\n\n');
    }

    res.end();
  }

  async streamChunk(res, chunk) {
    return new Promise((resolve) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      setImmediate(resolve);
    });
  }

  estimateTokens(messages) {
    let totalChars = 0;
    
    for (const message of messages) {
      if (message.content) {
        totalChars += message.content.length;
      }
    }
    
    return Math.ceil(totalChars / 4);
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(config.port, () => {
        console.log(`OpenAI API server running on http://localhost:${config.port}`);
        console.log(`Endpoint: http://localhost:${config.port}/v1/chat/completions`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('OpenAI API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = OpenAIAPIServer;
