/* =====================================================================
   attendance.js  -  Check in/out, payslip calculation and the 3 pages:
   admin dashboard, employee dashboard, payslip
   An attendance record looks like:
   { uid (employee id), date, in, out, status, late }
   status is "present", "late" or "half"
   ===================================================================== */

/* ---------- Small helpers ---------- */

// Find the attendance record of one employee on one day (default: today)
function getRecord(employeeId, date = todayString()) {
  return getAttendance().find(record => record.uid === employeeId && record.date === date);
}

// Is the employee on APPROVED leave on this date?
function isOnApprovedLeave(employeeId, date) {
  return getLeaves().some(request =>
    request.uid === employeeId && request.status === 'approved'
    && request.from <= date && date <= request.to);
}

// Work hours = check-out minus check-in
function hoursWorked(record) {
  if (!record || !record.out) return 0;
  return (toMinutes(record.out) - toMinutes(record.in)) / 60;
}

// If a "half day" is also late, show both badges
function extraLateBadge(record) {
  return (record.late && record.status === 'half') ? ' ' + badge('late') : '';
}

/* ---------- Check in and check out ---------- */
function checkIn(employee) {
  const company = getCompany();
  if (!isWorkingDay(new Date())) { showToast('Today is not a working day', true); return; }
  if (getRecord(employee.id)) { showToast('You already checked in today', true); return; }   // one check-in per day

  const time = currentTime();
  // Late = after office start + grace minutes (e.g. 09:00 + 15 = after 09:15)
  const isLate = toMinutes(time) > toMinutes(company.start) + company.grace;

  const allRecords = getAttendance();
  allRecords.push({ uid: employee.id, date: todayString(), in: time, out: '', status: isLate ? 'late' : 'present', late: isLate });
  saveData('hcm_attendance', allRecords);
  showToast('Checked in at ' + time);
}

function checkOut(employee) {
  const allRecords = getAttendance();
  const record = allRecords.find(item => item.uid === employee.id && item.date === todayString());
  if (!record) { showToast('Check in first', true); return; }              // out only after in
  if (record.out) { showToast('You already checked out', true); return; }

  record.out = currentTime();
  if (hoursWorked(record) < 5) record.status = 'half';                     // under 5 hours = half day
  saveData('hcm_attendance', allRecords);
  showToast('Checked out at ' + record.out);
}

/* ---------- Payslip calculation (rules from Section 3 of the PDF) ----------
   yearMonth looks like "2026-10". We go through each day of the month. */
function calculatePayslip(employee, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayString();

  let workingDays = 0, presentDays = 0, halfDays = 0, leaveDays = 0, absentDays = 0;

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const date = new Date(year, month - 1, dayNumber);
    const dateText = dateToString(date);
    if (!isWorkingDay(date)) continue;                                      // skip weekends
    workingDays++;

    if (dateText > today) continue;                                         // future days: nothing yet
    if (dateText < (employee.joined || '0')) continue;                      // before the employee joined

    const record = getRecord(employee.id, dateText);
    if (record) {
      if (record.status === 'half') halfDays++; else presentDays++;
    } else if (isOnApprovedLeave(employee.id, dateText)) {
      leaveDays++;                                                          // approved leave is not absent
    } else if (dateText < today) {
      absentDays++;                                                         // no record on a past working day
    }
  }

  const perDay = workingDays ? employee.salary / workingDays : 0;           // salary / working days
  const deduction = perDay * (absentDays + 0.5 * halfDays);                 // absent + half of half-days
  return {
    workingDays, presentDays, halfDays, leaveDays, absentDays,
    perDay, deduction, net: employee.salary - deduction                     // net = salary - deduction
  };
}

/* ---------- Announcements (Admin posts, employees read) ---------- */
function announcementsHtml() {
  const latestFive = getNotices().slice().reverse().slice(0, 5);
  if (latestFive.length === 0) return '<p class="empty">No announcements.</p>';
  return latestFive.map(notice =>
    `<div class="note">${escapeHtml(notice.text)}<br><small class="mut">${notice.date}</small></div>`).join('');
}

/* =====================================================================
   ADMIN DASHBOARD  (admin.html)
   ===================================================================== */
function adminPage() {
  const admin = requireLogin('admin');
  if (!admin) return;
  const main = buildPageShell('Admin dashboard', admin);

  const today = todayString();
  const employees = getUsers().filter(person => person.role === 'employee');
  const todayRecords = getAttendance().filter(record =>
    record.date === today && employees.some(person => person.id === record.uid));
  const onLeave = employees.filter(person => isOnApprovedLeave(person.id, today));
  const notInYet = isWorkingDay(new Date())
    ? employees.filter(person => !getRecord(person.id) && !isOnApprovedLeave(person.id, today))
    : [];
  const pendingCount = getLeaves().filter(request => request.status === 'pending').length;
  const employeeName = id => (getUsers().find(person => person.id === id) || {}).name;

  const attendanceRows = todayRecords.map(record => `
    <tr><td>${escapeHtml(employeeName(record.uid))}</td><td>${record.in}</td><td>${record.out || '—'}</td>
    <td>${badge(record.status)}${extraLateBadge(record)}</td></tr>`).join('');

  main.innerHTML = `
    <div class="grid">
      <div class="card stat p"><b>${employees.length}</b><span>Employees</span></div>
      <div class="card stat"><b>${todayRecords.length}</b><span>Checked in today</span></div>
      <div class="card stat o"><b>${todayRecords.filter(record => record.late).length}</b><span>Late today</span></div>
      <div class="card stat p"><b>${onLeave.length}</b><span>On leave today</span></div>
      <div class="card stat r"><b>${notInYet.length}</b><span>Not in yet</span></div>
      <div class="card stat o"><b>${pendingCount}</b><span>Pending leaves (<a href="leaves.html" style="text-decoration:underline">review</a>)</span></div>
    </div>
    <div class="cols">
      <div class="card"><h3>Today's attendance</h3><div class="tw">
        ${todayRecords.length
          ? `<table><tr><th>Employee</th><th>In</th><th>Out</th><th>Status</th></tr>${attendanceRows}</table>`
          : '<p class="empty">No check-ins yet today.</p>'}
      </div></div>
      <div class="card"><h3>Smart helper</h3><div id="helperBox"></div></div>
    </div>
    <div class="card">
      <h3>Announcements</h3>
      <form class="row" id="noticeForm"><input name="text" placeholder="Write an announcement"><button class="btn">Post</button></form>
      <div id="noticeList" style="margin-top:12px">${announcementsHtml()}</div>
    </div>`;

  find('#noticeForm').onsubmit = event => {
    event.preventDefault();
    const text = getFormValues(event.target).text.trim();
    if (!text) { showToast('Write something first', true); return; }
    const allNotices = getNotices();
    allNotices.push({ text: text, date: todayString() });
    saveData('hcm_notices', allNotices);
    event.target.reset();
    find('#noticeList').innerHTML = announcementsHtml();
    showToast('Announcement posted');
  };
  setupHelper(find('#helperBox'), admin);
}

/* =====================================================================
   EMPLOYEE DASHBOARD  (employee.html)
   The whole page is redrawn by drawPage() after every action.
   ===================================================================== */
function employeePage() {
  const employee = requireLogin('employee');
  if (!employee) return;
  const main = buildPageShell('My dashboard', employee);

  function drawPage() {
    const todayRecord = getRecord(employee.id);
    const myRecords = getAttendance()
      .filter(record => record.uid === employee.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15);                                                        // last 15 days
    const myLeaves = getLeaves().filter(request => request.uid === employee.id).sort((a, b) => b.id - a.id);

    const attendanceRows = myRecords.map(record => `
      <tr><td>${record.date}</td><td>${record.in}</td><td>${record.out || '—'}</td>
      <td>${record.out ? hoursWorked(record).toFixed(1) : '—'}</td>
      <td>${badge(record.status)}${extraLateBadge(record)}</td></tr>`).join('');

    const leaveRows = myLeaves.map(request => `
      <tr><td>${request.type}</td><td>${request.from} → ${request.to}</td><td>${request.days}</td>
      <td>${badge(request.status)}${request.comment ? `<br><small class="mut">${escapeHtml(request.comment)}</small>` : ''}</td></tr>`).join('');

    main.innerHTML = `
      <div class="grid">
        <div class="card stat"><b>${todayRecord ? todayRecord.status : 'Not in'}</b><span>Today's status</span></div>
        <div class="card stat p"><b>${leaveBalance(employee.id)}</b><span>Leave days left this year</span></div>
        <div class="card stat o"><b>${usedLeaveDays(employee.id, ['pending'])}</b><span>Days pending approval</span></div>
      </div>
      <div class="cols">
        <div class="card">
          <h3>Check in / out</h3>
          <div class="clock" id="clock"></div>
          <p class="mut" style="margin-bottom:12px">${todayRecord
            ? `In ${todayRecord.in}${todayRecord.out ? ' · Out ' + todayRecord.out : ''}`
            : 'You have not checked in today.'}</p>
          <div class="row">
            <button class="btn" id="checkInButton" ${todayRecord ? 'disabled' : ''}>Check in</button>
            <button class="btn o" id="checkOutButton" ${(!todayRecord || todayRecord.out) ? 'disabled' : ''}>Check out</button>
          </div>
        </div>
        <div class="card"><h3>Smart helper</h3><div id="helperBox"></div></div>
      </div>
      <div class="cols">
        <div class="card"><h3>Apply for leave</h3>${leaveFormHtml()}
          <p class="mut" style="margin-top:10px">Weekends and non-working days are not counted.</p></div>
        <div class="card"><h3>Announcements</h3>${announcementsHtml()}</div>
      </div>
      <div class="cols">
        <div class="card"><h3>My attendance</h3><div class="tw">
          ${myRecords.length ? `<table><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr>${attendanceRows}</table>` : '<p class="empty">No attendance yet.</p>'}
        </div></div>
        <div class="card"><h3>My leaves</h3><div class="tw">
          ${myLeaves.length ? `<table><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr>${leaveRows}</table>` : '<p class="empty">No leave requests.</p>'}
        </div></div>
      </div>`;

    find('#checkInButton').onclick = () => { checkIn(employee); drawPage(); };
    find('#checkOutButton').onclick = () => { checkOut(employee); drawPage(); };
    find('#leaveForm').onsubmit = event => { event.preventDefault(); submitLeave(employee, event.target, drawPage); };
    setupHelper(find('#helperBox'), employee);

    // Live clock, updated every second
    const showTime = () => { const clock = find('#clock'); if (clock) clock.textContent = new Date().toLocaleTimeString(); };
    showTime();
    clearInterval(window.clockTimer);
    window.clockTimer = setInterval(showTime, 1000);
  }
  drawPage();
}

/* =====================================================================
   PAYSLIP PAGE  (payslip.html)
   Admin can pick any employee; an Employee only sees their own.
   ===================================================================== */
function payslipPage() {
  const user = requireLogin();
  if (!user) return;
  const main = buildPageShell('Payslip', user);
  const isAdmin = user.role === 'admin';
  const employees = getUsers().filter(person => person.role === 'employee');

  const employeePicker = isAdmin
    ? `<select id="employeePicker">${employees.map(person => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join('')}</select>`
    : '';
  main.innerHTML = `
    <div class="card noprint row" style="margin-bottom:16px">
      ${employeePicker}
      <input type="month" id="monthPicker" value="${todayString().slice(0, 7)}">
      <button class="btn pur" id="printButton">Print / save as PDF</button>
    </div>
    <div class="card" id="slip" style="max-width:640px"></div>`;

  function drawSlip() {
    const employee = isAdmin
      ? employees.find(person => String(person.id) === find('#employeePicker').value)
      : user;
    if (!employee) { find('#slip').innerHTML = '<p class="empty">Add an employee to see payslips.</p>'; return; }

    const yearMonth = find('#monthPicker').value || todayString().slice(0, 7);
    const slip = calculatePayslip(employee, yearMonth);

    find('#slip').innerHTML = `
      <h2>${escapeHtml(getCompany().name)}</h2>
      <p class="mut" style="margin-bottom:12px">Payslip for ${yearMonth}</p>
      <p><b>${escapeHtml(employee.name)}</b> · ${escapeHtml(employee.department)}<br><span class="mut">${escapeHtml(employee.email)}</span></p>
      <div class="tw"><table class="slip" style="margin-top:12px">
        <tr><th>Item</th><th>Value</th></tr>
        <tr><td>Monthly salary</td><td>${formatMoney(employee.salary)}</td></tr>
        <tr><td>Working days in month</td><td>${slip.workingDays}</td></tr>
        <tr><td>Present days</td><td>${slip.presentDays}</td></tr>
        <tr><td>Half days</td><td>${slip.halfDays}</td></tr>
        <tr><td>Approved leave days</td><td>${slip.leaveDays}</td></tr>
        <tr><td>Absent days</td><td>${slip.absentDays}</td></tr>
        <tr><td>Salary per day</td><td>${formatMoney(slip.perDay)}</td></tr>
        <tr><td>Deduction (absent + ½ × half days)</td><td>− ${formatMoney(slip.deduction)}</td></tr>
        <tr class="net"><td>Net salary</td><td>${formatMoney(slip.net)}</td></tr>
      </table></div>`;
  }

  findAll('#employeePicker, #monthPicker').forEach(control => control.onchange = drawSlip);
  find('#printButton').onclick = () => window.print();      // the browser's "Save as PDF" works here
  drawSlip();
}