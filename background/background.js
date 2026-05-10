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
  async openPlatformTab(platform, forceNew = false, targetUrl = null) {
    console.log(`[TabManager] ========== openPlatformTab ==========`);
    console.log(`[TabManager] platform: ${platform}, forceNew: ${forceNew}, targetUrl: ${targetUrl || 'none'}`);

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
        // 如果指定了目标URL，只精准查找该URL的标签页
        if (targetUrl) {
          console.log(`[TabManager] 🔍 查找目标URL的标签页: ${targetUrl}`);
          const exactTab = await this.findTabByUrl(targetUrl);
          if (exactTab) {
            await chrome.tabs.update(exactTab.id, { active: false });
            console.log(`[TabManager] ✅ 找到目标URL标签页: ${exactTab.id}`);
            await this.sleep(1000);
            return exactTab;
          } else {
            console.log(`[TabManager] ⚠️ 未找到目标URL标签页，将创建新标签页并导航到该URL`);
            // 未找到目标URL，直接创建新标签页（不继续查找其他标签页）
          }
        } else {
          // 没有指定目标URL，查找该平台的任意标签页
          console.log(`[TabManager] 查找已有的 ${platform} 标签页...`);
          const existingTab = await this.findPlatformTab(platform);
          if (existingTab) {
            // 复用已有标签页，但不激活（保持焦点在浮动窗口）
            await chrome.tabs.update(existingTab.id, { active: false });
            console.log(`[TabManager] ⚠️ 复用已有 ${platform} 标签页: ${existingTab.id}, URL: ${existingTab.url}`);

            // 复用标签页时，等待更长时间确保页面稳定
            console.log(`[TabManager] 复用标签页，等待页面稳定...`);
            await this.sleep(2000);

            return existingTab;
          } else {
            console.log(`[TabManager] 未找到已有的 ${platform} 标签页`);
          }
        }
      } else {
        console.log(`[TabManager] forceNew=true，跳过查找已有标签页`);
      }

      // 创建新标签页
      console.log(`[TabManager] 创建新的 ${platform} 标签页...`);
      // 如果有目标URL，直接打开该URL；否则打开平台首页
      const openUrl = targetUrl || url;
      const tab = await chrome.tabs.create({
        url: openUrl,
        active: false // 在后台打开
      });

      this.tabs.set(platform, tab.id);
      console.log(`[TabManager] ✅ 打开 ${platform} 标签页:`, tab.id);

      // 等待页面加载
      await this.waitForTabReady(tab.id);

      return tab;
    } catch (error) {
      console.error(`[TabManager] ❌ 打开 ${platform} 标签页失败:`, error);
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

  // 通过URL精准查找标签页
  async findTabByUrl(targetUrl) {
    try {
      console.log(`[TabManager] 查找URL: ${targetUrl}`);
      const allTabs = await chrome.tabs.query({});
      const exactTab = allTabs.find(tab => tab.url === targetUrl && !tab.pendingUrl);

      if (exactTab) {
        console.log(`[TabManager] ✅ 找到精准匹配的标签页: ${exactTab.id}`);
        return exactTab;
      }

      console.log(`[TabManager] 未找到精准匹配的标签页`);
      return null;
    } catch (error) {
      console.error(`[TabManager] 查找URL失败:`, error);
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
      console.log(`[TabManager] ========== sendMessageToTab ==========`);
      console.log(`[TabManager] tabId: ${tabId}`);
      console.log(`[TabManager] message.type: ${message.type}`);
      console.log(`[TabManager] timeout: ${timeout}ms`);

      // 检查标签页是否存在
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error(`标签页 ${tabId} 不存在`);
      }

      console.log(`[TabManager] 标签页状态: ${tab.status}, URL: ${tab.url}`);

      // 先发送ping消息检测content script是否已加载
      try {
        console.log(`[TabManager] 📡 发送 Ping...`);
        const pingResponse = await Promise.race([
          chrome.tabs.sendMessage(tabId, { type: 'ping' }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ping超时')), 10000)
          )
        ]);
        console.log(`[TabManager] ✅ Ping成功:`, pingResponse);
      } catch (pingError) {
        console.error(`[TabManager] ❌ Ping失败，Content Script可能未注入:`, pingError);
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
  async sendToPlatform(platform, messageType, data = {}, forceNewTab = false, targetUrl = null) {
    try {
      // 确保标签页已打开
      console.log(`[TabManager] 正在打开 ${platform} 标签页... (forceNew: ${forceNewTab}, targetUrl: ${targetUrl || 'none'})`);
      const tab = await this.openPlatformTab(platform, forceNewTab, targetUrl);
      console.log(`[TabManager] ${platform} 标签页已打开:`, tab.id);

      // 等待content script初始化和页面加载
      console.log(`[TabManager] 等待 ${platform} 页面加载...`);
      await this.sleep(3000); // 增加等待时间到3秒

      // 尝试ping几次，确保content script已就绪
      let pingSuccess = false;
      for (let i = 0; i < 5; i++) {
        try {
          console.log(`[TabManager] Ping尝试 ${i + 1}/5...`);
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
          if (pingResponse && pingResponse.status === 'ok') {
            console.log(`[TabManager] Ping成功!`);
            pingSuccess = true;
            break;
          }
        } catch (pingError) {
          console.warn(`[TabManager] Ping ${i + 1} 失败，等待后重试...`);
          if (i < 4) {
            await this.sleep(2000); // 等待2秒后重试
          }
        }
      }

      if (!pingSuccess) {
        throw new Error('Content Script未就绪，请刷新AI网站页面');
      }

      // 如果是复用的标签页（不是新建的），再等待一段时间确保页面稳定
      if (!forceNewTab) {
        console.log(`[TabManager] 复用标签页，额外等待页面稳定...`);
        await this.sleep(2000);
      }

      // 发送消息
      const message = {
        type: messageType,
        ...data
      };

      console.log(`[TabManager] 向 ${platform} 发送消息:`, messageType);

      // 如果是sendMessage，使用异步等待模式
      if (messageType === 'sendMessage') {
        // 使用时间戳+随机数+平台名称生成唯一ID
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${platform}`;
        console.log(`[TabManager] ========== 创建异步等待Promise ==========`);
        console.log(`[TabManager] messageId: ${messageId}`);
        console.log(`[TabManager] 当前pendingResponses数量: ${pendingResponses.size}`);

        // 创建等待Promise
        const responsePromise = new Promise((resolve, reject) => {
          pendingResponses.set(messageId, { resolve, reject });
          console.log(`[TabManager] ✅ 已将messageId存入pendingResponses`);

          // 3分钟超时
          setTimeout(() => {
            if (pendingResponses.has(messageId)) {
              console.log(`[TabManager] ❌ messageId ${messageId} 超时（180秒）`);
              pendingResponses.delete(messageId);
              reject(new Error('等待AI回复超时（180秒）'));
            }
          }, 180000);
        });

        // 在消息中包含messageId
        message.messageId = messageId;

        console.log(`[TabManager] 发送消息到content-script, messageId: ${messageId}`);
        // 发送消息到content-script（会立刻返回）
        await chrome.tabs.sendMessage(tab.id, message);

        console.log(`[TabManager] ⏳ 等待AI响应（messageId: ${messageId}）`);

        // 等待content-script异步返回
        const response = await responsePromise;
        console.log(`[TabManager] ✅ 收到AI响应:`, response.content?.substring(0, 50) || '(no content)');
        console.log(`[TabManager] response.success:`, response?.success);
        console.log(`[TabManager] response.conversationUrl:`, response?.conversationUrl || 'none');

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
  async sendMessage(platform, content, forceNewTab = false, targetUrl = null) {
    console.log(`[TabManager] ========== sendMessage ==========`);
    console.log(`[TabManager] platform: ${platform}`);
    console.log(`[TabManager] content 长度: ${content.length}`);
    console.log(`[TabManager] forceNewTab: ${forceNewTab}`);
    console.log(`[TabManager] targetUrl: ${targetUrl || 'none'}`);

    return await this.sendToPlatform(platform, 'sendMessage', { content }, forceNewTab, targetUrl);
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

  async createConversation(name, roleIds, contextMode = null) {
    const conversations = await StorageManager.getConversations();

    const newConversation = {
      id: this.generateId(),
      name: name || `会话 ${conversations.length + 1}`,
      roleIds: roleIds || [],
      contextMode: contextMode || null, // 会话级别的上下文模式
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
      conversation.updatedAt = Date.now();
      await StorageManager.saveConversations(conversations);
      return conversation;
    }

    return null;
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
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation) {
      console.error(`[ConversationManager] 未找到会话: ${conversationId}`);
      console.error(`[ConversationManager] 当前会话列表:`, conversations.map(c => ({ id: c.id, name: c.name })));
    }
    
    return conversation;
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
    console.log('[AIMessageManager] ========== processUserMessage 开始 ==========');
    console.log('[AIMessageManager] conversationId:', conversationId);
    console.log('[AIMessageManager] userMessage:', userMessage);
    
    let conversation = await this.conversationManager.getConversation(conversationId);
    if (!conversation || !conversation.roleIds || conversation.roleIds.length === 0) {
      throw new Error('会话没有关联的角色');
    }

    console.log('[AIMessageManager] roleIds:', conversation.roleIds);

    // 获取设置
    const settings = await StorageManager.getSettings();
    // 使用会话的上下文模式，如果没有则使用全局设置
    const contextMode = conversation.contextMode || settings.contextMode || 'self';
    const useFloatWindow = settings.floatWindow !== false; // 默认使用浮动窗口
    // 使用会话的发送模式，如果没有则使用默认并行模式
    const sendMode = conversation.sendMode || 'parallel';

    console.log(`[AIMessageManager] 上下文模式: ${contextMode} (来源: ${conversation.contextMode ? '会话' : '全局设置'}), 浮动窗口: ${useFloatWindow}, 发送模式: ${sendMode}`);

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

    // 根据发送模式选择不同的策略
    if (sendMode === 'parallel') {
      // 并行模式：同时发送到所有角色
      await this.sendToRolesParallel(conversation, roles, userMessage, contextMode, useFloatWindow, conversationId);
    } else if (sendMode === 'sequential') {
      // 顺序模式：按角色列表顺序依次发送
      await this.sendToRolesSequential(conversation, roles, userMessage, contextMode, useFloatWindow, conversationId);
    } else if (sendMode === 'random') {
      // 随机模式：随机打乱顺序后依次发送
      await this.sendToRolesRandom(conversation, roles, userMessage, contextMode, useFloatWindow, conversationId);
    }

    console.log('[AIMessageManager] ========== 所有角色处理完成 ==========');

    // 延迟一下，确保所有消息都已保存到storage
    await new Promise(resolve => setTimeout(resolve, 500));

    // 返回更新后的会话
    const updatedConversation = await this.conversationManager.getConversation(conversationId);
    console.log('[AIMessageManager] 返回的会话消息数:', updatedConversation?.messages?.length || 0);
    return updatedConversation;
  }

  // 并行发送到所有角色
  async sendToRolesParallel(conversation, roles, userMessage, contextMode, useFloatWindow, conversationId) {
    console.log('[AIMessageManager] 使用并行模式发送消息');

    const sendPromises = conversation.roleIds.map(async (roleId) => {
      return await this.sendMessageToRole(roleId, roles, conversation, userMessage, contextMode, useFloatWindow, conversationId);
    });

    console.log('[AIMessageManager] 等待所有角色完成...');
    // 等待所有角色完成（不管成功失败）
    await Promise.allSettled(sendPromises);
  }

  // 顺序发送到所有角色（角色接龙模式）
  async sendToRolesSequential(conversation, roles, userMessage, contextMode, useFloatWindow, conversationId) {
    console.log('[AIMessageManager] 使用顺序模式发送消息（角色接龙）');

    const roleOrder = conversation.roleOrder || conversation.roleIds;
    console.log('[AIMessageManager] 角色顺序:', roleOrder);

    for (let i = 0; i < roleOrder.length; i++) {
      const roleId = roleOrder[i];
      console.log(`[AIMessageManager] 发送到第 ${i + 1}/${roleOrder.length} 个角色`);

      await this.sendMessageToRole(roleId, roles, conversation, userMessage, contextMode, useFloatWindow, conversationId, true);

      conversation = await this.conversationManager.getConversation(conversationId);
      console.log(`[AIMessageManager] 已更新conversation，当前消息数: ${conversation.messages.length}`);
    }
  }

  // 随机顺序发送到所有角色（角色接龙模式）
  async sendToRolesRandom(conversation, roles, userMessage, contextMode, useFloatWindow, conversationId) {
    console.log('[AIMessageManager] 使用随机模式发送消息（角色接龙）');

    const baseRoleIds = conversation.roleOrder || conversation.roleIds;
    const shuffledRoleIds = [...baseRoleIds].sort(() => Math.random() - 0.5);
    console.log('[AIMessageManager] 随机顺序:', shuffledRoleIds);

    for (let i = 0; i < shuffledRoleIds.length; i++) {
      const roleId = shuffledRoleIds[i];
      console.log(`[AIMessageManager] 发送到第 ${i + 1}/${shuffledRoleIds.length} 个角色`);

      await this.sendMessageToRole(roleId, roles, conversation, userMessage, contextMode, useFloatWindow, conversationId, true);

      conversation = await this.conversationManager.getConversation(conversationId);
      console.log(`[AIMessageManager] 已更新conversation，当前消息数: ${conversation.messages.length}`);
    }
  }

  // 发送消息到单个角色
  async sendMessageToRole(roleId, roles, conversation, userMessage, contextMode, useFloatWindow, conversationId, includeAllHistory = false) {
    const role = roles.find(r => r.id === roleId);
    if (!role) return null;

    try {
      console.log(`[AIMessageManager] ========== 发送到 ${role.provider} (${role.name}) ==========`);
      console.log(`[AIMessageManager] roleId: ${roleId}, provider: ${role.provider}`);
      console.log(`[AIMessageManager] role.conversationUrl: ${role.conversationUrl || 'none'}`);

      let messageToSend = userMessage;
      let forceNewTab = false;
      let targetUrl = null;

      if (contextMode === 'self' && role.conversationUrl) {
        targetUrl = role.conversationUrl;
        console.log(`[AIMessageManager] 使用保存的会话URL: ${targetUrl}`);
      }

      if (contextMode === 'full') {
        messageToSend = this.formatConversationWithHistory(conversation, role.id, includeAllHistory, roles);
        forceNewTab = true;
      }

      console.log(`[AIMessageManager] forceNewTab: ${forceNewTab}, targetUrl: ${targetUrl || 'none'}`);
      console.log(`[AIMessageManager] messageToSend 长度: ${messageToSend.length}`);

      // 非完整上下文模式才单独添加systemPrompt（完整模式下已内嵌到格式中）
      if (contextMode !== 'full' && role.systemPrompt) {
        messageToSend = `${role.systemPrompt}\n\n${messageToSend}`;
        console.log(`[AIMessageManager] 添加了systemPrompt，新长度: ${messageToSend.length}`);
      }

      console.log(`[AIMessageManager] ⏳ 调用 tabManager.sendMessage...`);

      // 调用sendMessage，内部已经有30秒超时控制
      const response = await this.tabManager.sendMessage(role.provider, messageToSend, forceNewTab, targetUrl);

      console.log(`[AIMessageManager] ✅ 收到 ${role.name} 响应`);
      console.log(`[AIMessageManager] response.success:`, response?.success);
      console.log(`[AIMessageManager] response.content 长度:`, response?.content?.length || 0);
      console.log(`[AIMessageManager] response.conversationUrl:`, response?.conversationUrl || 'none');

      if (response && response.success) {
        // 如果返回了会话URL且角色没有保存过，保存到角色数据
        if (response.conversationUrl && !role.conversationUrl) {
          console.log(`[AIMessageManager] 💾 保存会话URL到角色 ${role.name}: ${response.conversationUrl}`);
          role.conversationUrl = response.conversationUrl;
          await StorageManager.saveRoles(roles);
        }
        console.log(`[AIMessageManager] 💾 保存 ${role.name} 的消息到conversation...`);
        await this.conversationManager.addMessage(conversationId, roleId, response.content, false);
        console.log(`[AIMessageManager] ✅ ${role.name} 消息已保存`);

        if (useFloatWindow) {
          await this.sendToFloatWindow('addMessage', {
            role: role.name, content: response.content, isUser: false, isError: false, provider: role.provider
          });
        }
      } else {
        console.warn(`[AIMessageManager] ⚠️ ${role.name} 响应失败或无内容`);
      }
    } catch (error) {
      console.error(`[AIMessageManager] ❌ ${role.provider} 失败:`, error);
      console.error(`[AIMessageManager] 错误堆栈:`, error.stack);
      // 显示错误但不中断其他角色
    }
  }

  // 发送消息到浮动窗口
  async sendToFloatWindow(action, data) {
    try {
      console.log(`[AIMessageManager] ========== 发送到浮动窗口 ==========`);
      console.log(`[AIMessageManager] action: ${action}`);
      console.log(`[AIMessageManager] data:`, data);
      
      // 查找所有标签页，找到有浮动窗口的
      const tabs = await chrome.tabs.query({});
      console.log(`[AIMessageManager] 查找到 ${tabs.length} 个标签页`);
      
      let success = false;
      let triedCount = 0;
      
      for (const tab of tabs) {
        // 排除AI平台网站（它们有自己的content script）
        const isAIPlatform = tab.url && (
          tab.url.includes('deepseek.com') ||
          tab.url.includes('doubao.com') ||
          tab.url.includes('qianwen.com') ||
          tab.url.includes('chatgpt.com')
        );

        // 排除特殊页面
        const isSpecialPage = tab.url && (
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')
        );

        if (!isAIPlatform && !isSpecialPage && tab.url && tab.url.startsWith('http')) {
          triedCount++;
          console.log(`[AIMessageManager] 尝试发送到标签页 ${tab.id}: ${tab.url}`);
          
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action,
              ...data
            });
            
            console.log(`[AIMessageManager] ✅ 发送到浮动窗口成功:`, tab.url);
            success = true;
            return; // 找到一个就返回
          } catch (e) {
            // 该标签页没有浮动窗口，继续查找
            console.log(`[AIMessageManager] ⚠️ 标签页 ${tab.id} 发送失败:`, e.message);
            continue;
          }
        }
      }
      
      if (!success) {
        console.warn(`[AIMessageManager] ⚠️ 未找到浮动窗口，消息未显示`);
        console.warn(`[AIMessageManager] 尝试了 ${triedCount} 个标签页，都失败了`);
        console.warn(`[AIMessageManager] 当前打开的标签页:`);
        tabs.forEach(tab => {
          console.warn(`[AIMessageManager]   - ${tab.url}`);
        });
        console.warn(`[AIMessageManager] 提示：请在一个非AI平台的普通网页上（如百度、谷歌等）打开插件，浮动窗口会自动显示`);
      }
    } catch (error) {
      console.error(`[AIMessageManager] 发送到浮动窗口失败:`, error);
    }
  }

  // 格式化对话历史（完整上下文模式）
  formatConversationWithHistory(conversation, roleId, includeAllHistory = false, roles = []) {
    const roleMessages = includeAllHistory
      ? conversation.messages
      : conversation.messages.filter(m => m.roleId === roleId || m.isUser);

    const roleNameMap = {};
    roles.forEach(r => { roleNameMap[r.id] = r.name; });

    const currentRole = roles.find(r => r.id === roleId);
    const currentRoleName = currentRole?.name || '';

    const roleNames = (conversation.roleIds || [])
      .map(id => roleNameMap[id])
      .filter(Boolean);
    let formatted = `当前我们在一个会话里，会话里有成员 user、${roleNames.join('、')}\n`;
    formatted += `你的当前会话名称是：${currentRoleName}\n`;
    if (currentRole?.systemPrompt) {
      formatted += `你的角色设定：${currentRole.systemPrompt}\n`;
    }
    formatted += '\n下面是当前会话的历史内容：\n\n';

    if (roleMessages.length > 0) {
      roleMessages.forEach(msg => {
        if (msg.isUser) {
          formatted += `User: ${msg.content}\n\n`;
        } else {
          formatted += `${roleNameMap[msg.roleId] || 'Assistant'}: ${msg.content}\n\n`;
        }
      });
    }

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

  // 清除会话内容和重置角色URL
  async clearConversation(conversationId) {
    console.log('[AIMessageManager] ========== clearConversation ==========');
    console.log('[AIMessageManager] conversationId:', conversationId);

    try {
      const conversation = await this.conversationManager.getConversation(conversationId);
      if (!conversation) {
        throw new Error('会话不存在');
      }

      console.log('[AIMessageManager] roleIds:', conversation.roleIds);

      // 重置所有关联角色的 conversationUrl
      const roles = await StorageManager.getRoles();
      let updatedRoles = false;

      for (const roleId of conversation.roleIds) {
        const role = roles.find(r => r.id === roleId);
        if (role && role.conversationUrl) {
          console.log(`[AIMessageManager] 重置角色 ${role.name} 的 conversationUrl`);
          role.conversationUrl = null;
          updatedRoles = true;
        }
      }

      if (updatedRoles) {
        await StorageManager.saveRoles(roles);
        console.log('[AIMessageManager] 已保存角色更新');
      }

      // 清除会话的所有消息
      const updatedConversation = await this.conversationManager.clearConversationMessages(conversationId);
      console.log('[AIMessageManager] 已清除会话消息');

      return updatedConversation;
    } catch (error) {
      console.error('[AIMessageManager] 清除会话失败:', error);
      throw error;
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
  console.log('[Background] ========== 收到消息 ==========');
  console.log('[Background] action:', request.action || request.type);
  console.log('[Background] sender:', sender.tab?.url || 'background/popup');

  // 处理来自content-script的异步响应
  if (request.type === 'aiResponse') {
    console.log('[Background] ========== 收到 aiResponse ==========');
    console.log('[Background] platform:', request.platform);
    console.log('[Background] messageId:', request.messageId);
    console.log('[Background] content长度:', request.content?.length || 0);
    console.log('[Background] error:', request.error);

    // 查找对应的pending Promise
    const pending = pendingResponses.get(request.messageId);
    console.log('[Background] pendingResponses Map 大小:', pendingResponses.size);
    console.log('[Background] 找到pending:', !!pending);
    console.log('[Background] 当前的pending messageIds:', Array.from(pendingResponses.keys()));

    if (pending) {
      console.log('[Background] ✅ 找到对应的pending Promise，准备resolve');
      pendingResponses.delete(request.messageId);
      console.log('[Background] 已从pendingResponses删除 messageId');

      if (request.error) {
        console.log('[Background] ❌ AI返回错误，reject promise');
        pending.reject(new Error(request.error));
      } else {
        console.log('[Background] ✅ AI返回成功，resolve promise');
        console.log('[Background] response:', request.content);
        // request.content 现在是 { success: true, content: "...", conversationUrl: "..." }
        pending.resolve(request.content);
      }

      sendResponse({ status: 'received' });
      console.log('[Background] ✅ 已发送received确认给content script');
    } else {
      console.error('[Background] ❌ 未找到对应的pending Promise, messageId:', request.messageId);
      console.error('[Background] 当前的pending messageIds:', Array.from(pendingResponses.keys()));
      sendResponse({ status: 'no_matching_promise' });
    }
    return;
  }

  switch (request.action) {
    case 'createConversation':
      conversationManager.createConversation(request.name, request.roleIds, request.contextMode)
        .then(sendResponse);
      return true;

    case 'deleteConversation':
      conversationManager.deleteConversation(request.conversationId)
        .then(() => sendResponse({ success: true }));
      return true;

    case 'updateConversation':
      conversationManager.updateConversation(request.conversationId, request.updates)
        .then(conversation => sendResponse(conversation));
      return true;

    case 'clearConversation':
      aiMessageManager.clearConversation(request.conversationId)
        .then(conversation => sendResponse(conversation))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'addMessage':
      console.log('[Background] ========== 处理 addMessage ==========');
      console.log('[Background] conversationId:', request.conversationId);
      console.log('[Background] content:', request.content);
      
      aiMessageManager.processUserMessage(request.conversationId, request.content)
        .then(result => {
          console.log('[Background] ✅ addMessage成功');
          sendResponse(result);
        })
        .catch(error => {
          console.error('[Background] ❌ addMessage失败:', error);
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

    case 'activatePlatformTab':
      tabManager.activatePlatformTab(request.provider)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
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

// 点击插件图标打开侧边栏
if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
} else {
  console.warn('[Extension] chrome.action.onClicked is not available');
}

// 启动
init();

// 向所有已打开的页面注入浮动窗口content script
async function injectFloatingWindowToAllTabs() {
  try {
    console.log('[Background] ========== 注入浮动窗口到所有页面 ==========');
    const tabs = await chrome.tabs.query({});
    console.log(`[Background] 找到 ${tabs.length} 个标签页`);
    
    let injectedCount = 0;
    
    for (const tab of tabs) {
      // 排除特殊页面和AI平台
      const isAIPlatform = tab.url && (
        tab.url.includes('deepseek.com') ||
        tab.url.includes('doubao.com') ||
        tab.url.includes('qianwen.com') ||
        tab.url.includes('chatgpt.com')
      );
      
      const isSpecialPage = tab.url && (
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:')
      );
      
      if (!isAIPlatform && !isSpecialPage && tab.url && tab.url.startsWith('http')) {
        console.log(`[Background] 检查标签页 ${tab.id}: ${tab.url}`);
        
        try {
          // 先尝试ping，看浮动窗口是否已经注入
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          
          if (pingResponse && pingResponse.status === 'ok') {
            console.log(`[Background] 标签页 ${tab.id} 已有浮动窗口，跳过`);
          } else {
            console.log(`[Background] 标签页 ${tab.id} ping响应异常，尝试注入`);
          }
        } catch (pingError) {
          // ping失败，说明浮动窗口content script未注入，尝试注入
          console.log(`[Background] 标签页 ${tab.id} 未注入浮动窗口，开始注入...`);
          
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['utils/floating-window.js', 'utils/floating-content.js']
            });
            console.log(`[Background] ✅ 标签页 ${tab.id} 注入成功`);
            injectedCount++;
          } catch (injectError) {
            console.log(`[Background] ❌ 标签页 ${tab.id} 注入失败:`, injectError.message);
          }
        }
      }
    }
    
    console.log(`[Background] ========== 注入完成，成功注入 ${injectedCount} 个标签页 ==========`);
  } catch (error) {
    console.error('[Background] 注入浮动窗口失败:', error);
  }
}

// 插件安装或启动时，向所有已打开的页面注入浮动窗口content script
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] 插件启动');
  // 等待一段时间确保background初始化完成
  setTimeout(async () => {
    await injectFloatingWindowToAllTabs();
  }, 1000);
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] 插件安装');
  // 等待一段时间确保background初始化完成
  setTimeout(async () => {
    await injectFloatingWindowToAllTabs();
  }, 1000);
});
