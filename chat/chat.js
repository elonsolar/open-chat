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

  // 监听存储变化（实时更新UI）
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.conversations) {
      handleStorageChange(changes.conversations);
    }
  });

  // 渲染界面
  render();
}

function initElements() {
  elements.chatTitle = document.getElementById('chatTitle');
  elements.rolesTags = document.getElementById('rolesTags');
  elements.messagesContainer = document.getElementById('messagesContainer');
  elements.messageInput = document.getElementById('messageInput');
  elements.sendBtn = document.getElementById('sendBtn');
  elements.modeBadge = document.getElementById('modeBadge');
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
    } else if (e.key === 'Escape') {
      hideCommandSuggestions();
    }
  });

  elements.messageInput.addEventListener('input', (e) => {
    const value = e.target.value;
    
    if (value === '/') {
      showCommandSuggestions();
    } else if (value.startsWith('/') && !value.includes(' ')) {
      const filter = value.substring(1).toLowerCase();
      showCommandSuggestions(filter);
    } else {
      hideCommandSuggestions();
    }
  });

  // 模式徽章点击打开模式选择器
  const modeBadge = document.getElementById('modeBadge');
  if (modeBadge) {
    modeBadge.addEventListener('click', () => {
      showModeSelector();
    });
  }

  // 角色标签点击打开排序
  elements.rolesTags.addEventListener('click', (e) => {
    const tag = e.target.closest('.role-tag.draggable');
    if (tag) {
      showModeSelector(true);
    }
  });
}

async function handleStorageChange(change) {
  console.log('[Chat] 检测到存储变化');

  const newConversations = change.newValue || [];
  const updatedConversation = newConversations.find(c => c.id === conversationId);

  if (updatedConversation) {
    const oldMessageCount = state.conversation?.messages?.length || 0;
    const newMessageCount = updatedConversation?.messages?.length || 0;

    console.log(`[Chat] 消息数变化: ${oldMessageCount} → ${newMessageCount}`);

    state.conversation = updatedConversation;
    renderMessages();

    if (newMessageCount > oldMessageCount) {
      console.log(`[Chat] 新增了 ${newMessageCount - oldMessageCount} 条消息`);
      scrollToBottom();
    }
  }
}

function bindRoleClickEvents() {
  const clickableElements = elements.messagesContainer.querySelectorAll('.clickable');
  clickableElements.forEach(el => {
    el.addEventListener('click', async (e) => {
      const provider = e.currentTarget.getAttribute('data-provider');
      if (provider) {
        try {
          await chrome.runtime.sendMessage({
            action: 'activatePlatformTab',
            provider
          });
        } catch (error) {
          console.error('激活标签页失败:', error);
        }
      }
    });
  });
}

function render() {
  if (!state.conversation) return;

  // 设置标题
  elements.chatTitle.textContent = state.conversation.name;

  // 显示当前模式
  renderModeBadge();

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

  const hasOrdering = state.conversation.sendMode && state.conversation.sendMode === 'sequential';

  elements.rolesTags.innerHTML = state.conversation.roleIds.map(roleId => {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return '';
    const roleIndex = (state.conversation.roleOrder || state.conversation.roleIds).indexOf(roleId);
    return `<span class="role-tag${hasOrdering ? ' draggable' : ''}" data-role-id="${roleId}" title="${hasOrdering ? '点击调整顺序' : ''}">
      ${hasOrdering ? `<span class="role-tag-drag-handle">#${roleIndex + 1}</span>` : ''}
      ${escapeHtml(role.name)}
    </span>`;
  }).join('');
}

function renderModeBadge() {
  const badge = document.getElementById('modeBadge');
  if (!badge) return;

  const contextMode = state.conversation.contextMode || 'self';
  const sendMode = state.conversation.sendMode || 'parallel';
  
  const contextModeNames = { self: '独享', full: '共享' };
  const sendModeNames = { parallel: '并行', sequential: '顺序接龙', random: '随机接龙' };
  
  let badgeText, badgeClass, badgeTitle;

  if (contextMode === 'self') {
    badgeText = contextModeNames[contextMode];
    badgeClass = 'mode-badge mode-context-self';
    badgeTitle = '当前模式: 独享模式\n每个AI独立对话，互不干扰\n点击切换';
  } else {
    badgeText = `${contextModeNames[contextMode]} · ${sendModeNames[sendMode]}`;
    badgeClass = 'mode-badge mode-context-full mode-' + sendMode;
    
    const sendModeLabels = { 
      parallel: '并行模式', 
      sequential: '顺序模式（角色接龙）', 
      random: '随机模式（角色接龙）' 
    };
    badgeTitle = `当前模式: 共享模式 · ${sendModeLabels[sendMode]}\n点击切换`;
  }

  badge.className = badgeClass;
  badge.textContent = badgeText;
  badge.title = badgeTitle;
}

function renderMessages() {
  if (!state.conversation.messages || state.conversation.messages.length === 0) {
    elements.messagesContainer.innerHTML = '<div class="empty-messages">暂无消息，开始对话吧</div>';
    return;
  }

  elements.messagesContainer.innerHTML = state.conversation.messages.map(msg => {
    const role = state.roles.find(r => r.id === msg.roleId);
    const roleSetting = state.conversation.roleSettings?.[msg.roleId] || {};
    const displayName = roleSetting.nickname || role?.name || '未知角色';
    const providerName = role ? getProviderDisplayName(role.provider) : '';
    const provider = role ? role.provider : null;

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
      const clickableClass = provider ? 'clickable' : '';
      const providerAttr = provider ? `data-provider="${provider}"` : '';

      return `
        <div class="message ai-message">
          <div class="message-avatar ai-avatar ${clickableClass}" ${providerAttr}>${escapeHtml(displayName.charAt(0))}</div>
          <div class="message-content">
            <div class="message-role ${clickableClass}" ${providerAttr}>
              ${escapeHtml(displayName)}
              ${providerName ? `<span class="provider-badge">${escapeHtml(providerName)}</span>` : ''}
            </div>
            <div class="message-text">${formatMessage(msg.content)}</div>
            <div class="message-time">${formatTime(msg.timestamp)}</div>
          </div>
        </div>
      `;
    }
  }).join('');

  bindRoleClickEvents();

  // 滚动到底部
  scrollToBottom();
}

async function sendMessage() {
  const content = elements.messageInput.value.trim();

  if (!content || state.isLoading) {
    return;
  }

  // 检查是否是命令
  if (content.startsWith('/')) {
    await handleCommand(content);
    elements.messageInput.value = '';
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

async function handleCommand(command) {
  console.log('[Chat] 处理命令:', command);

  const parts = command.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case '/clear':
      await handleClearCommand();
      break;
    case '/mode':
      await handleModeCommand();
      break;
    default:
      showError('未知命令: ' + cmd);
  }
}

async function handleClearCommand() {
  if (!confirm('确定要清除所有会话内容吗？这将删除所有消息并重置角色会话URL。')) {
    return;
  }

  try {
    const updatedConversation = await chrome.runtime.sendMessage({
      action: 'clearConversation',
      conversationId
    });

    if (updatedConversation) {
      state.conversation = updatedConversation;
      renderMessages();
      console.log('[Chat] 会话已清除');
    }
  } catch (error) {
    console.error('[Chat] 清除会话失败:', error);
    showError('清除会话失败: ' + error.message);
  }
}

async function handleModeCommand() {
  showModeSelector();
}

function showModeSelector(focusOrder) {
  const currentContextMode = state.conversation.contextMode || 'self';
  const currentSendMode = state.conversation.sendMode || 'parallel';
  const currentOrder = state.conversation.roleOrder || state.conversation.roleIds || [];

  const contextModeNames = {
    self: '独享模式',
    full: '共享模式'
  };

  const sendModeNames = {
    parallel: '并行模式',
    sequential: '顺序模式',
    random: '随机模式'
  };

  const modal = document.createElement('div');
  modal.className = 'mode-selector-modal';
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <h2>会话模式设置</h2>

        ${currentContextMode === 'self' ? `
        <div class="mode-section">
          <div class="mode-info-readonly">
            <div class="mode-name">${contextModeNames[currentContextMode]}</div>
            <div class="mode-desc">每个AI独立对话，互不干扰，使用各自的会话URL</div>
          </div>
        </div>
        ` : `
        <div class="mode-section">
          <div class="mode-info-readonly">
            <div class="mode-name">${contextModeNames[currentContextMode]}</div>
            <div class="mode-desc">所有对话历史都发送给每个AI，每次打开新会话</div>
          </div>
        </div>

        <div class="mode-section" id="sendModeSection">
          <h3>发送模式</h3>
          <div class="mode-options">
            <label class="mode-option">
              <input type="radio" name="sendMode" value="parallel" ${currentSendMode === 'parallel' ? 'checked' : ''}>
              <div class="mode-info">
                <div class="mode-name">并行模式</div>
                <div class="mode-desc">所有角色同时收到消息并独立响应</div>
              </div>
            </label>
            <label class="mode-option">
              <input type="radio" name="sendMode" value="sequential" ${currentSendMode === 'sequential' ? 'checked' : ''}>
              <div class="mode-info">
                <div class="mode-name">顺序模式（角色接龙）</div>
                <div class="mode-desc">按角色顺序依次发送，每个角色能看到之前角色的回复</div>
              </div>
            </label>
            <label class="mode-option">
              <input type="radio" name="sendMode" value="random" ${currentSendMode === 'random' ? 'checked' : ''}>
              <div class="mode-info">
                <div class="mode-name">随机模式（角色接龙）</div>
                <div class="mode-desc">随机顺序依次发送，每个角色能看到之前角色的回复</div>
              </div>
            </label>
          </div>
        </div>
        `}
        
        <div class="mode-order-section" id="modeOrderSection">
          <h3>角色顺序</h3>
          <p class="mode-order-hint">拖动角色卡片调整顺序（用于顺序模式）</p>
          <div class="role-order-list" id="modeRoleOrderList">
            ${currentOrder.map((roleId, index) => {
              const role = state.roles.find(r => r.id === roleId);
              if (!role) return '';
              return `
                <div class="role-order-item" draggable="true" data-role-id="${roleId}">
                  <div class="role-order-handle">⋮⋮</div>
                  <div class="role-order-avatar">${escapeHtml(role.name.charAt(0))}</div>
                  <div class="role-order-info">
                    <div class="role-order-name">${escapeHtml(role.name)}</div>
                    <div class="role-order-provider">${getProviderDisplayName(role.provider)}</div>
                  </div>
                  <div class="role-order-index">${index + 1}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" id="cancelModeBtn">取消</button>
          <button class="btn btn-primary" id="saveModeBtn">保存</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const sendModeRadios = modal.querySelectorAll('input[name="sendMode"]');
  const sendModeSection = modal.querySelector('#sendModeSection');
  const orderSection = modal.querySelector('#modeOrderSection');
  const orderList = modal.querySelector('#modeRoleOrderList');

  function updateSectionVisibility() {
    if (!sendModeSection) return;

    const selectedSendMode = modal.querySelector('input[name="sendMode"]:checked').value;

    if (selectedSendMode === 'sequential') {
      orderSection.style.display = 'block';
    } else {
      orderSection.style.display = 'none';
    }
  }

  if (sendModeRadios) {
    sendModeRadios.forEach(radio => {
      radio.addEventListener('change', updateSectionVisibility);
    });
  }

  let draggedItem = null;
  orderList.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('role-order-item')) {
      draggedItem = e.target;
      e.target.style.opacity = '0.5';
    }
  });

  orderList.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('role-order-item')) {
      e.target.style.opacity = '1';
      draggedItem = null;
      updateOrderIndices(orderList);
    }
  });

  orderList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(orderList, e.clientY);
    if (draggedItem) {
      if (afterElement == null) {
        orderList.appendChild(draggedItem);
      } else {
        orderList.insertBefore(draggedItem, afterElement);
      }
    }
  });

  updateSectionVisibility();

  if (focusOrder && currentContextMode === 'full') {
    setTimeout(() => {
      if (orderSection && orderSection.style.display !== 'none') {
        orderSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  document.getElementById('cancelModeBtn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  document.getElementById('saveModeBtn').addEventListener('click', async () => {
    const items = orderList.querySelectorAll('.role-order-item');
    const newOrder = Array.from(items).map(item => item.getAttribute('data-role-id'));

    const updates = {};

    if (currentContextMode === 'full') {
      const selectedSendMode = modal.querySelector('input[name="sendMode"]:checked').value;
      updates.sendMode = selectedSendMode;
      if (selectedSendMode === 'sequential') {
        updates.roleOrder = newOrder;
      } else {
        updates.roleOrder = null;
      }
    } else {
      updates.sendMode = 'parallel';
    }

    try {
      const updatedConversation = await chrome.runtime.sendMessage({
        action: 'updateConversation',
        conversationId,
        updates
      });

      if (updatedConversation) {
        state.conversation = updatedConversation;
        render();
        if (currentContextMode === 'full') {
          console.log('[Chat] 发送模式已更新');
          console.log('[Chat] 角色顺序已更新:', newOrder);
        }
      }

      document.body.removeChild(modal);
    } catch (error) {
      console.error('[Chat] 更新失败:', error);
      showError('更新失败: ' + error.message);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.role-order-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateOrderIndices(container) {
  const items = container.querySelectorAll('.role-order-item');
  items.forEach((item, index) => {
    const indexEl = item.querySelector('.role-order-index');
    if (indexEl) {
      indexEl.textContent = index + 1;
    }
  });
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
  console.log('[Chat] ========== 发送消息到Background ==========');
  console.log('[Chat] conversationId:', conversationId);
  console.log('[Chat] content:', content);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('[Chat] ❌ 发送消息超时（180秒）');
      reject(new Error('发送消息超时（180秒）'));
    }, 180000);
    
    console.log('[Chat] 发送chrome.runtime.sendMessage...');
    chrome.runtime.sendMessage({
      action: 'addMessage',
      conversationId,
      content
    }, (response) => {
      console.log('[Chat] 收到Background响应:', response);
      clearTimeout(timeout);
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
  if (!content) return '';

  // 处理markdown格式的代码块
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let result = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 添加代码块之前的文本
    const beforeText = content.substring(lastIndex, match.index);
    if (beforeText.trim()) {
      const processedBefore = escapeHtml(beforeText)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      result.push(processedBefore);
    }

    // 添加代码块
    const lang = match[1] || '';
    const code = match[2];
    result.push(`<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`);

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余的文本
  const remainingText = content.substring(lastIndex);
  if (remainingText.trim()) {
    const processedRemaining = escapeHtml(remainingText)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    result.push(processedRemaining);
  }

  return result.join('');
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

const availableCommands = [
  { name: '/clear', description: '清除所有会话内容和重置角色会话URL' },
  { name: '/mode', description: '切换上下文模式和发送模式，调整角色顺序' }
];

function showCommandSuggestions(filter = '') {
  hideCommandSuggestions();

  const filteredCommands = filter 
    ? availableCommands.filter(cmd => cmd.name.toLowerCase().includes(filter))
    : availableCommands;

  if (filteredCommands.length === 0) {
    return;
  }

  const suggestionsDiv = document.createElement('div');
  suggestionsDiv.className = 'command-suggestions';
  suggestionsDiv.id = 'commandSuggestions';

  filteredCommands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-suggestion-item';
    item.innerHTML = `
      <div class="command-name">${escapeHtml(cmd.name)}</div>
      <div class="command-desc">${escapeHtml(cmd.description)}</div>
    `;
    item.addEventListener('click', () => {
      elements.messageInput.value = cmd.name + ' ';
      hideCommandSuggestions();
      elements.messageInput.focus();
    });
    suggestionsDiv.appendChild(item);
  });

  const inputContainer = elements.messageInput.parentElement;
  inputContainer.style.position = 'relative';
  inputContainer.appendChild(suggestionsDiv);
}

function hideCommandSuggestions() {
  const existingSuggestions = document.getElementById('commandSuggestions');
  if (existingSuggestions) {
    existingSuggestions.remove();
  }
}

// 启动
init();
