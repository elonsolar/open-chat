importScripts('../config/providers.config.js');

class StorageManager {
  static async getConversations() {
    const result = await chrome.storage.local.get('conversations');
    return result.conversations || [];
  }

  static async saveConversations(conversations) {
    await chrome.storage.local.set({ conversations });
  }

  static async getRoles() {
    const result = await chrome.storage.local.get('roles');
    return result.roles || [];
  }

  static async saveRoles(roles) {
    await chrome.storage.local.set({ roles });
  }

  static async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {
      wsUrl: 'ws://localhost:8080',
      wsEnabled: false,
      contextMode: 'self',
      floatWindow: true
    };
  }

  static async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }
}

class TabManager {
  constructor() {
    this.tabs = new Map();
  }

  async openPlatformTab(platform, forceNew = false, targetUrl = null) {
    const provider = PROVIDERS[platform];
    if (!provider) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    const url = provider.baseUrl;

    if (!forceNew) {
      if (targetUrl) {
        const exactTab = await this.findTabByUrl(targetUrl);
        if (exactTab) {
          await chrome.tabs.update(exactTab.id, { active: false });
          await this.sleep(1000);
          return exactTab;
        }
      } else {
        const existingTab = await this.findPlatformTab(platform);
        if (existingTab) {
          await chrome.tabs.update(existingTab.id, { active: false });
          await this.sleep(2000);
          return existingTab;
        }
      }
    }

    const openUrl = targetUrl || url;
    const tab = await chrome.tabs.create({
      url: openUrl,
      active: false
    });

    this.tabs.set(platform, tab.id);
    await this.waitForTabReady(tab.id);

    // 确保标签页保持后台状态
    await chrome.tabs.update(tab.id, { active: false });

    return tab;
  }

  async findPlatformTab(platform) {
    const provider = PROVIDERS[platform];
    if (!provider) return null;

    const domain = provider.domain;

    const tabId = this.tabs.get(platform);
    if (tabId) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url && tab.url.includes(domain)) {
          return tab;
        } else {
          this.tabs.delete(platform);
        }
      } catch (e) {
        this.tabs.delete(platform);
      }
    }

    const allTabs = await chrome.tabs.query({});
    const platformTab = allTabs.find(tab =>
      tab.url && tab.url.includes(domain) && !tab.pendingUrl
    );

    if (platformTab) {
      this.tabs.set(platform, platformTab.id);
      return platformTab;
    }

    return null;
  }

  async findTabByUrl(targetUrl) {
    const allTabs = await chrome.tabs.query({});
    return allTabs.find(tab => tab.url === targetUrl && !tab.pendingUrl) || null;
  }

  async waitForTabReady(tabId, timeout = 30000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);

          if (tab.status === 'complete') {
            resolve(tab);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`标签页 ${tabId} 加载超时`));
            return;
          }

          setTimeout(checkReady, 500);
        } catch (error) {
          reject(error);
        }
      };

      checkReady();
    });
  }

  async sendMessageToTab(tabId, message, timeout = 90000) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      throw new Error(`标签页 ${tabId} 不存在`);
    }

    try {
      await Promise.race([
        chrome.tabs.sendMessage(tabId, { type: 'ping' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ping超时')), 10000)
        )
      ]);
    } catch (pingError) {
      throw new Error('Content Script未注入，请刷新AI网站页面或重新加载插件');
    }

    return await Promise.race([
      chrome.tabs.sendMessage(tabId, message),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`发送消息超时 (${timeout / 1000}秒)`)), timeout)
      )
    ]);
  }

  async sendToPlatform(platform, messageType, data = {}, forceNewTab = false, targetUrl = null) {
    const tab = await this.openPlatformTab(platform, forceNewTab, targetUrl);

    // 确保标签页保持后台状态
    try {
      await chrome.tabs.update(tab.id, { active: false });
    } catch (e) {
      // 标签页可能已关闭
    }

    await this.sleep(3000);

    let pingSuccess = false;
    for (let i = 0; i < 5; i++) {
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
        if (pingResponse && pingResponse.status === 'ok') {
          pingSuccess = true;
          break;
        }
      } catch (pingError) {
        if (i === 0) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: [
                'utils/platforms/base-adapter.js',
                'utils/platforms/deepseek-adapter.js',
                'utils/platforms/doubao-adapter.js',
                'utils/platforms/qianwen-adapter.js',
                'utils/platforms/openai-adapter.js',
                'utils/platforms/kimi-adapter.js',
                'utils/content-script.js'
              ]
            });
            await this.sleep(3000);
          } catch (injectError) {
            console.warn(`注入content script到${platform}失败:`, injectError.message);
          }
        } else {
          await this.sleep(2000);
        }
      }
    }

    if (!pingSuccess) {
      throw new Error('Content Script未就绪，请刷新AI网站页面');
    }

    if (!forceNewTab) {
      await this.sleep(2000);
    }

    const message = {
      type: messageType,
      ...data
    };

    if (messageType === 'sendMessage') {
      const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${platform}`;

      const responsePromise = new Promise((resolve, reject) => {
        pendingResponses.set(messageId, { resolve, reject });

        setTimeout(() => {
          if (pendingResponses.has(messageId)) {
            pendingResponses.delete(messageId);
            reject(new Error('等待AI回复超时（300秒）'));
          }
        }, 300000);
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await chrome.tabs.sendMessage(tab.id, {
          ...message,
          messageId: messageId
        });

        // 发送消息后确保标签页保持后台状态
        try {
          await chrome.tabs.update(tab.id, { active: false });
        } catch (e) {
          // 标签页可能已关闭，忽略
        }
      } catch (sendError) {
        pendingResponses.delete(messageId);
        throw sendError;
      }

      return await responsePromise;
    } else {
      return await this.sendMessageToTab(tab.id, message);
    }
  }

  async newChat(platform) {
    return await this.sendToPlatform(platform, 'newChat');
  }

  async sendMessage(platform, content, forceNewTab = false, targetUrl = null) {
    const response = await this.sendToPlatform(platform, 'sendMessage', { content }, forceNewTab, targetUrl);
    return {
      success: true,
      content: response.content || response,
      conversationUrl: response.conversationUrl
    };
  }

  async getChatHistory(platform) {
    return await this.sendToPlatform(platform, 'getChatHistory');
  }

  async getPlatformInfo(platform) {
    return await this.sendToPlatform(platform, 'getPageInfo');
  }

  async closePlatformTab(platform) {
    const tabId = this.tabs.get(platform);
    if (tabId) {
      await chrome.tabs.remove(tabId);
      this.tabs.delete(platform);
    }
  }

  async activatePlatformTab(platform) {
    const existingTab = await this.findPlatformTab(platform);

    if (existingTab) {
      await chrome.tabs.update(existingTab.id, { active: true });
      return true;
    } else {
      const tab = await this.openPlatformTab(platform, true);
      await chrome.tabs.update(tab.id, { active: true });
      return true;
    }
  }

  async openPlatformConversation(platform) {
    const existingTab = await this.findPlatformTab(platform);

    if (existingTab) {
      await chrome.tabs.update(existingTab.id, { active: true });
      return { success: true, tabId: existingTab.id };
    } else {
      const tab = await this.openPlatformTab(platform, true);
      await chrome.tabs.update(tab.id, { active: true });
      return { success: true, tabId: tab.id };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class ConversationManager {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.messageQueues = new Map();
  }

  async createConversation(name, roleIds, contextMode, roleSettings = {}) {
    const conversations = await StorageManager.getConversations();

    const newConversation = {
      id: this.generateId(),
      name: name || `会话 ${conversations.length + 1}`,
      roleIds: roleIds || [],
      contextMode: contextMode || 'self',
      sendMode: 'parallel',
      roleSettings: roleSettings || {},
      roleUrls: {},
      roleLastMessageIds: {},
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    conversations.push(newConversation);
    await StorageManager.saveConversations(conversations);

    return newConversation;
  }

  async deleteConversation(conversationId) {
    let conversations = await StorageManager.getConversations();
    conversations = conversations.filter(c => c.id !== conversationId);
    await StorageManager.saveConversations(conversations);
  }

  async updateConversation(conversationId, updates) {
    const conversations = await StorageManager.getConversations();
    const conversation = conversations.find(c => c.id === conversationId);

    if (conversation) {
      if (updates.contextMode && updates.contextMode !== conversation.contextMode) {
        throw new Error('会话模式不可修改');
      }
      Object.assign(conversation, updates, { updatedAt: Date.now() });
      await StorageManager.saveConversations(conversations);
      return conversation;
    }

    return null;
  }

  async clearConversationMessages(conversationId) {
    const conversations = await StorageManager.getConversations();
    const conversation = conversations.find(c => c.id === conversationId);

    if (conversation) {
      conversation.messages = [];
      conversation.roleUrls = {};
      conversation.roleLastMessageIds = {};
      conversation.updatedAt = Date.now();
      await StorageManager.saveConversations(conversations);
      return conversation;
    }

    return null;
  }

  async addMessage(conversationId, roleId, content, isUser = false) {
    const queueKey = conversationId;

    if (!this.messageQueues.has(queueKey)) {
      this.messageQueues.set(queueKey, Promise.resolve());
    }

    const queue = this.messageQueues.get(queueKey);

    const newQueue = queue.then(async () => {
      const conversations = await StorageManager.getConversations();
      const conversation = conversations.find(c => c.id === conversationId);

      if (conversation) {
        const message = {
          id: this.generateId(),
          roleId,
          content,
          isUser,
          timestamp: Date.now()
        };

        conversation.messages.push(message);
        conversation.updatedAt = Date.now();

        await StorageManager.saveConversations(conversations);
        return message;
      }

      return null;
    });

    this.messageQueues.set(queueKey, newQueue);

    return newQueue;
  }

  async getConversation(conversationId) {
    const conversations = await StorageManager.getConversations();
    return conversations.find(c => c.id === conversationId) || null;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

class RoleManager {
  constructor(tabManager) {
    this.tabManager = tabManager;
  }

  async createRole(name, provider, model, systemPrompt) {
    const roles = await StorageManager.getRoles();

    const newRole = {
      id: this.generateId(),
      name,
      provider,
      model,
      systemPrompt,
      conversationUrl: null,
      createdAt: Date.now()
    };

    roles.push(newRole);
    await StorageManager.saveRoles(roles);

    return newRole;
  }

  async updateRole(roleId, updates) {
    const roles = await StorageManager.getRoles();
    const role = roles.find(r => r.id === roleId);

    if (role) {
      Object.assign(role, updates);
      await StorageManager.saveRoles(roles);
    }
  }

  async deleteRole(roleId) {
    let roles = await StorageManager.getRoles();
    roles = roles.filter(r => r.id !== roleId);
    await StorageManager.saveRoles(roles);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

class AIMessageManager {
  constructor(tabManager, conversationManager) {
    this.tabManager = tabManager;
    this.conversationManager = conversationManager;
  }

  async processUserMessage(conversationId, userMessage) {
    let conversation = await this.conversationManager.getConversation(conversationId);
    if (!conversation || !conversation.roleIds || conversation.roleIds.length === 0) {
      throw new Error('会话没有关联的角色');
    }

    const settings = await StorageManager.getSettings();
    const contextMode = conversation.contextMode || settings.contextMode || 'self';
    const useFloatWindow = settings.floatWindow !== false;
    const sendMode = conversation.sendMode || 'parallel';

    if (useFloatWindow) {
      await this.sendToFloatWindow('addMessage', {
        role: '用户',
        content: userMessage,
        isUser: true,
        isError: false
      });
    }

    const roles = await StorageManager.getRoles();

    await this.conversationManager.addMessage(conversationId, null, userMessage, true);

    conversation = await this.conversationManager.getConversation(conversationId);

    if (sendMode === 'sequential') {
      await this.sendToRolesSequential(conversation, roles, contextMode, useFloatWindow, conversationId);
    } else if (sendMode === 'random') {
      await this.sendToRolesRandom(conversation, roles, contextMode, useFloatWindow, conversationId);
    } else {
      const sendPromises = conversation.roleIds.map(async (roleId) => {
        return await this.sendMessageToRole(roleId, roles, conversation, contextMode, useFloatWindow, conversationId);
      });
      await Promise.allSettled(sendPromises);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    return await this.conversationManager.getConversation(conversationId);
  }

  async sendMessageToRole(roleId, roles, conversation, contextMode, useFloatWindow, conversationId) {
    const role = roles.find(r => r.id === roleId);
    if (!role) return null;

    const roleSetting = conversation.roleSettings?.[roleId] || {};
    const nickname = roleSetting.nickname || role.name;
    const additionalPrompt = roleSetting.additionalPrompt || '';

    try {
      let messageToSend = '';

      if (contextMode === 'self') {
        const lastMessageId = conversation.roleLastMessageIds?.[roleId];
        const messagesToSend = this.getMessagesToSend(conversation, lastMessageId, false);

        if (messagesToSend.length === 0) {
          return null;
        }

        messageToSend = messagesToSend.map(msg => msg.content).join('\n\n');

        let fullPrompt = role.systemPrompt || '';
        if (additionalPrompt) {
          fullPrompt = fullPrompt ? `${fullPrompt}\n\n${additionalPrompt}` : additionalPrompt;
        }

        if (fullPrompt) {
          messageToSend = `${fullPrompt}\n\n${messageToSend}`;
        }

        messageToSend += '\n\n重要：请在你的回复最后必须添加 [[<<>>]] 标记，表示回复结束。';
      } else {
        const lastMessageId = conversation.roleLastMessageIds?.[roleId];
        const messagesToSend = this.getMessagesToSend(conversation, lastMessageId, true);

        if (messagesToSend.length === 0) {
          return null;
        }

        const isFirstTime = !lastMessageId;
        const nicknameMap = {};
        roles.forEach(r => {
          const setting = conversation.roleSettings?.[r.id] || {};
          nicknameMap[r.id] = setting.nickname || r.name;
        });

        if (isFirstTime) {
          const nicknames = (conversation.roleIds || [])
            .map(id => nicknameMap[id])
            .filter(Boolean);
          messageToSend += `当前我们在一个会话里，会话里有成员 user、${nicknames.join('、')}\n`;
          messageToSend += `你的当前会话名称是：${nickname}\n`;

          let fullPrompt = role.systemPrompt || '';
          if (additionalPrompt) {
            fullPrompt = fullPrompt ? `${fullPrompt}\n\n${additionalPrompt}` : additionalPrompt;
          }

          if (fullPrompt) {
            messageToSend += `你的角色设定：${fullPrompt}\n`;
          }
          messageToSend += `\n请注意：你只能扮演${nickname}，不可以扮演其他角色。\n\n`;
          messageToSend += '下面是当前会话的历史内容：\n\n';
        }

        messagesToSend.forEach(msg => {
          if (msg.isUser) {
            messageToSend += `User: ${msg.content}\n\n`;
          } else {
            messageToSend += `${nicknameMap[msg.roleId] || 'Assistant'}: ${msg.content}\n\n`;
          }
        });

        messageToSend = messageToSend.trim() + '\n\n重要：请在你的回复最后必须添加 [[<<>>]] 标记，表示回复结束。';
      }

      const conversationUrl = conversation.roleUrls?.[roleId];
      console.log(`[AIMessageManager] 角色 ${roleId} 通过后台标签页发送消息，会话URL: ${conversationUrl || '使用baseUrl'}`);
      const response = await this.tabManager.sendMessage(role.provider, messageToSend, true, conversationUrl);

      if (response && response.success) {
          let content = response.content || '';

          const endMarker = '[[<<>>]]';
          if (content.endsWith(endMarker)) {
            content = content.slice(0, -endMarker.length).trim();
          } else {
            console.warn(`[AIMessageManager] ${role.name} 的回复可能不完整，缺少结束标记`);
          }
          if (response.conversationUrl) {
            if (!conversation.roleUrls) {
              conversation.roleUrls = {};
            }

            if (conversation.roleUrls[roleId] !== response.conversationUrl) {
              conversation.roleUrls[roleId] = response.conversationUrl;
              await this.conversationManager.updateConversation(conversationId, { roleUrls: conversation.roleUrls });
            }
          }

          const savedMessage = await this.conversationManager.addMessage(conversationId, roleId, content, false);

          if (savedMessage) {
            if (!conversation.roleLastMessageIds) {
              conversation.roleLastMessageIds = {};
            }
            conversation.roleLastMessageIds[roleId] = savedMessage.id;

            await this.conversationManager.updateConversation(conversationId, {
              roleLastMessageIds: conversation.roleLastMessageIds
            });
          }

          if (useFloatWindow) {
            await this.sendToFloatWindow('addMessage', {
              role: nickname,
              content: content,
              isUser: false,
              isError: false,
              provider: role.provider
            });
          }

          return true;
        } else {
          throw new Error('发送消息失败');
        }
    } catch (error) {
      console.error(`发送到 ${role.provider} 失败:`, error);
    }

    return false;
  }

  getMessagesToSend(conversation, lastMessageId, includeUserMessages = true) {
    if (!lastMessageId) {
      return includeUserMessages ? conversation.messages : conversation.messages.filter(m => m.isUser);
    }

    const lastMessageIndex = conversation.messages.findIndex(m => m.id === lastMessageId);

    if (lastMessageIndex >= 0) {
      const newMessages = conversation.messages.slice(lastMessageIndex + 1);
      return includeUserMessages ? newMessages : newMessages.filter(m => m.isUser);
    }

    return includeUserMessages ? conversation.messages : conversation.messages.filter(m => m.isUser);
  }

  async sendToRolesSequential(conversation, roles, contextMode, useFloatWindow, conversationId) {
    for (let i = 0; i < conversation.roleIds.length; i++) {
      const roleId = conversation.roleIds[i];
      await this.sendMessageToRole(roleId, roles, conversation, contextMode, useFloatWindow, conversationId);
      conversation = await this.conversationManager.getConversation(conversationId);
    }
  }

  async sendToRolesRandom(conversation, roles, contextMode, useFloatWindow, conversationId) {
    const shuffledRoleIds = [...conversation.roleIds].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffledRoleIds.length; i++) {
      const roleId = shuffledRoleIds[i];
      await this.sendMessageToRole(roleId, roles, conversation, contextMode, useFloatWindow, conversationId);
      conversation = await this.conversationManager.getConversation(conversationId);
    }
  }

  async sendToFloatWindow(action, data) {
    try {
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        const isAIPlatform = tab.url && (
          tab.url.includes('deepseek.com') ||
          tab.url.includes('doubao.com') ||
          tab.url.includes('qianwen.com') ||
          tab.url.includes('chatgpt.com') ||
          tab.url.includes('moonshot.cn')
        );

        const isSpecialPage = tab.url && (
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')
        );

        if (!isAIPlatform && !isSpecialPage && tab.url && tab.url.startsWith('http')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action,
              ...data
            });
            return;
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
      console.error('发送到浮动窗口失败:', error);
    }
  }

  async newChatOnPlatform(provider) {
    try {
      const response = await this.tabManager.newChat(provider);
      return response && response.success;
    } catch (error) {
      console.error(`在 ${provider} 创建新会话失败:`, error);
      return false;
    }
  }

  async initRoleConversation(conversationId, roleId) {
    const conversation = await this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error('会话不存在');
    }

    const roles = await StorageManager.getRoles();
    const role = roles.find(r => r.id === roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    try {
      const response = await this.tabManager.newChat(role.provider);
      if (!response || !response.conversationUrl) {
        throw new Error('创建会话失败');
      }

      if (!conversation.roleUrls) {
        conversation.roleUrls = {};
      }
      conversation.roleUrls[roleId] = response.conversationUrl;

      await this.conversationManager.updateConversation(conversationId, {
        roleUrls: conversation.roleUrls
      });

      return await this.conversationManager.getConversation(conversationId);
    } catch (error) {
      console.error(`初始化角色 ${roleId} 会话失败:`, error);
      throw error;
    }
  }

  async clearConversation(conversationId) {
    const conversation = await this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error('会话不存在');
    }

    return await this.conversationManager.clearConversationMessages(conversationId);
  }
}

let tabManager;
let conversationManager;
let roleManager;
let aiMessageManager;
const pendingResponses = new Map();

async function init() {
  tabManager = new TabManager();
  conversationManager = new ConversationManager(tabManager);
  roleManager = new RoleManager(tabManager);
  aiMessageManager = new AIMessageManager(tabManager, conversationManager);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'aiResponse') {
    const pending = pendingResponses.get(request.messageId);

    if (pending) {
      pendingResponses.delete(request.messageId);

      if (request.error) {
        pending.reject(new Error(request.error));
      } else {
        pending.resolve({
          content: request.content,
          conversationUrl: request.conversationUrl
        });
      }

      sendResponse({ status: 'received' });
    } else {
      sendResponse({ status: 'no_matching_promise' });
    }
    return;
  }

  switch (request.action) {
    case 'createConversation':
      conversationManager.createConversation(request.name, request.roleIds, request.contextMode, request.roleSettings)
        .then(sendResponse);
      return true;

    case 'deleteConversation':
      conversationManager.deleteConversation(request.conversationId)
        .then(() => sendResponse({ success: true }));
      return true;

    case 'updateConversation':
      conversationManager.updateConversation(request.conversationId, request.updates)
        .then(conversation => sendResponse(conversation))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'clearConversation':
      aiMessageManager.clearConversation(request.conversationId)
        .then(conversation => sendResponse(conversation))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'addMessage':
      aiMessageManager.processUserMessage(request.conversationId, request.content)
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('addMessage失败:', error);
          aiMessageManager.conversationManager.getConversation(request.conversationId)
            .then(conversation => sendResponse(conversation))
            .catch(() => sendResponse({ error: error.message }));
        });
      return true;

    case 'getConversations':
      StorageManager.getConversations().then(sendResponse);
      return true;

    case 'getConversation':
      conversationManager.getConversation(request.conversationId)
        .then(sendResponse);
      return true;

    case 'createRole':
      roleManager.createRole(
        request.name,
        request.provider,
        request.model,
        request.systemPrompt
      ).then(sendResponse);
      return true;

    case 'updateRole':
      roleManager.updateRole(request.roleId, request.updates)
        .then(() => sendResponse({ success: true }));
      return true;

    case 'deleteRole':
      roleManager.deleteRole(request.roleId)
        .then(() => sendResponse({ success: true }));
      return true;

    case 'getRoles':
      StorageManager.getRoles().then(sendResponse);
      return true;

    case 'updateSettings':
      StorageManager.saveSettings(request.settings)
        .then(() => sendResponse({ success: true }));
      return true;

    case 'activatePlatformTab':
      tabManager.activatePlatformTab(request.provider)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'getSettings':
      StorageManager.getSettings().then(sendResponse);
      return true;

    case 'testPlatform':
      tabManager.sendMessage(request.platform, '测试连接')
        .then(response => {
          if (response && response.success) {
            sendResponse({
              success: true,
              info: {
                platform: request.platform,
                response: response.content,
                length: response.content ? response.content.length : 0
              }
            });
          } else {
            sendResponse({
              success: false,
              error: response?.error || '未收到有效回复'
            });
          }
        })
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'newChatOnPlatform':
      aiMessageManager.newChatOnPlatform(request.provider)
        .then(success => sendResponse({ success }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'initRoleConversation':
      aiMessageManager.initRoleConversation(request.conversationId, request.roleId)
        .then(conversation => sendResponse(conversation))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'openPlatformConversation':
      tabManager.openPlatformConversation(request.provider)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pageReady') {
    sendResponse({ status: 'ok' });
  }

  if (message.type === 'sendToIframe') {
    sendResponse({ success: true });
    return true;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pageReady') {
    sendResponse({ status: 'ok' });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [platform, storedTabId] of tabManager.tabs.entries()) {
    if (storedTabId === tabId) {
      tabManager.tabs.delete(platform);
      break;
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    for (const [platform, storedTabId] of tabManager.tabs.entries()) {
      if (storedTabId === tabId) {
        const provider = PROVIDERS[platform];
        if (provider && !tab.url.includes(provider.domain)) {
          tabManager.tabs.delete(platform);
        }
        break;
      }
    }
  }
});

if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
}

async function injectFloatingWindowToAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      const isAIPlatform = tab.url && (
        tab.url.includes('deepseek.com') ||
        tab.url.includes('doubao.com') ||
        tab.url.includes('qianwen.com') ||
        tab.url.includes('chatgpt.com') ||
        tab.url.includes('moonshot.cn')
      );

      const isSpecialPage = tab.url && (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:')
      );

      if (!isAIPlatform && !isSpecialPage && tab.url && tab.url.startsWith('http')) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        } catch (pingError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['utils/floating-window.js', 'utils/floating-content.js']
            });
          } catch (injectError) {
          }
        }
      }
    }
  } catch (error) {
    console.error('注入浮动窗口失败:', error);
  }
}

chrome.runtime.onStartup.addListener(async () => {
  setTimeout(async () => {
    await injectFloatingWindowToAllTabs();
  }, 1000);
});

chrome.runtime.onInstalled.addListener(async () => {
  setTimeout(async () => {
    await injectFloatingWindowToAllTabs();
  }, 1000);
});

init();
