const CATEGORY_INFO = {
  'blue-bin': { label: 'Blue Bin', icon: '♻️', href: 'blue-bin.html' },
  'e-waste': { label: 'E-Waste', icon: '🔌', href: 'e-waste.html' },
  'textile': { label: 'Textile Bin', icon: '👕', href: 'textile.html' },
  'bcrs': { label: 'Beverage Container Return', icon: '🥤', href: 'bcrs.html' }
};

function validateAssistantForm(form) {
  if (!form.hasPhoto) {
    return 'Please attach a photo of the item.';
  }
  return null;
}

const ASSISTANT_COOLDOWN_MS = 15 * 1000;
const ASSISTANT_COOLDOWN_KEY = 'recyclesg_last_assistant_query_at';

function assistantCooldownRemainingMs() {
  const last = Number(localStorage.getItem(ASSISTANT_COOLDOWN_KEY) || 0);
  const remaining = ASSISTANT_COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

function markAssistantQueried() {
  localStorage.setItem(ASSISTANT_COOLDOWN_KEY, String(Date.now()));
}

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      // reader.result is "data:<mime>;base64,<data>" — strip the prefix
      const commaIndex = reader.result.indexOf(',');
      resolve(reader.result.slice(commaIndex + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function classifyPhoto(file, note) {
  const client = getSupabaseClient();
  if (!client) {
    const err = new Error('The assistant isn\'t set up yet. Please check back soon.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const imageBase64 = await fileToBase64(file);
  const { data, error } = await client.functions.invoke('classify-recyclable', {
    body: { imageBase64: imageBase64, mimeType: file.type, note: note || '' }
  });
  if (error) throw error;
  if (data && data.error) {
    const err = new Error(data.error);
    throw err;
  }
  return data.result;
}

// Node/Vitest export — no effect in the browser (module is undefined there),
// keeps every function above as a plain global for the <script> tags.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CATEGORY_INFO: CATEGORY_INFO,
    validateAssistantForm: validateAssistantForm,
    ASSISTANT_COOLDOWN_MS: ASSISTANT_COOLDOWN_MS,
    assistantCooldownRemainingMs: assistantCooldownRemainingMs,
    markAssistantQueried: markAssistantQueried
  };
}
