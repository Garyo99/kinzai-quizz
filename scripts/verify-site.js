const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');

for (const file of ['app.js', 'history.js', 'questions.js']) {
  new vm.Script(fs.readFileSync(path.join(root, 'docs', file), 'utf8'), { filename: file });
}
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'docs', 'questions.js'), 'utf8'), context);
const questions = context.window.QUESTIONS;
const ids = new Set(questions.map((q) => q.id));
const invalid = questions.filter((q) =>
  !q.id || !q.question || !['財務', '税務', '法務'].includes(q.subject) ||
  ![2, 4].includes(q.format) || q.options.length !== q.format ||
  q.answer < 0 || q.answer >= q.options.length || !q.explanation || 'source' in q
);
const missingAssets = ['index.html', 'quiz.html'].flatMap(page => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  return [...html.matchAll(/(?:href|src)="([^"#?]+)(?:\?[^"#]*)?"/g)].map(m => m[1]).filter(file => !/^(?:https?:)?\/\//.test(file)).filter(file => !fs.existsSync(path.join(root, file))).map(file => `${page}: ${file}`);
});
if (invalid.length || ids.size !== questions.length || missingAssets.length) {
  throw new Error(JSON.stringify({ invalid: invalid.length, uniqueIds: ids.size, total: questions.length, missingAssets }));
}
console.log(JSON.stringify({
  total: questions.length,
  formats: { 2: questions.filter((q) => q.format === 2).length, 4: questions.filter((q) => q.format === 4).length },
  subjects: Object.fromEntries(['財務', '税務', '法務'].map((s) => [s, questions.filter((q) => q.subject === s).length])),
  uniqueIds: ids.size,
  invalid: invalid.length,
  missingAssets,
}, null, 2));
