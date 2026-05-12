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
  openai: {
    id: 'openai',
    name: 'ChatGPT',
    baseUrl: 'https://chatgpt.com/',
    domain: 'chatgpt.com',
    defaultModel: 'gpt-4',
    color: '#059669',
    urlPatterns: [
      'https://chatgpt.com/*',
      'https://chat.openai.com/*'
    ]
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROVIDERS;
}
