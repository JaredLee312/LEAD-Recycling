function initMyReportsPage() {
  const listEl = document.getElementById('my-reports-list');
  const emptyEl = document.getElementById('my-reports-empty');

  function renderReport(report) {
    const li = document.createElement('li');
    li.className = 'my-report-item';
    li.dataset.id = report.id;

    const typeInfo = REPORT_TYPE_LABELS[report.report_type] || { icon: 'ℹ️', label: report.report_type };

    li.innerHTML =
      '<div class="my-report-main">' +
        (report.photo_url ? '<img class="my-report-photo" src="' + report.photo_url + '" alt="">' : '') +
        '<div class="my-report-info">' +
          '<div class="my-report-head">' +
            '<span class="my-report-badge">' + report.bin_category + '</span>' +
            '<span class="my-report-time">' + timeAgo(report.created_at) + '</span>' +
          '</div>' +
          '<h3>' + report.bin_name + '</h3>' +
          '<p class="my-report-type">' + typeInfo.icon + ' ' + typeInfo.label + '</p>' +
          (report.description ? '<p class="my-report-desc">' + report.description + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="my-report-actions">' +
        '<button type="button" class="report-edit-btn">Edit</button>' +
        '<button type="button" class="report-delete-btn">Delete</button>' +
      '</div>' +
      '<form class="report-form my-report-edit-form" style="display:none">' +
        '<div class="field">' +
          '<label>What\'s wrong?</label>' +
          '<div class="report-type-options">' +
            '<label class="report-type-option"><input type="radio" name="editReportType" value="full"><span>🔴 Bin is full</span></label>' +
            '<label class="report-type-option"><input type="radio" name="editReportType" value="damaged"><span>⚠️ Damaged / not working</span></label>' +
            '<label class="report-type-option"><input type="radio" name="editReportType" value="other"><span>ℹ️ Other issue</span></label>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label>Description <span class="field-hint">(where exactly, and what\'s wrong)</span></label>' +
          '<textarea class="my-report-edit-description" rows="3"></textarea>' +
        '</div>' +
        '<p class="report-form-error" role="alert"></p>' +
        '<div class="report-modal-actions">' +
          '<button type="button" class="report-cancel-btn">Cancel</button>' +
          '<button type="submit" class="report-submit-btn">Save changes</button>' +
        '</div>' +
      '</form>';

    const editBtn = li.querySelector('.report-edit-btn');
    const deleteBtn = li.querySelector('.report-delete-btn');
    const editForm = li.querySelector('.my-report-edit-form');
    const mainEl = li.querySelector('.my-report-main');
    const actionsEl = li.querySelector('.my-report-actions');
    const cancelBtn = li.querySelector('.report-cancel-btn');
    const errorEl = li.querySelector('.report-form-error');
    const descriptionInput = li.querySelector('.my-report-edit-description');

    editBtn.addEventListener('click', function () {
      const radio = editForm.querySelector('input[value="' + report.report_type + '"]');
      if (radio) radio.checked = true;
      descriptionInput.value = report.description || '';
      errorEl.textContent = '';
      mainEl.style.display = 'none';
      actionsEl.style.display = 'none';
      editForm.style.display = 'block';
    });

    cancelBtn.addEventListener('click', function () {
      editForm.style.display = 'none';
      mainEl.style.display = '';
      actionsEl.style.display = '';
    });

    editForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorEl.textContent = '';
      const checkedType = editForm.querySelector('input[name="editReportType"]:checked');
      const reportType = checkedType ? checkedType.value : '';
      const description = descriptionInput.value.trim();

      const validationError = validateReportEdit({ reportType: reportType, description: description });
      if (validationError) {
        errorEl.textContent = validationError;
        return;
      }

      const submitBtn = editForm.querySelector('.report-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      try {
        await updateBinReport(report.id, { reportType: reportType, description: description });
        report.report_type = reportType;
        report.description = description;
        const refreshed = renderReport(report);
        li.replaceWith(refreshed);
      } catch (err) {
        errorEl.textContent = 'Something went wrong saving your changes. Please try again.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save changes';
      }
    });

    deleteBtn.addEventListener('click', async function () {
      const confirmed = window.confirm('Delete this report? This can\'t be undone.');
      if (!confirmed) return;
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting…';
      try {
        await deleteBinReport(report);
        li.remove();
        if (listEl.children.length === 0) {
          emptyEl.style.display = 'block';
        }
      } catch (err) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
        window.alert('Something went wrong deleting that report. Please try again.');
      }
    });

    return li;
  }

  async function loadReports() {
    const reports = await fetchMyReports();
    listEl.innerHTML = '';
    if (reports.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    reports.forEach(function (report) {
      listEl.appendChild(renderReport(report));
    });
  }

  loadReports();
}
