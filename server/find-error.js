const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf-8');

// 分行检查
const lines = code.split('\n');
console.log('尝试逐行编译以定位错误...\n');

let testCode = '';
let errorLine = -1;

for (let i = 0; i < lines.length; i++) {
  testCode += lines[i] + '\n';

  try {
    new Function(testCode);
  } catch (error) {
    errorLine = i + 1;
    console.log(`❌ 错误出现在第 ${errorLine} 行:`);
    console.log(`   ${lines[i]}`);
    console.log(`   错误: ${error.message}\n`);

    // 显示上下文
    console.log('上下文:');
    const start = Math.max(0, errorLine - 3);
    const end = Math.min(lines.length, errorLine + 2);
    for (let j = start; j < end; j++) {
      const indicator = j === errorLine - 1 ? '>>>' : '   ';
      console.log(`${indicator} ${j + 1}: ${lines[j]}`);
    }

    break;
  }
}

if (errorLine === -1) {
  console.log('✅ 逐行检查通过！');
}
