function binId(bin) {
  return bin.lat.toFixed(6) + '_' + bin.lng.toFixed(6);
}

const REPORT_COOLDOWN_MS = 60 * 1000;
const REPORT_COOLDOWN_KEY = 'recyclesg_last_report_at';

function reportCooldownRemainingMs() {
  const last = Number(localStorage.getItem(REPORT_COOLDOWN_KEY) || 0);
  const remaining = REPORT_COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

function markReportSubmitted() {
  localStorage.setItem(REPORT_COOLDOWN_KEY, String(Date.now()));
}

function validateReportForm(form) {
  if (!form.reportType) {
    return 'Please select what\'s wrong with the bin.';
  }
  if (!form.hasPhoto) {
    return 'Please attach a photo of the bin.';
  }
  if (form.reportType === 'other' && !form.description) {
    return 'Please add a short description for "Other issue".';
  }
  return null;
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function validatePhotoFile(file) {
  if (!file) return null;
  if (!file.type || !file.type.startsWith('image/')) {
    return 'Please choose an image file.';
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Photo must be under 10 MB.';
  }
  return null;
}

const REPORT_VISIBILITY_MS = 24 * 60 * 60 * 1000;

function isReportVisible(createdAtIso) {
  return (Date.now() - new Date(createdAtIso).getTime()) < REPORT_VISIBILITY_MS;
}

// getSupabaseClient() now lives in supabase-config.js, shared with analytics.js

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
  const months = Math.floor(days / 30);
  return months + (months === 1 ? ' month ago' : ' months ago');
}

const REPORT_TYPE_LABELS = {
  full: { icon: '🔴', label: 'Reported full' },
  damaged: { icon: '⚠️', label: 'Reported damaged / not working' },
  other: { icon: 'ℹ️', label: 'Other issue reported' }
};

async function fetchReportsByBin(category) {
  const client = getSupabaseClient();
  if (!client) return {};
  const cutoffIso = new Date(Date.now() - REPORT_VISIBILITY_MS).toISOString();
  const { data, error } = await client
    .from('bin_reports')
    .select('*')
    .eq('bin_category', category)
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Failed to fetch reports:', error.message);
    return {};
  }
  const byBin = {};
  // Defensive re-check client-side too, in case of any clock/timezone drift
  // between this device and the database — a report must pass both.
  data.filter(function (r) { return isReportVisible(r.created_at); }).forEach(function (r) {
    if (!byBin[r.bin_id]) byBin[r.bin_id] = [];
    byBin[r.bin_id].push(r);
  });
  return byBin;
}

async function uploadReportPhoto(file, category, id) {
  const client = getSupabaseClient();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = category + '/' + id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const { error } = await client.storage.from('bin-report-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg'
  });
  if (error) throw error;
  const { data } = client.storage.from('bin-report-photos').getPublicUrl(path);
  return data.publicUrl;
}

async function submitBinReport(opts) {
  const client = getSupabaseClient();
  if (!client) {
    const err = new Error('Reporting isn\'t set up yet. Please check back soon.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  let photoUrl = null;
  if (opts.photoFile) {
    photoUrl = await uploadReportPhoto(opts.photoFile, opts.category, binId(opts.bin));
  }

  const { error } = await client.from('bin_reports').insert({
    bin_category: opts.category,
    bin_id: binId(opts.bin),
    bin_name: opts.bin.name,
    lat: opts.bin.lat,
    lng: opts.bin.lng,
    report_type: opts.reportType,
    description: opts.description || null,
    photo_url: photoUrl
  });
  if (error) throw error;
}

// ---- Modal ----

let _modalEl = null;
let _modalState = null;

function ensureReportModal() {
  if (_modalEl) return _modalEl;

  const overlay = document.createElement('div');
  overlay.className = 'report-modal-overlay';
  overlay.innerHTML =
    '<div class="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">' +
      '<button type="button" class="report-modal-close" aria-label="Close">&times;</button>' +
      '<h3 id="report-modal-title">Report an issue</h3>' +
      '<p class="report-modal-bin-name"></p>' +
      '<form class="report-form">' +
        '<div class="field">' +
          '<label>What\'s wrong?</label>' +
          '<div class="report-type-options">' +
            '<label class="report-type-option"><input type="radio" name="reportType" value="full"><span>🔴 Bin is full</span></label>' +
            '<label class="report-type-option"><input type="radio" name="reportType" value="damaged"><span>⚠️ Damaged / not working</span></label>' +
            '<label class="report-type-option"><input type="radio" name="reportType" value="other"><span>ℹ️ Other issue</span></label>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="report-description">Description <span class="field-hint">(where exactly, and what\'s wrong)</span></label>' +
          '<textarea id="report-description" rows="3" placeholder="e.g. Bin at the carpark entrance is overflowing, lid won\'t close"></textarea>' +
        '</div>' +
        '<div class="field">' +
          '<label for="report-photo">Add a photo <span class="field-hint">(required, under 10 MB)</span></label>' +
          '<input type="file" id="report-photo" accept="image/*">' +
          '<p class="report-photo-privacy">Photos are visible to everyone. Please avoid capturing people, faces, or vehicle license plates.</p>' +
          '<img class="report-photo-preview" alt="Preview" style="display:none;">' +
        '</div>' +
        '<p class="report-form-error" role="alert"></p>' +
        '<div class="report-modal-actions">' +
          '<button type="button" class="report-cancel-btn">Cancel</button>' +
          '<button type="submit" class="report-submit-btn">Submit report</button>' +
        '</div>' +
      '</form>' +
      '<div class="report-success" style="display:none;">✅ Thanks — your report has been posted for other users to see.</div>' +
    '</div>';

  document.body.appendChild(overlay);
  _modalEl = overlay;

  const closeBtn = overlay.querySelector('.report-modal-close');
  const cancelBtn = overlay.querySelector('.report-cancel-btn');
  const form = overlay.querySelector('.report-form');
  const photoInput = overlay.querySelector('#report-photo');
  const photoPreview = overlay.querySelector('.report-photo-preview');
  const errorEl = overlay.querySelector('.report-form-error');
  const submitBtn = overlay.querySelector('.report-submit-btn');
  const successEl = overlay.querySelector('.report-success');

  function closeModal() {
    overlay.classList.remove('open');
    form.reset();
    photoPreview.style.display = 'none';
    errorEl.textContent = '';
    form.style.display = '';
    successEl.style.display = 'none';
    _modalState = null;
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

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

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!_modalState) return;
    errorEl.textContent = '';

    const checkedType = form.querySelector('input[name="reportType"]:checked');
    const reportType = checkedType ? checkedType.value : '';
    const description = form.querySelector('#report-description').value.trim();
    const photoFile = photoInput.files[0] || null;

    const formError = validateReportForm({ reportType: reportType, description: description, hasPhoto: !!photoFile });
    if (formError) {
      errorEl.textContent = formError;
      return;
    }

    const photoError = validatePhotoFile(photoFile);
    if (photoError) {
      errorEl.textContent = photoError;
      return;
    }

    const cooldown = reportCooldownRemainingMs();
    if (cooldown > 0) {
      errorEl.textContent = 'You just submitted a report — please wait ' +
        Math.ceil(cooldown / 1000) + ' more second' + (Math.ceil(cooldown / 1000) === 1 ? '' : 's') +
        ' before submitting another.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      await submitBinReport({
        category: _modalState.category,
        bin: _modalState.bin,
        reportType: reportType,
        description: description,
        photoFile: photoFile
      });
      markReportSubmitted();
      form.style.display = 'none';
      successEl.style.display = 'block';
      if (_modalState.onSubmitted) _modalState.onSubmitted();
      setTimeout(closeModal, 1600);
    } catch (err) {
      errorEl.textContent = err.code === 'NOT_CONFIGURED'
        ? err.message
        : 'Something went wrong submitting your report. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit report';
    }
  });

  return overlay;
}

function openReportModal(bin, category, onSubmitted) {
  const overlay = ensureReportModal();
  _modalState = { bin: bin, category: category, onSubmitted: onSubmitted };
  overlay.querySelector('.report-modal-bin-name').textContent = bin.name + ' — ' + bin.address;
  overlay.classList.add('open');
}

// Node/Vitest export — no effect in the browser (module is undefined there),
// keeps every function above as a plain global for the <script> tags.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    binId: binId,
    timeAgo: timeAgo,
    REPORT_COOLDOWN_MS: REPORT_COOLDOWN_MS,
    reportCooldownRemainingMs: reportCooldownRemainingMs,
    markReportSubmitted: markReportSubmitted,
    validateReportForm: validateReportForm,
    validatePhotoFile: validatePhotoFile,
    MAX_PHOTO_BYTES: MAX_PHOTO_BYTES,
    REPORT_VISIBILITY_MS: REPORT_VISIBILITY_MS,
    isReportVisible: isReportVisible,
    REPORT_TYPE_LABELS: REPORT_TYPE_LABELS
  };
}
