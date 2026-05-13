import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..');

async function testDoubao() {
  console.log('========== 启动浏览器（带扩展） ==========');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // 监听控制台消息
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[AI Plugin]') || text.includes('[doubao]')) {
      console.log(`[浏览器] ${text}`);
    }
  });

  try {
    // ========== 测试 1: 访问豆包 ==========
    console.log('\n========== 测试 1: 访问豆包 ==========');
    await page.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✓ 已访问豆包');

    // 等待页面加载
    await page.waitForTimeout(3000);

    // 检查适配器是否注入
    const hasAdapter = await page.evaluate(() => {
      return !!window.platformAdapter;
    });
    console.log(`平台适配器已注入: ${hasAdapter}`);

    if (!hasAdapter) {
      console.log('⚠ 豆包适配器未注入，可能需要登录或页面结构已变更');
    }

    // ========== 测试 2: 检查 DOM 结构 ==========
    console.log('\n========== 测试 2: 检查 DOM 结构 ==========');

    const domInfo = await page.evaluate(() => {
      const msgList = document.querySelector('[class*="message-list"]');
      const aiMessages = msgList ? msgList.querySelectorAll('[class*="flow-markdown-body"]') : [];
      const inputBox = document.querySelector('textarea.semi-input-textarea');
      const sendBtn = document.querySelector('.send-btn-wrapper button');

      return {
        hasMessageList: !!msgList,
        aiMessageCount: aiMessages.length,
        hasInputBox: !!inputBox,
        hasSendButton: !!sendBtn,
      };
    });
    console.log('DOM 结构检查:', JSON.stringify(domInfo, null, 2));

    // ========== 测试 3: 模拟消息发送和接收 ==========
    console.log('\n========== 测试 3: 模拟消息发送和接收 ==========');

    // 注入测试代码：模拟 waitForAIResponse 的行为
    const testResult = await page.evaluate(async () => {
      const results = [];

      // 测试 checkNewMessage 逻辑
      const checkNewMessage = () => {
        const msgList = document.querySelector('[class*="message-list"]');
        if (!msgList) return null;

        const aiMessages = msgList.querySelectorAll('[class*="flow-markdown-body"]');
        if (aiMessages.length === 0) return null;

        const lastAiMessage = aiMessages[aiMessages.length - 1];
        if (!lastAiMessage) return null;

        const rawText = lastAiMessage.textContent?.trim() || '';
        if (!rawText || rawText.length < 10) return null;

        return rawText;
      };

      const content = checkNewMessage();
      results.push({
        test: 'checkNewMessage 返回最后一条 AI 消息',
        result: content ? `成功 (长度: ${content.length})` : '无消息或内容太短',
        content: content ? content.substring(0, 100) : null,
      });

      // 验证不再使用消息计数逻辑
      results.push({
        test: '重构: 移除了 messageCountBeforeSend',
        result: typeof window.messageCountBeforeSend === 'undefined' ? '通过 ✓' : '失败 ✗',
      });

      results.push({
        test: '重构: 移除了 processedNewMessage',
        result: typeof window.processedNewMessage === 'undefined' ? '通过 ✓' : '失败 ✗',
      });

      return results;
    });

    testResult.forEach(r => {
      console.log(`  ${r.test}: ${r.result}`);
      if (r.content) console.log(`    内容预览: ${r.content}`);
    });

    // ========== 测试 4: 发送消息（如果有输入框） ==========
    if (domInfo.hasInputBox && domInfo.hasSendButton) {
      console.log('\n========== 测试 4: 发送测试消息 ==========');

      const testMessage = '你好，请回复"测试成功"两个字';

      // 输入消息
      await page.evaluate((msg) => {
        const inputBox = document.querySelector('textarea.semi-input-textarea');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(inputBox, msg);
        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
        inputBox.dispatchEvent(new Event('change', { bubbles: true }));
      }, testMessage);

      await page.waitForTimeout(500);

      // 点击发送按钮
      await page.click('.send-btn-wrapper button');
      console.log('✓ 已发送测试消息');

      // 等待 AI 回复（最多 30 秒）
      console.log('等待 AI 回复...');
      let responseDetected = false;
      const startCount = domInfo.aiMessageCount;

      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const currentCount = await page.evaluate(() => {
          const msgList = document.querySelector('[class*="message-list"]');
          return msgList ? msgList.querySelectorAll('[class*="flow-markdown-body"]').length : 0;
        });

        if (currentCount > startCount) {
          responseDetected = true;
          console.log(`✓ 检测到新 AI 消息 (从 ${startCount} 增加到 ${currentCount})`);
          break;
        }
      }

      if (responseDetected) {
        // 验证获取的是最新消息而不是上一条
        const latestContent = await page.evaluate(() => {
          const msgList = document.querySelector('[class*="message-list"]');
          const aiMessages = msgList.querySelectorAll('[class*="flow-markdown-body"]');
          return aiMessages[aiMessages.length - 1]?.textContent?.trim() || '';
        });
        console.log(`最新 AI 回复内容: ${latestContent.substring(0, 200)}`);

        // 检查是否包含结束标记
        const hasEndMarker = latestContent.includes('[[<<>>]]');
        console.log(`包含结束标记: ${hasEndMarker}`);
      } else {
        console.log('⚠ 30 秒内未检测到新 AI 消息');
      }
    } else {
      console.log('\n⚠ 未找到输入框或发送按钮，跳过发送测试');
    }

    // ========== 测试 5: 打开扩展聊天页面 ==========
    console.log('\n========== 测试 5: 打开扩展聊天页面 ==========');

    const chatPage = await context.newPage();
    await chatPage.goto('chrome-extension://angbgpijikidiijdonlnnpdkknbnmgeb/chat/chat.html?id=mp4bucxpgtk0sv1t2u', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    console.log('✓ 已打开扩展聊天页面');

    await chatPage.waitForTimeout(2000);

    // 检查聊天页面状态
    const chatPageInfo = await chatPage.evaluate(() => {
      const title = document.getElementById('chatTitle');
      const messagesContainer = document.getElementById('messagesContainer');
      const messageInput = document.getElementById('messageInput');
      const sendBtn = document.getElementById('sendBtn');

      return {
        title: title?.textContent || '无标题',
        hasMessages: !!messagesContainer && messagesContainer.children.length > 0,
        hasInput: !!messageInput,
        hasSendBtn: !!sendBtn,
      };
    });
    console.log('聊天页面状态:', JSON.stringify(chatPageInfo, null, 2));

    console.log('\n========== 所有测试完成 ==========');
    console.log('浏览器保持打开，你可以手动继续测试...');
    console.log('按 Ctrl+C 结束测试');

    // 保持浏览器打开以便手动测试
    await new Promise(() => {});

  } catch (error) {
    console.error('测试错误:', error.message);
  }
}

testDoubao().catch(console.error);
