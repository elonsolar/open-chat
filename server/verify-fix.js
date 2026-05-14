// 验证 background.js 修复
const fs = require('fs');
const path = require('path');

const backgroundPath = path.join(__dirname, '../background/background.js');
const code = fs.readFileSync(backgroundPath, 'utf-8');

console.log('🔍 检查 background.js...\n');

// 检查关键的语法结构
const checks = [
  {
    name: '检查 importScripts',
    test: () => code.includes('importScripts'),
    expected: true
  },
  {
    name: '检查 class 定义',
    test: () => code.includes('class WebSocketManager'),
    expected: true
  },
  {
    name: '检查 chrome.runtime.onMessage.addListener 数量',
    test: () => {
      const matches = code.match(/chrome\.runtime\.onMessage\.addListener/g);
      return matches ? matches.length : 0;
    },
    expected: 3
  },
  {
    name: '检查 async IIFE 使用',
    test: () => code.includes('(async () => {'),
    expected: true
  },
  {
    name: '检查是否有重复的 switch',
    test: () => {
      const switchMatches = code.match(/switch \(request\.action\)/g);
      return switchMatches ? switchMatches.length : 0;
    },
    expected: 1
  }
];

let allPassed = true;

checks.forEach(check => {
  try {
    const result = check.test();
    const passed = result === check.expected;

    if (passed) {
      console.log(`✅ ${check.name}: ${result}`);
    } else {
      console.log(`❌ ${check.name}: 期望 ${check.expected}, 实际 ${result}`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: 检查失败 - ${error.message}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✅ 所有检查通过！语法应该正确了。');
  console.log('\n📝 下一步:');
  console.log('1. 在 chrome://extensions/ 重新加载插件');
  console.log('2. 检查是否还有错误');
} else {
  console.log('❌ 还有问题需要修复。');
}

console.log('='.repeat(50));
