class BasePlatformAdapter {
  constructor(platform, selectors) {
    this.platform = platform;
    this.selectors = selectors;
    this.lastUrl = window.location.href;
    this.conversationHistory = [];
    this.lastMessageId = null;
    console.log(`[${platform}] 初始化适配器，选择器:`, this.selectors);
  }

  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();

    console.log(`[${this.platform}] 等待元素: ${selector}`);

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`[${this.platform}] ✓ 找到元素:`, {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          visible: element.offsetParent !== null
        });
        return element;
      }
      await this.sleep(100);
    }

    console.error(`[${this.platform}] ✗ 元素查找超时: ${selector}`);
    console.error(`[${this.platform}] 当前页面URL: ${window.location.href}`);
    console.error(`[${this.platform}] 页面标题: ${document.title}`);

    if (selector.includes('textarea')) {
      const allTextareas = document.querySelectorAll('textarea');
      console.error(`[${this.platform}] 页面上的textarea数量: ${allTextareas.length}`);
      allTextareas.forEach((ta, i) => {
        console.error(`[${this.platform}] textarea[${i}]:`, {
          className: ta.className,
          id: ta.id,
          placeholder: ta.placeholder,
          visible: ta.offsetParent !== null
        });
      });
    }

    throw new Error(`元素未找到: ${selector}`);
  }

  async waitForResponse(timeout = 30000, initialAIMessageCount = 0, initialContent = '') {
    const startTime = Date.now();
    let lastAIMessageCount = initialAIMessageCount;
    let lastContent = '';
    let lastContentLength = 0;
    let lastHash = '';
    let hasNewMessage = false;
    let hasStartedResponse = false;
    let isResolved = false;

    const conversationSnapshot = this.getConversationHistory();

    let observer = null;
    let checkInterval = null;
    let timeoutHandle = null;

    console.log(`[${this.platform}] ========== 开始等待AI回复 ==========`);
    console.log(`[${this.platform}] 超时设置: ${timeout}ms`);
    console.log(`[${this.platform}] 发送前AI消息数量: ${lastAIMessageCount}`);
    console.log(`[${this.platform}] 初始内容长度: ${initialContent.length}`);
    console.log(`[${this.platform}] 等待策略: 检测新消息 → 检查结束标记[[<<>>]] → 立即返回`);

    const countAIMessages = () => {
      return this.countAIMessages();
    };

    const currentCount = countAIMessages();
    const initialHash = this.simpleHash(initialContent);
    if (currentCount > lastAIMessageCount) {
      console.log(`[${this.platform}] ⚡️ 发送后立即检测到新AI消息: ${lastAIMessageCount} → ${currentCount}`);
      lastAIMessageCount = currentCount;

      const result = this.checkForNewContent();
      if (result.found && result.content.length > 0) {
        const newHash = this.simpleHash(result.content);
        if (newHash !== lastHash || result.content.length > lastContentLength) {
          console.log(`[${this.platform}] ⚡️ 立即获取到新内容: ${result.content.length} 字符`);
          hasNewMessage = true;
          lastContent = result.content;
          lastContentLength = result.content.length;
          lastHash = newHash;
        }
      }
    }

    return new Promise((resolve, reject) => {
      const createObserver = () => {
        if (observer) {
          observer.disconnect();
        }

        observer = new MutationObserver(() => {
          const currentCount = countAIMessages();

          if (currentCount > lastAIMessageCount) {
            console.log(`[${this.platform}] 🎉 检测到新AI消息: ${lastAIMessageCount} → ${currentCount}`);

            const result = this.checkForNewContent();

            if (result.found && result.content.length > 0) {
              console.log(`[${this.platform}] ✅ 新消息内容: ${result.content.length} 字符`);
              console.log(`[${this.platform}] 内容末尾: "${result.content.slice(-100)}"`);

              if (result.content.includes('[[<<>>]]')) {
                console.log(`[${this.platform}] 🎯 检测到[[<<>>]]结束标记，等待DOM稳定后重新提取...`);

                clearInterval(checkInterval);
                if (observer) observer.disconnect();
                if (timeoutHandle) clearTimeout(timeoutHandle);

                const settleAndResolve = async () => {
                  await this.sleep(500);

                  const finalResult = this.checkForNewContent();
                  if (!finalResult.found || finalResult.content.length === 0) {
                    console.warn(`[${this.platform}] 重新提取内容失败，使用之前的内容`);
                  } else {
                    console.log(`[${this.platform}] 重新提取成功，长度: ${finalResult.content.length} (之前: ${result.content.length})`);
                  }

                  const contentToUse = (finalResult.found && finalResult.content.length >= result.content.length)
                    ? finalResult.content
                    : result.content;

                  const finalContent = contentToUse.replace(/\[\[<<>>\]\]/g, '').trim();

                  console.log(`[${this.platform}] ========== AI回复完成 ==========`);
                  console.log(`[${this.platform}] 回复长度: ${finalContent.length} 字符`);

                  resolve({
                    success: true,
                    content: finalContent,
                    conversationUrl: window.location.href
                  });
                };
                settleAndResolve();
                return;
              }

              const newHash = this.simpleHash(result.content);
              if (newHash !== lastHash || result.content.length > lastContentLength) {
                hasNewMessage = true;
                hasStartedResponse = true;
                lastContent = result.content;
                lastHash = newHash;
                lastContentLength = result.content.length;
                lastAIMessageCount = currentCount;
                console.log(`[${this.platform}] 记录新消息，等待结束标记...`);
              }
            }
          } else if (currentCount === lastAIMessageCount && currentCount > 0) {
            const result = this.checkForNewContent();

            if (result.found && result.content.length > 0) {
              const newHash = this.simpleHash(result.content);

              if (result.hasMarker || result.content.includes('[[<<>>]]')) {
                console.log(`[${this.platform}] 🎯 内容更新中检测到[[<<>>]]结束标记，等待DOM稳定后重新提取...`);

                clearInterval(checkInterval);
                if (observer) observer.disconnect();
                if (timeoutHandle) clearTimeout(timeoutHandle);

                const settleAndResolve = async () => {
                  await this.sleep(500);

                  const finalResult = this.checkForNewContent();
                  if (!finalResult.found || finalResult.content.length === 0) {
                    console.warn(`[${this.platform}] 重新提取内容失败，使用之前的内容`);
                  } else {
                    console.log(`[${this.platform}] 重新提取成功，长度: ${finalResult.content.length} (之前: ${result.content.length})`);
                  }

                  const contentToUse = (finalResult.found && finalResult.content.length >= result.content.length)
                    ? finalResult.content
                    : result.content;

                  const finalContent = contentToUse.replace(/\[\[<<>>\]\]/g, '').trim();

                  console.log(`[${this.platform}] ========== AI回复完成 ==========`);
                  console.log(`[${this.platform}] 回复长度: ${finalContent.length} 字符`);

                  resolve({
                    success: true,
                    content: finalContent,
                    conversationUrl: window.location.href
                  });
                };
                settleAndResolve();
                return;
              }

              if (newHash !== lastHash || result.content.length > lastContentLength) {
                hasStartedResponse = true;
                hasNewMessage = true;
                lastContent = result.content;
                lastHash = newHash;
                lastContentLength = result.content.length;
                console.log(`[${this.platform}] 内容更新中... (${result.content.length} 字符)`);
              }
            }
          }
        });

        try {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
          });
          console.log(`[${this.platform}] MutationObserver已启动，监听新消息...`);
        } catch (e) {
          console.warn(`[${this.platform}] MutationObserver启动失败:`, e);
        }
      };

      createObserver();

      checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        const result = this.checkForNewContent();
        if (result.found && result.content.length > 0) {
          const newHash = this.simpleHash(result.content);

          if (result.hasMarker || result.content.includes('[[<<>>]]')) {
            console.log(`[${this.platform}] 🎯 轮询中检测到[[<<>>]]结束标记`);

            clearInterval(checkInterval);
            if (observer) observer.disconnect();
            if (timeoutHandle) clearTimeout(timeoutHandle);

            const settleAndResolve = async () => {
              await this.sleep(500);
              const finalResult = this.checkForNewContent();
              const contentToUse = (finalResult.found && finalResult.content.length >= result.content.length)
                ? finalResult.content
                : result.content;
              const finalContent = contentToUse.replace(/\[\[<<>>\]\]/g, '').trim();
              console.log(`[${this.platform}] ========== AI回复完成 ==========`);
              console.log(`[${this.platform}] 回复长度: ${finalContent.length} 字符`);
              resolve({ success: true, content: finalContent, conversationUrl: window.location.href });
            };
            settleAndResolve();
            return;
          }

          if (newHash !== lastHash || result.content.length > lastContentLength) {
            hasStartedResponse = true;
            hasNewMessage = true;
            lastContent = result.content;
            lastHash = newHash;
            lastContentLength = result.content.length;
            console.log(`[${this.platform}] 轮询更新内容: ${result.content.length} 字符`);
          }
        }

        if (elapsed % 5000 < 500) {
          console.log(`[${this.platform}] 等待中... AI消息数: ${countAIMessages()}, 内容长度: ${lastContent.length}, 已等待: ${Math.floor(elapsed / 1000)}秒`);
        }
      }, 5000);

      timeoutHandle = setTimeout(() => {
        clearInterval(checkInterval);
        if (observer) observer.disconnect();

        if (isResolved) {
          console.log(`[${this.platform}] ⚠️ 超时检查时Promise已resolve，跳过`);
          return;
        }

        isResolved = true;

        if (lastContent.length > 0) {
          console.log(`[${this.platform}] ========== 超时但已有内容 ==========`);
          console.log(`[${this.platform}] 内容长度: ${lastContent.length}`);

          let cleanedContent = lastContent;
          const hasMarker = cleanedContent.includes('[[<<>>]]');
          if (hasMarker) {
            cleanedContent = cleanedContent.replace(/\[\[<<>>\]\]/g, '').trim();
            console.log(`[${this.platform}] 移除结束标记`);
          } else {
            console.warn(`[${this.platform}] ⚠️ 超时且未检测到结束标记[[<<>>]]，内容可能不完整`);
          }

          resolve({
            success: true,
            content: cleanedContent,
            conversationUrl: window.location.href,
            incomplete: !hasMarker
          });
        } else {
          console.error(`[${this.platform}] ========== 等待超时 ==========`);
          console.error(`[${this.platform}] 总等待时间: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
          console.error(`[${this.platform}] AI消息数量: ${countAIMessages()} (初始: ${lastAIMessageCount})`);
          console.error(`[${this.platform}] 检测到新消息: ${hasNewMessage}`);
          console.error(`[${this.platform}] 最后内容长度: ${lastContent.length}`);
          reject(new Error(`等待AI回复超时 (${timeout / 1000}秒)，未收到有效的AI回复`));
        }
      }, timeout);
    });
  }

  async sendMessage(content, options = {}) {
    if (typeof window !== 'undefined') {
      window.isSendingMessage = true;
    }

    const { enableThink = true } = options;

    try {
      console.log(`[${this.platform}] ========== 发送消息 ==========`);
      console.log(`[${this.platform}] 消息内容:`, content);
      console.log(`[${this.platform}] 平台URL:`, window.location.href);
      console.log(`[${this.platform}] 页面标题:`, document.title);
      console.log(`[${this.platform}] 思考模式:`, enableThink ? '启用' : '禁用');

      console.log(`[${this.platform}] 步骤0: 记录发送前会话状态...`);
      const conversationBefore = this.getConversationHistory();
      const initialAIMessageCount = conversationBefore.filter(msg => !msg.isUser).length;

      const initialAIContent = initialAIMessageCount > 0 ?
        conversationBefore.filter(msg => !msg.isUser).pop()?.content : '';

      console.log(`[${this.platform}] 发送前AI消息数量: ${initialAIMessageCount}`);
      if (initialAIContent) {
        console.log(`[${this.platform}] 发送前最后AI消息内容: ${initialAIContent.substring(0, 50)}...`);
      }

      if (enableThink) {
        await this.enableThinkMode();
      }

      console.log(`[${this.platform}] 步骤1: 等待输入框...`);
      const inputBox = await this.waitForElement(this.selectors.inputBox, 10000);
      console.log(`[${this.platform}] ✓ 找到输入框:`, inputBox.tagName, inputBox.className);

      console.log(`[${this.platform}] 步骤2: 填入消息...`);
      inputBox.focus();

      await this.fillInput(inputBox, content);
      await this.submitMessage(inputBox, content);

      console.log(`[${this.platform}] 步骤3: 等待AI回复...`);

      const response = await this.waitForResponse(180000, initialAIMessageCount, initialAIContent);
      console.log(`[${this.platform}] ========== 收到回复 ==========`);
      console.log(`[${this.platform}] 回复长度:`, response.content.length);
      console.log(`[${this.platform}] 会话URL:`, response.conversationUrl);

      this.getConversationHistory();

      return response;
    } catch (error) {
      console.error(`[${this.platform}] ========== 发送消息失败 ==========`);
      console.error(`[${this.platform}] 错误:`, error.message);
      throw error;
    } finally {
      if (typeof window !== 'undefined') {
        window.isSendingMessage = false;
      }
    }
  }

  async newChat() {
    try {
      console.log(`[${this.platform}] 创建新会话`);

      const newChatButton = document.querySelector(this.selectors.newChatButton);
      if (newChatButton) {
        newChatButton.click();
        await this.sleep(1000);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[${this.platform}] 创建新会话失败:`, error);
      return false;
    }
  }

  async getChatHistory() {
    try {
      const messageList = document.querySelector(this.selectors.messageList);
      if (!messageList) {
        return [];
      }

      const messages = [];
      return messages;
    } catch (error) {
      console.error(`[${this.platform}] 获取聊天历史失败:`, error);
      return [];
    }
  }

  async enableThinkMode() {
    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  simpleHash(str) {
    if (!str) return '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  extractThinkContent(messageElement) {
    try {
      const thinkSelectors = [
        '.thinking-content',
        '.think-process',
        '[class*="think"]',
        '[class*="thought"]',
        '.qk-think',
        '.think-container'
      ];

      for (const selector of thinkSelectors) {
        const thinkElement = messageElement.querySelector(selector);
        if (thinkElement) {
          const thinkText = thinkElement.textContent?.trim();
          if (thinkText && thinkText.length > 5) {
            console.log(`[${this.platform}] 找到思考内容，长度: ${thinkText.length}`);
            return thinkText;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn(`[${this.platform}] 提取思考内容失败:`, error);
      return null;
    }
  }

  extractContentWithCode(element) {
    const clone = element.cloneNode(true);

    const thinkSelectors = [
      '.ds-think-content', '.think-content', '.thinking-content',
      '.think-process', '.qk-think', '.think-container',
      '[class*="think"]', '[class*="thinking"]', '[class*="thought"]',
      '.thinking', '.thought'
    ];
    thinkSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    const preElements = clone.querySelectorAll('pre');
    const codeBlocks = [];
    preElements.forEach(pre => {
      const codeEl = pre.querySelector('code');
      const codeText = (codeEl || pre).textContent?.trim() || '';
      if (codeText.length > 0) {
        let lang = '';
        if (codeEl) {
          const langMatch = (codeEl.className || '').match(/language-(\w+)/);
          lang = langMatch ? langMatch[1] : '';
        }
        codeBlocks.push(`\`\`\`${lang}\n${codeText}\n\`\`\``);
      }
      pre.remove();
    });

    let rawText = (clone.innerText || clone.textContent || '').trim();

    if (codeBlocks.length > 0) {
      rawText += '\n\n' + codeBlocks.join('\n\n');
    }

    return rawText;
  }
}
