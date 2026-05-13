// 打开侧边栏
document.getElementById('openSidePanelBtn').addEventListener('click', async () => {
  try {
    // 获取当前窗口
    const currentWindow = await chrome.windows.getCurrent();
    // 打开侧边栏
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    window.close();
  } catch (error) {
    console.error('打开侧边栏失败:', error);
    // 如果失败，显示提示并引导用户
    const message = `
无法自动打开侧边栏，请尝试以下方法：

方法1：使用快捷键
按 Ctrl+Shift+S

方法2：通过菜单
1. 点击浏览器工具栏（右上角）
2. 找到"侧边栏"或扩展图标
3. 选择"多模型AI对话助手"

方法3：直接访问
在地址栏输入：edge://sidebar

提示：确保插件已启用并刷新页面。
    `;
    alert(message.trim());
  }
});

// 新建对话
document.getElementById('newChatBtn').addEventListener('click', async () => {
  try {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-').replace(/,\s*/g, ' ');

    let allRoleIds = [];

    try {
      const roles = await chrome.runtime.sendMessage({ action: 'getRoles' });
      if (roles && roles.length > 0) {
        allRoleIds = roles.map(role => role.id);
      }
    } catch (error) {
      console.warn('获取角色列表失败，使用空角色列表:', error);
    }

    const response = await chrome.runtime.sendMessage({
      action: 'createConversation',
      name: timeString,
      roleIds: allRoleIds
    });

    if (response && response.id) {
      chrome.tabs.create({
        url: chrome.runtime.getURL(`chat/chat.html?id=${response.id}`)
      });
      window.close();
    }
  } catch (error) {
    console.error('创建对话失败:', error);
  }
});

// 检查连接状态
chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = '';
  statusEl.className = 'status connected';
});
