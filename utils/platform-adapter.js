function createPlatformAdapter(platform) {
  switch (platform) {
    case 'deepseek':
      return new DeepSeekAdapter();
    case 'doubao':
      return new DoubaoAdapter();
    case 'qianwen':
      return new QianwenAdapter();
    case 'openai':
      return new OpenAIAdapter();
    default:
      console.warn(`未知平台: ${platform}，使用doubao作为默认`);
      return new DoubaoAdapter();
  }
}

window.AIPlatformAdapter = function(platform) {
  return createPlatformAdapter(platform);
};
