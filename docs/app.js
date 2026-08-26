(() => {
  'use strict';
  const STORAGE_KEY = 'kinzai-study-history-v1';
  const state = { subject: '財務', format: 2, review: false, queue: [], index: 0, answered: false };
  const $ = (id) => document.getElementById(id);
  const els = {
    quiz: $('quiz'), empty: $('empty-state'), subjectTitle: $('subject-title'), answered: $('answered-count'),
    accuracy: $('accuracy'), wrong: $('wrong-count'), allTotal: $('all-total'), reviewTotal: $('review-total'),
    typeTag: $('type-tag'), formatTag: $('format-tag'), progressText: $('progress-text'), progressBar: $('progress-bar'),
    questionNumber: $('question-number'), questionText: $('question-text'), choices: $('choices'), feedback: $('feedback'),
    result: $('result-label'), correctAnswer: $('correct-answer'), explanation: $('explanation-text'), next: $('next-button'),
    emptyMessage: $('empty-message')
  };

  function loadHistory() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
  function saveHistory(history) { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
  function matching() { return window.QUESTIONS.filter(q => q.subject === state.subject && q.format === state.format); }
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
    state.index = 0;
    render();
    updateStats();
  }

  function render() {
    const q = state.queue[state.index];
    state.answered = false;
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
      const key = document.createElement('span'); key.className = 'choice-key'; key.textContent = q.format === 2 ? (index ? '×' : '○') : index + 1;
      const label = document.createElement('span'); label.textContent = option;
      button.append(key, label); button.addEventListener('click', () => answer(index)); return button;
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function answer(selected) {
    if (state.answered) return;
    state.answered = true;
    const q = state.queue[state.index]; const isCorrect = selected === q.answer;
    [...els.choices.children].forEach((button, index) => {
      button.disabled = true;
      if (index === q.answer) { button.classList.add('correct'); button.setAttribute('aria-label', `正解: ${q.options[index]}`); }
      else if (index === selected) { button.classList.add('wrong'); button.setAttribute('aria-label', `不正解: ${q.options[index]}`); }
    });
    const history = loadHistory(); const old = history[q.id] || { attempts: 0, correct: 0 };
    history[q.id] = { attempts: old.attempts + 1, correct: old.correct + (isCorrect ? 1 : 0), lastCorrect: isCorrect, lastAnsweredAt: new Date().toISOString() };
    saveHistory(history); updateStats();
    els.result.textContent = isCorrect ? '✓ 正解です' : '× 不正解です';
    els.result.className = `result-label ${isCorrect ? 'correct-text' : 'wrong-text'}`;
    els.correctAnswer.textContent = `正解：${q.format === 4 ? `${q.answer + 1}. ` : ''}${q.options[q.answer]}`;
    els.explanation.textContent = q.explanation; els.feedback.hidden = false; els.next.hidden = false;
    els.next.textContent = state.index + 1 < state.queue.length ? '次の問題へ →' : 'もう一度はじめる ↻';
    els.feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.querySelectorAll('.subject').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.subject').forEach(b => b.classList.toggle('active', b === button));
    state.subject = button.dataset.subject; els.subjectTitle.textContent = state.subject; buildQueue();
  }));
  document.querySelectorAll('.format').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.format').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    state.format = Number(button.dataset.format); buildQueue();
  }));
  function setMode(review) {
    state.review = review;
    [$('normal-mode'), $('review-mode')].forEach((b, i) => { const active = review ? i === 1 : i === 0; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
    buildQueue();
  }
  $('normal-mode').addEventListener('click', () => setMode(false)); $('review-mode').addEventListener('click', () => setMode(true)); $('back-all').addEventListener('click', () => setMode(false));
  $('shuffle-button').addEventListener('click', () => buildQueue(true));
  els.next.addEventListener('click', () => { state.index = state.index + 1 < state.queue.length ? state.index + 1 : 0; render(); });
  $('reset-history').addEventListener('click', () => { if (confirm('すべての回答履歴を削除しますか？この操作は元に戻せません。')) { localStorage.removeItem(STORAGE_KEY); setMode(false); } });
  document.addEventListener('keydown', e => { if (!state.answered && /^[1-4]$/.test(e.key)) els.choices.children[Number(e.key) - 1]?.click(); else if (state.answered && (e.key === 'Enter' || e.key === 'ArrowRight')) els.next.click(); });
  buildQueue();
})();
