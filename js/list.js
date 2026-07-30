function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' m away';
  return km.toFixed(1) + ' km away';
}

function mapsUrl(bin) {
  const query = (typeof bin.lat === 'number' && typeof bin.lng === 'number')
    ? bin.lat + ',' + bin.lng
    : bin.address;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

const TOWN_CENTERS = [
  { name: "Ang Mo Kio", lat: 1.369933, lng: 103.849558 },
  { name: "Bedok", lat: 1.32398, lng: 103.929984 },
  { name: "Bishan", lat: 1.351019, lng: 103.850057 },
  { name: "Bukit Batok", lat: 1.349033, lng: 103.749566 },
  { name: "Bukit Merah", lat: 1.289635, lng: 103.816741 },
  { name: "Choa Chu Kang", lat: 1.385368, lng: 103.744085 },
  { name: "Clementi", lat: 1.315116, lng: 103.765191 },
  { name: "Hougang", lat: 1.370335, lng: 103.892262 },
  { name: "Jurong East", lat: 1.333028, lng: 103.74237 },
  { name: "Jurong West", lat: 1.338604, lng: 103.706065 },
  { name: "Pasir Ris", lat: 1.367129, lng: 103.960557 },
  { name: "Punggol", lat: 1.414927, lng: 103.910166 },
  { name: "Queenstown", lat: 1.294551, lng: 103.806077 },
  { name: "Sembawang", lat: 1.449051, lng: 103.820046 },
  { name: "Sengkang", lat: 1.391695, lng: 103.895485 },
  { name: "Serangoon", lat: 1.351048, lng: 103.87107 },
  { name: "Tampines", lat: 1.356191, lng: 103.954634 },
  { name: "Toa Payoh", lat: 1.332629, lng: 103.847502 },
  { name: "Woodlands", lat: 1.43682, lng: 103.786067 },
  { name: "Yishun", lat: 1.429443, lng: 103.835005 }
];

function findTownMatch(query) {
  const norm = query.trim().toLowerCase();
  if (!norm) return null;
  return TOWN_CENTERS.find(function (t) { return t.name.toLowerCase() === norm; }) || null;
}

function populateTownList() {
  const datalist = document.getElementById('town-options');
  if (!datalist) return;
  TOWN_CENTERS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (t) {
    const opt = document.createElement('option');
    opt.value = t.name;
    datalist.appendChild(opt);
  });
}

function initBinList(data, category) {
  const listEl = document.getElementById('bin-list');
  const countEl = document.getElementById('result-count');
  const emptyEl = document.getElementById('empty-state');
  const searchEl = document.getElementById('search-input');

  let reportsByBin = {};
  const expandedBins = {};

  populateTownList();

  function loadReports() {
    fetchReportsByBin(category).then(function (map) {
      reportsByBin = map;
      render();
    });
  }

  function renderReportsPanel(bin, reports) {
    const panel = document.createElement('div');
    panel.className = 'report-list';
    reports.forEach(function (r) {
      const item = document.createElement('div');
      item.className = 'report-list-item';
      const meta = REPORT_TYPE_LABELS[r.report_type] || REPORT_TYPE_LABELS.other;
      const head = document.createElement('p');
      head.className = 'report-list-item-head';
      head.textContent = meta.icon + ' ' + meta.label + ' · ' + timeAgo(r.created_at);
      item.appendChild(head);
      if (r.description) {
        const desc = document.createElement('p');
        desc.className = 'report-list-item-desc';
        desc.textContent = r.description;
        item.appendChild(desc);
      }
      if (r.photo_url) {
        const img = document.createElement('img');
        img.className = 'report-list-item-photo';
        img.src = r.photo_url;
        img.alt = 'Reported issue photo';
        img.loading = 'lazy';
        item.appendChild(img);
      }
      panel.appendChild(item);
    });
    return panel;
  }

  function render() {
    const rawQuery = searchEl.value.trim();
    const query = rawQuery.toLowerCase();
    const townMatch = findTownMatch(rawQuery);
    const anchor = townMatch ? { lat: townMatch.lat, lng: townMatch.lng } : null;

    let filtered = data;
    if (query && !townMatch) {
      filtered = filtered.filter(function (b) {
        return b.name.toLowerCase().includes(query) ||
          b.address.toLowerCase().includes(query) ||
          b.region.toLowerCase().includes(query);
      });
    }

    if (anchor) {
      filtered = filtered.map(function (b) {
        return Object.assign({}, b, { distanceKm: haversineKm(anchor.lat, anchor.lng, b.lat, b.lng) });
      }).sort(function (a, b) { return a.distanceKm - b.distanceKm; });
    }

    listEl.innerHTML = '';
    filtered.forEach(function (b, i) {
      const li = document.createElement('li');
      li.className = 'bin-item';

      const info = document.createElement('div');
      info.className = 'info';

      const h3 = document.createElement('h3');
      h3.textContent = b.name;
      info.appendChild(h3);

      const addr = document.createElement('p');
      addr.className = 'address';
      addr.textContent = b.address || 'Exact address not listed — use Get Directions for the pinned spot';
      info.appendChild(addr);

      const tag = document.createElement('span');
      tag.className = 'region-tag';
      tag.textContent = b.region;
      info.appendChild(tag);

      if (typeof b.distanceKm === 'number') {
        const dist = document.createElement('span');
        dist.className = 'distance-tag' + (i === 0 ? ' nearest' : '');
        dist.textContent = (i === 0 ? '📍 Nearest · ' : '') + formatDistance(b.distanceKm);
        info.appendChild(dist);
      }

      const id = binId(b);
      const reports = reportsByBin[id] || [];

      if (reports.length > 0) {
        const worst = reports.find(function (r) { return r.report_type === 'full'; }) || reports[0];
        const meta = REPORT_TYPE_LABELS[worst.report_type] || REPORT_TYPE_LABELS.other;
        const warn = document.createElement('button');
        warn.type = 'button';
        warn.className = 'report-warning';
        warn.textContent = meta.icon + ' ' + meta.label + (reports.length > 1 ? ' (+' + (reports.length - 1) + ' more)' : '') + ' — tap to view';
        warn.addEventListener('click', function () {
          expandedBins[id] = !expandedBins[id];
          render();
        });
        info.appendChild(warn);

        if (expandedBins[id]) {
          info.appendChild(renderReportsPanel(b, reports));
        }
      }

      const actions = document.createElement('div');
      actions.className = 'bin-actions';

      const link = document.createElement('a');
      link.className = 'directions-link';
      link.target = '_blank';
      link.rel = 'noopener';
      link.href = mapsUrl(b);
      link.textContent = 'Get Directions';
      actions.appendChild(link);

      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.className = 'report-link';
      reportBtn.textContent = 'Report an issue';
      reportBtn.addEventListener('click', function () {
        openReportModal(b, category, loadReports);
      });
      actions.appendChild(reportBtn);

      li.appendChild(info);
      li.appendChild(actions);
      listEl.appendChild(li);
    });

    const suffix = townMatch ? ', sorted by distance from ' + townMatch.name : '';
    countEl.textContent = filtered.length + (filtered.length === 1 ? ' location found' : ' locations found') + suffix;
    emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
  }

  searchEl.addEventListener('input', render);

  render();
  loadReports();
}
