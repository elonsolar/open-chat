// AI平台适配器 - 用于在不同AI网站上操作DOM
class AIPlatformAdapter {
  constructor(platform) {
    this.platform = platform;
    this.selectors = this.getSelectors(platform);
    this.lastUrl = window.location.href; // 记录初始URL
    this.conversationHistory = []; // 新增：会话历史记录
    this.lastMessageId = null; // 新增：最后一条消息的标识
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
        inputBox: 'div[contenteditable="true"][data-slate-editor="true"]',
        sendButton: 'button[aria-label="发送消息"]',
        messageList: '.message-list-content-container',
        messageSelector: '.chat-round',
        userInput: '.question-text-card',
        aiResponse: '.answer-common-card, .qk-markdown',
        newChatButton: 'button[class*="new"], a:contains("新对话")'
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

    // 尝试帮助调试：查找所有textarea
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

  // 检查是否有新内容
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

        if (messageElements.length === 0) {
          console.log(`[${this.platform}] 未找到 [data-message-id] 元素`);
        }
      } else if (this.platform === 'qianwen') {
        // 千问：每个 .chat-round 包含问答对，需要检查是否有 AI 回答
        messageElements = document.querySelectorAll('.chat-round');

        if (messageElements.length === 0) {
          console.log(`[${this.platform}] 未找到 .chat-round 元素`);
          return { found: false, content: '' };
        }

        // 千问特殊处理：查找所有包含 AI 回答的 .chat-round
        const messagesWithAnswer = Array.from(messageElements).filter(msg => {
          const hasAnswer = !!msg.querySelector('.qk-markdown, .answer-common-card, .answer-text');
          return hasAnswer;
        });

        console.log(`[${this.platform}] 找到 ${messageElements.length} 个聊天轮次，其中 ${messagesWithAnswer.length} 个包含AI回答`);

        if (messagesWithAnswer.length === 0) {
          console.log(`[${this.platform}] 没有找到包含AI回答的消息`);
          return { found: false, content: '' };
        }

        // 取最后一个包含 AI 回答的消息
        const lastAIMessage = messagesWithAnswer[messagesWithAnswer.length - 1];

        // 提取 AI 内容（使用专门的千问提取逻辑）
        return this.extractQianwenAIContent(lastAIMessage);

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

      // DeepSeek特殊处理：只提取 ds-markdown 下的内容（真正的AI回复）
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

  // 等待AI回复（检测AI消息数量变化，支持多轮对话）
  async waitForResponse(timeout = 30000, initialAIMessageCount = 0, initialContent = '') {
    const startTime = Date.now();
    let lastAIMessageCount = initialAIMessageCount;
    let lastContent = '';
    let lastContentLength = 0;
    let lastStableTime = Date.now();
    let lastHash = '';
    let hasNewMessage = false;
    let isResolved = false;

    // 千问和DeepSeek需要更长的稳定时间（可能包含思考过程）
    const STABLE_DURATION = (this.platform === 'deepseek' || this.platform === 'qianwen') ? 5000 : 3000;

    // 记录会话历史，用于多轮对话
    const conversationSnapshot = this.getConversationHistory();

    let observer = null;
    let checkInterval = null;
    let timeoutHandle = null;  // 保存setTimeout的ID，用于清除

    console.log(`[${this.platform}] ========== 开始等待AI回复 ==========`);
    console.log(`[${this.platform}] 超时设置: ${timeout}ms`);
    console.log(`[${this.platform}] 稳定要求: 内容${STABLE_DURATION/1000}秒不再增长`);
    console.log(`[${this.platform}] 发送前AI消息数量: ${lastAIMessageCount}`);

    // 统计当前AI消息数量（改进版，支持多轮对话）
    const countAIMessages = () => {
      let messages;

      if (this.platform === 'deepseek') {
        messages = document.querySelectorAll('.ds-message');
        const allMessages = Array.from(messages);
        const aiMessages = allMessages.filter((_, index) => index % 2 === 1);
        console.log(`[${this.platform}] 消息统计: 总数=${allMessages.length}, AI=${aiMessages.length}`);
        return aiMessages.length;

      } else if (this.platform === 'doubao') {
        messages = document.querySelectorAll('[data-message-id]');
        const allMessages = Array.from(messages);
        const aiMessages = allMessages.filter((_, index) => index % 2 === 1);
        console.log(`[${this.platform}] 消息统计: 总数=${allMessages.length}, AI=${aiMessages.length}`);
        return aiMessages.length;

      } else if (this.platform === 'qianwen') {
        // 千问：每个 .chat-round 包含问答对，计算包含 AI 回答的数量
        messages = document.querySelectorAll('.chat-round');
        const allMessages = Array.from(messages);

        // 统计包含 AI 回答的消息数量
        const messagesWithAnswer = allMessages.filter(msg => {
          const hasAnswer = !!msg.querySelector('.qk-markdown, .answer-common-card, .answer-text');
          return hasAnswer;
        });

        console.log(`[${this.platform}] 消息统计: 总轮次=${allMessages.length}, AI回答=${messagesWithAnswer.length}`);
        return messagesWithAnswer.length;

      } else {
        // 其他平台使用 data-message-id 属性
        messages = document.querySelectorAll('[data-message-id]');
        const allMessages = Array.from(messages);
        const aiMessages = allMessages.filter((_, index) => index % 2 === 1);
        console.log(`[${this.platform}] 消息统计: 总数=${allMessages.length}, AI=${aiMessages.length}`);
        return aiMessages.length;
      }
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
          console.log(`[${this.platform}] 当前会话URL:`, window.location.href);

          resolve({
            success: true,
            content: lastContent,
            conversationUrl: window.location.href
          });
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
          console.log(`[${this.platform}] 当前会话URL:`, window.location.href);
          resolve({
            success: true,
            content: lastContent,
            conversationUrl: window.location.href
          });
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
  async sendMessage(content, options = {}) {
    // 标记正在发送消息
    if (typeof window !== 'undefined') {
      window.isSendingMessage = true;
    }

    const { enableThink = false } = options; // 是否启用思考模式

    try {
      console.log(`[${this.platform}] ========== 发送消息 ==========`);
      console.log(`[${this.platform}] 消息内容:`, content);
      console.log(`[${this.platform}] 平台URL:`, window.location.href);
      console.log(`[${this.platform}] 页面标题:`, document.title);
      console.log(`[${this.platform}] 思考模式:`, enableThink ? '启用' : '禁用');

      // 📍 步骤0：获取当前会话快照
      console.log(`[${this.platform}] 步骤0: 记录发送前会话状态...`);
      const conversationBefore = this.getConversationHistory();
      const initialAIMessageCount = conversationBefore.filter(msg => !msg.isUser).length;
      
      // 获取最后一条AI消息的内容
      const initialAIContent = initialAIMessageCount > 0 ? 
        conversationBefore.filter(msg => !msg.isUser).pop()?.content : '';
      
      console.log(`[${this.platform}] 发送前AI消息数量: ${initialAIMessageCount}`);
      if (initialAIContent) {
        console.log(`[${this.platform}] 发送前最后AI消息内容: ${initialAIContent.substring(0, 50)}...`);
      }

      // 📍 步骤0.5：如果启用思考模式，点击思考按钮
      if (enableThink && this.platform === 'qianwen') {
        await this.enableThinkMode();
      }

      // 等待输入框
      console.log(`[${this.platform}] 步骤1: 等待输入框...`);
      const inputBox = await this.waitForElement(this.selectors.inputBox, 10000);
      console.log(`[${this.platform}] ✓ 找到输入框:`, inputBox.tagName, inputBox.className);

      // 聚焦并填入消息
      console.log(`[${this.platform}] 步骤2: 填入消息...`);
      inputBox.focus();
      
      // 千问使用contenteditable的div，需要用textContent而不是value
      if (this.platform === 'qianwen') {
        console.log(`[${this.platform}] 千问平台，跳过value设置（将在后续特殊处理中填入）`);
      } else {
        inputBox.value = content;
      }

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
      } else if (this.platform === 'qianwen') {
        console.log(`[${this.platform}] 开始千问发送流程...`);

        const editor = inputBox;
        
        // 方法：通过beforeinput事件让Slate处理文本，避免直接DOM操作导致状态不一致
        console.log(`[${this.platform}] 使用Slate兼容输入方法...`);
        
        // 1. 聚焦编辑器
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
        
        // 2. 找到或创建Slate文本节点
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
        
        // 3. 选中全部现有内容并删除（通过beforeinput事件让Slate处理）
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
        
        // 4. 将光标移到文本节点末尾（此时应已被清空）
        range = document.createRange();
        range.selectNodeContents(textNode);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 5. 通过beforeinput事件让Slate插入新文本
        editor.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: content
        }));
        editor.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: false, inputType: 'insertText', data: content
        }));
        
        await this.sleep(500);
        console.log(`[${this.platform}] ✓ 文本输入完成`);
        
        // 4. 等待发送按钮出现并启用（React状态更新需要时间）
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
          // 尝试所有选择器
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
        
        // 5. 如果找到按钮但禁用，强制启用
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
        
        // 6. 发送消息
        if (sendButton && buttonReady) {
          console.log(`[${this.platform}] ✓ 点击发送按钮`);
          sendButton.click();
        } else {
          console.error(`[${this.platform}] ✗ 未找到发送按钮`);
          throw new Error('发送按钮未找到');
        }

        await this.sleep(1000);
        console.log(`[${this.platform}] ✓ 发送完成`);
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
      
      // 获取最新的会话状态作为初始状态
      const currentConversation = this.getConversationHistory();
      const currentAIMessageCount = currentConversation.filter(msg => !msg.isUser).length;
      const currentAIContent = currentAIMessageCount > 0 ?
        currentConversation.filter(msg => !msg.isUser).pop()?.content : '';

      const response = await this.waitForResponse(60000, currentAIMessageCount, currentAIContent);
      console.log(`[${this.platform}] ========== 收到回复 ==========`);
      console.log(`[${this.platform}] 回复长度:`, response.content.length);
      console.log(`[${this.platform}] 会话URL:`, response.conversationUrl);

      // 更新会话历史
      this.getConversationHistory();

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

  // 千问专用：提取 AI 回答内容
  extractQianwenAIContent(messageElement) {
    try {
      console.log(`[${this.platform}] 提取千问AI内容...`);

      // 方法1: 优先查找 .qk-markdown
      let markdownElement = messageElement.querySelector('.qk-markdown');

      // 方法2: 查找 .answer-text
      if (!markdownElement) {
        markdownElement = messageElement.querySelector('.answer-text');
      }

      // 方法3: 查找 .answer-common-card
      if (!markdownElement) {
        markdownElement = messageElement.querySelector('.answer-common-card');
      }

      // 方法4: 查找任何包含 "answer" 的 div
      if (!markdownElement) {
        const allDivs = messageElement.querySelectorAll('div');
        for (const div of allDivs) {
          const className = div.className || '';
          // 使用 innerText 而不是 textContent，避免触发 Slate 错误
          const text = div.innerText || '';
          // 如果类名包含 answer/answer-text 且有实际内容
          if ((className.includes('answer') || className.includes('markdown')) && text.trim().length > 20) {
            markdownElement = div;
            break;
          }
        }
      }

      if (!markdownElement) {
        console.log(`[${this.platform}] 未找到明确的AI回答元素，尝试备用方法`);

        // 备用方案：克隆消息元素并移除用户问题部分
        const clone = messageElement.cloneNode(true);

        // 移除用户问题卡片
        const questionCard = clone.querySelector('.question-text-card');
        if (questionCard) {
          questionCard.remove();
        }

        // 移除按钮和图标
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

      // 提取文本内容
      let text = '';

      // 尝试提取 .qk-md-paragraph
      const paragraphs = markdownElement.querySelectorAll('.qk-md-paragraph');
      if (paragraphs.length > 0) {
        text = Array.from(paragraphs)
          .map(p => p.textContent?.trim())
          .filter(t => t && t.length > 0)
          .join('\n\n');
      } else {
        // 直接获取元素文本
        text = markdownElement.textContent?.trim() || markdownElement.innerText?.trim() || '';
      }

      if (!text || text.length < 5) {
        console.log(`[${this.platform}] 提取的文本太短`);
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] ✓ 成功提取AI内容，长度: ${text.length}`);
      console.log(`[${this.platform}] 内容预览: ${text.substring(0, 80)}`);

      return { found: true, content: text };

    } catch (error) {
      console.error(`[${this.platform}] 提取千问AI内容失败:`, error);
      return { found: false, content: '' };
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

  // 启用思考模式（千问专用）
  async enableThinkMode() {
    if (this.platform !== 'qianwen') {
      console.log(`[${this.platform}] 思考模式仅支持千问平台`);
      return false;
    }

    try {
      console.log(`[${this.platform}] 尝试启用思考模式...`);

      // 查找思考按钮
      const thinkButton = document.querySelector('button[aria-label="思考"]');

      if (!thinkButton) {
        console.log(`[${this.platform}] 未找到思考按钮`);
        return false;
      }

      // 检查是否已经激活
      const isActive = thinkButton.classList.contains('bg-gray-button-hover') ||
                      thinkButton.classList.contains('active');

      if (isActive) {
        console.log(`[${this.platform}] 思考模式已启用`);
        return true;
      }

      // 点击启用思考模式
      thinkButton.click();
      await this.sleep(500);

      console.log(`[${this.platform}] ✓ 思考模式已启用`);
      return true;
    } catch (error) {
      console.error(`[${this.platform}] 启用思考模式失败:`, error);
      return false;
    }
  }

  // 获取会话历史（用于多轮对话）
  getConversationHistory() {
    try {
      const messages = document.querySelectorAll('.chat-round');
      
      this.conversationHistory = Array.from(messages).map((msg, idx) => {
        // 判断消息类型
        const isUser = msg.classList.contains('chat-round-user') || 
                       !!msg.querySelector('.question-text-card');
        
        // 提取内容
        let content = '';
        if (isUser) {
          // 用户消息
          const userContent = msg.querySelector('.question-text-card, [class*="question"]');
          content = userContent ? userContent.textContent?.trim() : msg.textContent?.trim();
        } else {
          // AI消息
          const aiContent = msg.querySelector('.qk-markdown, .answer-text, [class*="answer"]');
          content = aiContent ? aiContent.textContent?.trim() : msg.textContent?.trim();
        }

        return {
          index: idx,
          isUser,
          content: content || '',
          timestamp: Date.now(),
          element: msg // 保留引用以便后续操作
        };
      });

      console.log(`[${this.platform}] 会话历史: ${this.conversationHistory.length} 条消息`);
      return this.conversationHistory;
    } catch (error) {
      console.error(`[${this.platform}] 获取会话历史失败:`, error);
      return [];
    }
  }

  // 提取思考内容（如果存在）
  extractThinkContent(messageElement) {
    try {
      // 各种可能的思考容器选择器
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

  // 辅助方法：HTML转义（防止XSS）
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 导出到全局
window.AIPlatformAdapter = AIPlatformAdapter;
