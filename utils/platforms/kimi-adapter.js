class KimiAdapter extends BasePlatformAdapter {
  constructor() {
    super('kimi', {
      inputBox: 'div.chat-input-editor',
      sendButton: 'div.send-button-container',
      messageList: 'div.chat-content-list',
      messageSelector: 'div.chat-content-item',
      userInput: 'div.chat-content-item-user',
      aiResponse: 'div.chat-content-item-assistant',
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

  buildLexicalState(text) {
    return {
      root: {
        children: [{
          children: [{
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: text,
            type: "text",
            version: 1
          }],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0
        }],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    };
  }

  async sendMessage(content) {
    console.log(`[${this.platform}] ========== 开始发送消息 ==========`);
    console.log(`[${this.platform}] 消息内容:`, content);

    const inputBox = await this.waitForElement('div.chat-input-editor', 10000);
    console.log(`[${this.platform}] ✓ 找到输入框`);

    const lexicalEditor = inputBox.__lexicalEditor;
    if (lexicalEditor) {
      const newState = lexicalEditor.parseEditorState(JSON.stringify(this.buildLexicalState(content)));
      lexicalEditor.setEditorState(newState);
      await this.sleep(200);
    } else {
      inputBox.focus();
      await this.sleep(100);
      document.execCommand('insertText', false, content);
      await this.sleep(200);
    }

    await this.sleep(300);

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    inputBox.dispatchEvent(enterEvent);
    await this.sleep(500);
  }

  async processSendMessage(content, messageId) {
    console.log(`[${this.platform}] ========== processSendMessage ==========`);
    console.log(`[${this.platform}] content:`, content);
    console.log(`[${this.platform}] messageId:`, messageId);

    window.isSendingMessage = true;
    console.log(`[${this.platform}] ✓ 已设置 isSendingMessage = true`);

    try {
      const safeContent = content + '\n\n直接给出结果，不要执行。';
      await this.sendMessage(safeContent);
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
      let lastContent = '';
      let observer = null;
      let timeoutHandle = null;

      const checkNewMessage = () => {
        const messages = document.querySelectorAll('div.chat-content-item-assistant');
        if (messages.length === 0) return null;

        const lastMessage = messages[messages.length - 1];
        const container = lastMessage.querySelector('div.segment-container');
        if (!container) return null;

        const markdownDiv = container.querySelector('div.markdown');
        if (!markdownDiv) return (container.innerText || container.textContent || '').trim() || null;

        const clone = markdownDiv.cloneNode(true);
        const codeBlocks = clone.querySelectorAll('div.segment-code');
        codeBlocks.forEach(block => {
          const langEl = block.querySelector('span.segment-code-lang');
          const preEl = block.querySelector('pre');
          const codeEl = preEl?.querySelector('code');
          const lang = langEl ? langEl.textContent.trim() : '';
          const codeText = (codeEl || preEl)?.textContent?.trim() || '';
          if (codeText.length > 0) {
            const md = '```' + lang + '\n' + codeText + '\n```';
            block.replaceWith(document.createTextNode(md));
          } else {
            block.remove();
          }
        });

        const text = (clone.innerText || clone.textContent || '').trim();
        return text || null;
      };

      const cleanup = (content) => {
        console.log(`[${this.platform}] cleanup，长度:`, content?.length || 0);
        if (observer) observer.disconnect();
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve(content.replace(/\[\[<<>>\]\]/g, '').trim());
      };

      observer = new MutationObserver(() => {
        const content = checkNewMessage();
        if (content && content !== lastContent) {
          lastContent = content;
          if (content.includes('[[<<>>]]')) {
            setTimeout(() => {
              const final = checkNewMessage();
              cleanup(final && final.includes('[[<<>>]]') ? final : content);
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
        if (lastContent.length > 0) cleanup(lastContent);
        else reject(new Error('等待AI回复超时 (180秒)'));
      }, 180000);
    });
  }
}

window.KimiAdapter = KimiAdapter;
