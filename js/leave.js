/* =====================================================================
   leave.js  -  Leave rules (balance, apply) + Admin leave requests page
   A leave request looks like:
   { id, uid (employee id), type, from, to, days, reason, status, comment }
   status is "pending", "approved" or "rejected"
   ===================================================================== */

const currentYear = () => String(new Date().getFullYear());

// Total leave days of an employee this year, for the given statuses
function usedLeaveDays(employeeId, statuses = ['approved']) {
  return getLeaves()
    .filter(request => request.uid === employeeId
                    && statuses.includes(request.status)
                    && request.from.startsWith(currentYear()))
    .reduce((total, request) => total + request.days, 0);
}

// Days left = yearly quota (set by Admin) minus approved days
function leaveBalance(employeeId) {
  return getCompany().quota - usedLeaveDays(employeeId);
}

// The "Apply for leave" form (shown on the employee dashboard)
function leaveFormHtml() {
  return `
    <form id="leaveForm">
      ${selectField('Type', 'type', ['Casual', 'Sick', 'Annual'])}
      ${inputField('From', 'from', 'date')}
      ${inputField('To', 'to', 'date')}
      <label>Reason<textarea name="reason" rows="2"></textarea></label>
      <button class="btn">Apply for leave</button>
    </form>`;
}

// Check the leave rules, then save the request as "pending"
function submitLeave(employee, form, afterSave) {
  const values = getFormValues(form);

  // 1. Basic checks: required fields and From <= To
  const basicOk = showErrors(form, {
    from: required(values.from),
    to: !values.to ? 'This field is required'
        : (values.from && values.to < values.from) ? 'To date must be on or after From date' : '',
    reason: required(values.reason)
  });
  if (!basicOk) return;

  // 2. Count working days only (weekends skipped)
  const days = countWorkingDays(values.from, values.to);
  if (days === 0) { showErrors(form, { to: 'No working days in this range' }); return; }

  // 3. Must not overlap another (non-rejected) leave of the same employee
  const overlaps = getLeaves().some(request =>
    request.uid === employee.id && request.status !== 'rejected'
    && request.from <= values.to && values.from <= request.to);
  if (overlaps) { showErrors(form, { from: 'Overlaps another leave request' }); return; }

  // 4. Must not go over the yearly quota (pending requests count too)
  const totalAfter = usedLeaveDays(employee.id, ['approved', 'pending']) + days;
  if (totalAfter > getCompany().quota) {
    showErrors(form, { to: `Over your yearly quota (${leaveBalance(employee.id)} days left, pending requests included)` });
    return;
  }

  const allLeaves = getLeaves();
  allLeaves.push({
    id: Date.now(), uid: employee.id, type: values.type, from: values.from, to: values.to,
    days: days, reason: values.reason.trim(), status: 'pending', comment: '', applied: todayString()
  });
  saveData('hcm_leaves', allLeaves);
  showToast(`Leave requested for ${days} working day(s)`);
  afterSave();
}

/* ---------- Admin page: approve or reject leave ---------- */
function leavesPage() {
  const admin = requireLogin('admin');
  if (!admin) return;
  const main = buildPageShell('Leave requests', admin);

  main.innerHTML = `
    <div class="card">
      <div class="row" style="margin-bottom:12px">
        <select id="statusFilter" style="max-width:200px">
          <option value="">All statuses</option><option>pending</option><option>approved</option><option>rejected</option>
        </select>
      </div>
      <div class="tw" id="tableArea"></div>
    </div>`;

  const employeeName = id => (getUsers().find(person => person.id === id) || {}).name;

  function drawTable() {
    const chosenStatus = find('#statusFilter').value;
    const shown = getLeaves()
      .filter(request => !chosenStatus || request.status === chosenStatus)
      .sort((a, b) => b.id - a.id);                        // newest first

    const rows = shown.map(request => `
      <tr>
        <td>${escapeHtml(employeeName(request.uid))}</td>
        <td>${request.type}</td><td>${request.from}</td><td>${request.to}</td><td>${request.days}</td>
        <td>${escapeHtml(request.reason)}</td>
        <td>${badge(request.status)}${request.comment ? `<br><small class="mut">${escapeHtml(request.comment)}</small>` : ''}</td>
        <td>${request.status === 'pending' ? `<button class="btn sm" data-review="${request.id}">Review</button>` : ''}</td>
      </tr>`).join('');

    find('#tableArea').innerHTML = shown.length
      ? `<table><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr>${rows}</table>`
      : '<p class="empty">No leave requests.</p>';
    findAll('[data-review]').forEach(button => button.onclick = () => openReview(Number(button.dataset.review)));
  }

  // Pop-up with a comment box and Approve / Reject buttons
  function openReview(requestId) {
    const dialog = openDialog(`
      <h3>Review leave</h3>
      <form>
        <label>Comment<textarea name="comment" rows="3"></textarea></label>
        <div class="row">
          <button class="btn" value="approved">Approve</button>
          <button class="btn red" value="rejected">Reject</button>
          <button type="button" class="btn ghost" id="cancelButton">Cancel</button>
        </div>
      </form>`);
    find('#cancelButton', dialog).onclick = () => dialog.close();

    find('form', dialog).onsubmit = event => {
      event.preventDefault();
      const form = event.target;
      const decision = event.submitter.value;              // value of the button that was clicked
      const comment = form.elements.comment.value.trim();

      if (!showErrors(form, { comment: (decision === 'rejected' && !comment) ? 'Add a comment when rejecting' : '' })) return;

      const allLeaves = getLeaves();
      const request = allLeaves.find(item => item.id === requestId);
      if (decision === 'approved' && usedLeaveDays(request.uid) + request.days > getCompany().quota) {
        showErrors(form, { comment: 'Approving would exceed the yearly quota' });
        return;
      }
      request.status = decision;                           // balance updates automatically from this
      request.comment = comment;
      saveData('hcm_leaves', allLeaves);
      dialog.close();
      showToast('Leave ' + decision);
      drawTable();
    };
  }

  find('#statusFilter').onchange = drawTable;
  drawTable();
}