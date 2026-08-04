const RECYCLING_MATERIALS = [
  'Paper', 'Plastic', 'Glass', 'Metal', 'E-Waste', 'Textile', 'Beverage Containers'
];

function validateLogEntry(entry) {
  if (!entry.material || RECYCLING_MATERIALS.indexOf(entry.material) === -1) {
    return 'Please select a material.';
  }
  const qty = Number(entry.quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return 'Please enter a whole number of items greater than 0.';
  }
  return null;
}

function computeTotals(rows, now) {
  const ref = now || new Date();
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const yearStart = new Date(ref.getFullYear(), 0, 1);

  const totals = { month: 0, year: 0, allTime: 0, byMaterial: {} };

  rows.forEach(function (r) {
    const created = new Date(r.created_at);
    const qty = Number(r.quantity) || 0;

    totals.allTime += qty;
    if (created >= yearStart) totals.year += qty;
    if (created >= monthStart) totals.month += qty;

    totals.byMaterial[r.material] = (totals.byMaterial[r.material] || 0) + qty;
  });

  return totals;
}

function sortedMaterialBreakdown(byMaterial) {
  return Object.keys(byMaterial)
    .map(function (material) { return { material: material, quantity: byMaterial[material] }; })
    .sort(function (a, b) { return b.quantity - a.quantity; });
}

async function fetchRecyclingRows() {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('recycling_log')
    .select('material, quantity, created_at');
  if (error) {
    console.error('Failed to fetch recycling log:', error.message);
    return [];
  }
  return data;
}

async function submitRecyclingLog(entry) {
  const client = getSupabaseClient();
  if (!client) {
    const err = new Error('Analytics isn\'t set up yet. Please check back soon.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const { error } = await client.from('recycling_log').insert({
    material: entry.material,
    quantity: Number(entry.quantity)
  });
  if (error) throw error;
}

function formatCount(n) {
  return n.toLocaleString('en-SG');
}

function initAnalyticsPage() {
  const form = document.getElementById('log-form');
  const materialSelect = document.getElementById('log-material');
  const quantityInput = document.getElementById('log-quantity');
  const errorEl = document.getElementById('log-form-error');
  const submitBtn = document.getElementById('log-submit-btn');
  const statusEl = document.getElementById('analytics-status');

  const monthEl = document.getElementById('stat-month');
  const yearEl = document.getElementById('stat-year');
  const allTimeEl = document.getElementById('stat-all-time');
  const breakdownEl = document.getElementById('material-breakdown');

  function renderBreakdown(byMaterial, allTime) {
    breakdownEl.innerHTML = '';
    const sorted = sortedMaterialBreakdown(byMaterial);
    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'breakdown-empty';
      empty.textContent = 'No recycling logged yet — be the first!';
      breakdownEl.appendChild(empty);
      return;
    }
    sorted.forEach(function (item) {
      const pct = allTime > 0 ? Math.round((item.quantity / allTime) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML =
        '<div class="breakdown-label"><span>' + item.material + '</span><span>' + formatCount(item.quantity) + '</span></div>' +
        '<div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:' + pct + '%"></div></div>';
      breakdownEl.appendChild(row);
    });
  }

  async function loadTotals() {
    const rows = await fetchRecyclingRows();
    const totals = computeTotals(rows, new Date());
    monthEl.textContent = formatCount(totals.month);
    yearEl.textContent = formatCount(totals.year);
    allTimeEl.textContent = formatCount(totals.allTime);
    renderBreakdown(totals.byMaterial, totals.allTime);
  }

  RECYCLING_MATERIALS.forEach(function (m) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    materialSelect.appendChild(opt);
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.textContent = '';

    const entry = { material: materialSelect.value, quantity: quantityInput.value };
    const validationError = validateLogEntry(entry);
    if (validationError) {
      errorEl.textContent = validationError;
      return;
    }

    if (typeof isFullyAuthenticated === 'function' && !(await isFullyAuthenticated())) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging…';

    try {
      await submitRecyclingLog(entry);
      form.reset();
      statusEl.textContent = '✅ Thanks — added to the community total!';
      statusEl.className = 'analytics-status success';
      await loadTotals();
      setTimeout(function () {
        statusEl.textContent = '';
        statusEl.className = 'analytics-status';
      }, 3000);
    } catch (err) {
      errorEl.textContent = err.code === 'NOT_CONFIGURED'
        ? err.message
        : 'Something went wrong logging that. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log it';
    }
  });

  loadTotals();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RECYCLING_MATERIALS: RECYCLING_MATERIALS,
    validateLogEntry: validateLogEntry,
    computeTotals: computeTotals,
    sortedMaterialBreakdown: sortedMaterialBreakdown,
    formatCount: formatCount
  };
}
