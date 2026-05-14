const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf-8');

// 查找有问题的代码段
console.log('检查 async/await 使用情况...\n');

// 1. 检查消息监听器
const listenerMatch = code.match(/chrome\.runtime\.onMessage\.addListener\(\([^)]+\) => \{([\s\S]*?)\n\}\);/g);
if (listenerMatch) {
  console.log(`找到 ${listenerMatch.length} 个消息监听器\n`);

  listenerMatch.forEach((listener, index) => {
    console.log(`监听器 ${index + 1}:`);

    // 检查是否有 await
    const hasAwait = listener.includes('await');
    const hasAsync = listener.includes('async');

    if (hasAwait && !hasAsync) {
      console.log('  ❌ 发现 await 但函数不是 async');

      // 显示包含 await 的行
      const lines = listener.split('\n');
      lines.forEach((line, lineNum) => {
        if (line.includes('await')) {
          console.log(`     行 ${lineNum + 1}: ${line.trim()}`);
        }
      });
    } else if (hasAwait && hasAsync) {
      console.log('  ✅ 正确：使用 async/await');
    } else {
      console.log('  ✅ 没有 await，正常');
    }
    console.log('');
  });
}

// 2. 尝试编译
console.log('尝试编译检查...');
try {
  new Function(code);
  console.log('✅ 代码可以编译');
} catch (error) {
  console.log(`❌ 编译失败: ${error.message}`);

  // 尝试定位错误位置
  const match = error.message.match(/(\d+):(\d+)/);
  if (match) {
    const line = parseInt(match[1]);
    const col = parseInt(match[2]);
    console.log(`   错误位置: 第 ${line} 行, 第 ${col} 列`);

    const lines = code.split('\n');
    if (lines[line - 1]) {
      console.log(`   代码: ${lines[line - 1].trim()}`);
    }
  }
}
