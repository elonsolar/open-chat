const PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://chat.deepseek.com/',
    domain: 'deepseek.com',
    defaultModel: 'deepseek-chat',
    color: '#4f46e5'
  },
  doubao: {
    id: 'doubao',
    name: '豆包',
    baseUrl: 'https://www.doubao.com/chat/',
    domain: 'doubao.com',
    defaultModel: 'doubao-pro',
    color: '#0891b2'
  },
  qianwen: {
    id: 'qianwen',
    name: '千问',
    baseUrl: 'https://www.qianwen.com/',
    domain: 'qianwen.com',
    defaultModel: 'qwen-plus',
    color: '#7c3aed'
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://www.kimi.com/',
    domain: 'moonshot.cn',
    defaultModel: 'kimi-chat',
    color: '#6366f1'
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROVIDERS;
}
