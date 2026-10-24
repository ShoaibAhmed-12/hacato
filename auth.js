// /* =====================================================================
//    auth.js  -  Login, logout, first-run setup, forgot password
//    ===================================================================== */

// // Who is logged in right now? (hcm_session only stores the user's id)
// function getLoggedInUser() {
//   const session = readData('hcm_session', null);
//   if (!session) return null;
//   return getUsers().find(person => person.id === session.id) || null;
// }

// // Each role has its own home page
// function homePageFor(user) {
//   return ROOT + 'pages/' + (user.role === 'admin' ? 'admin' : 'employee') + '.html';
// }

// // Called at the top of every protected page.
// //  - nobody logged in      -> go to login page
// //  - wrong role for page   -> go back to your own dashboard
// function requireLogin(requiredRole) {
//   const user = getLoggedInUser();
//   if (!user || !getCompany()) {
//     location.href = ROOT + 'index.html';
//     return null;
//   }
//   if (requiredRole && user.role !== requiredRole) {
//     location.href = homePageFor(user);
//     return null;
//   }
//   return user;
// }

// function logout() {
//   localStorage.removeItem('hcm_session');
//   location.href = ROOT + 'index.html';
// }

// /* ---------- The login page (index.html) ----------
//    One page shows 4 "views": setup -> login -> forgot -> reset */
// function loginPage() {
//   const loggedIn = getLoggedInUser();
//   if (loggedIn) { location.href = homePageFor(loggedIn); return; }   // already logged in

//   const box = find('#box');
//   let currentView = getCompany() ? 'login' : 'setup';   // first time ever = setup
//   let resetInfo = {};                                    // remembers user id + reset code

//   const heading = (title, text) => `<h2>${title}</h2><p class="mut">${text}</p>`;
//   const backLink = '<p class="link"><a href="#" data-view="login">Back to sign in</a></p>';

//   // The HTML of each view
//   const views = {
//     setup: () => heading('Set up your company', 'First run: create the company and the Admin account.') + `
//       <form>
//         ${inputField('Company name', 'company')}
//         ${inputField('Admin name', 'name')}
//         ${inputField('Admin email', 'email', 'email')}
//         ${inputField('Password', 'password', 'password')}
//         <button class="btn w">Create company</button>
//       </form>`,
//     login: () => heading('Welcome back', 'Sign in to ' + escapeHtml(getCompany().name)) + `
//       <form>
//         ${inputField('Email', 'email', 'email')}
//         ${inputField('Password', 'password', 'password')}
//         <button class="btn w">Sign in</button>
//       </form>
//       <p class="link"><a href="#" data-view="forgot">Forgot password?</a></p>`,
//     forgot: () => heading('Forgot password', 'Enter your account email to get a reset code.') + `
//       <form>
//         ${inputField('Email', 'email', 'email')}
//         <button class="btn w">Send reset code</button>
//       </form>` + backLink,
//     reset: () => heading('Reset password', 'Enter the code and choose a new password.') + `
//       <div class="code">Demo mode (no email server): your code is <b>${resetInfo.code}</b></div>
//       <form>
//         ${inputField('Reset code', 'code')}
//         ${inputField('New password', 'password', 'password')}
//         ${inputField('Confirm password', 'confirm', 'password')}
//         <button class="btn w">Reset password</button>
//       </form>` + backLink
//   };

//   // What happens when each form is submitted
//   const actions = {
//     // First run: save company settings + create the Admin account
//     setup(values, form) {
//       const isValid = showErrors(form, {
//         company: required(values.company), name: required(values.name),
//         email: validEmail(values.email), password: validPassword(values.password)
//       });
//       if (!isValid) return;
//       saveData('hcm_company', {
//         name: values.company.trim(), start: '09:00', grace: 15, quota: 20,
//         workdays: [1, 2, 3, 4, 5]                          // Monday to Friday
//       });
//       saveData('hcm_users', [{
//         id: Date.now(), name: values.name.trim(), email: values.email.trim().toLowerCase(),
//         password: values.password, role: 'admin', department: 'Management', salary: 0, joined: todayString()
//       }]);
//       showToast('Company created. Sign in with your Admin account.');
//       currentView = 'login';
//       draw();
//     },

//     // Check email + password, then save the session and open the right dashboard
//     login(values, form) {
//       const isValid = showErrors(form, { email: validEmail(values.email), password: required(values.password) });
//       if (!isValid) return;
//       const user = getUsers().find(person =>
//         person.email === values.email.trim().toLowerCase() && person.password === values.password);
//       if (!showErrors(form, { password: user ? '' : 'Wrong email or password' })) return;
//       saveData('hcm_session', { id: user.id });
//       location.href = homePageFor(user);
//     },

//     // Find the account by email and make a 6-digit code.
//     // (A real app would email the code; we have no server so we show it on screen.)
//     forgot(values, form) {
//       if (!showErrors(form, { email: validEmail(values.email) })) return;
//       const user = getUsers().find(person => person.email === values.email.trim().toLowerCase());
//       if (!showErrors(form, { email: user ? '' : 'No account uses this email' })) return;
//       resetInfo = { id: user.id, code: String(Math.floor(100000 + Math.random() * 900000)) };
//       currentView = 'reset';
//       draw();
//     },

//     // Check the code, then save the new password
//     reset(values, form) {
//       const isValid = showErrors(form, {
//         code: values.code.trim() !== resetInfo.code ? 'Code is not correct' : '',
//         password: validPassword(values.password),
//         confirm: values.confirm !== values.password ? 'Passwords do not match' : ''
//       });
//       if (!isValid) return;
//       const allUsers = getUsers();
//       allUsers.find(person => person.id === resetInfo.id).password = values.password;
//       saveData('hcm_users', allUsers);
//       showToast('Password updated. Please sign in.');
//       currentView = 'login';
//       draw();
//     }
//   };

//   // Show the current view and connect its form + links
//   function draw() {
//     box.innerHTML = views[currentView]();
//     const form = find('form', box);
//     form.onsubmit = event => {
//       event.preventDefault();                              // stop the page reloading
//       actions[currentView](getFormValues(form), form);
//     };
//     findAll('[data-view]', box).forEach(link => {
//       link.onclick = event => {
//         event.preventDefault();
//         currentView = link.dataset.view;
//         draw();
//       };
//     });
//   }
//   draw();
// }