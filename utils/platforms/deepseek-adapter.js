class DeepSeekAdapter extends BasePlatformAdapter {
  constructor() {
    super('deepseek', {
      inputBox: 'textarea',
      sendButton: 'button',
      messageList: '.ds-message',
      messageSelector: '.ds-message',
      userInput: '*',
      aiResponse: '*',
      newChatButton: '[class*="new"]'
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.sleep(100);
    }
    throw new Error(`元素未找到: ${selector}`);
  }

  async sendMessage(content) {
    console.log(`[${this.platform}] ========== 开始发送消息 ==========`);
    console.log(`[${this.platform}] 消息内容:`, content);

    const inputBox = await this.waitForElement('textarea', 10000);
    console.log(`[${this.platform}] ✓ 找到输入框`);
    
    inputBox.focus();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(inputBox, content);
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    await this.sleep(500);

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    inputBox.dispatchEvent(enterEvent);

    if (content.includes('\n')) {
      const shiftEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      inputBox.dispatchEvent(shiftEnterEvent);
    }
  }

  async processSendMessage(content, messageId) {
    console.log(`[${this.platform}] ========== processSendMessage ==========`);
    console.log(`[${this.platform}] content:`, content);
    console.log(`[${this.platform}] messageId:`, messageId);

    window.isSendingMessage = true;
    console.log(`[${this.platform}] ✓ 已设置 isSendingMessage = true`);

    try {
      await this.sendMessage(content);
      console.log(`[${this.platform}] ✓ 消息已发送到输入框`);

      const response = await this.waitForAIResponse();
      console.log(`[${this.platform}] ✓ 收到 AI 回复，长度:`, response?.length || 0);

      chrome.runtime.sendMessage({
        type: 'aiResponse',
        platform: this.platform,
        messageId: messageId,
        content: response,
        conversationUrl: window.location.href
      });
      console.log(`[${this.platform}] ✓ 已发送 aiResponse 消息到 background`);
    } catch (error) {
      chrome.runtime.sendMessage({
        type: 'aiResponse',
        platform: this.platform,
        messageId: messageId,
        error: error.message
      });
    } finally {
      window.isSendingMessage = false;
      console.log(`[${this.platform}] ✓ 消息处理完成，已清除 isSendingMessage 标记`);
    }
  }

  async waitForAIResponse() {
    console.log(`[${this.platform}] ========== 开始等待 AI 回复 ==========`);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let lastContent = '';
      let observer = null;
      let timeoutHandle = null;

      const checkNewMessage = (mutations) => {
        console.log(`[${this.platform}] MutationObserver 触发`);
        const messages = document.querySelectorAll('.ds-message');
        if (messages.length === 0) return null;

        const lastMessage = messages[messages.length - 1];

        const mainContent = lastMessage.querySelector('.ds-assistant-message-main-content');
        if (!mainContent) return null;

        const clonedContent = mainContent.cloneNode(true);
        
        // 使用 Turndown 将 HTML 转换为 markdown
        try {
          const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            fence: '```',
            bulletListMarker: '-',
            emDelimiter: '*',
            strongDelimiter: '**'
          });
          
          // 添加代码块规则
          turndownService.addRule('codeBlock', {
            filter: function (node) {
              return node.nodeName === 'PRE' && node.querySelector('code');
            },
            replacement: function (content, node) {
              const code = node.querySelector('code');
              const lang = (code.className || '').match(/language-(\w+)/)?.[1] || '';
              return `\n\n\`\`\`${lang}\n${code.textContent.trim()}\n\`\`\`\n\n`;
            }
          });
          
          const markdown = turndownService.turndown(clonedContent);
          
          if (!markdown || markdown.length < 10) return null;

          const thinkKeywords = ['思考中', 'Thinking', '正在思考', '思考内容'];
          const hasThinkKeyword = thinkKeywords.some(keyword => markdown.includes(keyword));
          if (hasThinkKeyword) return null;

          return markdown;
        } catch (error) {
          console.error(`[${this.platform}] Turndown 转换失败:`, error);
          // 降级到简单文本提取
          const simpleText = clonedContent.textContent?.trim() || '';
          return simpleText.length > 10 ? simpleText : null;
        }
      };

      const cleanup = (content) => {
        console.log(`[${this.platform}] ========== cleanup 被调用 ==========`);
        console.log(`[${this.platform}] 原始内容长度:`, content?.length || 0);
        if (observer) observer.disconnect();
        if (timeoutHandle) clearTimeout(timeoutHandle);

        const finalContent = content.replace(/\[\[<<>>\]\]/g, '').trim();
        console.log(`[${this.platform}] 清理后内容长度:`, finalContent?.length || 0);
        resolve(finalContent);
      };

      observer = new MutationObserver((mutations) => {
        const content = checkNewMessage(mutations);
        if (content && content !== lastContent) {
          lastContent = content;

          if (content.includes('[[<<>>]]')) {
            // 检测到结束标记后，等待 DOM 稳定再读取完整内容
            setTimeout(() => {
              const finalContent = checkNewMessage(mutations);
              if (finalContent && finalContent.includes('[[<<>>]]')) {
                cleanup(finalContent);
              } else {
                cleanup(content);
              }
            }, 500);
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      timeoutHandle = setTimeout(() => {
        if (lastContent.length > 0) {
          cleanup(lastContent);
        } else {
          reject(new Error('等待AI回复超时 (180秒)'));
        }
      }, 180000);
    });
  }

}

window.DeepSeekAdapter = DeepSeekAdapter;
