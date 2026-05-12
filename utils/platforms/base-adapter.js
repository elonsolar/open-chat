class BasePlatformAdapter {
  constructor(platform, selectors) {
    this.platform = platform;
    this.selectors = selectors;
  }

  async sendMessage(content) {
    throw new Error(`${this.platform}: sendMessage() 必须由子类实现`);
  }

  async processSendMessage(content, messageId) {
    throw new Error(`${this.platform}: processSendMessage() 必须由子类实现`);
  }
}
