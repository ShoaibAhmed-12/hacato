/* =====================================================================
   employees.js  -  Admin pages: Manage employees + Company settings
   ===================================================================== */

function employeesPage() {
  const admin = requireLogin('admin');
  if (!admin) return;
  const main = buildPageShell('Employees', admin);

  main.innerHTML = `
    <div class="card">
      <div class="row sb" style="margin-bottom:14px">
        <div class="row" style="flex:1">
          <input id="searchBox" placeholder="Search name or email">
          <select id="departmentFilter"></select>
        </div>
        <button class="btn" id="addButton">+ Add employee</button>
      </div>
      <div class="tw" id="tableArea"></div>
    </div>`;

  const getEmployees = () => getUsers().filter(person => person.role === 'employee');

  // Draw the table using the search text and the department filter
  function drawTable() {
    const searchText = find('#searchBox').value.toLowerCase();
    const chosenDepartment = find('#departmentFilter').value;

    // Fill the department dropdown with the departments that exist
    const departments = [...new Set(getEmployees().map(person => person.department))].sort();
    find('#departmentFilter').innerHTML = '<option value="">All departments</option>' +
      departments.map(name => `<option ${name === chosenDepartment ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');

    const shown = getEmployees().filter(person => {
      const matchesSearch = (person.name + person.email).toLowerCase().includes(searchText);
      const matchesDepartment = !find('#departmentFilter').value || person.department === find('#departmentFilter').value;
      return matchesSearch && matchesDepartment;
    });

    const rows = shown.map(person => `
      <tr>
        <td>${escapeHtml(person.name)}</td>
        <td>${escapeHtml(person.email)}</td>
        <td>${escapeHtml(person.department)}</td>
        <td>${formatMoney(person.salary)}</td>
        <td><div class="row">
          <button class="btn sm ghost" data-edit="${person.id}">Edit</button>
          <button class="btn sm red" data-delete="${person.id}">Delete</button>
        </div></td>
      </tr>`).join('');

    find('#tableArea').innerHTML = shown.length
      ? `<table><tr><th>Name</th><th>Email</th><th>Department</th><th>Salary</th><th></th></tr>${rows}</table>`
      : '<p class="empty">No employees found. Add an employee to create their login.</p>';

    findAll('[data-edit]').forEach(button => button.onclick = () => openEmployeeForm(Number(button.dataset.edit)));
    findAll('[data-delete]').forEach(button => button.onclick = () => openDeleteConfirm(Number(button.dataset.delete)));
  }

  // The Add / Edit pop-up. employeeId is undefined when adding a new employee.
  function openEmployeeForm(employeeId) {
    const employee = getEmployees().find(person => person.id === employeeId) || {};
    const departmentOptions = [...new Set(getEmployees().map(person => person.department))]
      .map(name => `<option>${escapeHtml(name)}</option>`).join('');

    const dialog = openDialog(`
      <h3>${employeeId ? 'Edit' : 'Add'} employee</h3>
      <form>
        ${inputField('Full name', 'name', 'text', '', employee.name)}
        ${inputField('Email (login)', 'email', 'email', '', employee.email)}
        ${inputField(employeeId ? 'New password (leave blank to keep)' : 'Password', 'password', 'password')}
        <label>Department
          <input name="department" list="departmentList" value="${escapeHtml(employee.department || '')}">
          <datalist id="departmentList">${departmentOptions}</datalist>
        </label>
        ${inputField('Monthly salary', 'salary', 'number', 'step="any"', employee.salary)}
        <div class="row"><button class="btn">Save employee</button>
        <button type="button" class="btn ghost" id="cancelButton">Cancel</button></div>
      </form>`);
    find('#cancelButton', dialog).onclick = () => dialog.close();

    find('form', dialog).onsubmit = event => {
      event.preventDefault();
      const form = event.target;
      const values = getFormValues(form);
      const email = values.email.trim().toLowerCase();
      const emailAlreadyUsed = getUsers().some(person => person.email === email && person.id !== employeeId);

      const isValid = showErrors(form, {
        name: required(values.name),
        email: validEmail(values.email) || (emailAlreadyUsed ? 'This email is already used' : ''),
        password: (employeeId && !values.password) ? '' : validPassword(values.password),  // blank is fine when editing
        department: required(values.department),
        salary: Number(values.salary) > 0 ? '' : 'Salary must be greater than 0'
      });
      if (!isValid) return;

      const allUsers = getUsers();
      if (employeeId) {                                    // EDIT: update the existing person
        const person = allUsers.find(item => item.id === employeeId);
        person.name = values.name.trim();
        person.email = email;
        person.department = values.department.trim();
        person.salary = Number(values.salary);
        if (values.password) person.password = values.password;
      } else {                                             // ADD: this also creates the login
        allUsers.push({
          id: Date.now(), name: values.name.trim(), email: email, password: values.password,
          role: 'employee', department: values.department.trim(),
          salary: Number(values.salary), joined: todayString()
        });
      }
      saveData('hcm_users', allUsers);
      dialog.close();
      showToast(employeeId ? 'Employee updated' : 'Employee added. Login created.');
      drawTable();
    };
  }

  // Ask before deleting, then remove the employee and all their records
  function openDeleteConfirm(employeeId) {
    const employee = getEmployees().find(person => person.id === employeeId);
    const dialog = openDialog(`
      <h3>Delete ${escapeHtml(employee.name)}?</h3>
      <p class="mut" style="margin-bottom:14px">This removes the login, attendance and leave records.</p>
      <div class="row"><button class="btn red" id="confirmButton">Delete</button>
      <button class="btn ghost" id="cancelButton">Cancel</button></div>`);
    find('#cancelButton', dialog).onclick = () => dialog.close();
    find('#confirmButton', dialog).onclick = () => {
      saveData('hcm_users', getUsers().filter(person => person.id !== employeeId));
      saveData('hcm_attendance', getAttendance().filter(record => record.uid !== employeeId));
      saveData('hcm_leaves', getLeaves().filter(request => request.uid !== employeeId));
      dialog.close();
      showToast('Employee deleted');
      drawTable();
    };
  }

  find('#addButton').onclick = () => openEmployeeForm();
  find('#searchBox').oninput = drawTable;                  // filter while typing
  find('#departmentFilter').onchange = drawTable;
  drawTable();
}

/* ---------- Company settings: the Admin's rules ---------- */
function settingsPage() {
  const admin = requireLogin('admin');
  if (!admin) return;
  const main = buildPageShell('Company settings', admin);
  const company = getCompany();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const dayCheckboxes = dayNames.map((day, index) => `
    <label><input type="checkbox" name="day${index}" ${company.workdays.includes(index) ? 'checked' : ''}>${day}</label>`).join('');

  main.innerHTML = `
    <div class="card" style="max-width:520px">
      <form>
        ${inputField('Company name', 'name', 'text', '', company.name)}
        ${inputField('Office start time', 'start', 'time', '', company.start)}
        ${inputField('Grace minutes', 'grace', 'number', 'min="0"', company.grace)}
        ${inputField('Yearly leave quota (days)', 'quota', 'number', 'min="0"', company.quota)}
        <label>Working days<span class="days" style="display:block;margin-top:6px">${dayCheckboxes}</span></label>
        <button class="btn">Save settings</button>
      </form>
    </div>`;

  find('form').onsubmit = event => {
    event.preventDefault();
    const form = event.target;
    const values = getFormValues(form);
    // Checked boxes only appear in the form values; collect their day numbers
    const workdays = [];
    dayNames.forEach((day, index) => { if (values['day' + index]) workdays.push(index); });

    const isValid = showErrors(form, {
      name: required(values.name),
      start: required(values.start),
      grace: (values.grace === '' || Number(values.grace) < 0) ? 'Enter 0 or more' : '',
      quota: (values.quota === '' || Number(values.quota) < 0) ? 'Enter 0 or more' : ''
    });
    if (!isValid) return;
    if (workdays.length === 0) { showToast('Select at least one working day', true); return; }

    saveData('hcm_company', {
      name: values.name.trim(), start: values.start,
      grace: Number(values.grace), quota: Number(values.quota), workdays: workdays
    });
    showToast('Settings saved');
  };
}