// 获取会话ID
const urlParams = new URLSearchParams(window.location.search);
const conversationId = urlParams.get('id');

// 状态
const state = {
  conversation: null,
  roles: [],
  isLoading: false
};

// DOM元素
const elements = {
  chatTitle: null,
  rolesTags: null,
  messagesContainer: null,
  messageInput: null,
  sendBtn: null
};

// 初始化
async function init() {
  if (!conversationId) {
    showError('会话ID不存在');
    return;
  }

  // 初始化DOM元素
  initElements();

  // 加载数据
  await loadData();

  // 绑定事件
  bindEvents();

  // 渲染界面
  render();
}

function initElements() {
  elements.chatTitle = document.getElementById('chatTitle');
  elements.rolesTags = document.getElementById('rolesTags');
  elements.messagesContainer = document.getElementById('messagesContainer');
  elements.messageInput = document.getElementById('messageInput');
  elements.sendBtn = document.getElementById('sendBtn');
}

async function loadData() {
  try {
    const [conversation, roles] = await Promise.all([
      getConversation(conversationId),
      getRoles()
    ]);

    state.conversation = conversation;
    state.roles = roles;

    if (!conversation) {
      showError('会话不存在');
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    showError('加载数据失败');
  }
}

function bindEvents() {
  elements.sendBtn.addEventListener('click', sendMessage);

  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function render() {
  if (!state.conversation) return;

  // 设置标题
  elements.chatTitle.textContent = state.conversation.name;

  // 设置角色标签
  renderRolesTags();

  // 渲染消息
  renderMessages();
}

function renderRolesTags() {
  if (!state.conversation.roleIds || state.conversation.roleIds.length === 0) {
    elements.rolesTags.innerHTML = '<span class="role-tag">未选择角色</span>';
    return;
  }

  elements.rolesTags.innerHTML = state.conversation.roleIds.map(roleId => {
    const role = state.roles.find(r => r.id === roleId);
    return role ? `<span class="role-tag">${escapeHtml(role.name)}</span>` : '';
  }).join('');
}

function renderMessages() {
  if (!state.conversation.messages || state.conversation.messages.length === 0) {
    elements.messagesContainer.innerHTML = '<div class="empty-messages">暂无消息，开始对话吧</div>';
    return;
  }

  elements.messagesContainer.innerHTML = state.conversation.messages.map(msg => {
    const role = state.roles.find(r => r.id === msg.roleId);
    const roleName = role ? role.name : '未知角色';
    const providerName = role ? getProviderDisplayName(role.provider) : '';

    if (msg.isUser) {
      return `
        <div class="message user-message">
          <div class="message-avatar user-avatar">我</div>
          <div class="message-content">
            <div class="message-text">${escapeHtml(msg.content)}</div>
            <div class="message-time">${formatTime(msg.timestamp)}</div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="message ai-message">
          <div class="message-avatar ai-avatar">${escapeHtml(roleName.charAt(0))}</div>
          <div class="message-content">
            <div class="message-role">
              ${escapeHtml(roleName)}
              ${providerName ? `<span class="provider-badge">${escapeHtml(providerName)}</span>` : ''}
            </div>
            <div class="message-text">${formatMessage(msg.content)}</div>
            <div class="message-time">${formatTime(msg.timestamp)}</div>
          </div>
        </div>
      `;
    }
  }).join('');

  // 滚动到底部
  scrollToBottom();
}

async function sendMessage() {
  const content = elements.messageInput.value.trim();

  if (!content || state.isLoading) {
    return;
  }

  state.isLoading = true;
  elements.sendBtn.disabled = true;
  elements.sendBtn.textContent = '发送中...';

  try {
    // 显示用户消息（立即）
    addTempMessage(content, true);

    // 清空输入框
    elements.messageInput.value = '';

    // 发送到后台处理
    const updatedConversation = await sendMessageToBackend(conversationId, content);

    if (updatedConversation) {
      state.conversation = updatedConversation;
      renderMessages();
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    showError('发送消息失败: ' + error.message);
  } finally {
    state.isLoading = false;
    elements.sendBtn.disabled = false;
    elements.sendBtn.textContent = '发送';
  }
}

function addTempMessage(content, isUser) {
  const tempDiv = document.createElement('div');
  tempDiv.className = `message ${isUser ? 'user-message' : 'ai-message'} temp-message`;
  tempDiv.innerHTML = `
    <div class="message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}">${isUser ? '我' : 'AI'}</div>
    <div class="message-content">
      <div class="message-text">${escapeHtml(content)}</div>
      <div class="message-time">正在发送...</div>
    </div>
  `;
  elements.messagesContainer.appendChild(tempDiv);
  scrollToBottom();
}

// 工具函数
async function getConversation(id) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('获取会话超时')), 30000);
    chrome.runtime.sendMessage({ action: 'getConversation', conversationId: id }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function getRoles() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('获取角色超时')), 30000);
    chrome.runtime.sendMessage({ action: 'getRoles' }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function sendMessageToBackend(conversationId, content) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('发送消息超时（60秒）')), 60000);
    chrome.runtime.sendMessage({
      action: 'addMessage',
      conversationId,
      content
    }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && !response.error) {
        resolve(response);
      } else {
        reject(new Error(response?.error || '发送失败'));
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessage(content) {
  return escapeHtml(content)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getProviderDisplayName(provider) {
  const names = {
    deepseek: 'DeepSeek',
    doubao: '豆包',
    qianwen: '千问',
    openai: 'ChatGPT'
  };
  return names[provider] || provider;
}

function scrollToBottom() {
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showError(message) {
  elements.messagesContainer.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
}

// 启动
init();
