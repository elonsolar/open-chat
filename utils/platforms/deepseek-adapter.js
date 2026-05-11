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

  countAIMessages() {
    const messages = document.querySelectorAll('.ds-message');
    const allMessages = Array.from(messages);
    const aiMessages = allMessages.filter((_, index) => index % 2 === 1);
    console.log(`[${this.platform}] 消息统计: 总数=${allMessages.length}, AI=${aiMessages.length}`);
    return aiMessages.length;
  }

  checkForNewContent() {
    try {
      const messageElements = document.querySelectorAll('.ds-message');

      if (messageElements.length === 0) {
        console.log(`[${this.platform}] 未找到消息元素`);
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] 找到 ${messageElements.length} 个消息元素`);

      const messages = Array.from(messageElements);
      let aiMessages;

      const markdown = messages[0]?.querySelector('.ds-markdown');
      if (messages[0]?.hasAttribute('data-message-id')) {
        aiMessages = messages.filter((_, index) => index % 2 === 1);
      } else {
        aiMessages = messages.filter(msg => {
          const md = msg.querySelector('.ds-markdown');
          if (md) {
            const text = md.textContent || '';
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

      const markdownElements = lastAIMessage.querySelectorAll('.ds-markdown');
      const markdownElement = markdownElements.length > 0 ? markdownElements[markdownElements.length - 1] : null;

      if (!markdownElement) {
        console.log(`[${this.platform}] 未找到 .ds-markdown 元素`);
        return { found: false, content: '' };
      }

      const allText = this.extractContentWithCode(markdownElement);

      if (!allText || allText.length < 10) {
        console.log(`[${this.platform}] 内容太短 (${allText?.length || 0}字符)，可能还在思考中`);
        return { found: false, content: '' };
      }

      const thinkKeywords = ['思考中', 'Thinking', '正在思考', '思考内容'];
      const hasThinkKeyword = thinkKeywords.some(keyword => allText.includes(keyword));

      if (hasThinkKeyword) {
        console.log(`[${this.platform}] 检测到思考关键词，还未生成真正回复`);
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] ✓ 成功提取真实回复内容，长度: ${allText.length}`);
      console.log(`[${this.platform}] 内容末尾: "${allText.slice(-50)}"`);
      console.log(`[${this.platform}] 是否包含结束标记: ${allText.includes('[[<<>>]]')}`);
      return { found: true, content: allText };

    } catch (e) {
      console.warn(`[${this.platform}] 检查新内容时出错:`, e);
      return { found: false, content: '' };
    }
  }

  async fillInput(inputBox, content) {
    inputBox.value = content;
  }

  async submitMessage(inputBox, content) {
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

    console.log(`[${this.platform}] DeepSeek消息已发送，等待回复...`);
  }

  getConversationHistory() {
    try {
      const messages = document.querySelectorAll('.ds-message');
      console.log(`[${this.platform}] 找到 .ds-message 元素: ${messages.length} 个`);

      Array.from(messages).forEach((msg, idx) => {
        const markdown = msg.querySelector('.ds-markdown');
        const text = markdown ? (markdown.innerText || markdown.textContent || '') : '';
        console.log(`[${this.platform}] 消息[${idx}]: 包含ds-markdown=${!!markdown}, 内容长度=${text.length}, 预览="${text.substring(0, 50)}"`);
      });

      this.conversationHistory = Array.from(messages).map((msg, idx) => {
        const isUser = idx % 2 === 0;
        const markdown = msg.querySelector('.ds-markdown');
        const content = markdown ? (markdown.innerText || markdown.textContent || '') : '';

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

window.DeepSeekAdapter = DeepSeekAdapter;
