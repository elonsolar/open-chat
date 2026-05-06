const state = {
  conversations: [],
  roles: [],
  settings: { wsUrl: 'ws://localhost:8080', wsEnabled: false },
  editingRoleId: null
};

// DOM元素
const elements = {
  conversationList: null,
  roleList: null,
  newConversationModal: null,
  newRoleModal: null
};

// 初始化
async function init() {
  // 初始化DOM元素引用
  initElements();

  // 加载数据
  await loadData();

  // 绑定事件
  bindEvents();

  // 渲染界面
  render();
}

function initElements() {
  elements.conversationList = document.getElementById('conversationList');
  elements.roleList = document.getElementById('roleList');
  elements.newConversationModal = document.getElementById('newConversationModal');
  elements.newRoleModal = document.getElementById('newRoleModal');
}

async function loadData() {
  const [conversations, roles, settings] = await Promise.all([
    sendMessage({ action: 'getConversations' }),
    sendMessage({ action: 'getRoles' }),
    sendMessage({ action: 'getSettings' })
  ]);

  state.conversations = conversations || [];
  state.roles = roles || [];
  state.settings = settings || { wsUrl: 'ws://localhost:8080', wsEnabled: false, contextMode: 'self', floatWindow: true };
  
  // 加载设置到UI
  loadSettingsToUI();
}

function loadSettingsToUI() {
  const contextModeSelect = document.getElementById('contextModeSelect');
  const floatWindowCheck = document.getElementById('floatWindowCheck');
  
  if (contextModeSelect) {
    contextModeSelect.value = state.settings.contextMode || 'self';
  }
  
  if (floatWindowCheck) {
    floatWindowCheck.checked = state.settings.floatWindow !== false;
  }
}

function bindEvents() {
  // 标签切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 新建会话
  const newConversationBtn = document.getElementById('newConversationBtn');
  if (newConversationBtn) {
    newConversationBtn.addEventListener('click', showNewConversationModal);
  }

  const confirmConversationBtn = document.getElementById('confirmConversationBtn');
  if (confirmConversationBtn) {
    confirmConversationBtn.addEventListener('click', createConversation);
  }

  const cancelConversationBtn = document.getElementById('cancelConversationBtn');
  if (cancelConversationBtn) {
    cancelConversationBtn.addEventListener('click', hideNewConversationModal);
  }

  // 新建角色
  const newRoleBtn = document.getElementById('newRoleBtn');
  if (newRoleBtn) {
    newRoleBtn.addEventListener('click', showNewRoleModal);
  }

  const confirmRoleBtn = document.getElementById('confirmRoleBtn');
  if (confirmRoleBtn) {
    confirmRoleBtn.addEventListener('click', createRole);
  }

  const cancelRoleBtn = document.getElementById('cancelRoleBtn');
  if (cancelRoleBtn) {
    cancelRoleBtn.addEventListener('click', hideNewRoleModal);
  }

  // 服务提供商改变时自动填充模型
  const providerSelect = document.getElementById('provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      const modelInput = document.getElementById('model');
      if (modelInput) {
        const defaultModels = {
          deepseek: 'deepseek-chat',
          doubao: 'doubao-pro',
          qianwen: 'qwen-plus',
          openai: 'gpt-4'
        };
        const selectedModel = defaultModels[e.target.value];
        if (selectedModel) {
          modelInput.value = selectedModel;
        }
      }
    });
  }

  // 保存设置
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }

  // 消息设置
  const contextModeSelect = document.getElementById('contextModeSelect');
  if (contextModeSelect) {
    contextModeSelect.addEventListener('change', (e) => {
      updateSetting('contextMode', e.target.value);
    });
  }

  const floatWindowCheck = document.getElementById('floatWindowCheck');
  if (floatWindowCheck) {
    floatWindowCheck.addEventListener('change', (e) => {
      updateSetting('floatWindow', e.target.checked);
    });
  }

  // 模态框关闭
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // 点击模态框外部关闭
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeAllModals();
    }
  });
}

function render() {
  renderConversations();
  renderRoles();
}

function renderConversations() {
  if (state.conversations.length === 0) {
    elements.conversationList.innerHTML = '<div class="empty-state">暂无会话</div>';
    return;
  }

  elements.conversationList.innerHTML = state.conversations.map(conv => {
    const roles = conv.roleIds.map(id => {
      const role = state.roles.find(r => r.id === id);
      return role ? role.name : '未知角色';
    }).join(', ');

    const lastMessage = conv.messages[conv.messages.length - 1];
    const preview = lastMessage ? lastMessage.content.substring(0, 50) + '...' : '暂无消息';

    return `
      <div class="conversation-item" data-id="${conv.id}">
        <div class="conversation-header">
          <h3>${escapeHtml(conv.name)}</h3>
          <button class="delete-btn" data-id="${conv.id}">&times;</button>
        </div>
        <div class="conversation-roles">角色: ${roles || '未选择'}</div>
        <div class="conversation-preview">${escapeHtml(preview)}</div>
        <div class="conversation-time">${formatTime(conv.updatedAt)}</div>
      </div>
    `;
  }).join('');

  // 绑定删除事件
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(btn.dataset.id);
    });
  });

  // 绑定点击事件
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      openConversation(item.dataset.id);
    });
  });
}

function renderRoles() {
  if (state.roles.length === 0) {
    elements.roleList.innerHTML = '<div class="empty-state">暂无角色</div>';
    return;
  }

  elements.roleList.innerHTML = state.roles.map(role => {
    const providerNames = {
      deepseek: 'DeepSeek',
      doubao: '豆包',
      qianwen: '千问',
      openai: 'ChatGPT'
    };

    return `
      <div class="role-item" data-id="${role.id}">
        <div class="role-header">
          <h3>${escapeHtml(role.name)}</h3>
          <div class="role-actions">
            <button class="edit-btn" data-id="${role.id}">编辑</button>
            <button class="test-btn" data-id="${role.id}" data-provider="${role.provider}">测试</button>
            <button class="delete-btn" data-id="${role.id}">&times;</button>
          </div>
        </div>
        <div class="role-info">
          <div>提供商: ${providerNames[role.provider] || role.provider}</div>
          <div>模型: ${escapeHtml(role.model)}</div>
        </div>
      </div>
    `;
  }).join('');

  // 绑定删除事件
  document.querySelectorAll('.role-item .delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteRole(btn.dataset.id);
    });
  });

  // 绑定编辑事件
  document.querySelectorAll('.role-item .edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editRole(btn.dataset.id);
    });
  });

  // 绑定测试事件
  document.querySelectorAll('.test-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      testPlatform(btn.dataset.provider, btn.dataset.id);
    });
  });
}

// 会话操作
async function createConversation() {
  const name = document.getElementById('conversationName').value.trim();
  const selectedRoles = Array.from(document.querySelectorAll('.role-selector input:checked'))
    .map(cb => cb.value);

  if (!name) {
    alert('请输入会话名称');
    return;
  }

  if (selectedRoles.length === 0) {
    alert('请至少选择一个角色');
    return;
  }

  const conversation = await sendMessage({
    action: 'createConversation',
    name,
    roleIds: selectedRoles
  });

  if (conversation) {
    state.conversations.push(conversation);
    renderConversations();
    hideNewConversationModal();

    // 打开新会话的聊天页面
    openConversation(conversation.id);
  }
}

async function deleteConversation(conversationId) {
  if (confirm('确定要删除这个会话吗？')) {
    await sendMessage({
      action: 'deleteConversation',
      conversationId
    });

    state.conversations = state.conversations.filter(c => c.id !== conversationId);
    renderConversations();
  }
}

function openConversation(conversationId) {
  chrome.tabs.create({
    url: chrome.runtime.getURL(`chat/chat.html?id=${conversationId}`)
  });
}

// 角色操作
async function createRole() {
  const name = document.getElementById('roleName').value.trim();
  const provider = document.getElementById('provider').value;
  let model = document.getElementById('model').value.trim();
  const systemPrompt = document.getElementById('systemPrompt').value.trim();

  if (!name) {
    alert('请输入角色名称');
    return;
  }

  if (state.editingRoleId) {
    const updates = { name, provider, model, systemPrompt };
    await sendMessage({
      action: 'updateRole',
      roleId: state.editingRoleId,
      updates
    });

    const roleIndex = state.roles.findIndex(r => r.id === state.editingRoleId);
    if (roleIndex !== -1) {
      Object.assign(state.roles[roleIndex], { id: state.editingRoleId, ...updates });
    }
    renderRoles();
    hideNewRoleModal();
  } else {
    if (!model) {
      const defaultModels = {
        deepseek: 'deepseek-chat',
        doubao: 'doubao-pro',
        qianwen: 'qwen-plus',
        openai: 'gpt-4'
      };
      model = defaultModels[provider] || 'default';
    }

    const role = await sendMessage({
      action: 'createRole',
      name,
      provider,
      model,
      systemPrompt
    });

    if (role) {
      state.roles.push(role);
      renderRoles();
      hideNewRoleModal();
    }
  }
}

async function deleteRole(roleId) {
  if (confirm('确定要删除这个角色吗？')) {
    await sendMessage({
      action: 'deleteRole',
      roleId
    });

    state.roles = state.roles.filter(r => r.id !== roleId);
    renderRoles();
  }
}

function editRole(roleId) {
  const role = state.roles.find(r => r.id === roleId);
  if (role) {
    showEditRoleModal(role);
  }
}

async function testPlatform(provider, roleId) {
  const role = state.roles.find(r => r.id === roleId);
  if (!role) return;

  const btn = document.querySelector(`.test-btn[data-id="${roleId}"]`);
  const originalText = btn.textContent;
  btn.textContent = '测试中...';
  btn.disabled = true;

  try {
    const result = await sendMessage({
      action: 'testPlatform',
      platform: provider
    });

    if (result && result.success) {
      alert(`✅ ${role.name} 连接成功！\n\n平台信息：${JSON.stringify(result.info, null, 2)}`);
    } else {
      alert(`❌ ${role.name} 连接失败\n\n请确保已在浏览器中登录 ${provider} 账号`);
    }
  } catch (error) {
    alert(`❌ 测试失败: ${error.message}`);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// 设置操作
async function saveSettings() {
  state.settings.wsEnabled = document.getElementById('wsEnabled').checked;
  state.settings.wsUrl = document.getElementById('wsUrl').value.trim();

  await sendMessage({
    action: 'updateSettings',
    settings: state.settings
  });

  alert('设置已保存');
}

async function updateSetting(key, value) {
  state.settings[key] = value;
  
  await sendMessage({
    action: 'updateSettings',
    settings: state.settings
  });

  console.log(`设置已更新: ${key} = ${value}`);
}

// 模态框操作
function showNewConversationModal() {
  // 渲染角色选择器
  const roleSelector = document.getElementById('roleSelector');
  if (state.roles.length === 0) {
    roleSelector.innerHTML = '<div class="empty-state">请先创建角色</div>';
  } else {
    roleSelector.innerHTML = state.roles.map(role => `
      <label class="role-checkbox">
        <input type="checkbox" value="${role.id}">
        <span>${escapeHtml(role.name)}</span>
        <small>(${role.provider})</small>
      </label>
    `).join('');
  }

  elements.newConversationModal.classList.add('active');
}

function hideNewConversationModal() {
  elements.newConversationModal.classList.remove('active');
  document.getElementById('conversationName').value = '';
}

function showNewRoleModal() {
  state.editingRoleId = null;
  document.querySelector('#newRoleModal h2').textContent = '新建角色';
  document.getElementById('confirmRoleBtn').textContent = '创建';
  elements.newRoleModal.classList.add('active');
}

function showEditRoleModal(role) {
  state.editingRoleId = role.id;
  document.querySelector('#newRoleModal h2').textContent = '编辑角色';
  document.getElementById('confirmRoleBtn').textContent = '保存';

  document.getElementById('roleName').value = role.name;
  document.getElementById('provider').value = role.provider;
  document.getElementById('model').value = role.model;
  document.getElementById('systemPrompt').value = role.systemPrompt || '';

  elements.newRoleModal.classList.add('active');
}

function hideNewRoleModal() {
  elements.newRoleModal.classList.remove('active');
  state.editingRoleId = null;
  document.getElementById('roleName').value = '';
  document.getElementById('model').value = '';
  document.getElementById('systemPrompt').value = '';
  document.querySelector('#newRoleModal h2').textContent = '新建角色';
  document.getElementById('confirmRoleBtn').textContent = '创建';
}

function closeAllModals() {
  hideNewConversationModal();
  hideNewRoleModal();
}

// 标签切换
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// 工具函数
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('请求超时（60秒）'));
    }, 60000); // 增加到60秒超时

    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

// 启动
init();
