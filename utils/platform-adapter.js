// AI平台适配器 - 用于在不同AI网站上操作DOM
class AIPlatformAdapter {
  constructor(platform) {
    this.platform = platform;
    this.selectors = this.getSelectors(platform);
    this.lastUrl = window.location.href; // 记录初始URL
    console.log(`[${platform}] 初始化适配器，选择器:`, this.selectors);
  }

  // 获取平台选择器
  getSelectors(platform) {
    const selectorMap = {
      deepseek: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: '.ds-message',
        userInput: '*',
        aiResponse: '*',
        newChatButton: '[class*="new"]'
      },
      doubao: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: 'body',
        userInput: '*',
        aiResponse: '*',
        newChatButton: '[class*="new"]'
      },
      qianwen: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: '[class*="message"]',
        userInput: '[class*="user"]',
        aiResponse: '[class*="assistant"]',
        newChatButton: '[class*="new"]'
      },
      openai: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: '[class*="message"]',
        userInput: '[class*="user"]',
        aiResponse: '[class*="assistant"]',
        newChatButton: '[class*="new"]'
      }
    };

    return selectorMap[platform] || selectorMap['doubao'];
  }

  // 等待元素出现
  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
      await this.sleep(100);
    }

    throw new Error(`元素未找到: ${selector}`);
  }

  // 检查是否有新内容（使用奇偶顺序：用户消息偶数位，AI消息奇数位）
  checkForNewContent() {
    try {
      // 根据平台使用不同的选择器
      let messageElements;

      if (this.platform === 'deepseek') {
        // DeepSeek使用 .ds-message 类
        messageElements = document.querySelectorAll('.ds-message');
      } else {
        // 其他平台使用 data-message-id 属性
        messageElements = document.querySelectorAll('[data-message-id]');
      }

      if (messageElements.length === 0) {
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] 找到 ${messageElements.length} 个消息元素`);

      // 转换为数组，索引从0开始
      const messages = Array.from(messageElements);

      // 用户消息在偶数位（0, 2, 4...），AI消息在奇数位（1, 3, 5...）
      const aiMessages = messages.filter((_, index) => index % 2 === 1);

      console.log(`[${this.platform}] 找到 ${aiMessages.length} 个AI消息（奇数位）`);

      if (aiMessages.length === 0) {
        console.log(`[${this.platform}] 没有找到AI消息`);
        return { found: false, content: '' };
      }

      // 取最后一个AI消息（最新的）
      const lastAIMessage = aiMessages[aiMessages.length - 1];

      // DeepSeek特殊处理：只提取 ds-markdown 下的内容（真正的AI回复）
      if (this.platform === 'deepseek') {
        // 克隆节点以避免修改原始DOM
        const messageClone = lastAIMessage.cloneNode(true);

        // 移除 ds-think-content（思考过程）
        const thinkContents = messageClone.querySelectorAll('.ds-think-content');
        thinkContents.forEach(think => think.remove());

        if (thinkContents.length > 0) {
          console.log(`[${this.platform}] 移除了 ${thinkContents.length} 个思考内容块`);
        }

        // 查找 ds-markdown 元素
        const markdownElement = messageClone.querySelector('.ds-markdown');

        if (!markdownElement) {
          console.log(`[${this.platform}] 未找到 .ds-markdown，可能还在思考中`);
          return { found: false, content: '' };
        }

        // 提取所有 ds-markdown-paragraph 的内容
        const paragraphs = markdownElement.querySelectorAll('.ds-markdown-paragraph');
        if (paragraphs.length === 0) {
          console.log(`[${this.platform}] 未找到 .ds-markdown-paragraph`);
          return { found: false, content: '' };
        }

        // 合并所有段落
        const text = Array.from(paragraphs)
          .map(p => p.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join('\n\n');

        if (!text) {
          console.log(`[${this.platform}] 提取的文本为空`);
          return { found: false, content: '' };
        }

        console.log(`[${this.platform}] 提取了 ${paragraphs.length} 个段落的AI回复`);
        console.log(`[${this.platform}] 提取的文本长度:`, text.length);

        return { found: true, content: text };
      }

      // 其他平台：使用原有逻辑
      let messageClone = lastAIMessage;

      // 尝试多种方式提取文本
      let text = '';

      // 方法1: 直接textContent（使用处理过的clone）
      text = messageClone.textContent?.trim() || '';

      // 方法2: 查找段落元素
      if (!text || text.length < 5) {
        const paragraphs = messageClone.querySelectorAll('div[class*="paragraph"], p, div[class*="content"]');
        for (const p of paragraphs) {
          const pText = p.textContent?.trim();
          if (pText && pText.length > 1) {
            text = pText;
            break;
          }
        }
      }

      // 方法3: 递归查找所有文本节点
      if (!text || text.length < 5) {
        const getTextNodes = (el) => {
          let text = '';
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              text += node.textContent || '';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              text += getTextNodes(node);
            }
          }
          return text;
        };
        text = getTextNodes(messageClone).trim();
      }

      console.log(`[${this.platform}] 最新AI消息（索引 ${messages.indexOf(lastAIMessage)}）`);
      console.log(`[${this.platform}] 提取的文本长度:`, text.length);
      console.log(`[${this.platform}] 提取的文本:`, text);

      // 只过滤掉完全空的
      if (!text) {
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] 回复预览:`, text.substring(0, 80));

      return { found: true, content: text };
    } catch (e) {
      console.warn(`[${this.platform}] 检查新内容时出错:`, e);
      return { found: false, content: '' };
    }
  }

  // 等待AI回复（检测AI消息数量变化）
  async waitForResponse(timeout = 60000) {
    const startTime = Date.now();
    let lastAIMessageCount = 0;
    let lastContent = '';
    let lastStableTime = Date.now();

    // DeepSeek需要更长的稳定时间（因为可能有思考过程）
    const STABLE_DURATION = this.platform === 'deepseek' ? 8000 : 3000;

    let observer = null;
    let checkInterval = null;

    console.log(`[${this.platform}] ========== 开始等待AI回复 ==========`);
    console.log(`[${this.platform}] 超时设置: ${timeout}ms`);
    console.log(`[${this.platform}] 稳定要求: 内容${STABLE_DURATION/1000}秒不再增长`);

    // 初始检查AI消息数量
    const initialCheck = this.checkForNewContent();
    if (initialCheck.found && initialCheck.content.length > 0) {
      lastContent = initialCheck.content;
      console.log(`[${this.platform}] 初始检测到AI消息:`, lastContent.substring(0, 50));
    }

    // 统计当前AI消息数量（奇数位）
    const countAIMessages = () => {
      let messages;

      if (this.platform === 'deepseek') {
        // DeepSeek使用 .ds-message 类
        messages = document.querySelectorAll('.ds-message');
      } else {
        // 其他平台使用 data-message-id 属性
        messages = document.querySelectorAll('[data-message-id]');
      }

      return Array.from(messages).filter((_, index) => index % 2 === 1).length;
    };

    lastAIMessageCount = countAIMessages();
    console.log(`[${this.platform}] 初始AI消息数量: ${lastAIMessageCount}`);

    // 创建或重新创建MutationObserver
    const createObserver = () => {
      if (observer) {
        observer.disconnect();
      }

      observer = new MutationObserver(() => {
        const currentCount = countAIMessages();

        // 如果AI消息数量增加了
        if (currentCount > lastAIMessageCount) {
          console.log(`[${this.platform}] 检测到新AI消息: ${lastAIMessageCount} → ${currentCount}`);

          // 获取最新内容
          const result = this.checkForNewContent();

          // DeepSeek特殊处理：只有找到markdown才算有效内容
          if (this.platform === 'deepseek') {
            if (result.found && result.content.length > 0) {
              console.log(`[${this.platform}] DeepSeek找到有效内容: ${result.content.length} 字符`);
              lastContent = result.content;
              lastAIMessageCount = currentCount;
              lastStableTime = Date.now(); // 重置稳定时间
            } else {
              console.log(`[${this.platform}] DeepSeek未找到有效内容（可能还在思考），不重置稳定时间`);
            }
          } else {
            // 其他平台：只要有内容就重置
            if (result.found && result.content.length > 0) {
              console.log(`[${this.platform}] 新消息长度: ${result.content.length}`);
              lastContent = result.content;
              lastAIMessageCount = currentCount;
              lastStableTime = Date.now(); // 重置稳定时间
            }
          }
        }
      });

      // 监听document.body
      try {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
        console.log(`[${this.platform}] MutationObserver已启动/重新启动`);
      } catch (e) {
        console.warn(`[${this.platform}] MutationObserver启动失败:`, e);
      }
    };

    return new Promise((resolve, reject) => {
      // 初始创建observer
      createObserver();

      // 定期检查是否稳定（每500ms检查一次）
      checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const stableElapsed = Date.now() - lastStableTime;

        // 检查URL是否变化，如果变化则重新创建observer
        if (window.location.href !== this.lastUrl) {
          console.log(`[${this.platform}] 检测到URL变化，重新创建MutationObserver`);
          this.lastUrl = window.location.href;
          createObserver();

          // 重新统计消息数量
          lastAIMessageCount = countAIMessages();
          lastStableTime = Date.now(); // 重置稳定时间
          console.log(`[${this.platform}] URL变化后，AI消息数量: ${lastAIMessageCount}`);
        }

        // DeepSeek特殊处理：检查是否真的有markdown内容（不是思考过程）
        if (this.platform === 'deepseek' && lastContent.length > 0) {
          // 重新检查内容，确保有markdown
          const recheck = this.checkForNewContent();
          if (!recheck.found) {
            // 如果没有找到markdown，重置稳定时间
            lastStableTime = Date.now();
            console.log(`[${this.platform}] 未找到有效内容，重置稳定时间`);
          }
        }

        // 检查内容是否已经稳定足够长时间
        if (lastContent.length > 0 && stableElapsed >= STABLE_DURATION) {
          clearInterval(checkInterval);
          if (observer) observer.disconnect();

          console.log(`[${this.platform}] ========== AI回复完成 ==========`);
          console.log(`[${this.platform}] 回复长度: ${lastContent.length} 字符`);
          console.log(`[${this.platform}] 回复预览:`, lastContent.substring(0, 100) + '...');
          console.log(`[${this.platform}] 总耗时: ${Math.floor(elapsed / 1000)}秒`);
          console.log(`[${this.platform}] 稳定时长: ${Math.floor(stableElapsed / 1000)}秒`);

          resolve(lastContent);
          return;
        }

        // 每5秒输出一次进度
        if (elapsed % 5000 < 500) {
          console.log(`[${this.platform}] 等待中... AI消息数: ${countAIMessages()}, 内容长度: ${lastContent.length}, 稳定: ${Math.floor(stableElapsed / 1000)}秒/${STABLE_DURATION / 1000}秒`);
        }
      }, 500);

      // 超时处理
      setTimeout(() => {
        clearInterval(checkInterval);
        if (observer) observer.disconnect();

        if (lastContent.length > 0) {
          console.log(`[${this.platform}] ========== 超时但已有内容 ==========`);
          console.log(`[${this.platform}] 内容长度: ${lastContent.length}`);
          resolve(lastContent);
        } else {
          console.error(`[${this.platform}] ========== 等待超时 ==========`);
          console.error(`[${this.platform}] 总等待时间: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
          console.error(`[${this.platform}] AI消息数量: ${countAIMessages()}`);
          console.error(`[${this.platform}] 最后内容长度: ${lastContent.length}`);
          reject(new Error(`等待AI回复超时 (${timeout / 1000}秒)`));
        }
      }, timeout);
    });
  }

  // 发送消息
  async sendMessage(content) {
    // 标记正在发送消息
    if (typeof window !== 'undefined') {
      window.isSendingMessage = true;
    }

    try {
      console.log(`[${this.platform}] ========== 发送消息 ==========`);
      console.log(`[${this.platform}] 消息内容:`, content);
      console.log(`[${this.platform}] 平台URL:`, window.location.href);
      console.log(`[${this.platform}] 页面标题:`, document.title);

      // 等待输入框
      console.log(`[${this.platform}] 步骤1: 等待输入框...`);
      const inputBox = await this.waitForElement(this.selectors.inputBox, 10000);
      console.log(`[${this.platform}] ✓ 找到输入框:`, inputBox.tagName, inputBox.className);

      // 聚焦并填入消息
      console.log(`[${this.platform}] 步骤2: 填入消息...`);
      inputBox.focus();
      inputBox.value = content;

      // DeepSeek特殊处理：使用react的事件系统
      if (this.platform === 'deepseek') {
        // 触发input事件让React更新状态
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(inputBox, content);

        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        await this.sleep(500);

        // 模拟完整的Enter事件序列
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });

        inputBox.dispatchEvent(enterEvent);

        // 如果需要Shift+Enter
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

        await this.sleep(1000);
        console.log(`[${this.platform}] DeepSeek Enter发送完成`);
      } else {
        // 其他平台：使用原有逻辑
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        await this.sleep(1000);

        console.log(`[${this.platform}] 步骤3: 按Enter发送...`);

        // 方法1: 尝试模拟按Enter
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

        // 方法2: 如果Enter没发送成功，尝试点击发送按钮
        const sendButtons = document.querySelectorAll('button, [role="button"]');
        let buttonClicked = false;

        for (const btn of sendButtons) {
          const text = btn.textContent?.trim().toLowerCase();
          // 查找包含"发送"、"send"等文字的按钮，或空按钮（图标按钮）
          if (text.includes('发送') || text.includes('send') || text.includes('提交') || text === '') {
            // 检查按钮是否可点击
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
      
      await this.sleep(2000);

      // 等待AI回复
      console.log(`[${this.platform}] 步骤4: 等待AI回复...`);
      const response = await this.waitForResponse();
      console.log(`[${this.platform}] ========== 收到回复 ==========`);
      console.log(`[${this.platform}] 回复长度:`, response.length);

      return response;
    } catch (error) {
      console.error(`[${this.platform}] ========== 发送消息失败 ==========`);
      console.error(`[${this.platform}] 错误:`, error.message);
      throw error;
    } finally {
      // 恢复发送消息标志
      if (typeof window !== 'undefined') {
        window.isSendingMessage = false;
      }
    }
  }

  // 创建新会话
  async newChat() {
    try {
      console.log(`[${this.platform}] 创建新会话`);

      // 尝试点击新会话按钮
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

  // 获取聊天历史
  async getChatHistory() {
    try {
      const messageList = document.querySelector(this.selectors.messageList);
      if (!messageList) {
        return [];
      }

      const messages = [];
      // 实现获取历史消息的逻辑
      return messages;
    } catch (error) {
      console.error(`[${this.platform}] 获取聊天历史失败:`, error);
      return [];
    }
  }

  // 辅助方法：延迟
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出到全局
window.AIPlatformAdapter = AIPlatformAdapter;
