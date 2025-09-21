// 全局状态变量（为每个section维护独立的状态）
const sectionStates = {};

// 为每个section定义独立的API参数
const sectionConfigs = {
  section1: {
    accessToken: "pat_ijPUwcT72jBK2ZaqWfSTettUAwKXQrj7Btftd4DuDMD0jM235e7zV0uBYRDi1Pae",
    botId: "7539088830415503406"
  },
  section2: {
    accessToken: "pat_ijPUwcT72jBK2ZaqWfSTettUAwKXQrj7Btftd4DuDMD0jM235e7zV0uBYRDi1Pae",
    botId: "7552543858085904424"  // 不同的bot_id
  },
  section3: {
    accessToken: "pat_ijPUwcT72jBK2ZaqWfSTettUAwKXQrj7Btftd4DuDMD0jM235e7zV0uBYRDi1Pae",
    botId: "7552547843530162211"  // 不同的bot_id
  },
  section4: {
    accessToken: "pat_ijPUwcT72jBK2ZaqWfSTettUAwKXQrj7Btftd4DuDMD0jM235e7zV0uBYRDi1Pae",
    botId: "7542276266360487963"  // 不同的bot_id
  },
  section5: {
    accessToken: "pat_ijPUwcT72jBK2ZaqWfSTettUAwKXQrj7Btftd4DuDMD0jM235e7zV0uBYRDi1Pae",
    botId: "7552550445202898996"  // 不同的bot_id
  }
};

// 初始化各section状态
function initializeSectionStates() {
  for (let i = 1; i <= 5; i++) {
    const sectionId = `section${i}`;
    sectionStates[sectionId] = {
      messageQueue: [],
      isTyping: false,
      lastProcessedIndex: 0,
      currentSessionBubble: null,
      currentMessageId: null,
      currentMessageContent: '',
      userId: "USER_123" // 生成随机用户ID
    };
  }
}

// 获取指定section的状态
function getSectionState(sectionId) {
  return sectionStates[sectionId];
}

// 获取指定section的配置
function getSectionConfig(sectionId) {
  return sectionConfigs[sectionId];
}

// 为每个section创建独立的发送消息函数
async function sendMessage1() {
  await sendMessage('section1');
}

async function sendMessage2() {
  await sendMessage('section2');
}

async function sendMessage3() {
  await sendMessage('section3');
}

async function sendMessage4() {
  await sendMessage('section4');
}

async function sendMessage5() {
  await sendMessage('section5');
}

// 通用发送消息函数
async function sendMessage(sectionId) {
  const state = getSectionState(sectionId);
  const config = getSectionConfig(sectionId);
  
  // 重置消息ID和内容，确保新问题使用新气泡
  state.currentMessageId = null;
  state.currentMessageContent = '';
  
  const inputElement = document.getElementById(`message-input${sectionId.slice(-1)}`);
  const userInput = inputElement.value.trim();
  if (!userInput) return;
  
  // 清空输入框
  inputElement.value = '';
  
  // 添加用户消息到聊天窗口
  const messageContainer = document.getElementById(`message-container${sectionId.slice(-1)}`);
  const userMessageElement = createUserMessage(userInput);
  messageContainer.appendChild(userMessageElement);
  scrollToBottom(messageContainer);
  
  // 组装历史消息上下文
  const previousMessages = messageContainer.querySelectorAll('.message .message-content .message-text');
  const additionalMessages = Array.from(previousMessages).map(message => {
    const role = message.closest('.message').classList.contains('user-message') ? 'user' : 'assistant';
    return {
      role,
      content: message.innerText,
      content_type: 'text'
    };
  });
  
  // 显示"正在输入"状态
  const typingIndicator = createTypingIndicator();
  messageContainer.appendChild(typingIndicator);
  scrollToBottom(messageContainer);
  
  try {
    // 发起Coze API请求，使用对应section的配置
    const response = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bot_id: config.botId,
        user_id: state.userId,
        additional_messages: additionalMessages,
        stream: true,
        auto_save_history: true,
        enable_card: true
      })
    });
    
    // 移除"正在输入"状态
    messageContainer.removeChild(typingIndicator);
    
    if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let messageContent = '';
    
    // 处理流式响应
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('流式响应结束');
        break;
      }
      
      messageContent += decoder.decode(value, { stream: true });
      processMessageContent(messageContent, sectionId);
    }
  } // 在sendMessage函数的catch块中修改
  catch (error) {
    console.error('请求异常:', error);
    
    // 移除"正在输入"状态
    if (messageContainer.contains(typingIndicator)) {
      messageContainer.removeChild(typingIndicator);
    }
    
    // 显示详细错误消息
    const errorMessage = createAIMessage(`请求失败: ${error.message || '未知错误'}`);
    messageContainer.appendChild(errorMessage);
    scrollToBottom(messageContainer);
  }
}

// 处理消息内容
function processMessageContent(content, sectionId) {
  const state = getSectionState(sectionId);
  let currentIndex = state.lastProcessedIndex;
  let eventDeltaIndex = content.indexOf('event:conversation.message.delta', currentIndex);
  
  while (eventDeltaIndex !== -1) {
    const nextEventDeltaIndex = content.indexOf('event:conversation.message.delta', eventDeltaIndex + 1);
    const endEventDeltaIndex = nextEventDeltaIndex !== -1 ? nextEventDeltaIndex : content.length;
    
    const dataString = content.substring(eventDeltaIndex, endEventDeltaIndex);
    const dataPrefixIndex = dataString.indexOf('data:');
    const jsonEndIndex = dataString.indexOf('}', dataPrefixIndex) + 1;
    
    if (dataPrefixIndex !== -1 && jsonEndIndex > 0 && dataString[jsonEndIndex - 1] === '}') {
      try {
        const dataObject = JSON.parse(dataString.substring(dataPrefixIndex + 5, jsonEndIndex));
        if (dataObject.content) {
          // 提取 id 而不是 conversation_id
          const messageId = dataObject.id || 'default';
          state.messageQueue.push({ content: dataObject.content, messageId });
        }
      } catch (error) {
        console.error('JSON解析失败:', error);
      }
      currentIndex = eventDeltaIndex + jsonEndIndex;
    } else {
      break;
    }
    
    eventDeltaIndex = nextEventDeltaIndex;
  }
  
  // 检查是否结束
  const eventDoneIndex = content.indexOf('event:done');
  if (eventDoneIndex !== -1) {
    messageContent = '';
    state.lastProcessedIndex = 0;
    return;
  }
  
  state.lastProcessedIndex = currentIndex;
  processQueue(sectionId);
}

// 处理消息队列
function processQueue(sectionId) {
  const state = getSectionState(sectionId);
  if (!state.isTyping && state.messageQueue.length > 0) {
    state.isTyping = true;
    const message = state.messageQueue.shift();
    typeMessage(message.content, message.messageId, sectionId);
  }
}

// 打字机效果
function typeMessage(content, messageId, sectionId) {
  const state = getSectionState(sectionId);
  const messageContainer = document.getElementById(`message-container${sectionId.slice(-1)}`);
  
  // 如果当前消息ID与之前不同，或者没有气泡，则创建新气泡
  if (state.currentMessageId !== messageId || !state.currentSessionBubble) {
    // 更新消息ID
    state.currentMessageId = messageId;
    
    // 重置当前消息内容
    state.currentMessageContent = '';
    
    // 创建新的聊天气泡
    const aiMessageElement = createAIMessage('');
    messageContainer.appendChild(aiMessageElement);
    state.currentSessionBubble = aiMessageElement.querySelector('.message-text');
    state.currentSessionBubble.innerHTML = '';
  }
  
  // 将新内容添加到当前消息内容
  state.currentMessageContent += content;
  
  // 检查是否为markdown格式并解析
  if (isMarkdown(state.currentMessageContent)) {
    // 如果是markdown，使用marked解析完整内容
    if (typeof marked !== 'undefined') {
      state.currentSessionBubble.innerHTML = marked.parse(state.currentMessageContent);
    } else {
      // 如果marked未定义，则使用普通文本
      state.currentSessionBubble.innerHTML = '<p>' + escapeHtml(state.currentMessageContent) + '</p>';
      console.warn('marked库未加载，无法解析Markdown');
    }
  } else {
    // 如果不是markdown，使用文本内容
    state.currentSessionBubble.innerHTML = '<p>' + escapeHtml(state.currentMessageContent) + '</p>';
  }
  
  scrollToBottom(messageContainer);
  
  // 完成当前消息处理
  state.isTyping = false;
  processQueue(sectionId);
}

// 判断是否为markdown格式
function isMarkdown(content) {
  // 检查是否包含markdown特征字符
  const markdownPatterns = [
    /^\s*#{1,6}\s/,        // 标题
    /\*\*.*?\*\*/,        // 粗体
    /\*.*?\*/,             // 斜体
    /\[.*?\]\(.*?\)/,     // 链接
    /^\s*[-+*]\s/,         // 无序列表
    /^\s*\d+\.\s/,        // 有序列表
    /`{3}.*?`{3}/s,         // 代码块
    /`.*?`/                 // 行内代码
  ];
  
  return markdownPatterns.some(pattern => pattern.test(content));
}

// 创建"正在输入"指示器
function createTypingIndicator() {
  var messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  messageDiv.innerHTML = 
    '<div class="avatar">' +
      '<div class="ai-icon">' +
        // 注意：请将下面的路径替换为您实际的PNG图片路径
        '<img src="https://i.postimg.cc/g0zdGspF/AI.png" width="24" height="24" alt="AI头像">' +
      '</div>' +
    '</div>' +
    '<div class="message-content">' +
      '<div class="message-header">' +
        '<span class="ai-name">小芒书AI</span>' + // 保持统一的AI名称
      '</div>' +
      '<div class="message-text">' +
        '<div class="typing-dots">' +
          '<span class="dot"></span>' +
          '<span class="dot"></span>' +
          '<span class="dot"></span>' +
        '</div>' +
      '</div>' +
      '<div class="message-actions">' +
      '</div>' +
    '</div>';
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .typing-dots {
      display: flex;
      gap: 5px;
      padding: 5px 0;
    }
    .typing-dots .dot {
      width: 8px;
      height: 8px;
      background-color: #666;
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out both;
    }
    .typing-dots .dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dots .dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes typing {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  messageDiv.appendChild(style);
  
  return messageDiv;
}

// 滚动到最新消息
function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

// 创建用户消息元素
function createUserMessage(text) {
  var messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  messageDiv.innerHTML = 
    '<div class="avatar">U</div>' +
    '<div class="message-content">' +
      '<div class="message-text">' +
        '<p>' + escapeHtml(text) + '</p>' +
      '</div>' +
    '</div>';
  return messageDiv;
}

// 创建AI消息元素
function createAIMessage(text) {
  var messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';
  
  // 检查是否为markdown格式并解析
  var messageContent;
  if (isMarkdown(text)) {
    // 如果是markdown，使用marked解析内容
    if (typeof marked !== 'undefined') {
      messageContent = marked.parse(text);
    } else {
      // 如果marked未定义，则使用普通文本
      messageContent = '<p>' + escapeHtml(text) + '</p>';
      console.warn('marked库未加载，无法解析Markdown');
    }
  } else {
    // 如果不是markdown，使用转义后的文本内容
    messageContent = '<p>' + escapeHtml(text) + '</p>';
  }
  
  messageDiv.innerHTML = 
    '<div class="avatar">' +
      '<div class="ai-icon">' +
        // 注意：请将下面的路径替换为您实际的PNG图片路径
        '<img src="https://i.postimg.cc/g0zdGspF/AI.png" width="24" height="24" alt="AI头像">' +
      '</div>' +
    '</div>' +
    '<div class="message-content">' +
      '<div class="message-header">' +
        '<span class="ai-name">小芒书AI</span>' + // 保持统一的AI名称
      '</div>' +
      '<div class="message-text">' +
        messageContent +
      '</div>' +
      '<div class="message-actions">' +
      '</div>' +
    '</div>';
  
  return messageDiv;
}

// 转义HTML特殊字符
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 显示提示消息
function showToast(message) {
  var toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 
    'position: fixed; top: 20px; right: 20px; background-color: #374151; color: white; ' +
    'padding: 12px 16px; border-radius: 8px; font-size: 14px; z-index: 1000; ' +
    'opacity: 0; transition: opacity 0.3s ease;';
  
  document.body.appendChild(toast);
  
  // 显示动画
  setTimeout(function() {
    toast.style.opacity = '1';
  }, 10);
  
  // 自动消失
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

// 更新发送按钮状态
function updateSendButton(inputElement, sendBtn) {
  var hasText = inputElement.value.trim().length > 0;
  sendBtn.disabled = !hasText;
  sendBtn.style.opacity = hasText ? '1' : '0.5';
}

// 开始新对话
function startNewChat(sectionId) {
  if (confirm('确定要开始新对话吗？当前对话将被清除。')) {
    // 保留初始消息，清除用户添加的消息
    const messageContainer = document.getElementById(`message-container${sectionId.slice(-1)}`);
    const messages = messageContainer.querySelectorAll('.message');
    for (var i = 0; i < messages.length; i++) {
      if (i >= 1) { // 保留第一条初始消息
        messages[i].remove();
      }
    }
    showToast('已开始新对话');
  }
}

// DOM加载完成后初始化
window.onload = function() {
  // 初始化各section状态
  initializeSectionStates();
  
  // 为每个section添加事件监听器
  for (var i = 1; i <= 5; i++) {
    const sectionId = `section${i}`;
    const inputElement = document.getElementById(`message-input${i}`);
    const sendBtn = document.getElementById(`send-btn${i}`);
    const newChatBtn = document.querySelector(`#section${i} .new-chat-btn`);
    
    // 发送按钮事件 - 使用对应的独立发送函数
    if (i === 1) {
      sendBtn.addEventListener('click', sendMessage1);
      inputElement.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage1();
        }
      });
    } else if (i === 2) {
      sendBtn.addEventListener('click', sendMessage2);
      inputElement.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage2();
        }
      });
    } else if (i === 3) {
      sendBtn.addEventListener('click', sendMessage3);
      inputElement.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage3();
        }
      });
    } else if (i === 4) {
      sendBtn.addEventListener('click', sendMessage4);
      inputElement.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage4();
        }
      });
    } else if (i === 5) {
      sendBtn.addEventListener('click', sendMessage5);
      inputElement.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage5();
        }
      });
    }
    
    // 输入框实时验证
    inputElement.addEventListener('input', function() {
      updateSendButton(inputElement, sendBtn);
    });
    
    // 新对话按钮
    newChatBtn.addEventListener('click', function() {
      startNewChat(sectionId);
    });
    
    // 初始化发送按钮状态
    updateSendButton(inputElement, sendBtn);
  }
  
  // 为已存在的操作按钮添加事件监听器
  const existingActionBtns = document.querySelectorAll('.action-btn');
  for (var i = 0; i < existingActionBtns.length; i++) {
    existingActionBtns[i].addEventListener('click', handleActionClick);
  }
  
  // 左右按钮导航功能
  const sections = document.querySelectorAll('.section');
  const upBtn = document.querySelector('.up-btn');
  const downBtn = document.querySelector('.down-btn');
  let currentSection = 0; // 设置为0，默认显示新添加的更多功能页面
  
  // 初始化显示第一个section
  sections.forEach((section, index) => {
    section.classList.toggle('active', index === currentSection);
  });
  
  // 向下滚动功能
  function showFeatureCards() {
    const currentSectionId = sections[currentSection].id;
    if (currentSectionId === 'more-feature') {
      // 重置所有元素的显示状态
      const title = document.querySelector('.more-feature-content .title');
      const desc = document.querySelector('.more-feature-content .desc');
      const cards = document.querySelectorAll('.feature-card');
      
      // 移除所有元素的show类
      title.classList.remove('show');
      desc.classList.remove('show');
      cards.forEach(card => card.classList.remove('show'));
      
      // 触发重排
      void title.offsetWidth;
      
      // 先显示文字
      setTimeout(() => {
        title.classList.add('show');
        desc.classList.add('show');
      }, 50);
      
      // 然后显示卡片（通过CSS中的延迟实现）
      setTimeout(() => {
        cards.forEach(card => card.classList.add('show'));
      }, 50);
    }
  }
  
  downBtn.addEventListener('click', function() {
    if (currentSection < sections.length - 1) {
      sections[currentSection].classList.remove('active');
      currentSection++;
      sections[currentSection].classList.add('active');
      showFeatureCards(); // 切换后检查是否需要显示卡片动画
    }
  });
  
  upBtn.addEventListener('click', function() {
    if (currentSection > 0) {
      sections[currentSection].classList.remove('active');
      currentSection--;
      sections[currentSection].classList.add('active');
      showFeatureCards(); // 切换后检查是否需要显示卡片动画
    }
  });
  
  // 在初始化时也调用一次，以显示默认页面的卡片动画
  showFeatureCards();
};

// 注释掉或移除以下代码，允许页面正常滚动
// // 禁止鼠标滚轮滚动页面
// window.addEventListener('wheel', function(e) {
//   e.preventDefault();
// }, { passive: false });
// 
// // 禁止触摸滑动
// window.addEventListener('touchmove', function(e) {
//   e.preventDefault();
// }, { passive: false });

// 为按钮添加联动点击效果
const sidebarNav = document.querySelector('.sidebar-nav');
const upBtn = document.querySelector('.up-btn');
const downBtn = document.querySelector('.down-btn');

// 修改按钮动画触发逻辑，移除长按效果
let isAnimationTriggered = false;

function triggerUpButtonAnimation() {
  // 防止长按触发多次动画
  if (isAnimationTriggered) return;
  
  isAnimationTriggered = true;
  
  // 移除可能存在的其他动画类
  sidebarNav.classList.remove('down-active');
  // 先移除再添加，确保动画可以连续触发
  sidebarNav.classList.remove('up-active');
  // 强制重排以重新触发动画
  void sidebarNav.offsetWidth;
  // 添加active类以激活上按钮的动画
  sidebarNav.classList.add('up-active');
  
  // 短暂延迟后移除active类，以便可以再次触发
  setTimeout(() => {
    sidebarNav.classList.remove('up-active');
    isAnimationTriggered = false; // 重置标志
  }, 600); // 与动画持续时间一致
}

function triggerDownButtonAnimation() {
  // 防止长按触发多次动画
  if (isAnimationTriggered) return;
  
  isAnimationTriggered = true;
  
  // 移除可能存在的其他动画类
  sidebarNav.classList.remove('up-active');
  // 先移除再添加，确保动画可以连续触发
  sidebarNav.classList.remove('down-active');
  // 强制重排以重新触发动画
  void sidebarNav.offsetWidth;
  // 添加active类以激活下按钮的动画
  sidebarNav.classList.add('down-active');
  
  // 短暂延迟后移除active类，以便可以再次触发
  setTimeout(() => {
    sidebarNav.classList.remove('down-active');
    isAnimationTriggered = false; // 重置标志
  }, 600); // 与动画持续时间一致
}

// 移除原有的点击事件监听器
upBtn.removeEventListener('click', triggerUpButtonAnimation);
downBtn.removeEventListener('click', triggerDownButtonAnimation);

// 使用mousedown事件代替click，并添加mouseup和mouseleave事件以处理长按
upBtn.addEventListener('mousedown', triggerUpButtonAnimation);
downBtn.addEventListener('mousedown', triggerDownButtonAnimation);

// 添加触摸事件支持，防止移动设备上的长按问题
upBtn.addEventListener('touchstart', (e) => {
  e.preventDefault(); // 阻止默认的触摸行为（如长按菜单）
  triggerUpButtonAnimation();
});
downBtn.addEventListener('touchstart', (e) => {
  e.preventDefault(); // 阻止默认的触摸行为
  triggerDownButtonAnimation();
});
