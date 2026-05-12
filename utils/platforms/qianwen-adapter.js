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
    const editor = await this.waitForElement('div[contenteditable="true"][data-slate-editor="true"]', 10000);
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
    try {
      await this.sendMessage(content);

      const response = await this.waitForAIResponse();

      chrome.runtime.sendMessage({
        type: 'aiResponse',
        platform: this.platform,
        messageId: messageId,
        content: response,
        conversationUrl: window.location.href
      });
    } catch (error) {
      chrome.runtime.sendMessage({
        type: 'aiResponse',
        platform: this.platform,
        messageId: messageId,
        error: error.message
      });
    }
  }

  async waitForAIResponse() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let lastContent = '';
      let observer = null;
      let timeoutHandle = null;

      const checkNewMessage = () => {
        const messageElements = document.querySelectorAll('.answer-common-card');

        if (messageElements.length === 0) return null;

        let bestCard = null;
        let bestLength = 0;
        const thinkSelectors = [
          '.thinking-content', '.think-process', '[class*="think"]',
          '[class*="thought"]', '.qk-think', '.think-container', '.thinking', '.thought'
        ];

        messageElements.forEach(card => {
          const tempClone = card.cloneNode(true);
          thinkSelectors.forEach(sel => tempClone.querySelectorAll(sel).forEach(el => el.remove()));
          const md = tempClone.querySelector('.qk-markdown');
          const len = (md?.textContent || '').length;
          if (len > bestLength) {
            bestLength = len;
            bestCard = card;
          }
        });

        if (!bestCard) {
          bestCard = messageElements[messageElements.length - 1];
        }

        const clonedMessage = bestCard.cloneNode(true);

        thinkSelectors.forEach(selector => {
          const elements = clonedMessage.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });

        const allMarkdownElements = clonedMessage.querySelectorAll('.qk-markdown');
        let markdownElement = null;

        if (allMarkdownElements.length > 1) {
          markdownElement = allMarkdownElements[allMarkdownElements.length - 1];
        } else if (allMarkdownElements.length === 1) {
          markdownElement = allMarkdownElements[0];
        }

        if (!markdownElement) {
          markdownElement = clonedMessage.querySelector('.answer-text');
        }

        if (!markdownElement) {
          markdownElement = clonedMessage.querySelector('.answer-common-card');
        }

        if (!markdownElement) {
          const allDivs = bestCard.querySelectorAll('div');
          for (const div of allDivs) {
            const className = div.className || '';
            const text = div.innerText || '';
            if ((className.includes('answer') || className.includes('markdown')) && text.trim().length > 20) {
              markdownElement = div;
              break;
            }
          }
        }

        if (!markdownElement) {
          return null;
        }

        const clone = markdownElement.cloneNode(true);

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

        const preElements = clone.querySelectorAll('pre');
        const codeBlocks = [];
        preElements.forEach(pre => {
          const codeEl = pre.querySelector('code');
          const codeSource = codeEl || pre;

          let codeText = '';
          if (codeEl) {
            const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT, null);
            let node;
            while (node = walker.nextNode()) {
              let text = node.textContent;
              text = text.replace(/^\d+ ?/, '');
              codeText += text;
            }
            codeText = codeText.trim();
          } else {
            codeText = pre.textContent?.trim() || '';
          }

          if (codeText.length > 0) {
            let lang = '';
            const wrapper = pre.closest('[class*="code"]') || pre.parentElement;
            const langSibling = wrapper?.parentElement?.querySelector('div:first-child');
            if (langSibling) {
              const langText = langSibling.textContent?.trim() || '';
              const langMatch = langText.match(/^([a-z]+)/i);
              lang = langMatch ? langMatch[1].toLowerCase() : '';
            }
            codeBlocks.push(`\`\`\`${lang}\n${codeText}\n\`\`\``);
          }
          pre.remove();
        });

        let rawText = (clone.innerText || '').trim();

        if (codeBlocks.length > 0) {
          rawText += '\n\n' + codeBlocks.join('\n\n');
        }

        const endMarker = '[[<<>>]]';
        const hasMarker = rawText.includes(endMarker);
        if (hasMarker) {
          rawText = rawText.substring(0, rawText.indexOf(endMarker)).trim();
        }

        const finalText = rawText;

        const isLikelyStreaming = codeBlocks.length === 0 && finalText.length < 1000 && !hasMarker;

        if (isLikelyStreaming) {
          return null;
        }

        if (!finalText || finalText.length < 5) {
          return null;
        }

        return finalText;
      };

      const cleanup = (content) => {
        if (observer) observer.disconnect();
        if (timeoutHandle) clearTimeout(timeoutHandle);

        const finalContent = content.replace(/\[\[<<>>\]\]/g, '').trim();
        resolve(finalContent);
      };

      observer = new MutationObserver(() => {
        const content = checkNewMessage();
        if (content && content !== lastContent) {
          lastContent = content;

          if (content.includes('[[<<>>]]')) {
            cleanup(content);
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
