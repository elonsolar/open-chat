// 简化的存储工具函数（可选，如果需要在content script中使用）

// 向background发送消息
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// 获取所有会话
async function getConversations() {
  return sendMessage({ action: 'getConversations' });
}

// 获取单个会话
async function getConversation(conversationId) {
  const conversations = await getConversations();
  return conversations.find(c => c.id === conversationId);
}

// 创建会话
async function createConversation(name, roleIds) {
  return sendMessage({
    action: 'createConversation',
    name,
    roleIds
  });
}

// 删除会话
async function deleteConversation(conversationId) {
  return sendMessage({
    action: 'deleteConversation',
    conversationId
  });
}

// 添加消息
async function addMessage(conversationId, roleId, content, isUser) {
  return sendMessage({
    action: 'addMessage',
    conversationId,
    roleId,
    content,
    isUser
  });
}

// 获取所有角色
async function getRoles() {
  return sendMessage({ action: 'getRoles' });
}

// 创建角色
async function createRole(name, provider, model, systemPrompt) {
  return sendMessage({
    action: 'createRole',
    name,
    provider,
    model,
    systemPrompt
  });
}

// 更新角色
async function updateRole(roleId, updates) {
  return sendMessage({
    action: 'updateRole',
    roleId,
    updates
  });
}

// 删除角色
async function deleteRole(roleId) {
  return sendMessage({
    action: 'deleteRole',
    roleId
  });
}

// 获取设置
async function getSettings() {
  return sendMessage({ action: 'getSettings' });
}

// 更新设置
async function updateSettings(settings) {
  return sendMessage({
    action: 'updateSettings',
    settings
  });
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendMessage,
    getConversations,
    getConversation,
    createConversation,
    deleteConversation,
    addMessage,
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    getSettings,
    updateSettings
  };
}
