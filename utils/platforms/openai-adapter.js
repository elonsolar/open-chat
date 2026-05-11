class OpenAIAdapter extends BasePlatformAdapter {
  constructor() {
    super('openai', {
      inputBox: 'textarea',
      sendButton: 'button',
      messageList: '[class*="message"]',
      messageSelector: '[class*="message"]',
      userInput: '[class*="user"]',
      aiResponse: '[class*="assistant"]',
      newChatButton: '[class*="new"]'
    });
  }

  countAIMessages() {
    const messages = document.querySelectorAll('[data-message-id]');
    const allMessages = Array.from(messages);
    const aiMessages = allMessages.filter((_, index) => index % 2 === 1);
    console.log(`[${this.platform}] 消息统计: 总数=${allMessages.length}, AI=${aiMessages.length}`);
    return aiMessages.length;
  }

  checkForNewContent() {
    try {
      let messageElements = document.querySelectorAll('[data-message-id]');

      if (messageElements.length === 0) {
        messageElements = document.querySelectorAll('.ds-message');

        if (messageElements.length === 0) {
          console.log(`[${this.platform}] 未找到消息元素`);
          return { found: false, content: '' };
        }
      }

      console.log(`[${this.platform}] 找到 ${messageElements.length} 个消息元素`);

      const messages = Array.from(messageElements);

      let aiMessages = [];

      if (messages[0]?.hasAttribute('data-message-id')) {
        aiMessages = messages.filter((_, index) => index % 2 === 1);
      } else {
        aiMessages = messages.filter(msg => {
          const markdown = msg.querySelector('.ds-markdown');
          if (markdown) {
            const text = markdown.textContent || '';
            return !text.trim().startsWith('User:') && !text.trim().startsWith('用户:');
          }
          return false;
        });
      }

      console.log(`[${this.platform}] 找到 ${aiMessages.length} 个AI消息`);

      if (aiMessages.length === 0) {
        console.log(`[${this.platform}] 没有找到AI消息`);
        return { found: false, content: '' };
      }

      const lastAIMessage = aiMessages[aiMessages.length - 1];

      const content = this.extractContentWithCode(lastAIMessage);
      if (content.length > 0) {
        console.log(`[${this.platform}] ✓ 成功提取回复内容，长度: ${content.length}`);
        return { found: true, content };
      }

      return { found: false, content: '' };

    } catch (e) {
      console.warn(`[${this.platform}] 检查新内容时出错:`, e);
      return { found: false, content: '' };
    }
  }

  async fillInput(inputBox, content) {
    inputBox.value = content;
  }

  async submitMessage(inputBox, content) {
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    await this.sleep(1000);

    console.log(`[${this.platform}] 步骤3: 按Enter发送...`);

    inputBox.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      compose: true
    }));

    await this.sleep(1000);

    const sendButtons = document.querySelectorAll('button, [role="button"]');
    let buttonClicked = false;

    for (const btn of sendButtons) {
      const text = btn.textContent?.trim().toLowerCase();
      if (text.includes('发送') || text.includes('send') || text.includes('提交') || text === '') {
        if (!btn.disabled && btn.offsetParent !== null) {
          console.log(`[${this.platform}] 找到发送按钮，尝试点击`);
          btn.click();
          buttonClicked = true;
          await this.sleep(500);
          break;
        }
      }
    }

    if (!buttonClicked) {
      console.log(`[${this.platform}] 未找到发送按钮，仅使用Enter键`);
    }
  }

  getConversationHistory() {
    try {
      const messages = document.querySelectorAll('[data-message-id]');

      this.conversationHistory = Array.from(messages).map((msg, idx) => {
        const isUser = idx % 2 === 0;
        const content = msg.textContent?.trim() || '';

        return {
          index: idx,
          isUser,
          content: content || '',
          timestamp: Date.now(),
          element: msg
        };
      });

      const userMessages = this.conversationHistory.filter(msg => msg.isUser);
      const aiMessages = this.conversationHistory.filter(msg => !msg.isUser);

      console.log(`[${this.platform}] 会话历史: 总共${this.conversationHistory.length}条消息 (用户:${userMessages.length}条, AI:${aiMessages.length}条)`);

      return this.conversationHistory;
    } catch (error) {
      console.error(`[${this.platform}] 获取会话历史失败:`, error);
      return [];
    }
  }
}

window.OpenAIAdapter = OpenAIAdapter;
