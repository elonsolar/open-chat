class QianwenAdapter extends BasePlatformAdapter {
  constructor() {
    super('qianwen', {
      inputBox: 'div[contenteditable="true"][data-slate-editor="true"]',
      sendButton: 'button[aria-label="发送消息"]',
      messageList: '.message-list-content-container',
      messageSelector: '.chat-round',
      userInput: '.question-text-card',
      aiResponse: '.answer-common-card, .qk-markdown',
      newChatButton: 'button[class*="new"], a:contains("新对话")'
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

    const editor = await this.waitForElement('div[contenteditable="true"][data-slate-editor="true"]', 10000);
    console.log(`[${this.platform}] ✓ 找到编辑器`);
    
    editor.focus();
    await this.sleep(200);

    let textNode = editor.querySelector('span[data-slate-node="text"]');
    if (!textNode) {
      const el = editor.querySelector('[data-slate-node="element"]') || Object.assign(
        editor.appendChild(document.createElement('p')), { 'data-slate-node': 'element' }
      );
      textNode = Object.assign(el.appendChild(document.createElement('span')), { 'data-slate-node': 'text' });
      await this.sleep(50);
    }

    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(textNode);
    sel.removeAllRanges();
    sel.addRange(r);

    editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContent' }));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'deleteContent' }));
    await this.sleep(100);

    r.selectNodeContents(textNode);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);

    editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: content }));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText', data: content }));
    await this.sleep(500);

    const sendButton = await this.waitForButton();
    sendButton.click();
    console.log(`[${this.platform}] ✓ 已点击发送按钮`);
    await this.sleep(1000);
  }

  async waitForButton() {
    const startTime = Date.now();
    while (Date.now() - startTime < 8000) {
      const btn = document.querySelector('button[aria-label="发送消息"]');
      if (btn && !btn.disabled && btn.offsetParent !== null) return btn;
      await this.sleep(200);
    }
    throw new Error('发送按钮未找到');
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
        const messageContainer = document.querySelector('.message-list-content-container');
        if (!messageContainer) return null;

        const chatRounds = messageContainer.querySelectorAll('.chat-round');
        if (chatRounds.length === 0) return null;

        const lastRound = chatRounds[chatRounds.length - 1];
        const answerCard = lastRound?.querySelector('.answer-common-card');
        
        if (!answerCard) return null;

        const clonedMessage = answerCard.cloneNode(true);

        const thinkSelectors = [
          '[data-card_name="deep_think"]', '.thinking-content', '.think-process', '[class*="think"]',
          '[class*="thought"]', '.qk-think', '.think-container', '.thinking', '.thought'
        ];

        thinkSelectors.forEach(selector => {
          const elements = clonedMessage.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });

        const markdownElement = clonedMessage.querySelector('.qk-markdown');

        if (!markdownElement) return null;

        const clone = markdownElement.cloneNode(true);
        
        // 处理代码块
        const codeBlocks = clone.querySelectorAll('pre');
        
        codeBlocks.forEach(block => {
          const codeEl = block.querySelector('code');
          const codeText = (codeEl || block)?.textContent?.trim() || '';
          
          if (codeText.length > 0) {
            let lang = '';
            if (codeEl) {
              const langMatch = (codeEl.className || '').match(/language-(\w+)/);
              lang = langMatch ? langMatch[1] : '';
            }
            const markdownCode = `\`\`\`${lang}\n${codeText}\n\`\`\``;
            block.replaceWith(document.createTextNode(markdownCode));
          } else {
            block.remove();
          }
        });

        // 在每个段落后添加换行符
        const paragraphs = clone.querySelectorAll('.qk-md-paragraph');
        paragraphs.forEach((p, index) => {
          if (index < paragraphs.length - 1) {
            p.appendChild(document.createTextNode('\n\n'));
          }
        });

        const removeSelectors = [
          '[class*="video-note"]',
          '[class*="card_video"]',
          '[class*="search-result"]',
          '[class*="recommend"]',
          '[class*="source-map"]',
          'style',
          'script'
        ];
        removeSelectors.forEach(sel => {
          clone.querySelectorAll(sel).forEach(el => el.remove());
        });

        let rawText = (clone.innerText || clone.textContent || '').trim();

        if (!rawText || rawText.length < 10) return null;

        return rawText;
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

window.QianwenAdapter = QianwenAdapter;
