// Content Script - 注入到AI网站页面中执行操作

let currentAdapter = null;
let currentPlatform = null;

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
        setTimeout(() => reject(new Error('sendMessage超时')), 5000);
      });

      console.log(`[AI Plugin] ✅ aiResponse已发送 (第${attempt}次尝试)`);
      return result;
    } catch (error) {
      console.warn(`[AI Plugin] ⚠️ 第${attempt}次发送aiResponse失败:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        console.error(`[AI Plugin] ❌ 发送aiResponse最终失败，已重试${maxRetries}次`);
      }
    }
  }
}

function createPlatformAdapter(platform) {
  switch (platform) {
    case 'deepseek': return new DeepSeekAdapter();
    case 'doubao':   return new DoubaoAdapter();
    case 'qianwen':  return new QianwenAdapter();
    case 'openai':   return new OpenAIAdapter();
    case 'kimi':     return new KimiAdapter();
    default:
      console.warn(`未知平台: ${platform}，使用doubao作为默认`);
      return new DoubaoAdapter();
  }
}

function init() {
  console.log('[AI Plugin] ========== 开始初始化 ==========');
  console.log('[AI Plugin] 当前URL:', window.location.href);

  currentPlatform = detectPlatform();
  console.log('[AI Plugin] 检测到平台:', currentPlatform);

  if (!currentPlatform) {
    console.warn('[AI Plugin] ⚠️ 无法识别当前平台');
    return;
  }

  try {
    currentAdapter = createPlatformAdapter(currentPlatform);
    console.log('[AI Plugin] ✓ 适配器创建成功');
  } catch (error) {
    console.error('[AI Plugin] ❌ 创建适配器失败:', error);
    return;
  }

  window.platformAdapter = currentAdapter;
  console.log('[AI Plugin] ✓ platformAdapter已暴露到window对象');

  chrome.runtime.sendMessage({
    type: 'pageReady',
    platform: currentPlatform,
    url: window.location.href
  });

  console.log('[AI Plugin] 初始化完成');
}

function detectPlatform() {
  const hostname = window.location.hostname;

  if (hostname.includes('deepseek')) {
    return 'deepseek';
  } else if (hostname.includes('doubao') || hostname.includes('feishu')) {
    return 'doubao';
  } else if (hostname.includes('qianwen') || hostname.includes('aliyun')) {
    return 'qianwen';
  } else if (hostname.includes('chatgpt') || hostname.includes('openai')) {
    return 'openai';
  } else if (hostname.includes('kimi') || hostname.includes('moonshot')) {
    return 'kimi';
  }

  return 'unknown';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AI Plugin] 收到消息:', request.type);

  if (request.type === 'ping') {
    sendResponse({ status: 'ok', platform: currentPlatform });
    return true;
  }

  if (request.type === 'sendMessage') {
    const messageId = request.messageId;
    sendResponse({ success: true, status: 'processing', messageId });

    if (currentAdapter && currentAdapter.processSendMessage) {
      currentAdapter.processSendMessage(request.content, messageId);
    } else {
      console.error('[AI Plugin] ❌ adapter 未初始化或没有 processSendMessage 方法');
    }
    return true;
  }

  if (request.type === 'newChat') {
    console.log('[AI Plugin] 执行新对话');

    (async () => {
      try {
        if (currentAdapter && currentAdapter.newChat) {
          await currentAdapter.newChat();
          await new Promise(resolve => setTimeout(resolve, 1000));

          const conversationUrl = window.location.href;
          console.log('[AI Plugin] 新对话URL:', conversationUrl);
          sendResponse({ success: true, conversationUrl });
        } else {
          sendResponse({ success: false, error: 'adapter未初始化或没有newChat方法' });
        }
      } catch (error) {
        console.error('[AI Plugin] newChat失败:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  return false;
});

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'sendMessage') {
    console.log('[AI Plugin] 从iframe收到消息:', event.data);

    const { messageId, content } = event.data;

    if (currentAdapter && currentAdapter.processSendMessage) {
      currentAdapter.processSendMessage(content, messageId);
    } else {
      console.error('[AI Plugin] ❌ adapter 未初始化或没有 processSendMessage 方法');
      chrome.runtime.sendMessage({
        type: 'aiResponse',
        messageId,
        error: 'adapter未初始化'
      });
    }
  }
});

console.log('[AI Plugin] ✓ 消息监听已启动');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
