// 标签页管理器 - 管理AI网站标签页

class TabManager {
  constructor() {
    this.tabs = new Map(); // platform -> tabId
  }

  // 打开AI平台标签页
  async openPlatformTab(platform) {
    const urls = {
      deepseek: 'https://chat.deepseek.com/',
      doubao: 'https://www.coze.com/',
      qianwen: 'https://tongyi.aliyun.com/',
      openai: 'https://chatgpt.com/'
    };

    const url = urls[platform];
    if (!url) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    try {
      // 检查是否已有该平台的标签页
      const existingTab = this.findPlatformTab(platform);
      if (existingTab) {
        // 激活已有标签页
        await chrome.tabs.update(existingTab.id, { active: true });
        console.log(`[TabManager] 激活已有 ${platform} 标签页`);
        return existingTab;
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
  findPlatformTab(platform) {
    const urls = {
      deepseek: 'deepseek.com',
      doubao: 'coze.com',
      qianwen: 'tongyi.aliyun.com',
      openai: 'chatgpt.com'
    };

    const domain = urls[platform];
    if (!domain) return null;

    // 从已存储的标签页ID查找
    const tabId = this.tabs.get(platform);
    if (tabId) {
      return chrome.tabs.get(tabId).catch(() => null);
    }

    return null;
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
  async sendMessageToTab(tabId, message) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      console.error(`[TabManager] 向标签页 ${tabId} 发送消息失败:`, error);
      throw error;
    }
  }

  // 发送消息到指定平台
  async sendToPlatform(platform, messageType, data = {}) {
    try {
      // 确保标签页已打开
      const tab = await this.openPlatformTab(platform);

      // 等待content script初始化
      await this.sleep(2000);

      // 发送消息
      const message = {
        type: messageType,
        ...data
      };

      console.log(`[TabManager] 向 ${platform} 发送消息:`, messageType);
      const response = await this.sendMessageToTab(tab.id, message);

      return response;
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
  async sendMessage(platform, content) {
    return await this.sendToPlatform(platform, 'sendMessage', { content });
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

  // 辅助方法
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出到全局
window.TabManager = TabManager;
