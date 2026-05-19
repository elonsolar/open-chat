class BasePlatformAdapter {
  constructor(platform, selectors) {
    this.platform = platform;
    this.selectors = selectors;
  }

  static extractMathLatex(node) {
    const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
      return annotation.textContent;
    }

    const el = node.closest('.math-inline, .math-display, [class*="math-inline"], [class*="math-display"]');
    if (el) {
      const copyText = el.getAttribute('copy-text');
      if (copyText) {
        return copyText.replace(/^\\\(|\\\)$/g, '').trim();
      }
    }

    return null;
  }

  async sendMessage(content) {
    throw new Error(`${this.platform}: sendMessage() 必须由子类实现`);
  }

  async processSendMessage(content, messageId) {
    throw new Error(`${this.platform}: processSendMessage() 必须由子类实现`);
  }

  async newChat() {
    const newChatButton = document.querySelector(this.selectors.newChatButton);
    if (!newChatButton) {
      throw new Error('找不到新对话按钮');
    }
    newChatButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
