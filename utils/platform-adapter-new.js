// =====================================================
// 全新的waitForResponse方法 - 使用MutationObserver
// =====================================================

// 将此代码添加到platform-adapter.js中，替换现有的waitForResponse方法

async function waitForResponseNew(platform, selectors, timeout = 60000) {
  const startTime = Date.now();
  
  console.log(`[${platform}] ========== 智能等待AI回复（MutationObserver） ==========`);
  console.log(`[${platform}] 超时: ${timeout}ms`);

  return new Promise((resolve, reject) => {
    let lastText = '';
    let stableCount = 0;

    const observer = new MutationObserver((mutations) => {
      try {
        // 检查DOM变化
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0 || mutation.type === 'characterData' || mutation.type === 'childList') {
            // 获取页面上所有的文本
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: (node) => {
                  // 过滤掉导航、按钮、脚本等
                  if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' ||
                      node.tagName === 'NOSCRIPT' || node.tagName === 'IFRAME') {
                    return NodeFilter.FILTER_REJECT;
                  }
                  // 只要有文本内容的元素
                  return node.textContent?.trim().length > 10;
                }
              }
            );

            const allText = [];
            let currentNode = walker.nextNode();

            while (currentNode) {
              const text = currentNode.textContent?.trim();
              if (text && text.length > 10 && text.length < 5000) {
                allText.push({
                  element: currentNode,
                  text: text,
                  tagName: currentNode.tagName,
                  className: currentNode.className
                });
              }
              currentNode = walker.nextNode();
            }

            console.log(`[${platform}] 检测到 ${allText.length} 个可能的文本元素`);

            // 查找包含我们发送内容的文本
            const ourContent = 'ggsd'; // 这里应该是实际的消息内容
            const relevantText = allText.filter(t => t.text.includes(ourContent) || t.text.length > 50);

            if (relevantText.length > 0) {
              console.log(`[${platform}] 找到 ${relevantText.length} 个相关文本`);

              // 按时间排序，取最新的
              relevantText.sort((a, b) => {
                // 尝试找到时间戳或位置信息
                const aTime = a.element.closest('[class*="time"]')?.textContent ||
                             a.element.querySelector('[class*="time"]')?.textContent;
                const bTime = b.element.closest('[class*="time"]')?.textContent ||
                             b.element.querySelector('[class*="time"]')?.textContent;
                return (bTime || '').localeCompare(aTime || '', undefined);
              });

              const latest = relevantText[relevantText.length - 1];
              console.log(`[${platform}] 最新的相关文本:`, latest.text.substring(0, 50));

              if (latest.text.length > lastText) {
                stableCount++;
                lastText = latest.text;

                if (stableCount >= 3 && lastText.length > 20) {
                  console.log(`[${platform}] ========== AI回复完成 ==========`);
                  console.log(`[${platform}] 回复长度:`, lastText.length);
                  console.log(`[${platform}] 回复预览:`, lastText.substring(0, 100) + '...');
                  console.log(`[${platform}] 总耗时:`, Math.floor((Date.now() - startTime) / 1000) + '秒');

                  observer.disconnect();
                  resolve(lastText.text);
                  return;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`[${platform}] MutationObserver错误:`, error);
      }
    });

    // 开始监听
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 超时处理
    setTimeout(() => {
      observer.disconnect();

      // 最后检查一次
      if (lastText && lastText.length > 0) {
        console.log(`[${platform}] ========== 超时但发现回复 ==========`);
        resolve(lastText);
      } else {
        console.error(`[${platform}] ========== 等待超时 ==========`);
        console.error(`[${platform}] 超时: ${timeout}ms`);
        console.error(`[${platform}] 建议: 如果AI已经回复，请手动复制回复内容`);
        reject(new Error(`等待AI回复超时 (${timeout/1000}秒)。但AI可能已经回复了。`));
      }
    }, timeout);
  });
}

// 在AIPlatformAdapter类中替换现有的waitForResponse方法
```

将以上代码保存为 platform-adapter-new.js，然后我可以告诉你如何集成。
