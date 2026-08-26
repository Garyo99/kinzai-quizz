(() => {
  'use strict';
  const STORAGE_KEY = 'kinzai-study-history-v1';
  const params = new URLSearchParams(location.search);
  const requestedSubject = params.get('subject');
  const requestedQuestion = window.QUESTIONS.find(question => question.id === params.get('question'));
  let pendingQuestionId = requestedQuestion?.id || null;
  const state = { subject: requestedQuestion?.subject || (['財務', '税務', '法務'].includes(requestedSubject) ? requestedSubject : '財務'), format: requestedQuestion?.format || 2, review: false, queue: [], index: 0, answered: false, streak: 0 };
  const $ = (id) => document.getElementById(id);
  const els = {
    quiz: $('quiz'), empty: $('empty-state'), answered: $('answered-count'),
    accuracy: $('accuracy'), wrong: $('wrong-count'), allTotal: $('all-total'), reviewTotal: $('review-total'),
    typeTag: $('type-tag'), formatTag: $('format-tag'), progressText: $('progress-text'), progressBar: $('progress-bar'),
    questionNumber: $('question-number'), questionText: $('question-text'), choices: $('choices'), feedback: $('feedback'),
    result: $('result-label'), streakTag: $('streak-tag'), correctAnswer: $('correct-answer'), explanation: $('explanation-text'), next: $('next-button'),
    emptyMessage: $('empty-message')
  };

  function loadHistory() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
  function saveHistory(history) { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
  function legacyAnswers(record) {
    if (Array.isArray(record.answers)) return record.answers;
    const attempts = Number(record.attempts) || 0;
    const correctCount = Math.min(Number(record.correct) || 0, attempts);
    const lastCorrect = Boolean(record.lastCorrect);
    const priorCorrect = Math.max(0, correctCount - (lastCorrect ? 1 : 0));
    const priorWrong = Math.max(0, attempts - correctCount - (lastCorrect ? 0 : 1));
    const results = [...Array(priorWrong).fill(false), ...Array(priorCorrect).fill(true)];
    if (attempts) results.push(lastCorrect);
    return results.map((correct, index) => ({ correct, answeredAt: index === attempts - 1 ? record.lastAnsweredAt : null }));
  }
  function matching() { return window.QUESTIONS.filter(q => q.subject === state.subject && (state.format === 'all' || q.format === state.format)); }
  function shuffle(items) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }

  function updateStats() {
    const history = loadHistory();
    const subjectItems = window.QUESTIONS.filter(q => q.subject === state.subject);
    const records = subjectItems.map(q => history[q.id]).filter(Boolean);
    const correct = records.filter(r => r.lastCorrect).length;
    const wrong = records.filter(r => !r.lastCorrect).length;
    els.answered.textContent = records.length;
    els.accuracy.textContent = records.length ? `${Math.round(correct / records.length * 100)}%` : '—';
    els.wrong.textContent = wrong;
    const current = matching();
    els.allTotal.textContent = `${current.length}問`;
    els.reviewTotal.textContent = `${current.filter(q => history[q.id] && !history[q.id].lastCorrect).length}問`;
  }

  function buildQueue(doShuffle = true) {
    const history = loadHistory();
    let items = matching();
    if (state.review) items = items.filter(q => history[q.id] && !history[q.id].lastCorrect);
    state.queue = doShuffle ? shuffle(items) : items;
    if (pendingQuestionId) {
      const requestedIndex = state.queue.findIndex(question => question.id === pendingQuestionId);
      if (requestedIndex > 0) state.queue.unshift(...state.queue.splice(requestedIndex, 1));
      pendingQuestionId = null;
    }
    state.index = 0;
    render();
    updateStats();
  }

  function render() {
    const q = state.queue[state.index];
    state.answered = false;
    document.body.classList.remove('has-answer');
    $('previous-button').disabled = state.index === 0;
    $('copy-question').hidden = true;
    $('copy-question').textContent = 'この問題をコピー';
    els.streakTag.hidden = true;
    if (!q) {
      els.quiz.hidden = true; els.empty.hidden = false;
      els.emptyMessage.textContent = state.review ? 'この条件で復習待ちの問題はありません。' : 'この条件に合う問題がありません。';
      return;
    }
    els.quiz.hidden = false; els.empty.hidden = true; els.feedback.hidden = true; els.next.hidden = true;
    els.typeTag.textContent = q.sourceType; els.formatTag.textContent = `${q.format}択`;
    els.progressText.textContent = `${state.index + 1} / ${state.queue.length}`;
    els.progressBar.style.width = `${(state.index + 1) / state.queue.length * 100}%`;
    els.questionNumber.textContent = `QUESTION ${String(state.index + 1).padStart(2, '0')}`;
    els.questionText.textContent = q.question;
    els.choices.replaceChildren(...q.options.map((option, index) => {
      const button = document.createElement('button'); button.className = 'choice'; button.type = 'button';
      const key = document.createElement('span'); key.className = 'choice-key'; key.textContent = index + 1;
      const label = document.createElement('span'); label.textContent = option;
      button.append(key, label); button.addEventListener('click', () => answer(index)); return button;
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function answer(selected) {
    if (state.answered) return;
    state.answered = true;
    const q = state.queue[state.index]; const isCorrect = selected === q.answer;
    state.streak = isCorrect ? state.streak + 1 : 0;
    [...els.choices.children].forEach((button, index) => {
      button.disabled = true;
      if (index === q.answer) { button.classList.add('correct'); button.setAttribute('aria-label', `正解: ${q.options[index]}`); }
      else if (index === selected) { button.classList.add('wrong'); button.setAttribute('aria-label', `不正解: ${q.options[index]}`); }
    });
    const history = loadHistory(); const old = history[q.id] || { attempts: 0, correct: 0 };
    const answeredAt = new Date().toISOString();
    history[q.id] = { attempts: old.attempts + 1, correct: old.correct + (isCorrect ? 1 : 0), lastCorrect: isCorrect, lastAnsweredAt: answeredAt, answers: [...legacyAnswers(old), { correct: isCorrect, answeredAt }] };
    saveHistory(history); updateStats();
    els.result.textContent = isCorrect ? '✓ 正解です' : '× 不正解です';
    els.result.className = `result-label ${isCorrect ? 'correct-text' : 'wrong-text'}`;
    els.streakTag.textContent = `${state.streak}問連続正解！`;
    els.streakTag.hidden = state.streak < 3;
    els.correctAnswer.textContent = `正解：${q.format === 4 ? `${q.answer + 1}. ` : ''}${q.options[q.answer]}`;
    els.explanation.textContent = q.explanation; els.feedback.hidden = false; els.next.hidden = false;
    $('copy-question').hidden = false;
    document.body.classList.add('has-answer');
    els.next.textContent = '次の問題へ';
    els.feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.querySelectorAll('.subject').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.subject').forEach(b => b.classList.toggle('active', b === button));
    state.subject = button.dataset.subject; buildQueue();
  }));
  function setFormat(value) {
    state.format = value === 'all' ? 'all' : Number(value);
    $('format-select').value = String(value);
    document.querySelectorAll('.format').forEach(b => { const active = b.dataset.format === String(value); b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    buildQueue();
  }
  document.querySelectorAll('.format').forEach(button => button.addEventListener('click', () => {
    setFormat(button.dataset.format);
  }));
  $('format-select').addEventListener('change', event => setFormat(event.target.value));
  function setMode(review) {
    state.review = review;
    [$('normal-mode'), $('review-mode')].forEach((b, i) => { const active = review ? i === 1 : i === 0; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    buildQueue();
  }
  $('normal-mode').addEventListener('click', () => setMode(false)); $('review-mode').addEventListener('click', () => setMode(true)); $('back-all').addEventListener('click', () => setMode(false));
  $('shuffle-button').addEventListener('click', () => buildQueue(true));
  $('previous-button').addEventListener('click', () => { if (state.index > 0) { state.index -= 1; render(); } });
  $('copy-question').addEventListener('click', async () => {
    const q = state.queue[state.index];
    if (!q || !state.answered) return;
    const choices = q.options.map((option, index) => `${index + 1}. ${option}`).join('\n');
    const prompt = `以下の問題について、正解になる理由を初学者にも分かるように詳しく解説してください。\n各選択肢についても、正しい点または誤っている点を説明してください。\n\n【問題文】\n${q.question}\n\n【選択肢】\n${choices}\n\n【正解】\n${q.answer + 1}. ${q.options[q.answer]}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(prompt);
      else throw new Error('Clipboard API unavailable');
    } catch {
      const area = document.createElement('textarea'); area.value = prompt; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    const button = $('copy-question'); button.textContent = 'コピーしました';
    window.setTimeout(() => { if (state.answered) button.textContent = 'この問題をコピー'; }, 1800);
  });
  els.next.addEventListener('click', () => { state.index = state.index + 1 < state.queue.length ? state.index + 1 : 0; render(); });
  $('reset-history').addEventListener('click', () => { if (confirm('すべての回答履歴を削除しますか？この操作は元に戻せません。')) { localStorage.removeItem(STORAGE_KEY); setMode(false); } });
  document.addEventListener('keydown', e => { if (!state.answered && /^[1-4]$/.test(e.key)) els.choices.children[Number(e.key) - 1]?.click(); else if (state.answered && (e.key === 'Enter' || e.key === 'ArrowRight')) els.next.click(); });
  document.querySelectorAll('.subject').forEach(button => button.classList.toggle('active', button.dataset.subject === state.subject));
  document.querySelectorAll('.format').forEach(button => { const active = button.dataset.format === String(state.format); button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  $('format-select').value = String(state.format);
  buildQueue();
})();
