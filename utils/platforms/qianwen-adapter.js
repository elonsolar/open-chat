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

  countAIMessages() {
    const messages = document.querySelectorAll('.answer-common-card');
    console.log(`[${this.platform}] 消息统计: AI回答=${messages.length}`);
    return messages.length;
  }

  checkForNewContent() {
    try {
      const messageElements = document.querySelectorAll('.answer-common-card');

      if (messageElements.length === 0) {
        console.log(`[${this.platform}] 未找到 .answer-common-card 元素`);
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] 找到 ${messageElements.length} 个AI回答`);

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

      let removedCount = 0;
      thinkSelectors.forEach(selector => {
        const elements = clonedMessage.querySelectorAll(selector);
        elements.forEach(el => {
          el.remove();
          removedCount++;
        });
      });

      if (removedCount > 0) {
        console.log(`[${this.platform}] 预处理移除了 ${removedCount} 个思考相关元素`);
      }

      return this.extractQianwenAIContent(clonedMessage);

    } catch (e) {
      console.warn(`[${this.platform}] 检查新内容时出错:`, e);
      return { found: false, content: '' };
    }
  }

  extractQianwenAIContent(messageElement) {
    try {
      console.log(`[${this.platform}] 提取千问AI内容...`);

      const clonedMessage = messageElement.cloneNode(true);

      const thinkSelectors = [
        '.thinking-content',
        '.think-process',
        '[class*="think"]',
        '[class*="thought"]',
        '.qk-think',
        '.think-container',
        '.thinking',
        '.thought'
      ];

      let removedCount = 0;
      thinkSelectors.forEach(selector => {
        const elements = clonedMessage.querySelectorAll(selector);
        elements.forEach(el => {
          el.remove();
          removedCount++;
        });
      });

      if (removedCount > 0) {
        console.log(`[${this.platform}] 移除了 ${removedCount} 个思考相关元素`);
      }

      const allMarkdownElements = clonedMessage.querySelectorAll('.qk-markdown');
      let markdownElement = null;

      if (allMarkdownElements.length > 1) {
        markdownElement = allMarkdownElements[allMarkdownElements.length - 1];
        console.log(`[${this.platform}] 找到 ${allMarkdownElements.length} 个 .qk-markdown，取最后一个作为回复 (长度: ${markdownElement.innerText.length})`);
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
        const allDivs = messageElement.querySelectorAll('div');
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
        console.log(`[${this.platform}] 未找到明确的AI回答元素，尝试备用方法`);

        const clone = messageElement.cloneNode(true);

        const questionCard = clone.querySelector('.question-text-card');
        if (questionCard) {
          questionCard.remove();
        }

        const buttons = clone.querySelectorAll('button, [class*="icon"], [class*="button"]');
        buttons.forEach(btn => btn.remove());

        const text = clone.innerText?.trim() || clone.textContent?.trim() || '';

        if (text.length > 10) {
          console.log(`[${this.platform}] ✓ 备用方法成功提取，长度: ${text.length}`);
          return { found: true, content: text };
        }

        console.log(`[${this.platform}] ✗ 备用方法也失败`);
        return { found: false, content: '' };
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

      const hasEndMarker = messageElement.innerHTML?.includes('[[<<>>]]') ||
                           (clone.innerText || '').includes('[[<<>>]]');
      const isLikelyStreaming = codeBlocks.length === 0 && finalText.length < 1000 && !hasEndMarker;

      if (isLikelyStreaming) {
        console.log(`[${this.platform}] 内容可能还在流式输出中（长度:${finalText.length}，无代码块，无结束标记），继续等待...`);
        return { found: false, content: '' };
      }

      if (!finalText || finalText.length < 5) {
        console.log(`[${this.platform}] 提取的文本太短`);
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] ✓ 成功提取AI内容，长度: ${finalText.length}（代码块:${codeBlocks.length}，标记:${hasMarker}）`);
      console.log(`[${this.platform}] 内容预览: ${finalText.substring(0, 80)}`);

      return { found: true, content: finalText, hasMarker };

    } catch (error) {
      console.error(`[${this.platform}] 提取千问AI内容失败:`, error);
      return { found: false, content: '' };
    }
  }

  async fillInput(inputBox, content) {
    console.log(`[${this.platform}] 千问平台，跳过value设置（将在submitMessage中填入）`);
  }

  async submitMessage(inputBox, content) {
    console.log(`[${this.platform}] 开始千问发送流程...`);

    const editor = inputBox;

    console.log(`[${this.platform}] 使用Slate兼容输入方法...`);

    try {
      if (editor && editor.offsetParent !== null) {
        editor.focus();
      } else {
        console.warn(`[${this.platform}] 编辑器不可见或不可聚焦`);
      }
    } catch (e) {
      console.warn(`[${this.platform}] 聚焦编辑器失败:`, e.message);
    }
    await this.sleep(200);

    let textNode = editor.querySelector('span[data-slate-node="text"]');

    if (!textNode) {
      const existingElement = editor.querySelector('[data-slate-node="element"]');
      if (existingElement) {
        textNode = document.createElement('span');
        textNode.setAttribute('data-slate-node', 'text');
        existingElement.appendChild(textNode);
      } else {
        const pElement = document.createElement('p');
        pElement.setAttribute('data-slate-node', 'element');
        textNode = document.createElement('span');
        textNode.setAttribute('data-slate-node', 'text');
        pElement.appendChild(textNode);
        editor.appendChild(pElement);
      }
      await this.sleep(50);
    }

    const selection = window.getSelection();
    let range = document.createRange();
    range.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'deleteContent'
    }));
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: false, inputType: 'deleteContent'
    }));
    await this.sleep(100);

    range = document.createRange();
    range.selectNodeContents(textNode);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: content
    }));
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: false, inputType: 'insertText', data: content
    }));

    await this.sleep(500);
    console.log(`[${this.platform}] ✓ 文本输入完成`);

    console.log(`[${this.platform}] 等待发送按钮出现并启用...`);
    let sendButton = null;
    let buttonReady = false;
    let attempts = 0;
    const maxAttempts = 40;

    const sendButtonSelectors = [
      'button[aria-label="发送消息"]',
      'button[aria-label="发送"]',
      'button[aria-label="send"]',
      'button[type="submit"]',
      'button[class*="send"]',
      'button[class*="submit"]',
      'button:has(svg)',
      'div[class*="send"] button',
      'div[class*="submit"] button',
      'button[class*="Send"]',
      'button[class*="chat"]'
    ];

    while (!buttonReady && attempts < maxAttempts) {
      for (const selector of sendButtonSelectors) {
        sendButton = document.querySelector(selector);
        if (sendButton) break;
      }

      if (sendButton) {
        const isDisabled = sendButton.hasAttribute('disabled') ||
                          sendButton.classList.contains('bg-[--ty-text-disabled]') ||
                          sendButton.disabled;

        if (!isDisabled && sendButton.offsetParent !== null) {
          buttonReady = true;
          console.log(`[${this.platform}] ✓ 发送按钮已就绪`);
          break;
        }
      }

      if (attempts < maxAttempts - 1) {
        console.log(`[${this.platform}] 等待按钮就绪... (${attempts + 1}/${maxAttempts})`);
      }
      await this.sleep(200);
      attempts++;
    }

    if (!buttonReady && sendButton) {
      console.log(`[${this.platform}] 按钮仍未启用，尝试强制启用...`);
      sendButton.removeAttribute('disabled');
      sendButton.disabled = false;
      sendButton.classList.remove('bg-[--ty-text-disabled]', 'cursor-not-allowed');
      sendButton.classList.remove('[&>*]:!cursor-not-allowed', '[&_svg]:!cursor-not-allowed', '[&_span]:!cursor-not-allowed');
      sendButton.classList.add('bg-black-button');
      sendButton.style.cssText = 'cursor: pointer !important; pointer-events: auto !important;';
      await this.sleep(200);
      buttonReady = true;
    }

    if (sendButton && buttonReady) {
      console.log(`[${this.platform}] ✓ 点击发送按钮`);
      sendButton.click();
    } else {
      console.error(`[${this.platform}] ✗ 未找到发送按钮`);
      throw new Error('发送按钮未找到');
    }

    await this.sleep(1000);
    console.log(`[${this.platform}] ✓ 发送完成`);
  }

  async enableThinkMode() {
    try {
      console.log(`[${this.platform}] 尝试启用思考模式...`);

      const thinkButton = document.querySelector('button[aria-label="思考"]');

      if (!thinkButton) {
        console.log(`[${this.platform}] 未找到思考按钮`);
        return false;
      }

      const isActive = thinkButton.classList.contains('bg-gray-button-hover') ||
                      thinkButton.classList.contains('active');

      if (isActive) {
        console.log(`[${this.platform}] 思考模式已启用`);
        return true;
      }

      thinkButton.click();
      await this.sleep(500);

      console.log(`[${this.platform}] ✓ 思考模式已启用`);
      return true;
    } catch (error) {
      console.error(`[${this.platform}] 启用思考模式失败:`, error);
      return false;
    }
  }

  getConversationHistory() {
    try {
      const userMsgs = document.querySelectorAll('.question-text-card');
      const aiMsgs = document.querySelectorAll('.answer-common-card');

      const allMsgs = [];
      userMsgs.forEach(el => allMsgs.push({ el, isUser: true }));
      aiMsgs.forEach(el => allMsgs.push({ el, isUser: false }));

      allMsgs.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      this.conversationHistory = allMsgs.map((m, idx) => {
        const isUser = m.isUser;
        let content;
        if (isUser) {
          content = m.el.textContent?.trim() || '';
        } else {
          const aiContent = m.el.querySelector('.qk-markdown');
          content = aiContent ? aiContent.textContent?.trim() : m.el.textContent?.trim();
        }

        return {
          index: idx,
          isUser,
          content: content || '',
          timestamp: Date.now(),
          element: m.el
        };
      });

      const userMessages = this.conversationHistory.filter(msg => msg.isUser);
      const aiMessageList = this.conversationHistory.filter(msg => !msg.isUser);

      console.log(`[${this.platform}] 会话历史: 总共${this.conversationHistory.length}条消息 (用户:${userMessages.length}条, AI:${aiMessageList.length}条)`);

      return this.conversationHistory;
    } catch (error) {
      console.error(`[${this.platform}] 获取会话历史失败:`, error);
      return [];
    }
  }
}

window.QianwenAdapter = QianwenAdapter;
