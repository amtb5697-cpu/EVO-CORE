/* EVO CORE AI bridge v0.1
 * Client-side bridge only. Never put provider API keys in this file or browser storage.
 * Configure a trusted HTTPS backend endpoint that keeps provider secrets server-side.
 */
(() => {
  'use strict';
  const ENDPOINT_KEY = 'evo-core-ai-endpoint-v1';
  const HISTORY_KEY = 'evo-core-chat-history-v1';
  const SYSTEM_PROMPT = 'أنت العقل المساعد لمنصة EVO CORE. أجب بالعربية الواضحة. حلّل الأفكار إلى متطلبات وخطوات عملية، وميّز بين ما تم تنفيذه وما هو اقتراح. لا تدّعِ أنك أنشأت ملفات أو نفذت تغييرات ما لم يؤكد النظام ذلك. عند طلب بناء تطبيق، اسأل عن النواقص الضرورية فقط، واقترح بنية آمنة وقابلة للتوسع. لا تطلب كلمات مرور أو مفاتيح سرية.';
  const $ = id => document.getElementById(id);
  const endpointInput = $('aiEndpoint');
  const endpointStatus = $('aiEndpointStatus');
  const chatLog = $('aiChatLog');
  const promptInput = $('aiPrompt');
  const sendButton = $('aiSend');
  const saveButton = $('saveAiEndpoint');
  const clearButton = $('clearAiChat');
  const exportButton = $('exportAiChat');
  if (!endpointInput || !chatLog || !promptInput) return;

  let history = [];
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (Array.isArray(saved)) history = saved.slice(-30);
  } catch (_) { history = []; }

  endpointInput.value = localStorage.getItem(ENDPOINT_KEY) || '';
  updateEndpointStatus();
  renderHistory();

  function updateEndpointStatus(message) {
    if (message) { endpointStatus.textContent = message; return; }
    endpointStatus.textContent = endpointInput.value.trim()
      ? 'تم حفظ عنوان الاتصال محلياً — لم يتم اختبار الخادم بعد'
      : 'العقل الذكي غير متصل بعد؛ لا يوجد خادم AI مضبوط';
  }

  function addMessage(role, content) {
    history.push({ role, content, time: new Date().toISOString() });
    history = history.slice(-30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    chatLog.replaceChildren();
    if (!history.length) {
      const empty = document.createElement('p');
      empty.className = 'ai-empty';
      empty.textContent = 'ابدأ بكتابة فكرة أو سؤال. ستظهر المحادثة هنا.';
      chatLog.append(empty);
      return;
    }
    history.forEach(item => {
      const bubble = document.createElement('div');
      bubble.className = 'ai-message ' + (item.role === 'user' ? 'user' : 'assistant');
      const label = document.createElement('strong');
      label.textContent = item.role === 'user' ? 'أنت' : 'EVO CORE';
      const body = document.createElement('p');
      body.textContent = item.content;
      bubble.append(label, body);
      chatLog.append(bubble);
    });
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  saveButton.addEventListener('click', () => {
    const value = endpointInput.value.trim();
    if (value && !/^https:\/\/[^ ]+/i.test(value)) {
      updateEndpointStatus('يجب أن يبدأ عنوان الخادم بـ https://');
      return;
    }
    localStorage.setItem(ENDPOINT_KEY, value);
    updateEndpointStatus(value ? 'تم حفظ عنوان الاتصال. استخدم زر إرسال لاختبار الربط.' : 'تم إلغاء عنوان الاتصال.');
  });

  clearButton.addEventListener('click', () => {
    if (!confirm('هل تريد حذف سجل المحادثة المحفوظ على هذا الجهاز؟')) return;
    history = [];
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  });

  exportButton.addEventListener('click', () => {
    const transcript = history.map(item => (item.role === 'user' ? 'أنت' : 'EVO CORE') + ':\n' + item.content).join('\n\n');
    const blob = new Blob([transcript || 'لا توجد محادثة بعد.'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'evo-core-chat.txt';
    link.click();
    URL.revokeObjectURL(url);
  });

  async function sendMessage() {
    const text = promptInput.value.trim();
    if (!text || sendButton.disabled) return;
    const endpoint = localStorage.getItem(ENDPOINT_KEY) || '';
    addMessage('user', text);
    promptInput.value = '';
    if (!endpoint) {
      addMessage('assistant', 'وصلت فكرتك. لكن العقل الذكي الحقيقي لم يُربط بعد. هذه الواجهة جاهزة لاستقبال الردود، ونحتاج الآن إلى خادم وسيط آمن يتصل بمزوّد الذكاء الاصطناعي ويحفظ مفتاحه بعيداً عن المتصفح. لن أقدّم لك رداً تجريبياً على أنه ذكاء اصطناعي حقيقي.');
      updateEndpointStatus('غير متصل — لم يتم ضبط عنوان خادم AI');
      return;
    }

    sendButton.disabled = true;
    sendButton.textContent = 'جارٍ الاتصال...';
    updateEndpointStatus('جارٍ الاتصال بخادم AI...');
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-16).map(item => ({ role: item.role, content: item.content }))
    ];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, app: 'EVO CORE', version: '0.1' }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('الخادم أعاد الحالة ' + response.status);
      const data = await response.json();
      const answer = data.reply || data.message || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('صيغة الرد غير معروفة. أعد reply أو choices[0].message.content');
      addMessage('assistant', answer.trim());
      updateEndpointStatus('تم الاتصال واستلام رد من الخادم');
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'انتهت مهلة الاتصال (45 ثانية).' : error.message;
      addMessage('assistant', 'تعذر الحصول على رد من خادم الذكاء الاصطناعي: ' + reason + '\nتحقق من عنوان الخادم وإعدادات CORS وأنه يقبل POST بصيغة JSON.');
      updateEndpointStatus('فشل الاتصال — راجع إعدادات الخادم');
    } finally {
      clearTimeout(timeout);
      sendButton.disabled = false;
      sendButton.textContent = 'إرسال';
    }
  }

  sendButton.addEventListener('click', sendMessage);
  promptInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
})();