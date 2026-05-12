# Open-Chat Agent Guide

Chrome/Edge Manifest V3 extension for multi-model AI chat. Vanilla JS, no build step.

## Development

### Extension
1. `edge://extensions` or `chrome://extensions` → Enable Developer Mode → Load unpacked → select project root
2. Reload extension after code changes (no build/lint/typecheck)

### Server (optional WebSocket relay)
```bash
cd server && npm install
npm start        # ws://localhost:8080
npm run dev      # nodemon auto-restart
```

## Project Structure

```
background/background.js    # Service worker — ALL manager classes in one file
                            # (TabManager, StorageManager, ConversationManager,
                            #  RoleManager, AIMessageManager)
                            # Cannot use external <script> — Service Worker limitation
utils/platforms/            # Per-platform adapter classes
  base-adapter.js           #   BasePlatformAdapter (shared logic)
  deepseek-adapter.js       #   DeepSeekAdapter extends BasePlatformAdapter
  doubao-adapter.js         #   DoubaoAdapter extends BasePlatformAdapter
  qianwen-adapter.js        #   QianwenAdapter extends BasePlatformAdapter
  openai-adapter.js         #   OpenAIAdapter extends BasePlatformAdapter
utils/content-script.js     # Bootstrap: detects platform, factory switch,
                            #   creates adapter, bridges chrome.runtime messages
utils/floating-window.js    # Injected on all non-AI-site pages
utils/floating-content.js   #   (excluded by manifest exclude_matches)
sidepanel/                  # Side panel UI (HTML + JS)
popup/                      # Browser action popup
chat/                       # Full-page chat UI
styles/                     # CSS files
server/                     # Optional Node.js WebSocket server
```

## Content Script Injection Order (critical)

Defined in `manifest.json`. Scripts load in this exact sequence:
1. `utils/platforms/base-adapter.js` — defines `BasePlatformAdapter`
2. `utils/platforms/deepseek-adapter.js` — defines `DeepSeekAdapter`, assigns to `window`
3. `utils/platforms/doubao-adapter.js` — defines `DoubaoAdapter`, assigns to `window`
4. `utils/platforms/qianwen-adapter.js` — defines `QianwenAdapter`, assigns to `window`
5. `utils/platforms/openai-adapter.js` — defines `OpenAIAdapter`, assigns to `window`
6. `utils/content-script.js` — detects platform, factory + bootstrap

## Key Architecture

- **Platform adapters**: Each subclass overrides `countAIMessages()`, `checkForNewContent()`, `fillInput()`, `submitMessage()`, `getConversationHistory()`. Base class handles `waitForResponse()`, `sendMessage()`, `newChat()`, and utility methods.
- **Adding a new platform**: Create `utils/platforms/<name>-adapter.js` extending `BasePlatformAdapter`, register in `content-script.js` `createPlatformAdapter()` switch, add URL matches in `manifest.json`, update `background.js` domain maps (4 locations: `openPlatformTab`, `findPlatformTab`, `sendToFloatWindow`, `chrome.tabs.onUpdated`), update `content-script.js` `detectPlatform()`.
- **End-marker protocol**: `background.js` appends `\n\n重要：请在你的回复最后必须添加 [[<<>>]] 标记` to every message. Adapters watch for `[[<<>>]]` in DOM to detect response completion.
- **Floating window**: Excluded from AI platform sites via `manifest.json` `exclude_matches`.
- **Context modes**: `self` = separate tabs per role, `shared` = all roles see same history
- **Send modes**: `parallel` | `sequential` | `random`

## Common Gotchas

- **Stale files on disk**: `utils/tab-manager.js`, `utils/storage.js`, `utils/platform-adapter.js.backup`, `utils/platform-adapter-new.js`, `utils/platform-adapter.js` are dead code — their logic was merged into `background.js` or replaced by the platform refactor.
- **Selectors break when AI sites update DOM**: Platform adapters use hardcoded CSS selectors. If message send/receive breaks, the platform adapter selectors need updating.
- **SPA re-init**: `content-script.js` uses MutationObserver on `document.body` to detect URL changes and re-initialize. Skipped when `window.isSendingMessage === true`.
- **Provider = platform string**: The UI "provider" dropdown value is passed directly as the `platform` argument — 1:1 mapping, no translation layer.
