// 设置管理
const wsUrlInput = document.getElementById('wsUrlInput');
const wsEnabledCheckbox = document.getElementById('wsEnabledCheckbox');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const reconnectBtn = document.getElementById('reconnectBtn');
const settingsHeader = document.getElementById('settingsHeader');
const settingsToggle = document.getElementById('settingsToggle');
const settingsContent = document.getElementById('settingsContent');
const wsStatus = document.getElementById('wsStatus');
const wsStatusText = document.getElementById('wsStatusText');

// 切换设置面板
settingsHeader.addEventListener('click', () => {
  settingsContent.classList.toggle('show');
  settingsToggle.classList.toggle('expanded');
});

// 加载设置
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response) {
      wsUrlInput.value = response.wsUrl || 'ws://localhost:8080';
      wsEnabledCheckbox.checked = response.wsEnabled || false;
      updateWSStatus(response.wsConnected || false);
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    wsUrlInput.value = 'ws://localhost:8080';
    wsEnabledCheckbox.checked = false;
  }
}

// 保存设置
saveSettingsBtn.addEventListener('click', async () => {
  try {
    const settings = {
      wsUrl: wsUrlInput.value.trim(),
      wsEnabled: wsEnabledCheckbox.checked
    };

    await chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: settings
    });

    // 显示保存成功提示
    const originalText = saveSettingsBtn.textContent;
    saveSettingsBtn.textContent = '已保存 ✓';
    saveSettingsBtn.style.background = 'linear-gradient(135deg, #34c759 0%, #30b350 100%)';
    
    setTimeout(() => {
      saveSettingsBtn.textContent = originalText;
      saveSettingsBtn.style.background = '';
    }, 2000);

    // 如果启用了 WebSocket，重新连接
    if (settings.wsEnabled) {
      await chrome.runtime.sendMessage({ action: 'reconnectWebSocket' });
    } else {
      await chrome.runtime.sendMessage({ action: 'disconnectWebSocket' });
    }

  } catch (error) {
    console.error('保存设置失败:', error);
    saveSettingsBtn.textContent = '保存失败 ✗';
    setTimeout(() => {
      saveSettingsBtn.textContent = '保存设置';
    }, 2000);
  }
});

// 更新 WebSocket 状态显示
function updateWSStatus(connected, reconnectInfo = null) {
  if (connected) {
    wsStatus.className = 'ws-status connected';
    wsStatusText.textContent = '已连接';
    reconnectBtn.style.display = 'none';
    saveSettingsBtn.style.flex = '1';
  } else if (reconnectInfo && reconnectInfo.isReconnecting) {
    wsStatus.className = 'ws-status reconnecting';
    const delay = Math.round(reconnectInfo.delay / 1000);
    wsStatusText.textContent = `重连中 (${reconnectInfo.attempt}次) ${delay}s`;
    reconnectBtn.style.display = 'block';
    saveSettingsBtn.style.flex = '1';
  } else {
    wsStatus.className = 'ws-status disconnected';
    wsStatusText.textContent = '未连接';
    reconnectBtn.style.display = 'block';
    saveSettingsBtn.style.flex = '1';
  }
}

// 立即重连按钮
reconnectBtn.addEventListener('click', async () => {
  try {
    reconnectBtn.textContent = '重连中...';
    reconnectBtn.disabled = true;
    
    await chrome.runtime.sendMessage({ action: 'reconnectWebSocket' });
    
    setTimeout(() => {
      reconnectBtn.textContent = '立即重连';
      reconnectBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('重连失败:', error);
    reconnectBtn.textContent = '重连失败';
    setTimeout(() => {
      reconnectBtn.textContent = '立即重连';
      reconnectBtn.disabled = false;
    }, 2000);
  }
});

// 定期更新 WebSocket 状态
let statusCheckInterval = null;

function startStatusCheck() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  
  statusCheckInterval = setInterval(async () => {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'getWSStatus' });
      if (status) {
        updateWSStatus(status.connected, {
          isReconnecting: status.isReconnecting,
          attempt: status.reconnectAttempts,
          delay: status.reconnectDelay
        });
      }
    } catch (error) {
      console.error('获取 WS 状态失败:', error);
    }
  }, 1000); // 每秒更新一次
}

// 监听 WebSocket 状态变化
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'wsStatusChanged') {
    updateWSStatus(message.connected, message.reconnectInfo);
  }
});

// 页面加载时开始状态检查
document.addEventListener('DOMContentLoaded', () => {
  startStatusCheck();
});

// 页面卸载时停止状态检查
window.addEventListener('beforeunload', () => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
});

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

// 页面加载时初始化
loadSettings();

// 定期更新 WebSocket 状态
setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getWSStatus' });
    if (response && typeof response.connected === 'boolean') {
      updateWSStatus(response.connected);
    }
  } catch (error) {
    // Ignore errors during status check
  }
}, 3000);
