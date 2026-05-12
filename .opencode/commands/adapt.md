---
description: 适配特定的AI平台
agent: build
---

完成 $1 的适配工作 
概述： 
    我们需要角色配置可以配置目标平台，可以通过插件会话功能 向 $1 平台地址 发送消息， 通过content-script注入目标平台的脚本接受到插件消息，找到目标平台的消息发送框， 发送消息并等待 ai响应，最终将获取最新的ai消息发回给插件显示。

指导方案：
    如果不确定是否第一次适配，请查询代码库信息

    一、 适配流程：
        1. 获取和配置平台信息： 询问用户相平台相关信息，然后配置config\providers.config.js 和manifest.json
        2. 通过playwright打开目标平台地址，如果相关页面没有登陆需要提示用户登陆，并等待用户登陆成功
        3. 实现输入框发送消息功能：
            分析dom 元素，根据不同的dom类型分别实现不同的发送消息逻辑
            示范：DeepSeek — 传统 textarea
            DeepSeek 用原生 <textarea>，设置 .value 不会触发 React 的受控组件监听，需要用 Object.getOwnPropertyDescriptor 拿到 setter 直接调用，再手动 dispatch input 事件让 React 感知到变化。发送是 Enter 键。 
            伪代码：
            ```
            sendMessage(content): 找到 textarea
            focus()
            用原生 value setter 设置内容
            dispatch input 事件（通知 React）
            等 500ms
            模拟 Enter 键发送
            ```
            真实案例
            ```
            const inputBox = await this.waitForElement('textarea', 10000);
            inputBox.focus();
            // 绕过 React 受控组件，直接调用原生 setter
            const nativeSetter = Object.getOwnPropertyDescriptor( window.HTMLTextAreaElement.prototype, 'value').set;
            nativeSetter.call(inputBox, content);
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            await this.sleep(500);
            // Enter 键发送
            inputBox.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true }));
            if (content.includes('\n')) {
            // 多行内容：Shift+Enter 避免误触发
            inputBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, ... }));
            ```
        
            千问 — Slate.js 富文本编辑器
            千问用 contenteditable 的 Slate.js 编辑器，不监听 DOM 属性变化，只拦截 InputEvent 事件来更新内部数据模型。所以不能直接设 innerHTML，必须通过事件驱动。
            伪代码
            ```
             sendMessage(content):
             找到 div[contenteditable][data-slate-editor]
             focus()
             定位到 Slate 的 textNode（span[data-slate-node="text"]）
             如不存在则创建
             设置光标选中全部
             发 InputEvent('deleteContent') → Slate 收到后清空
             设置光标到末尾
             发 InputEvent('insertText', data=content) → Slate 收到后填入
             轮询等待发送按钮启用（禁用时不带 cursor-pointer class）
             点击发送
             ```
            真实案例
            ```
            async sendMessage(content) {
                const editor = await this.waitForElement(
                    'div[contenteditable="true"][data-slate-editor="true"]', 10000
                );
                editor.focus();
                await this.sleep(200);
                // 定位 Slate 内部文本节点
                let textNode = editor.querySelector('span[data-slate-node="text"]');
                if (!textNode) {
                    const el = editor.querySelector('[data-slate-node="element"]')
                        || Object.assign(editor.appendChild(document.createElement('p')),
                            { 'data-slate-node': 'element' });
                    textNode = Object.assign(el.appendChild(document.createElement('span')),
                        { 'data-slate-node': 'text' });
                    await this.sleep(50);
                }
                // 选中全部 → 发 delete 事件（清空）
                const sel = window.getSelection();
                const r = document.createRange();
                r.selectNodeContents(textNode);
                sel.removeAllRanges(); sel.addRange(r);
                editor.dispatchEvent(new InputEvent('beforeinput',
                    { bubbles: true, cancelable: true, inputType: 'deleteContent' }));
                editor.dispatchEvent(new InputEvent('input',
                    { bubbles: true, cancelable: false, inputType: 'deleteContent' }));
                await this.sleep(100);
                // 光标移到末尾 → 发 insert 事件（填入内容）
                r.selectNodeContents(textNode); r.collapse(false);
                sel.removeAllRanges(); sel.addRange(r);
                editor.dispatchEvent(new InputEvent('beforeinput',
                    { bubbles: true, cancelable: true, inputType: 'insertText', data: content }));
                editor.dispatchEvent(new InputEvent('input',
                    { bubbles: true, cancelable: false, inputType: 'insertText', data: content }));
                await this.sleep(500);
                // 轮询等待按钮可用（Slate 异步处理事件后才会启用按钮）
                const sendButton = await this.waitForButton();
                sendButton.click();
                await this.sleep(1000);
            }
            async waitForButton() {
                const start = Date.now();
                while (Date.now() - start < 8000) {
                    const btn = document.querySelector('button[aria-label="发送消息"]');
                    if (btn && !btn.disabled && btn.offsetParent !== null) return btn;
                    await this.sleep(200);
                }
                throw new Error('发送按钮未找到');
            }
            
            ```

         4. 实现消息监听和获取功能:
         尝试发送多条信息，分析页面dom显示，查看消息格式, 以及消息内部的思考内容，通查消息都会有特殊的标签
         通过MutationObserver 监测dom, 当dom 变化时,查找最后一条消息,最后一条消息你可以通过之前的消息标签，
         去除思考内容标签后，如果正文有约定好的结束标签，然后就结束监听，发送消息给后台
    二. 参考案例     
        deepseek已经适配过了，可以参考其适配代码

    三. 测试
        全程使用playwright操作浏览器测试，整个过程模拟用户实际操作
        1. 重新加载插件，
        2. 新建或复用已有的插件会话
        3. 发送若干消息，包含简单的文本，复杂的问题，包含代码的问题
        4. 查看$1 平台 的会话消息 和 插件会话内的响应消息是否一致, 用户消息是否正常发送，ai 回复最新消息是否正确获取
        5. 如果有问题，继续解决问题，并重新加载插件，循环往复，否则告诉用户成功
    四. 约束
        1. 所有修改必须按照 第三步骤约定的测试
        2. 有问题不要盲目更改代码，需要思考，搜索 和借鉴已有的实现
        3. 当你多次无法成功修改，可以和用户讨论, 但不是让用户做低级的任务



        
   
    