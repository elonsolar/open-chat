const PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://chat.deepseek.com/',
    domain: 'deepseek.com',
    defaultModel: 'deepseek-chat',
    color: '#4f46e5',
    urlPatterns: [
      'https://chat.deepseek.com/*',
      'https://www.deepseek.com/*',
      'https://deepseek.com/*'
    ]
  },
  doubao: {
    id: 'doubao',
    name: '豆包',
    baseUrl: 'https://www.doubao.com/chat/',
    domain: 'doubao.com',
    defaultModel: 'doubao-pro',
    color: '#0891b2',
    urlPatterns: [
      'https://www.doubao.com/*',
      'https://doubao.com/*'
    ]
  },
  qianwen: {
    id: 'qianwen',
    name: '千问',
    baseUrl: 'https://www.qianwen.com/',
    domain: 'qianwen.com',
    defaultModel: 'qwen-plus',
    color: '#7c3aed',
    urlPatterns: [
      'https://www.qianwen.com/*',
      'https://qianwen.com/*'
    ]
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://www.kimi.com/',
    domain: 'moonshot.cn',
    defaultModel: 'kimi-chat',
    color: '#6366f1',
    urlPatterns: [
      'https://kimi.moonshot.cn/*',
      'https://www.kimi.moonshot.cn/*',
      'https://www.kimi.com/*',
      'https://kimi.com/*'
    ]
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROVIDERS;
}
