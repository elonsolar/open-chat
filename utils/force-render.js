/**
 * Force Render Utility
 * Forces DOM updates in background tabs for React 18 concurrent mode apps.
 * 
 * Key findings from Playwright analysis:
 * - Doubao: React root at <div id="root"> via __reactContainer$, tag=3 HostRoot
 * - Qianwen: React root at <div id="ice-container"> via __reactContainer$, tag=3 HostRoot
 * - Both use React 18 concurrent mode (mode=1)
 * - Element-level fibers are tag=5 (FunctionComponent), NOT tag 3/4
 * - window.React/window.ReactDOM may not be exposed (Doubao)
 * - flushSync is unavailable on both platforms
 * 
 * Strategy:
 * 1. Override requestAnimationFrame to fire immediately in background tabs
 * 2. Override document.visibilityState/hidden/hasFocus
 * 3. Find React root via __reactContainer$ on root DOM elements
 * 4. Force React scheduler flush via FiberRootNode internals
 * 5. Platform-specific message container triggers
 */

class ForceRenderUtil {
  constructor() {
    this.platform = this.detectPlatform();
    this._originalRAF = window.requestAnimationFrame;
    this._originalCAF = window.cancelAnimationFrame;
    this._patched = false;
  }

  detectPlatform() {
    const hostname = window.location.hostname;

    if (hostname.includes('deepseek')) {
      return 'deepseek';
    } else if (hostname.includes('qianwen') || hostname.includes('aliyun')) {
      return 'qianwen';
    } else if (hostname.includes('doubao') || hostname.includes('feishu')) {
      return 'doubao';
    } else if (hostname.includes('kimi') || hostname.includes('moonshot')) {
      return 'kimi';
    }

    return 'unknown';
  }

  async tryForceRender() {
    console.log(`[ForceRender] Platform: ${this.platform}, URL: ${window.location.href}`);

    this.tryPatchVisibility();
    this.tryPatchRAF();
    this.tryForceReactSchedulerFlush();
    this.tryPlatformSpecificForceRender();
    this.tryFlushPendingWork();
    this.tryEventTrigger();
    this.tryForceReflow();

    console.log(`[ForceRender] All methods executed`);
    return true;
  }

  /**
   * Find React FiberRootNode via __reactContainer$ on root DOM elements.
   * Returns { fiberRootNode, rootFiber, containerElement } or null.
   */
  findReactRoot() {
    const rootSelectors = ['#root', '#ice-container', '#app', '#__next'];
    
    for (const selector of rootSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      
      const containerKey = Object.keys(el).find(k => k.startsWith('__reactContainer'));
      if (!containerKey) continue;
      
      const rootFiber = el[containerKey];
      if (!rootFiber || rootFiber.tag !== 3) continue;
      
      const fiberRootNode = rootFiber.stateNode;
      if (!fiberRootNode || !fiberRootNode.containerInfo) continue;
      
      console.log(`[ForceRender] Found React root at "${selector}", tag=${rootFiber.tag}, mode=${rootFiber.mode}`);
      return { fiberRootNode, rootFiber, containerElement: el };
    }

    return null;
  }

  /**
   * Override document.visibilityState, document.hidden, document.hasFocus
   * to make the page think it's in the foreground.
   */
  tryPatchVisibility() {
    try {
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true,
        enumerable: true
      });

      document.hasFocus = () => true;

      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));

      console.log(`[ForceRender] Visibility patched`);
    } catch (e) {
      console.log(`[ForceRender] Visibility patch failed:`, e.message);
    }
  }

  /**
   * Override requestAnimationFrame to execute callbacks immediately.
   * This is critical because React 18 concurrent mode and many AI chat platforms
   * use RAF to batch DOM updates during streaming, and RAF is throttled in
   * background tabs.
   */
  tryPatchRAF() {
    if (this._patched) return;
    
    const self = this;
    
    window.requestAnimationFrame = function(callback) {
      if (typeof callback === 'function') {
        try {
          callback(performance.now());
        } catch (e) {}
      }
      return 0;
    };

    window.cancelAnimationFrame = function() {};

    this._patched = true;
    console.log(`[ForceRender] RAF patched - callbacks execute immediately`);
  }

  /**
   * Force React 18's scheduler to flush pending work by accessing the
   * FiberRootNode directly via __reactContainer$.
   */
  tryForceReactSchedulerFlush() {
    try {
      const root = this.findReactRoot();
      if (!root) {
        console.log(`[ForceRender] No React root found, trying flushSync fallback`);
        this.tryFlushSyncFallback();
        return;
      }

      const { fiberRootNode, rootFiber } = root;

      if (fiberRootNode.pendingLanes !== 0 || rootFiber.childLanes !== 0) {
        console.log(`[ForceRender] Pending work found: pendingLanes=${fiberRootNode.pendingLanes}, childLanes=${rootFiber.childLanes}`);
      }

      // Strategy 1: Set pendingLanes to force React to schedule work
      // Lane 1 = SyncLane, Lane 16 = InputContinuousLane, Lane 32 = DefaultLane
      const SyncLane = 1;
      const DefaultLane = 32;
      const mergeLanes = fiberRootNode.pendingLanes | SyncLane | DefaultLane;
      
      fiberRootNode.pendingLanes = mergeLanes;
      fiberRootNode.suspendedLanes = 0;
      fiberRootNode.pingedLanes = mergeLanes;
      fiberRootNode.expiredLanes = mergeLanes;
      
      rootFiber.lanes = mergeLanes;
      rootFiber.childLanes = mergeLanes;

      // Clear the callback node so React will schedule a new one
      if (fiberRootNode.callbackNode) {
        fiberRootNode.callbackNode = null;
        fiberRootNode.callbackPriority = 0;
      }

      console.log(`[ForceRender] FiberRootNode lanes set to force scheduling`);

      // Strategy 2: If there's a finishedWork tree, try to commit it
      if (fiberRootNode.finishedWork) {
        console.log(`[ForceRender] Found finishedWork, attempting to trigger commit`);
        
        // Set finishedLanes to include all lanes
        fiberRootNode.finishedLanes = mergeLanes;
      }

      // Strategy 3: Walk child fibers and force updates
      this.forceChildFiberUpdates(rootFiber, 5);

      // Strategy 4: Try to trigger the scheduler via MessageChannel
      this.tryTriggerSchedulerMessage();

      // Also try flushSync fallback if ReactDOM is available
      this.tryFlushSyncFallback();

    } catch (e) {
      console.log(`[ForceRender] React scheduler flush failed:`, e.message);
    }
  }

  /**
   * Walk child fibers and force state updates
   */
  forceChildFiberUpdates(fiber, maxDepth) {
    if (!fiber || maxDepth <= 0) return;

    // If this fiber has an updateQueue, mark it as having pending updates
    if (fiber.updateQueue) {
      try {
        if (fiber.updateQueue.shared && !fiber.updateQueue.shared.pending) {
          const update = {
            lane: 1,
            payload: null,
            next: null
          };
          update.next = update;
          fiber.updateQueue.shared.pending = update;
        }
      } catch (e) {}
    }

    // Force stateNode update if available
    if (fiber.stateNode && typeof fiber.stateNode.forceUpdate === 'function') {
      try {
        fiber.stateNode.forceUpdate();
      } catch (e) {}
    }

    // Recurse into children
    if (fiber.child) {
      this.forceChildFiberUpdates(fiber.child, maxDepth - 1);
    }
    if (fiber.sibling) {
      this.forceChildFiberUpdates(fiber.sibling, maxDepth - 1);
    }
  }

  /**
   * Try to trigger React's scheduler by sending a MessageChannel message.
   * React 18 uses MessageChannel for scheduling work.
   */
  tryTriggerSchedulerMessage() {
    try {
      // React's scheduler sets up a MessageChannel. We can try to find it
      // by looking at the message channel ports in the window's event listeners
      
      // Method: Create a microtask chain that forces the scheduler to run
      // React checks for pending work in its MessageChannel callback
      // By forcing synchronous execution, we can flush pending work
      
      // Use a chain of Promise.then + queueMicrotask to force flush
      for (let i = 0; i < 10; i++) {
        Promise.resolve().then(() => {
          // Each microtask gives React's scheduler a chance to run
          void document.body?.offsetHeight;
        });
      }
      
      console.log(`[ForceRender] Scheduler microtask chain triggered`);
    } catch (e) {
      console.log(`[ForceRender] Scheduler message trigger failed:`, e.message);
    }
  }

  /**
   * Try ReactDOM.flushSync if available
   */
  tryFlushSyncFallback() {
    try {
      if (window.ReactDOM && typeof window.ReactDOM.flushSync === 'function') {
        window.ReactDOM.flushSync(() => {});
        console.log(`[ForceRender] flushSync executed`);
      }
    } catch (e) {}
  }

  /**
   * Platform-specific force render based on actual DOM structure analysis.
   */
  tryPlatformSpecificForceRender() {
    switch (this.platform) {
      case 'doubao':
        this.forceRenderDoubao();
        break;
      case 'qianwen':
        this.forceRenderQianwen();
        break;
      case 'deepseek':
        this.forceRenderDeepSeek();
        break;
    }
  }

  /**
   * Doubao (Semi Design + React 18):
   * - Uses [class*="message-list"] for message container
   * - Uses [class*="scroller"] for scroll container
   * - Streaming updates via RAF (now patched)
   * - React root at #root
   */
  forceRenderDoubao() {
    console.log(`[ForceRender] Doubao-specific rendering`);

    // Force scroll the message list to trigger IntersectionObserver updates
    const messageList = document.querySelector('[class*="message-list"]');
    if (messageList) {
      const scrollParent = messageList.closest('[class*="scroller"]') || messageList;
      
      // Save and restore scroll position
      const savedScrollTop = scrollParent.scrollTop;
      
      // Trigger multiple scroll events
      scrollParent.scrollTop = scrollParent.scrollHeight;
      scrollParent.dispatchEvent(new Event('scroll', { bubbles: true }));
      
      scrollParent.scrollTop = Math.max(0, savedScrollTop - 10);
      scrollParent.dispatchEvent(new Event('scroll', { bubbles: true }));
      
      scrollParent.scrollTop = scrollParent.scrollHeight;
      scrollParent.dispatchEvent(new Event('scroll', { bubbles: true }));
    }

    // Trigger Semi Design's internal re-render by dispatching events on inputs
    const textarea = document.querySelector('textarea.semi-input-textarea');
    if (textarea) {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Force all .v_list_row elements to recalculate
    const rows = document.querySelectorAll('.v_list_row');
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      lastRow.dispatchEvent(new Event('scroll', { bubbles: true }));
      
      // Trigger reflow on the last row
      lastRow.style.opacity = '0.999';
      void lastRow.offsetHeight;
      lastRow.style.opacity = '1';
      void lastRow.offsetHeight;
    }
  }

  /**
   * Qianwen (React 18.2.0 + Slate editor):
   * - Uses .message-list-content-container for message container
   * - Uses Slate editor (contenteditable)
   * - React root at #ice-container
   */
  forceRenderQianwen() {
    console.log(`[ForceRender] Qianwen-specific rendering`);

    // Force scroll the message container
    const messageContainer = document.querySelector('.message-list-content-container');
    if (messageContainer) {
      const savedScrollTop = messageContainer.scrollTop;
      
      messageContainer.scrollTop = messageContainer.scrollHeight;
      messageContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      
      messageContainer.scrollTop = Math.max(0, savedScrollTop - 10);
      messageContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      
      messageContainer.scrollTop = messageContainer.scrollHeight;
      messageContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    }

    // Force re-render of chat rounds
    const chatRounds = document.querySelectorAll('.chat-round');
    if (chatRounds.length > 0) {
      const lastRound = chatRounds[chatRounds.length - 1];
      const answerCard = lastRound.querySelector('.answer-common-card');
      if (answerCard) {
        answerCard.style.opacity = '0.999';
        void answerCard.offsetHeight;
        answerCard.style.opacity = '1';
        void answerCard.offsetHeight;
      }
    }

    // Trigger Slate editor events (Qianwen uses Slate for input)
    const editor = document.querySelector('[data-slate-editor="true"]');
    if (editor) {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * DeepSeek:
   * - Uses .ds-message for messages
   * - Uses textarea for input
   * - React root at #root
   */
  forceRenderDeepSeek() {
    console.log(`[ForceRender] DeepSeek-specific rendering`);

    const messages = document.querySelectorAll('.ds-message');
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      lastMessage.style.opacity = '0.999';
      void lastMessage.offsetHeight;
      lastMessage.style.opacity = '1';
      void lastMessage.offsetHeight;
    }
  }

  /**
   * Force flush pending async work by running multiple microtask/macrotask cycles.
   */
  tryFlushPendingWork() {
    try {
      // Run multiple RAF cycles (now patched to execute immediately)
      for (let i = 0; i < 10; i++) {
        this._originalRAF.call(window, () => {
          void document.body?.offsetHeight;
        });
      }

      // Force layout calculations
      void document.body?.offsetHeight;
      void document.body?.offsetWidth;
      void document.body?.getBoundingClientRect();

      // Dispatch focus/scroll to wake up any listeners
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('visibilitychange'));

      console.log(`[ForceRender] Pending work flushed`);
    } catch (e) {
      console.log(`[ForceRender] Flush pending work failed:`, e.message);
    }
  }

  /**
   * Trigger various DOM events that might wake up rendering
   */
  tryEventTrigger() {
    try {
      const events = ['focus', 'scroll', 'resize', 'mousemove', 'keydown', 'keyup', 'click'];
      events.forEach(type => {
        window.dispatchEvent(new Event(type, { bubbles: true }));
      });

      // Trigger input events on editable elements
      document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach(el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    } catch (e) {}
  }

  /**
   * Force browser reflow/repaint
   */
  tryForceReflow() {
    try {
      void document.body?.offsetHeight;
      void document.body?.offsetWidth;
      void document.body?.clientHeight;
      void document.body?.clientWidth;
    } catch (e) {}
  }

  /**
   * Restore original RAF (call when force render cycle is complete)
   */
  restoreRAF() {
    if (this._patched) {
      window.requestAnimationFrame = this._originalRAF;
      window.cancelAnimationFrame = this._originalCAF;
      this._patched = false;
      console.log(`[ForceRender] RAF restored`);
    }
  }
}

if (typeof window !== 'undefined') {
  window.forceRenderUtil = new ForceRenderUtil();
  console.log('[ForceRender] Initialized, platform:', window.forceRenderUtil.platform);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForceRenderUtil;
}
