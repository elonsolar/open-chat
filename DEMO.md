# 🎬 演示说明

## 插件工作原理演示

### 场景：用户发送一条消息

```
┌─────────────────────────────────────────────────────────────┐
│                      用户操作流程                            │
└─────────────────────────────────────────────────────────────┘

1. 用户在聊天页面输入: "如何学习Python？"
   ↓
2. 点击"发送"按钮
   ↓
3. 消息发送到插件后台
```

```
┌─────────────────────────────────────────────────────────────┐
│                   插件后台处理                              │
└─────────────────────────────────────────────────────────────┘

4. Background 接收消息
   ↓
5. 查询会话信息，发现有3个角色：
   - DeepSeek助手
   - 豆包编程专家
   - 千问老师
   ↓
6. 保存用户消息到本地存储
   ↓
7. 为每个角色执行以下操作...
```

```
┌─────────────────────────────────────────────────────────────┐
│              DeepSeek 助手处理流程                          │
└─────────────────────────────────────────────────────────────┘

8a. TabManager 检查 DeepSeek 标签页
    ↓
9a. 如果没有打开，自动创建标签页
    - URL: https://chat.deepseek.com
    - 在后台打开（不聚焦）
    ↓
10a. 等待页面加载完成
    ↓
11a. 通过 chrome.tabs.sendMessage 发送消息到 Content Script
    {
      type: "sendMessage",
      content: "如何学习Python？"
    }
    ↓
12a. Content Script 接收消息
    ↓
13a. AIPlatformAdapter 执行 DOM 操作：
    a. 找到输入框元素
       选择器: 'textarea[placeholder*="输入"]'
    b. 设置输入框的值
       inputBox.value = "如何学习Python？"
    c. 触发 input 事件
       inputBox.dispatchEvent(new Event('input'))
    d. 点击发送按钮
       sendButton.click()
    ↓
14a. MutationObserver 监听页面变化
    - 等待新的 AI 消息出现
    - 提取消息内容
    ↓
15a. Content Script 返回回复
    chrome.runtime.sendMessage({
      type: "message",
      content: "学习Python的建议..."
    })
    ↓
16a. Background 保存 DeepSeek 的回复
```

```
┌─────────────────────────────────────────────────────────────┐
│              豆包编程专家处理流程                            │
└─────────────────────────────────────────────────────────────┘

8b. TabManager 检查豆包标签页
    ↓
9b. 重复步骤 10a-16a（但使用豆包的选择器）
```

```
┌─────────────────────────────────────────────────────────────┐
│                千问老师处理流程                             │
└─────────────────────────────────────────────────────────────┘

8c. TabManager 检查千问标签页
    ↓
9c. 重复步骤 10a-16a（但使用千问的选择器）
```

```
┌─────────────────────────────────────────────────────────────┐
│                   返回结果给用户                            │
└─────────────────────────────────────────────────────────────┘

17. 所有AI都回复完毕
    ↓
18. Background 返回更新后的会话给聊天页面
    ↓
19. 聊天页面渲染所有消息：
    ┌──────────────────────────────────────┐
    │ 我: 如何学习Python？                 │
    ├──────────────────────────────────────┤
    │ DeepSeek助手: 学习Python的建议...    │
    │ [DeepSeek]                           │
    ├──────────────────────────────────────┤
    │ 豆包编程专家: 我的建议是...          │
    │ [豆包]                               │
    ├──────────────────────────────────────┤
    │ 千问老师: Python是一门...            │
    │ [千问]                               │
    └──────────────────────────────────────┘
```

---

## 技术细节

### 1. Content Script 注入

当用户访问 AI 网站时，插件自动注入两个脚本：

```javascript
// manifest.json
"content_scripts": [{
  "matches": ["https://chat.deepseek.com/*"],
  "js": [
    "utils/platform-adapter.js",  // AI平台适配器
    "utils/content-script.js"     // 消息处理
  ],
  "run_at": "document_idle"
}]
```

### 2. DOM 操作示例

```javascript
// platform-adapter.js

// 找到输入框
const inputBox = document.querySelector('textarea[placeholder*="输入"]');
inputBox.value = userMessage;
inputBox.dispatchEvent(new Event('input'));

// 点击发送
const sendButton = document.querySelector('button[type="submit"]');
sendButton.click();

// 等待回复
const observer = new MutationObserver(() => {
  const aiMessage = document.querySelector('[class*="ai"]');
  if (aiMessage && aiMessage.textContent.length > 0) {
    resolve(aiMessage.textContent);
  }
});
```

### 3. 跨页面通信

```javascript
// Background → Content Script
chrome.tabs.sendMessage(tabId, {
  type: "sendMessage",
  content: "你好"
});

// Content Script → Background
chrome.runtime.sendMessage({
  type: "response",
  content: "收到回复"
});
```

### 4. 等待机制

```javascript
// 使用 MutationObserver 等待AI回复
async waitForResponse(timeout = 60000) {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const messages = document.querySelectorAll('[class*="ai"]');
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.textContent.trim().length > 0) {
          observer.disconnect();
          resolve(lastMessage.textContent);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error('超时'));
    }, timeout);
  });
}
```

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Sidepanel│  │  Chat    │  │  Popup   │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │              │              │                        │
└───────┼──────────────┼──────────────┼────────────────────────┘
        │              │              │
        └──────────────┴──────────────┘
                       │
                  chrome.runtime.sendMessage
                       │
┌─────────────────────────────────────────────────────────────┐
│                   业务逻辑层                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Background Service Worker                  │  │
│  │  ┌──────────────┐  ┌──────────────┐                 │  │
│  │  │ TabManager   │  │Conversation  │                 │  │
│  │  │              │  │   Manager    │                 │  │
│  │  └──────┬───────┘  └──────┬───────┘                 │  │
│  │         │                  │                          │  │
│  │  ┌──────┴───────┐  ┌──────┴───────┐                 │  │
│  │  │   Role       │  │    AI        │                 │  │
│  │  │   Manager    │  │   Message    │                 │  │
│  │  │              │  │   Manager    │                 │  │
│  │  └──────────────┘  └──────────────┘                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       │
                  chrome.tabs.create
                  chrome.tabs.sendMessage
                       │
┌─────────────────────────────────────────────────────────────┐
│                    AI网站层                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  DeepSeek    │  │   豆包       │  │    千问      │     │
│  │              │  │              │  │              │     │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │     │
│  │ │  Content │ │  │ │  Content │ │  │ │  Content │ │     │
│  │ │  Script  │ │  │ │  Script  │ │  │ │  Script  │ │     │
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │     │
│  │      │       │  │      │       │  │      │       │     │
│  │ ┌────┴─────┐ │  │ ┌────┴─────┐ │  │ ┌────┴─────┐ │     │
│  │ │ Platform │ │  │ │ Platform │ │  │ │ Platform │ │     │
│  │ │ Adapter  │ │  │ │ Adapter  │ │  │ │ Adapter  │ │     │
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │     │
│  └──────┼──────┘  └──────┼──────┘  └──────┼──────┘     │
│         │                │                │               │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐      │
│  │   DOM API   │  │   DOM API   │  │   DOM API   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 时间线

### 发送消息的时间消耗

| 步骤 | 耗时 | 说明 |
|------|------|------|
| 用户点击发送 | < 1ms | 立即响应 |
| 保存到本地存储 | ~10ms | Chrome Storage API |
| 打开AI网站标签页 | 1-3秒 | 仅首次，后续复用 |
| 等待页面加载 | 2-5秒 | 取决于网络 |
| Content Script 初始化 | ~1秒 | 注入和初始化 |
| 输入消息 | < 100ms | DOM操作 |
| 等待AI回复 | 10-30秒 | AI思考时间 |
| 提取回复内容 | < 100ms | DOM查询 |
| 保存到本地 | ~10ms | Chrome Storage API |
| 更新UI | < 50ms | 渲染消息 |
| **总计** | **15-40秒** | 首次较慢，后续更快 |

---

## 优化方向

### 已实现
- ✅ 标签页复用（避免重复打开）
- ✅ 本地缓存（减少重复加载）
- ✅ 异步处理（不阻塞UI）

### 待优化
- [ ] 并行发送（多个AI同时工作）
- [ ] 智能等待（根据AI特点调整）
- [ ] 预加载（提前打开标签页）
- [ ] 增量更新（实时显示AI回复）

---

希望这个演示能帮助你理解插件的工作原理！🎉
