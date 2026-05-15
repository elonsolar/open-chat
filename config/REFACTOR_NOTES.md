# 服务提供商配置重构说明

## 概述
已将项目中硬编码的服务提供商信息统一到配置文件中，提高了可维护性和扩展性。

## 新增文件

### config/providers.config.js
统一的服务提供商配置文件，包含以下信息：
- `id`: 服务商唯一标识
- `name`: 显示名称
- `baseUrl`: 打开标签页的基础URL
- `domain`: 用于查找已打开标签页的域名
- `defaultModel`: 默认模型名称
- `color`: UI显示颜色
- `urlPatterns`: 用于manifest.json的URL匹配模式

## 修改的文件

### 1. background/background.js
**变更：**
- 在文件开头添加 `importScripts('config/providers.config.js')`
- 移除 `openPlatformTab()` 方法中的硬编码 `urls` 对象，改用 `PROVIDERS[platform].baseUrl`
- 移除 `findPlatformTab()` 方法中的硬编码 `domains` 对象，改用 `PROVIDERS[platform].domain`
- 移除 `chrome.tabs.onUpdated` 监听器中的硬编码 `domains` 对象

### 2. sidepanel/sidepanel.js
**变更：**
- 移除 `bindEvents()` 中provider选择器事件处理里的 `defaultModels` 对象，改用 `PROVIDERS[e.target.value].defaultModel`
- 移除 `renderRoles()` 方法中的 `providerNames` 和 `providerColors` 对象，改用 `PROVIDERS` 配置
- 移除 `saveRole()` 中的 `defaultModels` 对象，改用 `PROVIDERS[provider].defaultModel`
- 添加 `initProviderSelect()` 函数动态填充provider选择器

### 3. sidepanel/sidepanel.html
**变更：**
- 在 `<script>` 标签列表中添加 `<script src="../config/providers.config.js"></script>`
- 移除provider选择器中的硬编码 `<option>` 元素，改为空选择器由JS动态填充

### 4. chat/chat.js
**变更：**
- 移除全局的 `providerColors` 对象
- 修改 `renderRolesTags()` 方法，改用 `PROVIDERS[role.provider].color`
- 修改 `getProviderDisplayName()` 函数，改用 `PROVIDERS[provider].name`

### 5. chat/chat.html
**变更：**
- 在 `<script>` 标签列表中添加 `<script src="../config/providers.config.js"></script>`

## 未修改的文件

### manifest.json
manifest.json中的 `content_scripts.matches` 和 `exclude_matches` 仍包含硬编码的URL模式。这是正常的，因为：
1. manifest.json是静态文件，不支持动态生成
2. 这些URL模式应该与 `config/providers.config.js` 中的 `urlPatterns` 保持一致
3. 当添加新平台时，需要同时更新这两个文件

### utils/tab-manager.js
这是已弃用的死代码文件，其逻辑已合并到background.js中，无需修改。

## 添加新服务商的步骤

1. 在 `config/providers.config.js` 中添加新的服务商配置
2. 在 `manifest.json` 的 `content_scripts.matches` 和 `exclude_matches` 中添加对应的URL模式
3. 如需要，创建对应的服务商适配器文件（如 `utils/platforms/newprovider-adapter.js`）
4. 在 `utils/platform-adapter.js` 中注册新的适配器
5. 在 `background.js` 中的注入脚本列表中添加新的适配器文件

## 注意事项

- 配置文件使用 `importScripts()` 在Service Worker中加载（background.js）
- 在普通网页环境中使用 `<script>` 标签加载（sidepanel和chat）
- 配置文件包含 `module.exports` 以支持CommonJS环境（虽然当前不使用）
