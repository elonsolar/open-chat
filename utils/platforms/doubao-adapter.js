class DoubaoAdapter extends BasePlatformAdapter {
  constructor() {
    super('doubao', {
      inputBox: 'textarea.semi-input-textarea',
      sendButton: 'button[class*="bg-g-send-msg-btn-bg"]',
      messageList: '.message-list-S2Fv2S',
      messageSelector: 'div[class*="max-w-(--content-max-width)"]',
      userInput: 'div[class*="justify-end"]',
      aiResponse: 'div[class*="text-s-color-text-secondary"]',
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

    const inputBox = await this.waitForElement('textarea.semi-input-textarea', 10000);
    console.log(`[${this.platform}] ✓ 找到输入框`);

    inputBox.focus();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(inputBox, content);
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    await this.sleep(500);

    const sendButton = await this.waitForElement('button[class*="bg-g-send-msg-btn-bg"]', 5000);
    console.log(`[${this.platform}] ✓ 找到发送按钮`);

    if (!sendButton.disabled) {
      sendButton.click();
      console.log(`[${this.platform}] ✓ 已点击发送按钮`);
    } else {
      console.error(`[${this.platform}] ❌ 发送按钮被禁用`);
      throw new Error('发送按钮被禁用');
    }

    await this.sleep(1000);
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
      let stableCount = 0;
      let observer = null;
      let checkInterval = null;
      const STABLE_THRESHOLD = 3;
      const CHECK_INTERVAL = 1000;

      const checkNewMessage = () => {
        const messageList = document.querySelector('.message-list-S2Fv2S');
        if (!messageList) return null;

        const messageContainers = messageList.querySelectorAll('div[class*="max-w-(--content-max-width)"]');
        const validMessages = Array.from(messageContainers).filter(msg => msg.textContent?.trim().length > 0);

        if (validMessages.length === 0) return null;

        const lastMessage = validMessages[validMessages.length - 1];

        const isAIMessage = lastMessage.querySelector('[class*="text-s-color-text-secondary"]');
        if (!isAIMessage) return null;

        let rawText = (lastMessage.innerText || lastMessage.textContent || '').trim();

        if (!rawText || rawText.length < 10) return null;

        return rawText;
      };

      const cleanup = (content) => {
        console.log(`[${this.platform}] ========== cleanup 被调用 ==========`);
        console.log(`[${this.platform}] 原始内容长度:`, content?.length || 0);
        if (observer) observer.disconnect();
        if (checkInterval) clearInterval(checkInterval);

        const finalContent = content.replace(/\[\[<<>>\]\]/g, '').trim();
        console.log(`[${this.platform}] 清理后内容长度:`, finalContent?.length || 0);
        resolve(finalContent);
      };

      observer = new MutationObserver(() => {
        const content = checkNewMessage();
        if (content && content.length > 0) {
          if (content !== lastContent) {
            lastContent = content;
            stableCount = 0;
            console.log(`[${this.platform}] 内容变化，重置稳定计数器`);
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      checkInterval = setInterval(() => {
        const content = checkNewMessage();
        if (content && content.length > 0) {
          if (content === lastContent) {
            stableCount++;
            console.log(`[${this.platform}] 内容稳定，计数: ${stableCount}/${STABLE_THRESHOLD}`);

            if (stableCount >= STABLE_THRESHOLD) {
              cleanup(content);
            } else if (content.includes('[[<<>>]]')) {
              cleanup(content);
            }
          } else {
            lastContent = content;
            stableCount = 0;
          }
        }
      }, CHECK_INTERVAL);

      setTimeout(() => {
        if (lastContent.length > 0) {
          cleanup(lastContent);
        } else {
          reject(new Error('等待AI回复超时 (180秒)'));
        }
      }, 180000);
    });
  }
}

window.DoubaoAdapter = DoubaoAdapter;
