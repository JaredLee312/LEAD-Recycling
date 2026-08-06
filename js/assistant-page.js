function initAssistantPage() {
  const chatEl = document.getElementById('assistant-chat');
  const form = document.getElementById('assistant-form');
  const photoInput = document.getElementById('assistant-photo');
  const photoPreview = document.getElementById('assistant-photo-preview');
  const noteInput = document.getElementById('assistant-note');
  const errorEl = document.getElementById('assistant-form-error');
  const submitBtn = document.getElementById('assistant-submit-btn');

  photoInput.addEventListener('change', function () {
    const file = photoInput.files[0];
    errorEl.textContent = '';
    if (!file) {
      photoPreview.style.display = 'none';
      return;
    }
    const photoError = validatePhotoFile(file);
    if (photoError) {
      errorEl.textContent = photoError;
      photoInput.value = '';
      photoPreview.style.display = 'none';
      return;
    }
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.style.display = 'block';
  });

  function appendUserMessage(file, note) {
    const li = document.createElement('div');
    li.className = 'chat-msg chat-msg-user';
    const img = document.createElement('img');
    img.className = 'chat-msg-photo';
    img.src = URL.createObjectURL(file);
    img.alt = '';
    li.appendChild(img);
    if (note) {
      const noteEl = document.createElement('p');
      noteEl.className = 'chat-msg-note';
      noteEl.textContent = note;
      li.appendChild(noteEl);
    }
    chatEl.appendChild(li);
    chatEl.scrollTop = chatEl.scrollHeight;
    return li;
  }

  function appendThinkingMessage() {
    const li = document.createElement('div');
    li.className = 'chat-msg chat-msg-ai chat-msg-thinking';
    li.textContent = 'Looking at your photo…';
    chatEl.appendChild(li);
    chatEl.scrollTop = chatEl.scrollHeight;
    return li;
  }

  function renderResultInto(el, result) {
    el.className = 'chat-msg chat-msg-ai';
    el.innerHTML = '';

    const verdict = document.createElement('p');
    verdict.className = 'chat-msg-verdict';
    const categoryInfo = CATEGORY_INFO[result.category];
    if (result.recyclable && categoryInfo) {
      verdict.innerHTML = '✅ <strong>' + escapeHtml(result.item) + '</strong> — recycle this in the ' + categoryInfo.icon + ' ' + categoryInfo.label;
    } else {
      verdict.innerHTML = '🚫 <strong>' + escapeHtml(result.item) + '</strong> — not recyclable through our bins';
    }
    el.appendChild(verdict);

    const reason = document.createElement('p');
    reason.className = 'chat-msg-reason';
    reason.textContent = result.reason;
    el.appendChild(reason);

    if (result.recyclable && categoryInfo) {
      const link = document.createElement('a');
      link.className = 'chat-msg-link';
      link.href = categoryInfo.href;
      link.textContent = 'Find ' + categoryInfo.label + ' locations near you →';
      el.appendChild(link);
    }
  }

  function renderErrorInto(el, message) {
    el.className = 'chat-msg chat-msg-ai chat-msg-error';
    el.textContent = message;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.textContent = '';

    const file = photoInput.files[0] || null;
    const note = noteInput.value.trim();

    const formError = validateAssistantForm({ hasPhoto: !!file });
    if (formError) {
      errorEl.textContent = formError;
      return;
    }

    const photoError = validatePhotoFile(file);
    if (photoError) {
      errorEl.textContent = photoError;
      return;
    }

    const cooldown = assistantCooldownRemainingMs();
    if (cooldown > 0) {
      errorEl.textContent = 'Please wait ' + Math.ceil(cooldown / 1000) + ' more second' +
        (Math.ceil(cooldown / 1000) === 1 ? '' : 's') + ' before asking again.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Thinking…';

    appendUserMessage(file, note);
    const thinkingEl = appendThinkingMessage();

    try {
      const result = await classifyPhoto(file, note);
      markAssistantQueried();
      renderResultInto(thinkingEl, result);
      form.reset();
      photoPreview.style.display = 'none';
    } catch (err) {
      renderErrorInto(thinkingEl, err.code === 'NOT_CONFIGURED' ? err.message : 'Something went wrong looking at that photo. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ask the assistant';
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  });
}
