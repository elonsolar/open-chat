const state = {
  conversations: [],
  roles: [],
  settings: { wsUrl: 'ws://localhost:8080', wsEnabled: false },
  editingRoleId: null,
  editingConversationId: null,
  batchConvMode: false,
  batchRoleMode: false,
  selectedConvs: new Set(),
  selectedRoles: new Set()
};

const elements = {
  conversationList: null,
  roleList: null,
  newConversationModal: null,
  newRoleModal: null
};

async function init() {
  initElements();
  await loadData();
  bindEvents();
  render();
}

function initElements() {
  elements.conversationList = document.getElementById('conversationList');
  elements.roleList = document.getElementById('roleList');
  elements.newConversationModal = document.getElementById('newConversationModal');
  elements.newRoleModal = document.getElementById('newRoleModal');
  initProviderSelect();
}

function initProviderSelect() {
  const providerSelect = document.getElementById('provider');
  if (providerSelect && PROVIDERS) {
    providerSelect.innerHTML = '';
    Object.values(PROVIDERS).forEach(provider => {
      const option = document.createElement('option');
      option.value = provider.id;
      option.textContent = provider.name;
      providerSelect.appendChild(option);
    });
  }
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
  loadSettingsToUI();
}

function loadSettingsToUI() {
  const floatWindowCheck = document.getElementById('floatWindowCheck');
  if (floatWindowCheck) {
    floatWindowCheck.checked = state.settings.floatWindow !== false;
  }
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  const newConversationBtn = document.getElementById('newConversationBtn');
  if (newConversationBtn) newConversationBtn.addEventListener('click', showNewConversationModal);

  const confirmConversationBtn = document.getElementById('confirmConversationBtn');
  if (confirmConversationBtn) confirmConversationBtn.addEventListener('click', createConversation);

  const cancelConversationBtn = document.getElementById('cancelConversationBtn');
  if (cancelConversationBtn) cancelConversationBtn.addEventListener('click', hideNewConversationModal);

  const newRoleBtn = document.getElementById('newRoleBtn');
  if (newRoleBtn) newRoleBtn.addEventListener('click', showNewRoleModal);

  const confirmRoleBtn = document.getElementById('confirmRoleBtn');
  if (confirmRoleBtn) confirmRoleBtn.addEventListener('click', createRole);

  const cancelRoleBtn = document.getElementById('cancelRoleBtn');
  if (cancelRoleBtn) cancelRoleBtn.addEventListener('click', hideNewRoleModal);

  const providerSelect = document.getElementById('provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      const modelInput = document.getElementById('model');
      if (modelInput) {
        const provider = PROVIDERS[e.target.value];
        if (provider && provider.defaultModel) modelInput.value = provider.defaultModel;
      }
    });
  }

  const floatWindowCheck = document.getElementById('floatWindowCheck');
  if (floatWindowCheck) {
    floatWindowCheck.addEventListener('change', (e) => updateSetting('floatWindow', e.target.checked));
  }

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeAllModals();
  });

  document.getElementById('batchConvBtn')?.addEventListener('click', toggleBatchConvMode);
  document.getElementById('batchConvSelectAll')?.addEventListener('click', batchConvSelectAll);
  document.getElementById('batchConvDelete')?.addEventListener('click', batchConvDelete);

  document.getElementById('batchRoleBtn')?.addEventListener('click', toggleBatchRoleMode);
  document.getElementById('batchRoleSelectAll')?.addEventListener('click', batchRoleSelectAll);
  document.getElementById('batchRoleDelete')?.addEventListener('click', batchRoleDelete);
}

function render() {
  renderConversations();
  renderRoles();
}

function renderConversations() {
  const list = elements.conversationList;
  if (state.conversations.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无会话</div>';
    return;
  }

  list.innerHTML = state.conversations.map(conv => {
    const roles = conv.roleIds.map(id => {
      const role = state.roles.find(r => r.id === id);
      return role ? role.name : '未知';
    }).join(', ');

    const lastMessage = conv.messages[conv.messages.length - 1];
    const preview = lastMessage ? lastMessage.content.substring(0, 60) + '...' : '暂无消息';
    const msgCount = conv.messages?.length || 0;
    const modeTag = conv.contextMode === 'full'
      ? '<span class="conversation-mode-tag full">共享</span>'
      : '<span class="conversation-mode-tag self">独享</span>';

    const selected = state.selectedConvs.has(conv.id) ? 'checked' : '';
    const selectedClass = state.selectedConvs.has(conv.id) ? ' selected' : '';

    return `
      <div class="conversation-item${selectedClass}" data-id="${conv.id}">
        <div class="conversation-header">
          <h3>
            <input type="checkbox" class="item-checkbox" data-id="${conv.id}" ${selected}>
            ${escapeHtml(conv.name)}
          </h3>
          <div class="conversation-actions">
            <button class="edit-btn" data-id="${conv.id}">编辑</button>
            <button class="delete-btn" data-id="${conv.id}">&times;</button>
          </div>
        </div>
        <div class="conversation-meta">
          ${modeTag}
          <span class="conversation-message-count">${msgCount} 条</span>
          <span class="conversation-time">${formatTime(conv.updatedAt || conv.createdAt)}</span>
        </div>
        <div class="conversation-roles">${roles || '未选择'}</div>
        <div class="conversation-preview">${escapeHtml(preview)}</div>
      </div>
    `;
  }).join('');

  bindItemEvents(list, '.conversation-item', 'conv');
}

function renderRoles() {
  const list = elements.roleList;
  if (state.roles.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无角色</div>';
    return;
  }

  list.innerHTML = state.roles.map(role => {
    const provider = PROVIDERS[role.provider];
    const providerName = provider ? provider.name : role.provider;
    const providerColor = provider ? provider.color : '#666';

    const selected = state.selectedRoles.has(role.id) ? 'checked' : '';
    const selectedClass = state.selectedRoles.has(role.id) ? ' selected' : '';

    return `
      <div class="role-item${selectedClass}" data-id="${role.id}">
        <div class="role-header">
          <h3>
            <input type="checkbox" class="item-checkbox" data-id="${role.id}" ${selected}>
            <span class="avatar" style="background:${providerColor}">${escapeHtml(role.name.charAt(0))}</span>
            ${escapeHtml(role.name)}
          </h3>
          <div class="role-actions">
            <button class="test-btn" data-id="${role.id}" data-provider="${role.provider}">测试</button>
            <button class="edit-btn" data-id="${role.id}">编辑</button>
            <button class="delete-btn" data-id="${role.id}">&times;</button>
          </div>
        </div>
        <div class="role-info">
          <div><span>${providerName}</span> · ${escapeHtml(role.model)}</div>
        </div>
      </div>
    `;
  }).join('');

  bindItemEvents(list, '.role-item', 'role');
}

function bindItemEvents(container, itemSelector, type) {
  container.querySelectorAll(`${itemSelector} .delete-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (type === 'conv') deleteConversation(btn.dataset.id);
      else deleteRole(btn.dataset.id);
    });
  });

  container.querySelectorAll(`${itemSelector} .edit-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (type === 'conv') editConversation(btn.dataset.id);
      else editRole(btn.dataset.id);
    });
  });

  container.querySelectorAll(`${itemSelector} .test-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      testPlatform(btn.dataset.provider, btn.dataset.id);
    });
  });

  container.querySelectorAll(`${itemSelector} .item-checkbox`).forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (type === 'conv') {
        cb.checked ? state.selectedConvs.add(id) : state.selectedConvs.delete(id);
        cb.closest(itemSelector).classList.toggle('selected', cb.checked);
        updateBatchConvInfo();
      } else {
        cb.checked ? state.selectedRoles.add(id) : state.selectedRoles.delete(id);
        cb.closest(itemSelector).classList.toggle('selected', cb.checked);
        updateBatchRoleInfo();
      }
    });
  });

  container.querySelectorAll(itemSelector).forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('item-checkbox')) return;
      if (state.batchConvMode && type === 'conv') {
        const cb = item.querySelector('.item-checkbox');
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
        return;
      }
      if (state.batchRoleMode && type === 'role') {
        const cb = item.querySelector('.item-checkbox');
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
        return;
      }
      if (type === 'conv') openConversation(item.dataset.id);
    });
  });
}

function toggleBatchConvMode() {
  state.batchConvMode = !state.batchConvMode;
  state.selectedConvs.clear();
  document.getElementById('conversations-tab').classList.toggle('batch-mode', state.batchConvMode);
  document.getElementById('batchConvBtn').classList.toggle('active', state.batchConvMode);
  document.getElementById('batchConvBtn').textContent = state.batchConvMode ? '取消' : '管理';
  document.getElementById('batchConvBar').classList.toggle('visible', state.batchConvMode);
  updateBatchConvInfo();
  renderConversations();
}

function updateBatchConvInfo() {
  document.getElementById('batchConvInfo').textContent = `已选 ${state.selectedConvs.size} 项`;
}

function batchConvSelectAll() {
  const all = state.conversations.map(c => c.id);
  if (state.selectedConvs.size === all.length) {
    state.selectedConvs.clear();
  } else {
    all.forEach(id => state.selectedConvs.add(id));
  }
  renderConversations();
  updateBatchConvInfo();
}

async function batchConvDelete() {
  if (state.selectedConvs.size === 0) return;
  if (!confirm(`确定要删除选中的 ${state.selectedConvs.size} 个会话吗？`)) return;

  for (const id of state.selectedConvs) {
    await sendMessage({ action: 'deleteConversation', conversationId: id });
  }
  state.conversations = state.conversations.filter(c => !state.selectedConvs.has(c.id));
  state.selectedConvs.clear();
  updateBatchConvInfo();
  renderConversations();
}

function toggleBatchRoleMode() {
  state.batchRoleMode = !state.batchRoleMode;
  state.selectedRoles.clear();
  document.getElementById('roles-tab').classList.toggle('batch-mode', state.batchRoleMode);
  document.getElementById('batchRoleBtn').classList.toggle('active', state.batchRoleMode);
  document.getElementById('batchRoleBtn').textContent = state.batchRoleMode ? '取消' : '管理';
  document.getElementById('batchRoleBar').classList.toggle('visible', state.batchRoleMode);
  updateBatchRoleInfo();
  renderRoles();
}

function updateBatchRoleInfo() {
  document.getElementById('batchRoleInfo').textContent = `已选 ${state.selectedRoles.size} 项`;
}

function batchRoleSelectAll() {
  const all = state.roles.map(r => r.id);
  if (state.selectedRoles.size === all.length) {
    state.selectedRoles.clear();
  } else {
    all.forEach(id => state.selectedRoles.add(id));
  }
  renderRoles();
  updateBatchRoleInfo();
}

async function batchRoleDelete() {
  if (state.selectedRoles.size === 0) return;
  if (!confirm(`确定要删除选中的 ${state.selectedRoles.size} 个角色吗？`)) return;

  for (const id of state.selectedRoles) {
    await sendMessage({ action: 'deleteRole', roleId: id });
  }
  state.roles = state.roles.filter(r => !state.selectedRoles.has(r.id));
  state.selectedRoles.clear();
  updateBatchRoleInfo();
  renderRoles();
}

async function createConversation() {
  const name = document.getElementById('conversationName').value.trim();
  const selectedRoles = Array.from(document.querySelectorAll('.role-selector input:checked')).map(cb => cb.value);
  const contextMode = document.getElementById('contextMode').value;

  if (!name) { alert('请输入会话名称'); return; }
  if (selectedRoles.length === 0) { alert('请至少选择一个角色'); return; }

  const roleSettings = {};
  selectedRoles.forEach(roleId => {
    const nicknameInput = document.querySelector(`.role-nickname-input[data-role-id="${roleId}"]`);
    const promptInput = document.querySelector(`.role-prompt-input[data-role-id="${roleId}"]`);
    roleSettings[roleId] = {
      nickname: nicknameInput?.value?.trim() || '',
      additionalPrompt: promptInput?.value?.trim() || ''
    };
  });

  if (state.editingConversationId) {
    const updates = { name, roleIds: selectedRoles };
    await sendMessage({ action: 'updateConversation', conversationId: state.editingConversationId, updates });
    const idx = state.conversations.findIndex(c => c.id === state.editingConversationId);
    if (idx !== -1) Object.assign(state.conversations[idx], updates);
    renderConversations();
    hideNewConversationModal();
  } else {
    const conversation = await sendMessage({
      action: 'createConversation', name, roleIds: selectedRoles, contextMode, roleSettings
    });
    if (conversation) {
      state.conversations.push(conversation);
      renderConversations();
      hideNewConversationModal();
      openConversation(conversation.id);
    }
  }
}

async function deleteConversation(conversationId) {
  if (confirm('确定要删除这个会话吗？')) {
    await sendMessage({ action: 'deleteConversation', conversationId });
    state.conversations = state.conversations.filter(c => c.id !== conversationId);
    renderConversations();
  }
}

function editConversation(conversationId) {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (conversation) showEditConversationModal(conversation);
}

function openConversation(conversationId) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`chat/chat.html?id=${conversationId}`) });
}

async function createRole() {
  const name = document.getElementById('roleName').value.trim();
  const provider = document.getElementById('provider').value;
  let model = document.getElementById('model').value.trim();
  const systemPrompt = document.getElementById('systemPrompt').value.trim();

  if (!name) { alert('请输入角色名称'); return; }

  if (state.editingRoleId) {
    const updates = { name, provider, model, systemPrompt };
    await sendMessage({ action: 'updateRole', roleId: state.editingRoleId, updates });
    const idx = state.roles.findIndex(r => r.id === state.editingRoleId);
    if (idx !== -1) Object.assign(state.roles[idx], { id: state.editingRoleId, ...updates });
    renderRoles();
    hideNewRoleModal();
  } else {
    if (!model) {
      const providerConfig = PROVIDERS[provider];
      model = providerConfig ? providerConfig.defaultModel : 'default';
    }
    const role = await sendMessage({ action: 'createRole', name, provider, model, systemPrompt });
    if (role) {
      state.roles.push(role);
      renderRoles();
      hideNewRoleModal();
    }
  }
}

async function deleteRole(roleId) {
  if (confirm('确定要删除这个角色吗？')) {
    await sendMessage({ action: 'deleteRole', roleId });
    state.roles = state.roles.filter(r => r.id !== roleId);
    renderRoles();
  }
}

function editRole(roleId) {
  const role = state.roles.find(r => r.id === roleId);
  if (role) showEditRoleModal(role);
}

async function testPlatform(provider, roleId) {
  const role = state.roles.find(r => r.id === roleId);
  if (!role) return;

  const btn = document.querySelector(`.test-btn[data-id="${roleId}"]`);
  const originalText = btn.textContent;
  btn.textContent = '测试中...';
  btn.disabled = true;

  try {
    const result = await sendMessage({ action: 'testPlatform', platform: provider });
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

async function saveSettings() {
  state.settings.wsEnabled = document.getElementById('wsEnabled').checked;
  state.settings.wsUrl = document.getElementById('wsUrl').value.trim();
  await sendMessage({ action: 'updateSettings', settings: state.settings });
  alert('设置已保存');
}

async function updateSetting(key, value) {
  state.settings[key] = value;
  await sendMessage({ action: 'updateSettings', settings: state.settings });
}

function showNewConversationModal() {
  state.editingConversationId = null;
  document.getElementById('conversationModalTitle').textContent = '新建会话';
  document.getElementById('confirmConversationBtn').textContent = '创建';
  document.getElementById('contextMode').disabled = false;

  const roleSelector = document.getElementById('roleSelector');
  if (state.roles.length === 0) {
    roleSelector.innerHTML = '<div class="empty-state">请先创建角色</div>';
  } else {
    roleSelector.innerHTML = state.roles.map(role => `
      <label class="role-checkbox">
        <input type="checkbox" value="${role.id}" data-role-change>
        <span>${escapeHtml(role.name)}</span>
        <small>(${role.provider})</small>
      </label>
    `).join('');
    roleSelector.querySelectorAll('input[data-role-change]').forEach(checkbox => {
      checkbox.addEventListener('change', () => updateRoleSettings());
    });
  }

  document.getElementById('roleSettingsContainer').innerHTML = '';
  document.getElementById('roleSettingsGroup').style.display = 'none';
  elements.newConversationModal.classList.add('active');
}

function updateRoleSettings() {
  const selectedRoleIds = Array.from(document.querySelectorAll('.role-selector input:checked')).map(cb => cb.value);
  const container = document.getElementById('roleSettingsContainer');
  const group = document.getElementById('roleSettingsGroup');

  if (selectedRoleIds.length === 0) {
    container.innerHTML = '';
    group.style.display = 'none';
    return;
  }

  group.style.display = 'block';
  container.innerHTML = selectedRoleIds.map(roleId => {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return '';
    return `
      <div style="margin-bottom:10px;padding:10px;background:var(--bg-secondary);border-radius:6px;">
        <div style="font-weight:600;margin-bottom:6px;font-size:13px;">${escapeHtml(role.name)}</div>
        <div style="margin-bottom:6px;">
          <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">昵称（可选）</label>
          <input type="text" class="role-nickname-input" data-role-id="${roleId}" placeholder="默认：${escapeHtml(role.name)}">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">追加提示词（可选）</label>
          <textarea class="role-prompt-input" data-role-id="${roleId}" rows="2" placeholder="为该角色追加特殊提示词"></textarea>
        </div>
      </div>
    `;
  }).join('');
}

function showEditConversationModal(conversation) {
  state.editingConversationId = conversation.id;
  document.getElementById('conversationModalTitle').textContent = '编辑会话';
  document.getElementById('confirmConversationBtn').textContent = '保存';
  document.getElementById('conversationName').value = conversation.name;

  const contextModeSelect = document.getElementById('contextMode');
  contextModeSelect.value = conversation.contextMode || 'self';
  contextModeSelect.disabled = true;

  const roleSelector = document.getElementById('roleSelector');
  if (state.roles.length === 0) {
    roleSelector.innerHTML = '<div class="empty-state">请先创建角色</div>';
  } else {
    roleSelector.innerHTML = state.roles.map(role => {
      const isChecked = conversation.roleIds.includes(role.id) ? 'checked' : '';
      return `
        <label class="role-checkbox">
          <input type="checkbox" value="${role.id}" ${isChecked}>
          <span>${escapeHtml(role.name)}</span>
          <small>(${role.provider})</small>
        </label>
      `;
    }).join('');
  }

  elements.newConversationModal.classList.add('active');
}

function hideNewConversationModal() {
  elements.newConversationModal.classList.remove('active');
  state.editingConversationId = null;
  document.getElementById('conversationName').value = '';
  document.getElementById('conversationModalTitle').textContent = '新建会话';
  document.getElementById('confirmConversationBtn').textContent = '创建';
}

function showNewRoleModal() {
  state.editingRoleId = null;
  document.getElementById('roleModalTitle').textContent = '新建角色';
  document.getElementById('confirmRoleBtn').textContent = '创建';
  elements.newRoleModal.classList.add('active');
}

function showEditRoleModal(role) {
  state.editingRoleId = role.id;
  document.getElementById('roleModalTitle').textContent = '编辑角色';
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
  document.getElementById('roleModalTitle').textContent = '新建角色';
  document.getElementById('confirmRoleBtn').textContent = '创建';
}

function closeAllModals() {
  hideNewConversationModal();
  hideNewRoleModal();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('请求超时')), 300000);
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

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return date.toLocaleDateString('zh-CN');
}

init();
