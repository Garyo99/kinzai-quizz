(() => {
  'use strict';
  const STORAGE_KEY = 'kinzai-study-history-v1';
  const CHECK_LATER_KEY = 'kinzai-check-later-v1';
  const subjects = ['財務', '税務', '法務'];
  const history = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } })();
  const checkLater = (() => { try { return new Set(JSON.parse(localStorage.getItem(CHECK_LATER_KEY)) || []); } catch { return new Set(); } })();
  const questions = new Map(window.QUESTIONS.map(q => [q.id, q]));
  const records = Object.entries(history).map(([id, record]) => ({ record, question: questions.get(id) })).filter(item => item.question);
  const overview = document.getElementById('subject-overview');
  subjects.forEach(subject => {
    const items = records.filter(item => item.question.subject === subject);
    const correct = items.filter(item => item.record.lastCorrect).length;
    const card = document.createElement('article'); card.className = 'overview-card';
    card.innerHTML = `<div class="overview-title"><span>${subject[0]}</span><h2>${subject}</h2></div><div class="overview-metrics"><p><strong>${items.length}</strong><small>回答済み</small></p><p><strong>${items.length ? `${Math.round(correct / items.length * 100)}%` : '—'}</strong><small>正答率</small></p><a class="overview-review" href="index.html?tab=answered&amp;subject=${encodeURIComponent(subject)}&amp;result=still-wrong" aria-label="${subject}の現在も不正解の問題を表示"><strong>${items.filter(item => !item.record.lastCorrect).length}</strong><small>復習待ち</small></a></div><a href="quiz.html?subject=${encodeURIComponent(subject)}">${subject}を練習する</a>`;
    overview.append(card);
  });
  const laterQuestions = window.QUESTIONS.filter(question => checkLater.has(question.id));
  document.getElementById('later-count').textContent = laterQuestions.length;
  const laterList = document.getElementById('later-list');
  document.getElementById('later-empty').hidden = laterQuestions.length > 0;
  laterQuestions.forEach(question => {
    const answered = Boolean(history[question.id]);
    const link = document.createElement('a'); link.className = 'later-item'; link.href = `quiz.html?question=${encodeURIComponent(question.id)}`;
    const meta = document.createElement('p'); meta.textContent = `${question.subject}・${question.sourceType}・${question.format}択`;
    const title = document.createElement('h3'); title.textContent = question.question;
    const status = document.createElement('span'); status.className = answered ? 'later-status answered' : 'later-status'; status.textContent = answered ? '回答済み' : '未回答';
    const content = document.createElement('div'); content.append(meta, title);
    link.append(status, content); laterList.append(link);
  });
  function formatDate(value) { return value ? new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)).replace(/\s/g, ' ') : '日時不明'; }
  function attemptsFor(record) {
    if (Array.isArray(record.answers)) return record.answers;
    const attempts = Number(record.attempts) || 0; const correctCount = Math.min(Number(record.correct) || 0, attempts); const lastCorrect = Boolean(record.lastCorrect);
    const results = [...Array(Math.max(0, attempts - correctCount - (lastCorrect ? 0 : 1))).fill(false), ...Array(Math.max(0, correctCount - (lastCorrect ? 1 : 0))).fill(true)];
    if (attempts) results.push(lastCorrect);
    return results.map((correct, index) => ({ correct, answeredAt: index === attempts - 1 ? record.lastAnsweredAt : null }));
  }
  const initialParams = new URLSearchParams(location.search);
  const initialTab = initialParams.get('tab') === 'answered' ? 'answered' : 'learning';
  const initialSubject = subjects.includes(initialParams.get('subject')) ? initialParams.get('subject') : 'all';
  const initialResult = ['ever-wrong', 'still-wrong'].includes(initialParams.get('result')) ? initialParams.get('result') : 'all';
  const filters = { subject: initialSubject, result: initialResult };
  function render() {
    const list = document.getElementById('history-list'); const empty = document.getElementById('history-empty');
    const visible = records.filter(item => {
      if (filters.subject !== 'all' && item.question.subject !== filters.subject) return false;
      const attempts = attemptsFor(item.record);
      if (filters.result === 'ever-wrong' && !attempts.some(attempt => !attempt.correct)) return false;
      if (filters.result === 'still-wrong' && attempts.at(-1)?.correct !== false) return false;
      return true;
    }).flatMap(item => attemptsFor(item.record).map((attempt, index) => ({ question: item.question, attempt, attemptNumber: index + 1 }))).sort((a, b) => new Date(b.attempt.answeredAt || 0) - new Date(a.attempt.answeredAt || 0));
    list.replaceChildren(); empty.hidden = visible.length > 0;
    visible.forEach(({ question, attempt, attemptNumber }) => {
      const item = document.createElement('a'); item.className = 'history-item'; item.href = `quiz.html?question=${encodeURIComponent(question.id)}`; item.setAttribute('aria-label', `${question.question}へ移動`);
      const status = document.createElement('span'); status.className = `history-status ${attempt.correct ? 'is-correct' : 'is-wrong'}`; status.textContent = attempt.correct ? '正解' : '不正解';
      const content = document.createElement('div'); content.className = 'history-content';
      const meta = document.createElement('p'); meta.className = 'history-meta'; meta.textContent = `${question.subject}・${question.sourceType}・${question.format}択　${formatDate(attempt.answeredAt)}`;
      const title = document.createElement('h3'); title.textContent = question.question;
      const detail = document.createElement('p'); detail.className = 'history-detail'; detail.textContent = `${attemptNumber}回目の回答`;
      content.append(meta, title, detail); item.append(status, content); list.append(item);
    });
  }
  const dialog = document.getElementById('filter-dialog');
  document.getElementById('history-subject').value = filters.subject;
  document.getElementById('history-result').value = filters.result;
  if (filters.subject !== 'all' || filters.result !== 'all') {
    document.getElementById('filter-badge').hidden = false;
    document.getElementById('open-filter').classList.add('active');
  }
  document.getElementById('open-filter').addEventListener('click', () => dialog.showModal());
  document.getElementById('close-filter').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.getElementById('filter-form').addEventListener('submit', () => {
    filters.subject = document.getElementById('history-subject').value;
    filters.result = document.getElementById('history-result').value;
    const active = filters.subject !== 'all' || filters.result !== 'all';
    document.getElementById('filter-badge').hidden = !active;
    document.getElementById('open-filter').classList.toggle('active', active);
    render();
  });
  function setTab(tab) {
    const answered = tab === 'answered';
    document.getElementById('learning-panel').hidden = answered;
    document.getElementById('answered-panel').hidden = !answered;
    document.getElementById('learning-tab').classList.toggle('active', !answered);
    document.getElementById('answered-tab').classList.toggle('active', answered);
    document.getElementById('learning-tab').setAttribute('aria-selected', !answered);
    document.getElementById('answered-tab').setAttribute('aria-selected', answered);
  }
  document.getElementById('learning-tab').addEventListener('click', () => setTab('learning'));
  document.getElementById('answered-tab').addEventListener('click', () => setTab('answered'));
  setTab(initialTab);
  render();
  if (initialParams.get('later') === 'open') {
    const laterSection = document.querySelector('.later-section');
    laterSection.open = true;
    requestAnimationFrame(() => laterSection.scrollIntoView({ block: 'start' }));
  }
})();
