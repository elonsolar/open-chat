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
        // 尝试备用选择器
        messageElements = document.querySelectorAll('.ds-message');
        
        if (messageElements.length === 0) {
          console.log(`[${this.platform}] 未找到消息元素`);
          return { found: false, content: '' };
        }
      }

      console.log(`[${this.platform}] 找到 ${messageElements.length} 个消息元素`);

      // 转换为数组，索引从0开始
      const messages = Array.from(messageElements);
      
      // 尝试区分用户消息和AI消息
      let aiMessages = [];
      
      // 方法1: 通过data-message-id区分（奇数位是AI）
      if (messages[0]?.hasAttribute('data-message-id')) {
        aiMessages = messages.filter((_, index) => index % 2 === 1);
      } else {
        // 方法2: 通过内容判断（包含"User:"开头的通常是用户消息）
        // 但更可靠的方法是查找包含.ds-markdown的元素
        aiMessages = messages.filter(msg => {
          const markdown = msg.querySelector('.ds-markdown');
          // 如果有markdown但没有User:前缀，可能是AI消息
          if (markdown) {
            const text = markdown.textContent || '';
            return !text.trim().startsWith('User:') && !text.trim().startsWith('用户:');
          }
          return false;
        });
      }

      console.log(`[${this.platform}] 找到 ${aiMessages.length} 个AI消息`);

      if (aiMessages.length === 0) {
        console.log(`[${this.platform}] 没有找到AI消息`);
        return { found: false, content: '' };
      }

      // 取最后一个AI消息（最新的）
      const lastAIMessage = aiMessages[aiMessages.length - 1];

      // DeepSeek特殊处理：只提取 ds-markdown 下的内容（真正的AI回复）
      if (this.platform === 'deepseek') {
        // 直接使用已经筛选好的AI消息
        const latestAIMessage = lastAIMessage.cloneNode(true);

        // 移除所有思考相关的元素（更全面的移除）
        const thinkSelectors = [
          '.ds-think-content',
          '.think-content',
          '[class*="think"]',
          '[class*="thinking"]',
          '[class*="thought"]'
        ];

        let removedCount = 0;
        thinkSelectors.forEach(selector => {
          const elements = latestAIMessage.querySelectorAll(selector);
          elements.forEach(el => {
            el.remove();
            removedCount++;
          });
        });

        if (removedCount > 0) {
          console.log(`[${this.platform}] 移除了 ${removedCount} 个思考相关元素`);
        }

        // 查找 ds-markdown 元素
        const markdownElement = latestAIMessage.querySelector('.ds-markdown');

        if (!markdownElement) {
          console.log(`[${this.platform}] 未找到 .ds-markdown 元素`);
          return { found: false, content: '' };
        }

        // 验证是否真的有内容（而不是空的思考容器）
        const markdownClone = markdownElement.cloneNode(true);
        // 再次确保移除思考内容
        thinkSelectors.forEach(selector => {
          const elements = markdownClone.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });

        // 优先使用 innerText 而不是只提取段落
        // innerText 会包含所有文本内容，包括代码块、列表等
        const allText = markdownClone.innerText || markdownClone.textContent;

        // 如果文本太短或包含思考标志，可能不是真正的回复
        if (!allText || allText.trim().length < 10) {
          console.log(`[${this.platform}] 内容太短 (${allText?.length || 0}字符)，可能还在思考中`);
          return { found: false, content: '' };
        }

        // 检查是否包含思考相关的关键词
        const thinkKeywords = ['思考中', 'Thinking', '正在思考', '思考内容'];
        const hasThinkKeyword = thinkKeywords.some(keyword =>
          allText.includes(keyword)
        );

        if (hasThinkKeyword) {
          console.log(`[${this.platform}] 检测到思考关键词，还未生成真正回复`);
          return { found: false, content: '' };
        }

        console.log(`[${this.platform}] ✓ 成功提取真实回复内容，长度: ${allText.trim().length}`);
        console.log(`[${this.platform}] 内容末尾: "${allText.trim().slice(-50)}"`);
        console.log(`[${this.platform}] 是否包含结束标记: ${allText.includes('[[<<>>]]')}`);
        return { found: true, content: allText.trim() };
      }

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
    let hasStartedResponse = false; // 新增：标记是否开始有响应

    // 千问和DeepSeek需要更长的稳定时间（可能包含思考过程）
    // DeepSeek特别增加稳定时间，确保思考完成后真正内容输出完毕
    const STABLE_DURATION = this.platform === 'deepseek' ? 20000 : (this.platform === 'qianwen' ? 15000 : 8000);

    // 记录会话历史，用于多轮对话
    const conversationSnapshot = this.getConversationHistory();

    let observer = null;
    let checkInterval = null;
    let timeoutHandle = null;  // 保存setTimeout的ID，用于清除
    let hasEndMarker = false;  // 是否检测到结束标记

    console.log(`[${this.platform}] ========== 开始等待AI回复 ==========`);
    console.log(`[${this.platform}] 超时设置: ${timeout}ms`);
    console.log(`[${this.platform}] 稳定要求: 内容${STABLE_DURATION/1000}秒不再增长`);
    console.log(`[${this.platform}] 发送前AI消息数量: ${lastAIMessageCount}`);
    console.log(`[${this.platform}] 初始内容长度: ${initialContent.length}`);

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
        } else if (currentCount === lastAIMessageCount && currentCount > 0) {
          // 消息数量没变，但内容可能更新了（流式输出或追加回复）
          const result = this.checkForNewContent();

          if (result.found && result.content.length > 0) {
            const newHash = this.simpleHash(result.content);
            const initialHash = this.simpleHash(initialContent);

            // 内容与初始内容不同，说明有新回复
            if (newHash !== initialHash && newHash !== lastHash) {
              console.log(`[${this.platform}] 检测到内容变化（消息数量不变，可能是追加回复）`);
              console.log(`[${this.platform}] 旧内容长度: ${lastContentLength} → 新内容长度: ${result.content.length}`);

              hasStartedResponse = true;
              hasNewMessage = true;
              lastContent = result.content;
              lastHash = newHash;
              lastContentLength = result.content.length;
              lastStableTime = Date.now(); // 重置稳定时间
            } else if (newHash !== lastHash && newHash === initialHash) {
              console.log(`[${this.platform}] 内容回到初始状态，可能是重新生成`);
              lastStableTime = Date.now();
            }
          }
        } else if (currentCount === lastAIMessageCount && !hasStartedResponse) {
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
        const recheck = this.checkForNewContent();
        const initialHash = this.simpleHash(initialContent);
        const currentHash = recheck.found ? this.simpleHash(recheck.content) : '';

        // 如果内容与初始内容不同，说明有回复（包括追加回复）
        // 🔧 降低长度要求，允许短回复（从10降到3）
        if (recheck.found && recheck.content.length >= 3 && currentHash !== initialHash) {
          // 检查是否包含思考关键词
          const thinkKeywords = ['思考中', 'Thinking', '正在思考'];
          const hasThinkKeyword = thinkKeywords.some(kw => recheck.content.includes(kw));

          if (!hasThinkKeyword) {
            // 有有效内容且不在思考，标记开始响应
            if (!hasStartedResponse) {
              console.log(`[${this.platform}] ✅ DeepSeek开始响应（内容检测）`);
              console.log(`[${this.platform}] 初始hash: ${initialHash.substring(0, 8)}...`);
              console.log(`[${this.platform}] 当前hash: ${currentHash.substring(0, 8)}...`);
              console.log(`[${this.platform}] 内容长度: ${recheck.content.length}`);
              console.log(`[${this.platform}] 内容末尾: "${recheck.content.slice(-50)}"`);
              hasStartedResponse = true;
              hasNewMessage = true;

              // 检查是否有结束标记（更宽松的检查）
              if (recheck.content.includes('[[<<>>]]')) {
                console.log(`[${this.platform}] ✅ 检测到结束标记，立即完成等待`);
                hasEndMarker = true;
                lastStableTime = Date.now() - STABLE_DURATION;
              } else {
                lastStableTime = Date.now();
              }
            }

            // 内容有变化，重置稳定时间
            if (currentHash !== lastHash) {
              lastContent = recheck.content;
              lastHash = currentHash;
              lastContentLength = recheck.content.length;

              // 检查是否有结束标记（更宽松的检查）
              if (lastContent.includes('[[<<>>]]')) {
                console.log(`[${this.platform}] ✅ 检测到结束标记，立即完成等待`);
                hasEndMarker = true;
                // 立即设置可以完成的时间点
                lastStableTime = Date.now() - STABLE_DURATION;
                console.log(`[${this.platform}] 📝 内容更新，长度: ${recheck.content.length}`);
                console.log(`[${this.platform}] 内容末尾: "${lastContent.slice(-50)}"`);
              } else {
                // 只有在没有结束标记时才重置稳定时间
                if (!hasEndMarker) {
                  lastStableTime = Date.now();
                  console.log(`[${this.platform}] 📝 DeepSeek内容更新，长度: ${recheck.content.length}, 稳定时间重置`);
                  console.log(`[${this.platform}] 内容末尾: "${lastContent.slice(-50)}"`);
                }
              }
            }
          } else {
            // 还在思考
            if (hasStartedResponse) {
              lastStableTime = Date.now();
              console.log(`[${this.platform}] DeepSeek仍在思考，重置稳定时间`);
            }
          }
        } else if (!recheck.found) {
          // 没有找到内容
          if (hasStartedResponse) {
            lastStableTime = Date.now();
            console.log(`[${this.platform}] DeepSeek内容未找到，重置稳定时间`);
          } else {
            console.log(`[${this.platform}] DeepSeek等待内容出现...`);
          }
        } else if (recheck.content.length > 0 && recheck.content.length < 3) {
          // 🔧 有内容但太短（1-2个字符），可能是刚开始输出
          if (hasStartedResponse) {
            // 如果已经开始响应了，不要重置时间，允许短回复
            console.log(`[${this.platform}] DeepSeek内容很短 (${recheck.content.length})，但已开始响应，继续等待稳定`);
          } else {
            // 还没开始响应，等待更多内容
            console.log(`[${this.platform}] DeepSeek内容太短 (${recheck.content.length})，等待更多内容...`);
          }
        } else {
          // 内容与初始内容相同，还没开始响应
          console.log(`[${this.platform}] DeepSeek内容未变化（hash相同），等待响应...`);
        }

        // 检查内容是否已经稳定足够长时间
        // 必须已经检测到新消息或开始响应才能完成
        // 如果检测到结束标记，立即完成（不需要等待STABLE_DURATION）
        const shouldComplete = hasEndMarker || stableElapsed >= STABLE_DURATION;

        if ((hasNewMessage || hasStartedResponse) && lastContent.length > 0 && shouldComplete) {
          // DeepSeek额外验证：确保不是思考内容
          if (this.platform === 'deepseek') {
            const finalCheck = this.checkForNewContent();
            if (!finalCheck.found) {
              console.log(`[${this.platform}] DeepSeek最终检查：未找到内容，继续等待`);
              lastStableTime = Date.now();
              return;
            }

            // 只检查是否完全没内容，允许短回复
            if (finalCheck.content.length === 0) {
              console.log(`[${this.platform}] DeepSeek最终检查：内容为空，继续等待`);
              lastStableTime = Date.now();
              return;
            }

            // 检查是否包含思考关键词
            const thinkKeywords = ['思考中', 'Thinking', '正在思考', '思考内容'];
            const hasThinkKeyword = thinkKeywords.some(kw => finalCheck.content.includes(kw));
            if (hasThinkKeyword) {
              console.log(`[${this.platform}] DeepSeek仍在思考中，继续等待`);
              lastStableTime = Date.now();
              return;
            }
          }

          // 确保只resolve一次
          if (isResolved) {
            console.log(`[${this.platform}] ⚠️ Promise已resolve，跳过重复检查`);
            return;
          }
          isResolved = true;

          // 最终检查结束标记
          let finalContent = lastContent;
          console.log(`[${this.platform}] 最终内容末尾: "${finalContent.slice(-50)}"`);
          console.log(`[${this.platform}] 是否包含结束标记: ${finalContent.includes('[[<<>>]]')}`);

          if (finalContent.includes('[[<<>>]]')) {
            console.log(`[${this.platform}] ✅ 最终检查发现结束标记`);
            finalContent = finalContent.replace(/\[\[<<>>\]\]/g, '').trim();
          }

          // 清理资源
          clearInterval(checkInterval);
          checkInterval = null;
          if (observer) observer.disconnect();
          observer = null;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          timeoutHandle = null;

          console.log(`[${this.platform}] ========== AI回复完成 ==========`);
          console.log(`[${this.platform}] 回复长度: ${finalContent.length} 字符`);
          console.log(`[${this.platform}] 回复预览:`, finalContent.substring(0, 100) + '...');
          console.log(`[${this.platform}] 总耗时: ${Math.floor(elapsed / 1000)}秒`);
          console.log(`[${this.platform}] 稳定时长: ${Math.floor(stableElapsed / 1000)}秒`);
          console.log(`[${this.platform}] 当前会话URL:`, window.location.href);

          resolve({
            success: true,
            content: finalContent,
            conversationUrl: window.location.href
          });
          return; // 确保不再继续执行
        }

        // 每5秒输出一次进度
        if (elapsed % 5000 < 500) {
          const stablePercent = Math.min(100, Math.floor((stableElapsed / STABLE_DURATION) * 100));
          console.log(`[${this.platform}] 等待中... AI消息数: ${countAIMessages()}, 内容长度: ${lastContent.length}, 稳定: ${Math.floor(stableElapsed / 1000)}秒/${STABLE_DURATION / 1000}秒 (${stablePercent}%)`);
        }
      }, 500);

      // 超时处理
      timeoutHandle = setTimeout(async () => {
        // 清理资源
        clearInterval(checkInterval);
        if (observer) observer.disconnect();

        // 检查是否已经resolve
        if (isResolved) {
          console.log(`[${this.platform}] ⚠️ 超时检查时Promise已resolve，跳过`);
          return;
        }

        isResolved = true;

        // 🔧 超时处理：只要有内容就接受，不再限制长度
        if ((hasNewMessage || hasStartedResponse) && lastContent.length > 0) {
          console.log(`[${this.platform}] ========== 超时但已有内容 ==========`);
          console.log(`[${this.platform}] 内容长度: ${lastContent.length}`);
          console.log(`[${this.platform}] 总耗时: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
          console.log(`[${this.platform}] 当前会话URL:`, window.location.href);
          console.log(`[${this.platform}] 内容预览: ${lastContent.substring(0, 50)}...`);

          // 移除结束标记
          let cleanedContent = lastContent;
          if (cleanedContent.includes('[[<<>>]]')) {
            cleanedContent = cleanedContent.replace(/\[\[<<>>\]\]/g, '').trim();
            console.log(`[${this.platform}] 移除结束标记`);
          }

          resolve({
            success: true,
            content: cleanedContent,
            conversationUrl: window.location.href
          });
        } else if (lastContent.length > 0) {
          // 🔧 有内容但还没开始响应，可能刚开始输出，额外等待一下
          console.warn(`[${this.platform}] ========== 超时但内容刚开始 ==========`);
          console.warn(`[${this.platform}] 内容长度: ${lastContent.length}`);
          console.warn(`[${this.platform}] 内容预览: ${lastContent}`);
          console.warn(`[${this.platform}] 尝试继续等待...`);

          // 额外等待一段时间，看看内容是否会增长
          await this.sleep(5000);
          const finalCheck = this.checkForNewContent();

          // 🔧 只要有内容就接受，不限制长度
          if (finalCheck.found && finalCheck.content.length > 0) {
            const finalHash = this.simpleHash(finalCheck.content);
            const initialHash = this.simpleHash(initialContent);
            if (finalHash !== initialHash) {
              console.log(`[${this.platform}] ✅ 额外等待后获得有效内容`);
              let cleanedContent = finalCheck.content;
              if (cleanedContent.includes('[[<<>>]]')) {
                cleanedContent = cleanedContent.replace(/\[\[<<>>\]\]/g, '').trim();
              }
              resolve({
                success: true,
                content: cleanedContent,
                conversationUrl: window.location.href
              });
              return;
            }
          }

          // 如果还是没有，用已有内容返回
          console.warn(`[${this.platform}] ⚠️ 额外等待后仍无更好内容，使用现有内容`);
          let cleanedContent = lastContent;
          if (cleanedContent.includes('[[<<>>]]')) {
            cleanedContent = cleanedContent.replace(/\[\[<<>>\]\]/g, '').trim();
          }
          resolve({
            success: true,
            content: cleanedContent,
            conversationUrl: window.location.href
          });
        } else {
          console.error(`[${this.platform}] ========== 等待超时 ==========`);
          console.error(`[${this.platform}] 总等待时间: ${Math.floor((Date.now() - startTime) / 1000)}秒`);
          console.error(`[${this.platform}] AI消息数量: ${countAIMessages()} (初始: ${lastAIMessageCount})`);
          console.error(`[${this.platform}] 检测到新消息: ${hasNewMessage}`);
          console.error(`[${this.platform}] 开始响应: ${hasStartedResponse}`);
          console.error(`[${this.platform}] 最后内容长度: ${lastContent.length}`);
          console.error(`[${this.platform}] 提示: DeepSeek可能在追加回复，消息数不变但内容在更新`);

          // 最后尝试一次检查
          const emergencyCheck = this.checkForNewContent();
          // 🔧 降低紧急检查的长度要求（从20降到3）
          if (emergencyCheck.found && emergencyCheck.content.length > 3) {
            const emergencyHash = this.simpleHash(emergencyCheck.content);
            const initialHash = this.simpleHash(initialContent);
            if (emergencyHash !== initialHash) {
              console.log(`[${this.platform}] ✅ 紧急检查找到有效内容`);
              resolve({
                success: true,
                content: emergencyCheck.content,
                conversationUrl: window.location.href
              });
              return;
            }
          }

          reject(new Error(`等待AI回复超时 (${timeout / 1000}秒)，未收到有效的AI回复`));
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

        await this.sleep(2000);
        console.log(`[${this.platform}] DeepSeek Enter发送完成`);

        // DeepSeek特殊处理：等待思考过程完成或开始响应
        console.log(`[${this.platform}] 等待DeepSeek思考过程完成...`);
        let thinkingCompleted = false;
        let thinkingAttempts = 0;
        const maxThinkingAttempts = 30; // 最多等待30秒（1秒检查一次）

        while (!thinkingCompleted && thinkingAttempts < maxThinkingAttempts) {
          await this.sleep(1000);
          thinkingAttempts++;

          // 检查AI消息情况
          const currentMessages = document.querySelectorAll('.ds-message');
          const aiMessages = Array.from(currentMessages).filter((_, index) => index % 2 === 1);

          if (aiMessages.length > initialAIMessageCount) {
            // 有新消息，检查是否包含真实内容（不是思考）
            const latestMessage = aiMessages[aiMessages.length - 1];
            const markdownElement = latestMessage.querySelector('.ds-markdown');

            if (markdownElement) {
              const content = markdownElement.innerText || markdownElement.textContent || '';
              // 内容长度大于20且不包含思考关键词，认为思考完成
              const thinkKeywords = ['思考中', 'Thinking', '正在思考'];
              const hasThinkKeyword = thinkKeywords.some(kw => content.includes(kw));

              if (content.length > 20 && !hasThinkKeyword) {
                console.log(`[${this.platform}] ✓ DeepSeek思考完成，开始生成真实内容 (${thinkingAttempts}秒)`);
                thinkingCompleted = true;
              } else {
                console.log(`[${this.platform}] DeepSeek仍在思考中... (${thinkingAttempts}/${maxThinkingAttempts})`);
              }
            }
          } else if (aiMessages.length === initialAIMessageCount && aiMessages.length > 0) {
            // 消息数量没变，可能是追加回复，检查最后一条消息的内容是否有变化
            const latestMessage = aiMessages[aiMessages.length - 1];
            const markdownElement = latestMessage.querySelector('.ds-markdown');

            if (markdownElement) {
              const content = markdownElement.innerText || markdownElement.textContent || '';
              const initialHash = this.simpleHash(initialAIContent);
              const currentHash = this.simpleHash(content);

              // 🔧 降低追加回复的长度要求（从20降到3），允许短回复
              if (content.length > 3 && currentHash !== initialHash) {
                const thinkKeywords = ['思考中', 'Thinking', '正在思考'];
                const hasThinkKeyword = thinkKeywords.some(kw => content.includes(kw));

                if (!hasThinkKeyword) {
                  console.log(`[${this.platform}] ✓ DeepSeek开始追加回复 (${thinkingAttempts}秒)`);
                  thinkingCompleted = true;
                }
              }
            }
          }

          // 如果内容明显变化（非思考），也可以认为完成等待
          const latestCheck = this.checkForNewContent();
          // 🔧 降低内容变化的长度要求（从50降到10）
          if (latestCheck.found && latestCheck.content.length > 10) {
            const thinkKeywords = ['思考中', 'Thinking', '正在思考'];
            const hasThinkKeyword = thinkKeywords.some(kw => latestCheck.content.includes(kw));
            if (!hasThinkKeyword) {
              console.log(`[${this.platform}] ✓ 检测到有效内容，完成等待 (${thinkingAttempts}秒)`);
              thinkingCompleted = true;
            }
          }

          if (!thinkingCompleted) {
            console.log(`[${this.platform}] 等待DeepSeek响应... (${thinkingAttempts}/${maxThinkingAttempts})`);
          }
        }

        if (!thinkingCompleted) {
          console.log(`[${this.platform}] ⚠️ 思考等待超时，继续执行（可能是追加回复）`);
        }
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

      const response = await this.waitForResponse(180000, currentAIMessageCount, currentAIContent);
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

      // 提取文本内容和代码块
      let text = '';
      const codeBlocks = [];

      // 直接查找所有 pre 元素（代码块）
      const allPreElements = markdownElement.querySelectorAll('pre');
      console.log(`[${this.platform}] 找到 ${allPreElements.length} 个 pre 元素`);

      allPreElements.forEach(pre => {
        const code = pre.textContent || pre.innerText || '';
        if (code.trim() && code.trim().length > 10) {
          // 尝试从第一个 code 元素获取语言
          const codeElement = pre.querySelector('code');
          let language = '';
          if (codeElement) {
            const className = codeElement.className || '';
            const langMatch = className.match(/language-(\w+)/);
            language = langMatch ? langMatch[1] : '';
          }
          codeBlocks.push(`\`\`\`${language}\n${code.trim()}\n\`\`\``);
        }
      });

      // 移除 pre 元素后提取文本
      const clone = markdownElement.cloneNode(true);
      const pres = clone.querySelectorAll('pre');
      pres.forEach(p => p.remove());
      
      // 提取非代码的文本，使用 .qk-md-paragraph
      const paragraphs = clone.querySelectorAll('.qk-md-paragraph');
      paragraphs.forEach(p => {
        const pText = p.textContent?.trim();
        if (pText) {
          text += (text ? '\n\n' : '') + pText;
        }
      });

      // 如果没有找到段落，直接使用全部文本
      if (paragraphs.length === 0) {
        text = clone.textContent?.trim() || clone.innerText?.trim() || '';
      }

      // 合并文本和代码块
      let finalText = text;
      if (codeBlocks.length > 0) {
        finalText += (finalText ? '\n\n' : '') + codeBlocks.join('\n\n');
        console.log(`[${this.platform}] 提取了 ${codeBlocks.length} 个代码块`);
      }

      if (!finalText || finalText.length < 5) {
        console.log(`[${this.platform}] 提取的文本太短`);
        return { found: false, content: '' };
      }

      console.log(`[${this.platform}] ✓ 成功提取AI内容，长度: ${finalText.length}`);
      console.log(`[${this.platform}] 内容预览: ${finalText.substring(0, 80)}`);

      return { found: true, content: finalText };

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
