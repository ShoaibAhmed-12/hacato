/* =====================================================================
   helper.js  -  The "Smart helper" chat box
   It looks for KEYWORDS in the question (text.includes("leave")) and
   answers with real numbers from the app's data. No AI service is used.
   Employees can only get answers about their own data.
   ===================================================================== */

// Returns the answer text for a question
function answerQuestion(question, user) {
  const text = question.toLowerCase();
  const today = todayString();
  const employees = getUsers().filter(person => person.role === 'employee');
  const joinNames = list => list.length ? list.map(person => person.name).join(', ') : 'nobody';

  /* ----- Admin questions: can use all company data ----- */
  if (user.role === 'admin') {
    if (text.includes('pending')) {
      const count = getLeaves().filter(request => request.status === 'pending').length;
      return `There are ${count} pending leave request(s).`;
    }
    if (text.includes('leave')) {                                   // "Who is on leave today?"
      const onLeave = employees.filter(person => isOnApprovedLeave(person.id, today));
      return `${onLeave.length} on leave today: ${joinNames(onLeave)}.`;
    }
    if (text.includes('late')) {                                    // "Who was late today?"
      const lateList = employees.filter(person => (getRecord(person.id) || {}).late);
      return `${lateList.length} late today: ${joinNames(lateList)}.`;
    }
    if (text.includes('absent') || text.includes('not in')) {
      const missing = employees.filter(person => !getRecord(person.id) && !isOnApprovedLeave(person.id, today));
      return `${missing.length} not checked in yet: ${joinNames(missing)}.`;
    }
    if (text.includes('present') || text.includes('check')) {
      const checkedIn = employees.filter(person => getRecord(person.id)).length;
      return `${checkedIn} of ${employees.length} employees have checked in today.`;
    }
    if (text.includes('employee') || text.includes('staff')) {      // "How many employees do we have?"
      return `You have ${employees.length} employee(s).`;
    }
    return 'Try: "How many employees do we have?", "Who is on leave today?", "Who was late today?", "Who is absent?" or "How many pending leaves?"';
  }

  /* ----- Employee questions: only their OWN data ----- */
  if (/employee|everyone|team|who |colleague|salary/.test(text)) {
    return 'I can only share your own data.';
  }
  if (text.includes('left') || text.includes('balance') || text.includes('remaining')) {
    return `You have ${leaveBalance(user.id)} leave day(s) left this year (quota ${getCompany().quota}).`;
  }
  if (text.includes('late')) {                                      // "Was I late today?"
    const record = getRecord(user.id);
    if (!record) return 'You have not checked in today.';
    return record.late
      ? `Yes, you checked in at ${record.in} (office starts ${getCompany().start}, grace ${getCompany().grace} min).`
      : `No, you checked in on time at ${record.in}.`;
  }
  if (text.includes('hour')) {                                      // "How many hours did I work this week?"
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));       // go back to Monday
    const total = getAttendance()
      .filter(record => record.uid === user.id && record.date >= dateToString(monday))
      .reduce((sum, record) => sum + hoursWorked(record), 0);
    return `You worked ${total.toFixed(1)} hours this week (Monday to today).`;
  }
  if (text.includes('leave')) {
    return `You have ${usedLeaveDays(user.id, ['pending'])} pending and ${usedLeaveDays(user.id)} approved leave day(s) this year.`;
  }
  if (text.includes('check') || text.includes('present')) {
    const record = getRecord(user.id);
    if (!record) return 'You have not checked in today.';
    return `You checked in at ${record.in}${record.out ? ' and out at ' + record.out : ''}. Status: ${record.status}.`;
  }
  return 'Try: "How many leaves do I have left?", "Was I late today?" or "How many hours did I work this week?"';
}

// Builds the chat box inside `box` and connects the buttons
function setupHelper(box, user) {
  const suggestions = user.role === 'admin'
    ? ['How many employees do we have?', 'Who is on leave today?', 'Who was late today?']
    : ['How many leaves do I have left?', 'Was I late today?', 'How many hours did I work this week?'];

  box.innerHTML = `
    <div class="chips">${suggestions.map(text => `<button type="button">${text}</button>`).join('')}</div>
    <div class="chat"><div class="msg">Hi ${escapeHtml(user.name.split(' ')[0])}! Ask me about ${user.role === 'admin' ? 'the company' : 'your attendance and leave'}.</div></div>
    <form class="row"><input name="q" placeholder="Type a question" autocomplete="off"><button class="btn pur">Ask</button></form>`;

  const chat = find('.chat', box);
  function ask(question) {
    if (!question.trim()) return;
    chat.insertAdjacentHTML('beforeend',
      `<div class="msg me">${escapeHtml(question)}</div><div class="msg">${escapeHtml(answerQuestion(question, user))}</div>`);
    chat.scrollTop = chat.scrollHeight;                             // scroll to the newest message
  }
  find('form', box).onsubmit = event => { event.preventDefault(); ask(event.target.q.value); event.target.reset(); };
  findAll('.chips button', box).forEach(button => button.onclick = () => ask(button.textContent));
}