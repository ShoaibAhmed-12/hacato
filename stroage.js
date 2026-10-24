// /* =====================================================================
//    storage.js  -  Shared helpers used by EVERY page
//    1. Read / save data in localStorage
//    2. Date and time helpers
//    3. Form helpers (validation + error messages)
//    4. The page layout (sidebar + top bar)
//    ===================================================================== */

// // Pages inside the "pages" folder must go one folder up to reach index.html
// const ROOT = location.pathname.includes('/pages/') ? '../' : '';

// /* ---------- Short names for finding elements on the page ---------- */
// function find(selector, parent = document) {
//   return parent.querySelector(selector);          // first matching element
// }
// function findAll(selector, parent = document) {
//   return [...parent.querySelectorAll(selector)];  // all matching elements as an array
// }

// /* ---------- localStorage: read and save ----------
//    localStorage only stores text, so we convert with JSON.stringify / JSON.parse. */
// function readData(key, fallback) {
//   try {
//     const value = JSON.parse(localStorage.getItem(key));
//     return value === null ? fallback : value;     // nothing saved yet -> use fallback
//   } catch (error) {
//     return fallback;
//   }
// }
// function saveData(key, value) {
//   localStorage.setItem(key, JSON.stringify(value));
// }

// // One getter per localStorage key (see Section 4 of the hackathon PDF)
// const getCompany    = () => readData('hcm_company', null);   // name + rules
// const getUsers      = () => readData('hcm_users', []);       // admin + employees
// const getAttendance = () => readData('hcm_attendance', []);  // check-in records
// const getLeaves     = () => readData('hcm_leaves', []);      // leave requests
// const getNotices    = () => readData('hcm_notices', []);     // announcements

// /* ---------- Date and time helpers ---------- */
// function pad(number) {                            // 5 -> "05"
//   return String(number).padStart(2, '0');
// }
// function dateToString(date) {                     // Date object -> "2026-10-24"
//   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// }
// function todayString() {
//   return dateToString(new Date());
// }
// function currentTime() {                          // "09:05"
//   const now = new Date();
//   return pad(now.getHours()) + ':' + pad(now.getMinutes());
// }
// function toMinutes(time) {                        // "09:15" -> 555 (easy to compare)
//   const [hours, minutes] = time.split(':');
//   return Number(hours) * 60 + Number(minutes);
// }
// function parseDate(text) {                        // "2026-10-24" -> Date object
//   const [year, month, day] = text.split('-');
//   return new Date(Number(year), Number(month) - 1, Number(day));
// }

// // Is this date a working day? (the Admin chooses working days in Settings)
// function isWorkingDay(date) {
//   return getCompany().workdays.includes(date.getDay());   // 0 = Sunday ... 6 = Saturday
// }

// // Count working days between two dates (weekends are skipped)
// function countWorkingDays(fromText, toText) {
//   let count = 0;
//   const day = parseDate(fromText);
//   const end = parseDate(toText);
//   while (day <= end) {
//     if (isWorkingDay(day)) count++;
//     day.setDate(day.getDate() + 1);                       // move to the next day
//   }
//   return count;
// }

// /* ---------- Text helpers ---------- */
// // Stops users from typing HTML/script into the page (security)
// function escapeHtml(text) {
//   const safe = text === null || text === undefined ? '' : String(text);
//   return safe.replace(/[&<>"']/g, char => (
//     { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
//   ));
// }
// function formatMoney(amount) {
//   return 'Rs ' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// }
// // A coloured label such as "present", "late", "approved"
// function badge(status) {
//   return `<span class="badge ${status}">${status}</span>`;
// }

// /* ---------- Validation: each returns '' (OK) or an error message ---------- */
// function required(value) {
//   return String(value || '').trim() ? '' : 'This field is required';
// }
// function validEmail(value) {
//   if (!String(value || '').trim()) return 'This field is required';
//   const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
//   return looksLikeEmail ? '' : 'Enter a valid email address';
// }
// function validPassword(value) {
//   return String(value || '').length < 6 ? 'Use at least 6 characters' : '';
// }

// /* ---------- Form building and error display ---------- */
// function inputField(label, name, type = 'text', attributes = '', value = '') {
//   return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${attributes}></label>`;
// }
// function selectField(label, name, options) {
//   const optionsHtml = options.map(option => `<option>${option}</option>`).join('');
//   return `<label>${label}<select name="${name}">${optionsHtml}</select></label>`;
// }
// // Reads every input of a form into an object, e.g. { name: 'Ali', email: '...' }
// function getFormValues(form) {
//   return Object.fromEntries(new FormData(form));
// }
// // errors = { fieldName: 'message' }. Shows each message next to its field.
// // Returns true when there are NO errors.
// function showErrors(form, errors) {
//   findAll('.err', form).forEach(oldError => oldError.remove());   // clear old messages
//   let isValid = true;
//   let firstBadField = null;
//   for (const fieldName in errors) {
//     if (!errors[fieldName]) continue;                             // empty = no error
//     isValid = false;
//     const field = form.elements[fieldName];
//     const message = document.createElement('small');
//     message.className = 'err';
//     message.textContent = errors[fieldName];
//     field.closest('label').append(message);                       // show under the field
//     firstBadField = firstBadField || field;
//   }
//   if (firstBadField) firstBadField.focus();
//   return isValid;
// }

// /* ---------- Small pop-ups ---------- */
// function showToast(message, isError) {            // message that disappears after 3 seconds
//   const toast = document.createElement('div');
//   toast.className = 'toast' + (isError ? ' bad' : '');
//   toast.textContent = message;
//   document.body.append(toast);
//   setTimeout(() => toast.remove(), 2800);
// }
// function openDialog(html) {                       // pop-up window for forms
//   const dialog = find('#dlg');
//   dialog.innerHTML = html;
//   dialog.showModal();
//   return dialog;
// }

// /* ---------- Page layout: sidebar + top bar ----------
//    Every logged-in page calls this first, then fills the returned <div id="main">. */
// function buildPageShell(title, user) {
//   const adminLinks = [
//     ['admin', 'Dashboard'], ['employees', 'Employees'], ['leaves', 'Leave requests'],
//     ['settings', 'Settings'], ['payslip', 'Payslips']
//   ];
//   const employeeLinks = [['employee', 'Dashboard'], ['payslip', 'My payslip']];
//   const links = user.role === 'admin' ? adminLinks : employeeLinks;
//   const currentPage = location.pathname.split('/').pop().replace('.html', '');

//   const linksHtml = links.map(([page, label]) =>
//     `<a href="${page}.html" class="${page === currentPage ? 'on' : ''}">${label}</a>`
//   ).join('');

//   document.body.innerHTML = `
//     <aside class="side" id="side">
//       <b>◆ ${escapeHtml(getCompany().name)}</b>
//       ${linksHtml}
//       <span style="flex:1"></span>
//       <a href="#" id="changePassword">Change password</a>
//       <a href="#" id="logoutLink">Log out</a>
//     </aside>
//     <main class="main">
//       <div class="top">
//         <div class="row"><button class="btn ghost burger" id="menuButton" aria-label="Menu">☰</button><h1>${title}</h1></div>
//         <div class="chip">${escapeHtml(user.name)} · ${user.role}</div>
//       </div>
//       <div id="main"></div>
//     </main>
//     <dialog id="dlg"></dialog>`;

//   find('#menuButton').onclick = () => find('#side').classList.toggle('open');   // phone menu
//   find('#logoutLink').onclick = event => { event.preventDefault(); logout(); };
//   find('#changePassword').onclick = event => { event.preventDefault(); openChangePassword(user); };
//   return find('#main');
// }

// // "Change password" pop-up (available to both Admin and Employee)
// function openChangePassword(user) {
//   const dialog = openDialog(`
//     <h3>Change password</h3>
//     <form>
//       ${inputField('Current password', 'oldPassword', 'password')}
//       ${inputField('New password', 'newPassword', 'password')}
//       <div class="row"><button class="btn">Save password</button>
//       <button type="button" class="btn ghost" id="cancelButton">Cancel</button></div>
//     </form>`);
//   find('#cancelButton', dialog).onclick = () => dialog.close();
//   find('form', dialog).onsubmit = event => {
//     event.preventDefault();
//     const form = event.target;
//     const values = getFormValues(form);
//     const allUsers = getUsers();
//     const me = allUsers.find(person => person.id === user.id);
//     const isValid = showErrors(form, {
//       oldPassword: values.oldPassword !== me.password ? 'Current password is wrong' : '',
//       newPassword: validPassword(values.newPassword)
//     });
//     if (!isValid) return;
//     me.password = values.newPassword;
//     saveData('hcm_users', allUsers);
//     dialog.close();
//     showToast('Password changed');
//   };
// }