// ========================================
// 数据存储管理
// ========================================
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
      contextMode: 'self', // 'self' = AI自保持, 'full' = 完整上下文
      floatWindow: true // 使用浮动窗口
    };
  }

  static async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
  }
}

// ========================================
// 标签页管理器
// ========================================
class TabManager {
  constructor() {
    this.tabs = new Map(); // platform -> tabId
  }

  // 打开AI平台标签页
  async openPlatformTab(platform, forceNew = false) {
    const urls = {
      deepseek: 'https://chat.deepseek.com/',
      doubao: 'https://www.doubao.com/chat/',
      qianwen: 'https://www.qianwen.com/',
      openai: 'https://chatgpt.com/'
    };

    const url = urls[platform];
    if (!url) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    try {
      // 如果不强制新建，检查是否已有该平台的标签页
      if (!forceNew) {
        const existingTab = await this.findPlatformTab(platform);
        if (existingTab) {
          // 复用已有标签页，但不激活（保持焦点在浮动窗口）
          await chrome.tabs.update(existingTab.id, { active: false });
          console.log(`[TabManager] 使用已有 ${platform} 标签页`);
          return existingTab;
        }
      }

      // 创建新标签页
      const tab = await chrome.tabs.create({
        url: url,
        active: false // 在后台打开
      });

      this.tabs.set(platform, tab.id);
      console.log(`[TabManager] 打开 ${platform} 标签页:`, tab.id);

      // 等待页面加载
      await this.waitForTabReady(tab.id);

      return tab;
    } catch (error) {
      console.error(`[TabManager] 打开 ${platform} 标签页失败:`, error);
      throw error;
    }
  }

  // 查找平台的标签页
  async findPlatformTab(platform) {
    const domains = {
      deepseek: 'deepseek.com',
      doubao: 'doubao.com',
      qianwen: 'qianwen.com',
      openai: 'chatgpt.com'
    };

    const domain = domains[platform];
    if (!domain) return null;

    try {
      // 方法1：从已存储的标签页ID查找
      const tabId = this.tabs.get(platform);
      if (tabId) {
        try {
          const tab = await chrome.tabs.get(tabId);
          // 检查标签页是否还属于该平台
          if (tab.url && tab.url.includes(domain)) {
            console.log(`[TabManager] 找到已存储的 ${platform} 标签页:`, tab.id);
            return tab;
          } else {
            // URL不匹配，从Map中删除
            this.tabs.delete(platform);
          }
        } catch (e) {
          // 标签页已关闭，从Map中删除
          this.tabs.delete(platform);
        }
      }

      // 方法2：遍历所有标签页查找
      const allTabs = await chrome.tabs.query({});
      const platformTab = allTabs.find(tab => 
        tab.url && tab.url.includes(domain) && !tab.pendingUrl
      );

      if (platformTab) {
        // 找到了，更新Map
        this.tabs.set(platform, platformTab.id);
        console.log(`[TabManager] 遍历找到 ${platform} 标签页:`, platformTab.id);
        return platformTab;
      }

      console.log(`[TabManager] 未找到 ${platform} 标签页`);
      return null;
    } catch (error) {
      console.error(`[TabManager] 查找标签页失败:`, error);
      return null;
    }
  }

  // 等待标签页准备好
  async waitForTabReady(tabId, timeout = 30000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);

          if (tab.status === 'complete') {
            console.log(`[TabManager] 标签页 ${tabId} 已加载完成`);
            resolve(tab);
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`标签页 ${tabId} 加载超时`));
            return;
          }

          // 继续检查
          setTimeout(checkReady, 500);
        } catch (error) {
          reject(error);
        }
      };

      checkReady();
    });
  }

  // 向标签页发送消息
  async sendMessageToTab(tabId, message, timeout = 90000) {
    try {
      console.log(`[TabManager] 尝试向标签页 ${tabId} 发送消息:`, message.type);

      // 检查标签页是否存在
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error(`标签页 ${tabId} 不存在`);
      }

      console.log(`[TabManager] 标签页状态:`, tab.status);

      // 先发送ping消息检测content script是否已加载
      try {
        const pingResponse = await Promise.race([
          chrome.tabs.sendMessage(tabId, { type: 'ping' }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ping超时')), 10000)
          )
        ]);
        console.log(`[TabManager] Ping成功:`, pingResponse);
      } catch (pingError) {
        console.error(`[TabManager] Ping失败，Content Script可能未注入:`, pingError);
        throw new Error('Content Script未注入，请刷新AI网站页面或重新加载插件');
      }

      // 发送实际消息，带超时控制
      console.log(`[TabManager] 发送消息，超时设置: ${timeout}ms`);
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, message),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`发送消息超时 (${timeout / 1000}秒)`)), timeout)
        )
      ]);

      console.log(`[TabManager] 收到响应:`, response);
      return response;
    } catch (error) {
      console.error(`[TabManager] 向标签页 ${tabId} 发送消息失败:`, error);
      throw error;
    }
  }

  // 发送消息到指定平台
  async sendToPlatform(platform, messageType, data = {}, forceNewTab = false) {
    try {
      // 确保标签页已打开
      console.log(`[TabManager] 正在打开 ${platform} 标签页... (forceNew: ${forceNewTab})`);
      const tab = await this.openPlatformTab(platform, forceNewTab);
      console.log(`[TabManager] ${platform} 标签页已打开:`, tab.id);

      // 等待content script初始化和页面加载
      console.log(`[TabManager] 等待 ${platform} 页面加载...`);
      await this.sleep(3000); // 增加等待时间到3秒

      // 尝试ping几次，确保content script已就绪
      let pingSuccess = false;
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`[TabManager] Ping尝试 ${i + 1}/3...`);
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
          if (pingResponse && pingResponse.status === 'ok') {
            console.log(`[TabManager] Ping成功!`);
            pingSuccess = true;
            break;
          }
        } catch (pingError) {
          console.warn(`[TabManager] Ping ${i + 1} 失败，等待后重试...`);
          if (i < 2) {
            await this.sleep(2000); // 等待2秒后重试
          }
        }
      }

      if (!pingSuccess) {
        throw new Error('Content Script未就绪，请刷新AI网站页面');
      }

      // 发送消息
      const message = {
        type: messageType,
        ...data
      };

      console.log(`[TabManager] 向 ${platform} 发送消息:`, messageType);

      // 如果是sendMessage，使用异步等待模式
      if (messageType === 'sendMessage') {
        const messageId = Date.now();

        // 创建等待Promise
        const responsePromise = new Promise((resolve, reject) => {
          pendingResponses.set(messageId, { resolve, reject });

          // 90秒超时
          setTimeout(() => {
            if (pendingResponses.has(messageId)) {
              pendingResponses.delete(messageId);
              reject(new Error('等待AI回复超时（90秒）'));
            }
          }, 90000);
        });

        // 在消息中包含messageId
        message.messageId = messageId;

        // 发送消息到content-script（会立刻返回）
        await chrome.tabs.sendMessage(tab.id, message);

        console.log(`[TabManager] 等待AI响应（messageId: ${messageId}）`);

        // 等待content-script异步返回
        const response = await responsePromise;
        console.log(`[TabManager] 收到AI响应:`, response.content?.substring(0, 50));

        return response;
      } else {
        // 其他消息类型，直接等待返回
        const response = await this.sendMessageToTab(tab.id, message);
        return response;
      }
    } catch (error) {
      console.error(`[TabManager] 与 ${platform} 通信失败:`, error);
      throw error;
    }
  }

  // 在指定平台创建新会话
  async newChat(platform) {
    return await this.sendToPlatform(platform, 'newChat');
  }

  // 在指定平台发送消息
  async sendMessage(platform, content, forceNewTab = false) {
    return await this.sendToPlatform(platform, 'sendMessage', { content }, forceNewTab);
  }

  // 获取指定平台的聊天历史
  async getChatHistory(platform) {
    return await this.sendToPlatform(platform, 'getChatHistory');
  }

  // 获取平台页面信息
  async getPlatformInfo(platform) {
    return await this.sendToPlatform(platform, 'getPageInfo');
  }

  // 关闭平台标签页
  async closePlatformTab(platform) {
    const tabId = this.tabs.get(platform);
    if (tabId) {
      await chrome.tabs.remove(tabId);
      this.tabs.delete(platform);
      console.log(`[TabManager] 关闭 ${platform} 标签页`);
    }
  }

  // 激活平台标签页
  async activatePlatformTab(platform) {
    try {
      // 查找该平台的标签页
      const existingTab = await this.findPlatformTab(platform);

      if (existingTab) {
        // 激活已有标签页
        await chrome.tabs.update(existingTab.id, { active: true });
        console.log(`[TabManager] 激活已有 ${platform} 标签页`);
        return true;
      } else {
        // 没有找到，创建新标签页并激活
        const tab = await this.openPlatformTab(platform, true);
        await chrome.tabs.update(tab.id, { active: true });
        console.log(`[TabManager] 创建并激活 ${platform} 标签页`);
        return true;
      }
    } catch (error) {
      console.error(`[TabManager] 激活 ${platform} 标签页失败:`, error);
      throw error;
    }
  }

  // 辅助方法
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// 会话管理器
// ========================================
class ConversationManager {
  constructor(tabManager) {
    this.tabManager = tabManager;
  }

  async createConversation(name, roleIds) {
    const conversations = await StorageManager.getConversations();

    const newConversation = {
      id: this.generateId(),
      name: name || `会话 ${conversations.length + 1}`,
      roleIds: roleIds || [],
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

  async addMessage(conversationId, roleId, content, isUser = false) {
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
  }

  async getConversation(conversationId) {
    const conversations = await StorageManager.getConversations();
    return conversations.find(c => c.id === conversationId);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// ========================================
// 角色管理器
// ========================================
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

// ========================================
// AI消息处理管理器
// ========================================
class AIMessageManager {
  constructor(tabManager, conversationManager) {
    this.tabManager = tabManager;
    this.conversationManager = conversationManager;
  }

  // 处理用户消息，发送到AI平台
  async processUserMessage(conversationId, userMessage) {
    let conversation = await this.conversationManager.getConversation(conversationId);
    if (!conversation || !conversation.roleIds || conversation.roleIds.length === 0) {
      throw new Error('会话没有关联的角色');
    }

    // 获取设置
    const settings = await StorageManager.getSettings();
    const contextMode = settings.contextMode || 'self'; // 默认AI自保持模式
    const useFloatWindow = settings.floatWindow !== false; // 默认使用浮动窗口

    console.log(`[AIMessageManager] 上下文模式: ${contextMode}, 浮动窗口: ${useFloatWindow}`);

    // 如果使用浮动窗口，显示用户消息
    if (useFloatWindow) {
      await this.sendToFloatWindow('addMessage', {
        role: '用户',
        content: userMessage,
        isUser: true,
        isError: false
      });
    }

    // 获取角色信息
    const roles = await StorageManager.getRoles();

    // 先保存用户消息（这样历史中才能包含它）
    await this.conversationManager.addMessage(conversationId, null, userMessage, true);

    // 重新获取conversation（包含刚保存的用户消息）
    conversation = await this.conversationManager.getConversation(conversationId);

    // 为每个角色发送消息到对应的AI平台
    for (const roleId of conversation.roleIds) {
      const role = roles.find(r => r.id === roleId);
      if (!role) continue;

      try {
        console.log(`[AIMessageManager] 发送消息到 ${role.provider} (${role.name})`);

        // 根据上下文模式准备消息
        let messageToSend = userMessage;
        let forceNewTab = false; // 是否强制新建标签页

        if (contextMode === 'full') {
          // 完整上下文模式：合并所有历史，并强制新建标签页
          messageToSend = this.formatConversationWithHistory(conversation, role.id);
          forceNewTab = true;
          console.log(`[AIMessageManager] 完整上下文模式，消息长度: ${messageToSend.length}，将创建新标签页`);
        } else {
          console.log(`[AIMessageManager] AI自保持模式，复用已有标签页`);
        }

        // 发送到AI平台（根据模式决定是否强制新建标签页）
        const response = await this.tabManager.sendMessage(role.provider, messageToSend, forceNewTab);

        console.log(`[AIMessageManager] 收到响应:`, response);

        if (response && response.success) {
          // 保存AI回复
          await this.conversationManager.addMessage(
            conversationId,
            roleId,
            response.content,
            false
          );

          console.log(`[AIMessageManager] 收到 ${role.name} 的回复`);

          // 如果使用浮动窗口，显示AI回复
          if (useFloatWindow) {
            await this.sendToFloatWindow('addMessage', {
              role: role.name,
              content: response.content,
              isUser: false,
              isError: false,
              provider: role.provider  // 添加provider参数
            });
          }
        } else {
          // response是undefined或者success为false
          const errorMsg = response ? (response.error || '发送失败') : '未收到响应（可能URL变化导致连接中断）';
          console.error(`[AIMessageManager] 响应无效:`, response);
          
          const errorContent = `❌ ${role.name} 错误: ${errorMsg}`;
          
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error(`[AIMessageManager] ${role.provider} 响应失败:`, error);

        const errorContent = `❌ ${role.name} 错误: ${error.message}\n\n请确保：\n1. 已在浏览器中登录 ${role.provider} 网站\n2. ${role.provider} 网站标签页未关闭\n3. 网站标签页已完全加载\n4. Content Script已正确注入`;

        // 保存错误消息
        await this.conversationManager.addMessage(
          conversationId,
          roleId,
          errorContent,
          false
        );

        // 如果使用浮动窗口，显示错误
        if (useFloatWindow) {
          await this.sendToFloatWindow('addMessage', {
            role: role.name,
            content: errorContent,
            isUser: false,
            isError: true,
            provider: role.provider  // 添加provider参数
          });
        }
      }
    }

    // 返回更新后的会话
    return await this.conversationManager.getConversation(conversationId);
  }

  // 发送消息到浮动窗口
  async sendToFloatWindow(action, data) {
    try {
      // 查找所有标签页，找到有浮动窗口的
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        try {
          // 排除AI平台网站（它们有自己的content script）
          const isAIPlatform = tab.url && (
            tab.url.includes('deepseek.com') ||
            tab.url.includes('doubao.com') ||
            tab.url.includes('qianwen.com') ||
            tab.url.includes('chatgpt.com')
          );

          if (!isAIPlatform && tab.url && tab.url.startsWith('http')) {
            await chrome.tabs.sendMessage(tab.id, {
              action,
              ...data
            });
            console.log(`[AIMessageManager] 发送到浮动窗口成功:`, tab.url);
            return; // 找到一个就返回
          }
        } catch (e) {
          // 该标签页没有浮动窗口，继续查找
          continue;
        }
      }
    } catch (error) {
      console.error(`[AIMessageManager] 发送到浮动窗口失败:`, error);
    }
  }

  // 格式化对话历史（完整上下文模式）
  formatConversationWithHistory(conversation, roleId) {
    // 找到该角色相关的所有历史消息
    const roleMessages = conversation.messages.filter(m =>
      m.roleId === roleId || m.isUser
    );

    if (roleMessages.length === 0) {
      return '请开始我们的对话。';
    }

    // 构建格式化的对话历史
    let formatted = '以下是我们之前的对话历史，请参考这些历史来继续对话：\n\n';

    // 格式化所有消息（包括最新保存的用户消息）
    roleMessages.forEach(msg => {
      const role = msg.isUser ? 'User' : 'Assistant';
      formatted += `${role}: ${msg.content}\n\n`;
    });

    return formatted.trim();
  }

  // 在AI平台创建新会话
  async newChatOnPlatform(provider) {
    try {
      const response = await this.tabManager.newChat(provider);
      return response && response.success;
    } catch (error) {
      console.error(`[AIMessageManager] 在 ${provider} 创建新会话失败:`, error);
      return false;
    }
  }
}

// ========================================
// 初始化
// ========================================
let tabManager;
let conversationManager;
let roleManager;
let aiMessageManager;

async function init() {
  console.log('[Background] 初始化...');

  // 创建管理器
  tabManager = new TabManager();
  conversationManager = new ConversationManager(tabManager);
  roleManager = new RoleManager(tabManager);
  aiMessageManager = new AIMessageManager(tabManager, conversationManager);

  console.log('[Background] 初始化完成');
}

// ========================================
// 消息监听
// ========================================

// 等待AI响应的Promise存储
const pendingResponses = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] 收到消息:', request.action || request.type);

  // 处理来自content-script的异步响应
  if (request.type === 'aiResponse') {
    console.log('[Background] 收到AI响应:', request.platform, request.content?.substring(0, 50));

    // 查找对应的pending Promise
    const pending = pendingResponses.get(request.messageId);
    if (pending) {
      pendingResponses.delete(request.messageId);

      if (request.error) {
        pending.reject(new Error(request.error));
      } else {
        pending.resolve({ success: true, content: request.content });
      }
    }
    return;
  }

  switch (request.action) {
    case 'createConversation':
      conversationManager.createConversation(request.name, request.roleIds)
        .then(sendResponse);
      return true;

    case 'deleteConversation':
      conversationManager.deleteConversation(request.conversationId)
        .then(() => sendResponse({ success: true }));
      return true;

    case 'addMessage':
      console.log('[Background] 处理addMessage请求');
      aiMessageManager.processUserMessage(request.conversationId, request.content)
        .then(result => {
          console.log('[Background] addMessage成功:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('[Background] addMessage失败:', error);
          // 即使失败也返回更新后的会话（包含错误消息）
          aiMessageManager.conversationManager.getConversation(request.conversationId)
            .then(conversation => {
              sendResponse(conversation);
            })
            .catch(() => {
              sendResponse({ error: error.message });
            });
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

    case 'getSettings':
      StorageManager.getSettings().then(sendResponse);
      return true;

    case 'testPlatform':
      // 真正测试AI平台：发送测试消息并等待回复
      console.log('[Background] 开始测试平台:', request.platform);

      // 发送测试消息到AI平台
      tabManager.sendMessage(request.platform, '测试连接')
        .then(response => {
          console.log('[Background] 测试成功，收到回复:', response);

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
        .catch(error => {
          console.error('[Background] 测试失败:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'newChatOnPlatform':
      // 在AI平台创建新会话
      aiMessageManager.newChatOnPlatform(request.provider)
        .then(success => sendResponse({ success }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'activatePlatformTab':
      // 激活AI平台标签页
      tabManager.activatePlatformTab(request.provider)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// 监听content script的页面就绪消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pageReady') {
    console.log('[Background] 收到页面就绪通知:', message.platform, sender.tab?.url);
    sendResponse({ status: 'ok' });
  }
});

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
  // 从所有平台的Map中删除该标签页ID
  for (const [platform, storedTabId] of tabManager.tabs.entries()) {
    if (storedTabId === tabId) {
      tabManager.tabs.delete(platform);
      console.log(`[TabManager] 清理已关闭的 ${platform} 标签页:`, tabId);
      break;
    }
  }
});

// 监听标签页更新事件（URL变化）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 检查是否是AI平台标签页
    for (const [platform, storedTabId] of tabManager.tabs.entries()) {
      if (storedTabId === tabId) {
        const domains = {
          deepseek: 'deepseek.com',
          doubao: 'doubao.com',
          qianwen: 'qianwen.com',
          openai: 'chatgpt.com'
        };
        const domain = domains[platform];
        
        // 如果URL不再属于该平台，从Map中删除
        if (!tab.url.includes(domain)) {
          tabManager.tabs.delete(platform);
          console.log(`[TabManager] 清理已导航的 ${platform} 标签页:`, tabId);
        }
        break;
      }
    }
  }
});

// 启动
init();
