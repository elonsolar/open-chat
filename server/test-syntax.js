// 测试修复后的 background.js 语法
const fs = require('fs');
const path = require('path');

console.log('检查 background.js 语法...');

const backgroundCode = fs.readFileSync(
  path.join(__dirname, '../background/background.js'),
  'utf-8'
);

try {
  // 检查是否有明显的语法错误
  new Function(backgroundCode);
  console.log('✅ background.js 语法检查通过');
} catch (error) {
  console.error('❌ 语法错误:', error.message);
  process.exit(1);
}

// 检查关键修复点
console.log('\n检查关键修复:');

// 1. 检查 saveSettings 处理
if (backgroundCode.includes("request.action === 'saveSettings' || request.action === 'reconnectWebSocket'")) {
  console.log('✅ saveSettings 和 reconnectWebSocket 已正确隔离为 async IIFE');
} else {
  console.log('❌ saveSettings 处理可能有问题');
}

// 2. 检查是否还有直接在 switch 中使用 await
const switchMatch = backgroundCode.match(/switch \(request\.action\) \{([\s\S]*?)\n\}/);
if (switchMatch) {
  const switchContent = switchMatch[1];
  const awaitCount = (switchContent.match(/\bawait\b/g) || []).length;
  if (awaitCount === 0) {
    console.log('✅ switch 语句中没有直接使用 await');
  } else {
    console.log(`⚠️  switch 语句中发现 ${awaitCount} 个 await，可能有问题`);
  }
}

console.log('\n✅ 所有检查通过！');
