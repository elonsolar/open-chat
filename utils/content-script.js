// Content Script - 注入到AI网站页面中执行操作

// 创建适配器实例
let adapter = null;
let currentPlatform = null;

// 带重试的消息发送（解决background service worker休眠问题）
async function sendAiResponseWithRetry(message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
        // 5秒超时
        setTimeout(() => reject(new Error('sendMessage超时')), 5000);
      });

      console.log(`[AI Plugin] ✅ aiResponse已发送 (第${attempt}次尝试)`);
      return result;
    } catch (error) {
      console.warn(`[AI Plugin] ⚠️ 第${attempt}次发送aiResponse失败:`, error.message);
      if (attempt < maxRetries) {
        // 等待后重试（唤醒service worker）
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        console.error(`[AI Plugin] ❌ 发送aiResponse最终失败，已重试${maxRetries}次`);
      }
    }
  }
}

// 初始化
function init() {
  console.log('[AI Plugin] ========== 开始初始化 ==========');
  console.log('[AI Plugin] 当前URL:', window.location.href);
  console.log('[AI Plugin] document.readyState:', document.readyState);

  // 检测当前平台
  currentPlatform = detectPlatform();
  console.log('[AI Plugin] 检测到平台:', currentPlatform);

  if (!currentPlatform) {
    console.warn('[AI Plugin] ⚠️ 无法识别当前平台');
    console.warn('[AI Plugin] hostname:', window.location.hostname);
    return;
  }

  // 检查AIPlatformAdapter类是否存在
  if (typeof AIPlatformAdapter === 'undefined') {
    console.error('[AI Plugin] ❌ AIPlatformAdapter类未定义！');
    console.error('[AI Plugin] platform-adapter.js可能未正确加载');
    return;
  }

  console.log('[AI Plugin] ✓ AIPlatformAdapter类存在');

  // 创建适配器
  try {
    adapter = new AIPlatformAdapter(currentPlatform);
    console.log('[AI Plugin] ✓ 适配器创建成功');
  } catch (error) {
    console.error('[AI Plugin] ❌ 创建适配器失败:', error);
    return;
  }

  // 暴露到window对象，供background.js检测
  window.platformAdapter = adapter;
  console.log('[AI Plugin] ✓ platformAdapter已暴露到window对象');

  // 监听来自插件的消息
  chrome.runtime.onMessage.addListener(handleMessage);
  console.log('[AI Plugin] ✓ 消息监听器已注册');

  // 通知插件页面已加载
  chrome.runtime.sendMessage({
    type: 'pageReady',
    platform: currentPlatform,
    url: window.location.href
  });

  console.log('[AI Plugin] 初始化完成');
}

// 检测当前平台
function detectPlatform() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  console.log('[AI Plugin] 检测平台:', { hostname, pathname });

  if (hostname.includes('deepseek')) {
    return 'deepseek';
  } else if (hostname.includes('doubao') || hostname.includes('feishu')) {
    return 'doubao';
  } else if (hostname.includes('qianwen') || hostname.includes('aliyun')) {
    console.log('[AI Plugin] ✓ 检测到千问平台');
    return 'qianwen';
  } else if (hostname.includes('chatgpt') || hostname.includes('openai')) {
    return 'openai';
  }

  console.log('[AI Plugin] ⚠️ 未知平台');
  return 'unknown';
}

// 处理来自插件的消息
async function handleMessage(request, sender, sendResponse) {
  console.log('[AI Plugin] 收到消息:', request.type);

  try {
    switch (request.type) {
      case 'ping':
        sendResponse({ status: 'ok', platform: currentPlatform });
        return true;

      case 'sendMessage':
        console.log('[AI Plugin] 开始处理sendMessage，将异步返回结果');
        const messageId = request.messageId; // 使用background发送的messageId

        // 立刻返回"已接收"，避免超时
        sendResponse({ success: true, status: 'processing', messageId });

        // 异步处理，完成后通知background（带重试）
        (async () => {
          try {
            const response = await adapter.sendMessage(request.content);
            console.log('[AI Plugin] ✅ 消息发送成功，通知background');
            console.log('[AI Plugin] 发送aiResponse, messageId:', messageId);

            await sendAiResponseWithRetry({
              type: 'aiResponse',
              platform: currentPlatform,
              messageId: messageId,
              content: response
            });
          } catch (error) {
            console.error('[AI Plugin] ❌ 消息发送失败:', error);

            await sendAiResponseWithRetry({
              type: 'aiResponse',
              platform: currentPlatform,
              messageId: messageId,
              error: error.message
            });
          }
        })();

        return true;

      case 'newChat':
        const success = await adapter.newChat();
        sendResponse({ success });
        return true;

      case 'getChatHistory':
        const history = await adapter.getChatHistory();
        sendResponse({ success: true, history });
        return true;

      case 'getPageInfo':
        const info = {
          platform: currentPlatform,
          url: window.location.href,
          title: document.title,
          hasInputBox: !!document.querySelector(adapter.selectors.inputBox),
          hasSendButton: !!document.querySelector(adapter.selectors.sendButton)
        };
        sendResponse({ success: true, info });
        return true;

      default:
        sendResponse({ error: '未知消息类型' });
        return true;
    }
  } catch (error) {
    console.error('[AI Plugin] 处理消息失败:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 页面变化时重新初始化（SPA应用）
let lastUrl = window.location.href;

new MutationObserver(() => {
  const currentUrl = window.location.href;
  const isSendingMessage = window.isSendingMessage || false;

  if (currentUrl !== lastUrl && !isSendingMessage) {
    lastUrl = currentUrl;
    console.log('[AI Plugin] URL变化，重新初始化');
    setTimeout(init, 1000);
  } else if (currentUrl !== lastUrl && isSendingMessage) {
    console.log('[AI Plugin] URL变化但正在发送消息，跳过重新初始化');
    lastUrl = currentUrl;
  }
}).observe(document.body, { childList: true, subtree: true });
