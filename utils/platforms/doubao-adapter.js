class DoubaoAdapter extends BasePlatformAdapter {
  constructor() {
    super('doubao', {
      inputBox: 'textarea.semi-input-textarea',
      sendButton: '.send-btn-wrapper button',
      messageList: '[class*="message-list"]',
      messageSelector: '[class*="flow-markdown-body"]',
      userInput: '[class*="whitespace-pre-wrap"]',
      aiResponse: '[class*="flow-markdown-body"]',
      newChatButton: '[class*="new"]'
    });
    this.messageCountBeforeSend = 0;
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

  async waitForButton() {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      const btn = document.querySelector('.send-btn-wrapper button');
      if (btn && !btn.disabled && btn.offsetParent !== null) return btn;
      await this.sleep(200);
    }
    throw new Error('发送按钮未找到或已禁用');
  }

  getAiMessages() {
    const msgList = document.querySelector('[class*="message-list"]');
    if (!msgList) return [];
    return msgList.querySelectorAll('[class*="flow-markdown-body"]');
  }

  async sendMessage(content) {
    console.log(`[${this.platform}] ========== 开始发送消息 ==========`);
    console.log(`[${this.platform}] 消息内容:`, content);

    // 记录发送前的消息数量
    this.messageCountBeforeSend = this.getAiMessages().length;
    console.log(`[${this.platform}] 发送前 AI 消息数量: ${this.messageCountBeforeSend}`);

    const inputBox = await this.waitForElement('textarea.semi-input-textarea', 10000);
    console.log(`[${this.platform}] ✓ 找到输入框`);

    inputBox.focus();
    await this.sleep(200);

    // 绕过 React 受控组件，直接调用原生 setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(inputBox, content);
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    inputBox.dispatchEvent(new Event('change', { bubbles: true }));
    await this.sleep(500);

    // 等待发送按钮可用
    const sendButton = await this.waitForButton();
    console.log(`[${this.platform}] ✓ 找到发送按钮`);

    // 点击发送按钮
    sendButton.click();
    console.log(`[${this.platform}] ✓ 已点击发送按钮`);

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
      console.error(`[${this.platform}] ❌ 错误:`, error.message);
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

  formatCodeBlocks(element) {
    const clonedElement = element.cloneNode(true);
    const codeBlocks = clonedElement.querySelectorAll('pre');

    codeBlocks.forEach(block => {
      const codeEl = block.querySelector('code');
      const langClass = (codeEl || block).className || '';
      const langMatch = langClass.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : '';

      const codeText = (codeEl || block).textContent?.trim() || '';

      if (codeText.length > 0) {
        const markdownCode = `\`\`\`${lang}\n${codeText}\n\`\`\``;
        block.replaceWith(document.createTextNode(markdownCode));
      } else {
        block.remove();
      }
    });

    return clonedElement;
  }

  extractTextWithNewlines(node) {
    const blockTags = new Set(['P', 'DIV', 'BR', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'UL', 'OL']);
    const headingTags = { 'H1': '# ', 'H2': '## ', 'H3': '### ', 'H4': '#### ', 'H5': '##### ', 'H6': '###### ' };
    let result = '';

    const extractTable = (tableNode) => {
      const rows = [];
      const tableRows = tableNode.querySelectorAll('tr');
      tableRows.forEach(tr => {
        const cells = [];
        tr.querySelectorAll('th, td').forEach(cell => {
          cells.push(cell.textContent.trim().replace(/\|/g, '\\|'));
        });
        rows.push(cells);
      });

      if (rows.length === 0) return '';

      const maxCols = Math.max(...rows.map(r => r.length));
      let table = '\n';

      rows.forEach((row, i) => {
        while (row.length < maxCols) row.push('');
        table += '| ' + row.join(' | ') + ' |\n';
        if (i === 0) {
          table += '| ' + row.map(() => '---').join(' | ') + ' |\n';
        }
      });

      return table + '\n';
    };

    const walk = (node, inBlock) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const isBlock = blockTags.has(node.tagName);
        const isHeading = headingTags[node.tagName];

        if (node.tagName === 'BR') {
          result += '\n';
        } else if (node.tagName === 'TABLE') {
          result += extractTable(node);
        } else if (isHeading) {
          if (result.length > 0 && !result.endsWith('\n')) {
            result += '\n';
          }
          result += isHeading;
          for (let child of node.childNodes) {
            walk(child, true);
          }
          if (!result.endsWith('\n')) {
            result += '\n';
          }
        } else {
          if (isBlock && inBlock && result.length > 0 && !result.endsWith('\n')) {
            result += '\n';
          }

          for (let child of node.childNodes) {
            walk(child, isBlock || inBlock);
          }

          if (isBlock && !result.endsWith('\n')) {
            result += '\n';
          }
        }
      }
    };

    walk(node, false);
    return result;
  }

  async waitForAIResponse() {
    console.log(`[${this.platform}] ========== 开始等待 AI 回复 ==========`);

    return new Promise((resolve, reject) => {
      let lastContent = '';
      let observer = null;
      let timeoutHandle = null;
      let checkInterval = null;

      const checkNewMessage = () => {
        const aiMessages = this.getAiMessages();
        if (aiMessages.length === 0) return null;

        // 只获取发送后出现的新消息
        if (aiMessages.length <= this.messageCountBeforeSend) return null;

        const lastAiMessage = aiMessages[aiMessages.length - 1];

        // 格式化代码块
        const formattedElement = this.formatCodeBlocks(lastAiMessage);

        // 移除按钮等非内容元素
        const buttons = formattedElement.querySelectorAll('button');
        buttons.forEach(btn => btn.remove());

        // 使用改进的文本提取函数
        let rawText = this.extractTextWithNewlines(formattedElement).trim();

        if (!rawText || rawText.length < 10) return null;

        // 检查是否包含结束标记
        const hasEndMarker = rawText.includes('[[<<>>]]');

        // 检查是否正在思考中
        const thinkKeywords = ['思考中', 'Thinking', '正在思考', '思考内容'];
        const hasThinkKeyword = thinkKeywords.some(keyword => rawText.includes(keyword));
        if (hasThinkKeyword && !hasEndMarker) return null;

        return { text: rawText, hasEndMarker };
      };

      const cleanup = (content) => {
        console.log(`[${this.platform}] ========== cleanup 被调用 ==========`);
        console.log(`[${this.platform}] 原始内容长度:`, content?.length || 0);
        if (observer) observer.disconnect();
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (checkInterval) clearInterval(checkInterval);

        // 移除结束标记
        const finalContent = content.replace(/\[\[<<>>\]\]/g, '').trim();
        console.log(`[${this.platform}] 清理后内容长度:`, finalContent?.length || 0);
        resolve(finalContent);
      };

      // 使用 MutationObserver 监听 DOM 变化
      observer = new MutationObserver(() => {
        const result = checkNewMessage();
        if (result && result.text !== lastContent) {
          lastContent = result.text;
          console.log(`[${this.platform}] 检测到内容变化，长度:`, result.text.length);

          if (result.hasEndMarker) {
            console.log(`[${this.platform}] 检测到结束标记，等待 DOM 稳定...`);
            // 检测到结束标记后，等待 DOM 稳定再读取完整内容
            setTimeout(() => {
              const finalResult = checkNewMessage();
              if (finalResult && finalResult.hasEndMarker) {
                cleanup(finalResult.text);
              } else {
                cleanup(result.text);
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

      // 定期检查（作为备用机制）
      checkInterval = setInterval(() => {
        const result = checkNewMessage();
        if (result && result.hasEndMarker && result.text !== lastContent) {
          lastContent = result.text;
          cleanup(result.text);
        }
      }, 1000);

      // 超时处理
      timeoutHandle = setTimeout(() => {
        console.log(`[${this.platform}] 等待超时，当前内容长度:`, lastContent.length);
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
