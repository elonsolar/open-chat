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
        messageSelector: '.ds-message',  // 新增
        userInput: '*',
        aiResponse: '*',
        newChatButton: '[class*="new"]'
      },
      doubao: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: 'body',
        messageSelector: '[data-message-id], [class*="message"], [class*="chat-message"]',  // 新增：多种可能的选择器
        userInput: '*',
        aiResponse: '*',
        newChatButton: '[class*="new"]'
      },
      qianwen: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: '[class*="message"]',
        messageSelector: '[class*="message"]',  // 新增
        userInput: '[class*="user"]',
        aiResponse: '[class*="assistant"]',
        newChatButton: '[class*="new"]'
      },
      openai: {
        inputBox: 'textarea',
        sendButton: 'button',
        messageList: '[class*="message"]',
        messageSelector: '[class*="message"]',  // 新增
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
      } else if (this.platform === 'doubao') {
        // 豆包优先使用 data-message-id
        messageElements = document.querySelectorAll('[data-message-id]');
        
        // 如果没有找到，输出调试信息
        if (messageElements.length === 0) {
          console.log(`[${this.platform}] 未找到 [data-message-id] 元素`);
        }
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

        // 查找 ds-markdown 元素 - 尝试多种方式
        let markdownElement = messageClone.querySelector('.ds-markdown');

        if (!markdownElement) {
          // 尝试在原始节点查找
          const originalMarkdown = lastAIMessage.querySelector('.ds-markdown');
          if (originalMarkdown) {
            console.log(`[${this.platform}] 在原始节点找到 ds-markdown`);
            markdownElement = originalMarkdown;
          } else {
            console.log(`[${this.platform}] 未找到 .ds-markdown，调试信息:`);
            console.log(`[${this.platform}] 节点HTML:`, messageClone.innerHTML.substring(0, 300));
            return { found: false, content: '' };
          }
        }

        // 提取所有 ds-markdown-paragraph 的内容
        const paragraphs = markdownElement.querySelectorAll('p');
        console.log(`[${this.platform}] 找到段落数: ${paragraphs.length}`);

        if (paragraphs.length === 0) {
          // 尝试获取 markdown 内的全部文本
          const allText = markdownElement.innerText || markdownElement.textContent;
          if (allText && allText.trim().length > 10) {
            console.log(`[${this.platform}] 使用innerText备用方案`);
            return { found: true, content: allText.trim() };
          }
          return { found: false, content: '' };
        }

        // 合并所有段落
        const text = Array.from(paragraphs)
          .map(p => p.textContent?.trim())
          .filter(text => text && text.length > 0)
          .join('\n\n');

        if (!text) {
          return { found: false, content: '' };
        }

        console.log(`[${this.platform}] 提取了 ${paragraphs.length} 个段落，长度: ${text.length}`);
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
  async waitForResponse(timeout = 30000, initialAIMessageCount = 0, initialContent = '') {
    const startTime = Date.now();
    let lastAIMessageCount = initialAIMessageCount;  // 使用传入的初始值
    let lastContent = '';
    let lastContentLength = 0;  // 记录上次内容长度，用于判断是否真的在增长
    let lastStableTime = Date.now();
    let lastHash = '';  // 新增：内容的哈希值，用于检测内容变化
    let hasNewMessage = false;  // 新增：标记是否检测到新的AI消息
    let isResolved = false;  // 新增：确保Promise只被resolve一次

    // DeepSeek需要更长的稳定时间（因为可能有思考过程）
    const STABLE_DURATION = this.platform === 'deepseek' ? 5000 : 3000;

    let observer = null;
    let checkInterval = null;
    let timeoutHandle = null;  // 保存setTimeout的ID，用于清除

    console.log(`[${this.platform}] ========== 开始等待AI回复 ==========`);
    console.log(`[${this.platform}] 超时设置: ${timeout}ms`);
    console.log(`[${this.platform}] 稳定要求: 内容${STABLE_DURATION/1000}秒不再增长`);
    console.log(`[${this.platform}] 发送前AI消息数量: ${lastAIMessageCount}`);

    // 统计当前AI消息数量（奇数位）
    const countAIMessages = () => {
      let messages;

      if (this.platform === 'deepseek') {
        // DeepSeek使用 .ds-message 类
        messages = document.querySelectorAll('.ds-message');
      } else if (this.platform === 'doubao') {
        // 豆包使用 data-message-id
        messages = document.querySelectorAll('[data-message-id]');
      } else {
        // 其他平台使用 data-message-id 属性
        messages = document.querySelectorAll('[data-message-id]');
      }

      const allMessages = Array.from(messages);
      const aiMessages = allMessages.filter((_, index) => index % 2 === 1);
      
      // 调试输出
      console.log(`[${this.platform}] 消息统计: 总数=${allMessages.length}, AI=${aiMessages.length}`);
      
      return aiMessages.length;
    };

    // 检查发送后立即是否有新消息（AI回复很快的情况）
    const currentCount = countAIMessages();
    const initialHash = this.simpleHash(initialContent);
    if (currentCount > lastAIMessageCount) {
      console.log(`[${this.platform}] ⚡️ 发送后立即检测到新AI消息: ${lastAIMessageCount} → ${currentCount}`);
      lastAIMessageCount = currentCount;

      // 立即检查内容
      const result = this.checkForNewContent();
      if (result.found && result.content.length > 0) {
        const newHash = this.simpleHash(result.content);
        // 只有当内容与初始内容不同时，才认为是新消息
        if (newHash !== lastHash && newHash !== initialHash) {
          console.log(`[${this.platform}] ⚡️ 立即获取到新内容: ${result.content.length} 字符`);
          hasNewMessage = true;
          lastContent = result.content;
          lastContentLength = result.content.length;
          lastHash = newHash;
          lastStableTime = Date.now();
        } else if (newHash === initialHash) {
          console.log(`[${this.platform}] ⚠️ 立即检测到内容与初始消息相同，忽略`);
        }
      }
    }

    // 创建或重新创建MutationObserver
    const createObserver = () => {
      if (observer) {
        observer.disconnect();
      }

      observer = new MutationObserver(() => {
        const currentCount = countAIMessages();

        // 如果AI消息数量增加了
        if (currentCount > lastAIMessageCount) {
          console.log(`[${this.platform}] 🎉 检测到新AI消息: ${lastAIMessageCount} → ${currentCount}`);

          // 获取最新内容
          const result = this.checkForNewContent();

          // 只有找到有效内容才算真正的新消息
          if (result.found && result.content.length > 0) {
            const newHash = this.simpleHash(result.content);

            // 检查内容是否真的不同（避免重复的旧内容）
            if (newHash !== lastHash && newHash !== initialHash) {
              console.log(`[${this.platform}] ✅ 检测到新AI回复: ${result.content.length} 字符`);
              hasNewMessage = true;  // 标记已收到新消息
              lastContent = result.content;
              lastContentLength = result.content.length;
              lastHash = newHash;
              lastAIMessageCount = currentCount;
              lastStableTime = Date.now(); // 重置稳定时间
            } else if (newHash === initialHash) {
              console.log(`[${this.platform}] ⚠️ 内容与初始消息相同，忽略`);
            }
          } else {
            console.log(`[${this.platform}] 检测到消息但无有效内容`);
          }
        } else if (currentCount === lastAIMessageCount && currentCount > 0 && hasNewMessage) {
          // 消息数量没变，但内容可能更新了（流式输出或编辑）
          // 只有在已经检测到新消息后才检查内容更新
          const result = this.checkForNewContent();
          if (result.found && result.content.length > 0) {
            const newHash = this.simpleHash(result.content);
            if (newHash !== lastHash) {
              console.log(`[${this.platform}] 检测到内容变化（消息数量不变）`);
              console.log(`[${this.platform}] 旧内容长度: ${lastContentLength} → 新内容长度: ${result.content.length}`);

              // 只有当内容长度显著增长时（> 10字符）才重置稳定时间
              // 这样可以避免因DOM微小变化（如光标闪烁、格式调整）导致无法完成等待
              if (result.content.length > lastContentLength + 10) {
                console.log(`[${this.platform}] ✅ 内容显著增长，重置稳定时间`);
                lastContent = result.content;
                lastHash = newHash;
                lastContentLength = result.content.length;
                lastStableTime = Date.now(); // 重置稳定时间
              } else {
                console.log(`[${this.platform}] ℹ️ 内容变化微小（< 10字符），忽略，不重置稳定时间`);
                // 只更新内容和哈希，不重置稳定时间
                lastContent = result.content;
                lastHash = newHash;
              }
            }
          }
        } else if (currentCount === lastAIMessageCount && !hasNewMessage) {
          // 还没检测到新消息，但是消息数量没变，输出调试信息
          const result = this.checkForNewContent();
          if (result.found && result.content.length > 0) {
            console.log(`[${this.platform}] 🔍 检测到内容但数量未变 (${currentCount}), 长度: ${result.content.length}`);
            // 尝试检查最后一个消息是否是新的
            const newHash = this.simpleHash(result.content);
            const initialHash = this.simpleHash(initialContent);
            // 只有当内容与初始内容不同时，才认为是新消息
            if (newHash !== lastHash && newHash !== initialHash) {
              console.log(`[${this.platform}] 🎯 可能是新消息（首次内容）`);
              hasNewMessage = true;
              lastContent = result.content;
              lastContentLength = result.content.length;
              lastHash = newHash;
              lastStableTime = Date.now();
            } else if (newHash === initialHash) {
              console.log(`[${this.platform}] ⚠️ 内容与初始消息相同，忽略`);
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
          const newUrl = window.location.href;
          console.log(`[${this.platform}] 检测到URL变化: ${this.lastUrl} → ${newUrl}`);
          this.lastUrl = newUrl;
          createObserver();

          // 重新统计消息数量
          lastAIMessageCount = countAIMessages();

          // DeepSeek: 如果URL还是/chat/，不重置稳定时间（同一会话内的导航）
          if (this.platform === 'deepseek' && newUrl.includes('/chat/')) {
            console.log(`[${this.platform}] DeepSeek聊天页面导航，不重置稳定时间`);
          } else {
            lastStableTime = Date.now(); // 重置稳定时间
          }

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
        // 必须已经检测到新消息才能完成
        if (hasNewMessage && lastContent.length > 0 && stableElapsed >= STABLE_DURATION) {
          // 确保只resolve一次
          if (isResolved) {
            console.log(`[${this.platform}] ⚠️ Promise已resolve，跳过重复检查`);
            return;
          }
          isResolved = true;

          // 清理资源
          clearInterval(checkInterval);
          checkInterval = null;
          if (observer) observer.disconnect();
          observer = null;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          timeoutHandle = null;

          console.log(`[${this.platform}] ========== AI回复完成 ==========`);
          console.log(`[${this.platform}] 回复长度: ${lastContent.length} 字符`);
          console.log(`[${this.platform}] 回复预览:`, lastContent.substring(0, 100) + '...');
          console.log(`[${this.platform}] 总耗时: ${Math.floor(elapsed / 1000)}秒`);
          console.log(`[${this.platform}] 稳定时长: ${Math.floor(stableElapsed / 1000)}秒`);

          resolve(lastContent);
          return; // 确保不再继续执行
        }

        // 每5秒输出一次进度
        if (elapsed % 5000 < 500) {
          console.log(`[${this.platform}] 等待中... AI消息数: ${countAIMessages()}, 内容长度: ${lastContent.length}, 稳定: ${Math.floor(stableElapsed / 1000)}秒/${STABLE_DURATION / 1000}秒`);
        }
      }, 500);

      // 超时处理
      timeoutHandle = setTimeout(() => {
        // 清理资源
        clearInterval(checkInterval);
        if (observer) observer.disconnect();

        // 检查是否已经resolve
        if (isResolved) {
          console.log(`[${this.platform}] ⚠️ 超时检查时Promise已resolve，跳过`);
          return;
        }

        isResolved = true;

        if (hasNewMessage && lastContent.length > 0) {
          console.log(`[${this.platform}] ========== 超时但已有新内容 ==========`);
          console.log(`[${this.platform}] 内容长度: ${lastContent.length}`);
          console.log(`[${this.platform}] 总耗时: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
          resolve(lastContent);
        } else {
          console.error(`[${this.platform}] ========== 等待超时 ==========`);
          console.error(`[${this.platform}] 总等待时间: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
          console.error(`[${this.platform}] AI消息数量: ${countAIMessages()} (初始: ${lastAIMessageCount})`);
          console.error(`[${this.platform}] 检测到新消息: ${hasNewMessage}`);
          console.error(`[${this.platform}] 最后内容长度: ${lastContent.length}`);
          reject(new Error(`等待AI回复超时 (${timeout / 1000}秒)，未收到新的AI回复`));
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

      // 📍 步骤0：在发送前先记录当前AI消息数量和内容
      console.log(`[${this.platform}] 步骤0: 记录发送前的AI消息数量和内容...`);
      const { count: initialAIMessageCount, content: initialAIContent } = (() => {
        let messages;
        if (this.platform === 'deepseek') {
          messages = document.querySelectorAll('.ds-message');
        } else {
          messages = document.querySelectorAll('[data-message-id]');
        }
        const aiMessages = Array.from(messages).filter((_, index) => index % 2 === 1);
        
        // 获取最后一个AI消息的内容
        let lastContent = '';
        if (aiMessages.length > 0) {
          const lastAIMessage = aiMessages[aiMessages.length - 1];
          lastContent = lastAIMessage.textContent?.trim() || '';
        }
        
        return { count: aiMessages.length, content: lastContent };
      })();
      console.log(`[${this.platform}] 发送前AI消息数量: ${initialAIMessageCount}`);
      if (initialAIContent) {
        console.log(`[${this.platform}] 发送前最后AI消息内容: ${initialAIContent.substring(0, 50)}...`);
      }

      // ⚠️ 检查是否在旧会话中，如果在，清空输入框并创建新会话
      const isInOldConversation = initialAIMessageCount > 0;
      if (isInOldConversation) {
        console.log(`[${this.platform}] ⚠️ 检测到旧会话（${initialAIMessageCount}条AI消息），尝试创建新会话...`);
        
        // 尝试清空输入框
        const inputBox = document.querySelector('textarea');
        if (inputBox) {
          inputBox.value = '';
          inputBox.focus();
        }
        
        // 等待一下让页面稳定
        await this.sleep(1000);
      }

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
      const response = await this.waitForResponse(60000, initialAIMessageCount, initialAIContent);
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

  // 辅助方法：简单哈希函数（用于检测内容变化）
  simpleHash(str) {
    if (!str) return '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

// 导出到全局
window.AIPlatformAdapter = AIPlatformAdapter;
