const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter((name) => /^(財務|税務|法務).+\.html$/.test(name));

function text(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? text(match[1]) : '';
}

const questions = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const subject = file.slice(0, 2);
  const sourceType = file.includes('練習') ? '練習問題' : file.includes('〇×') ? '○×問題' : '選択問題';
  const chunks = html.split(/<div class="card w-100 shadow mt-3 overflow-hidden">/).slice(1);

  chunks.forEach((chunk, index) => {
    const questionMatch = chunk.match(/<div class="bg-light py-2 px-4 text-14px">([\s\S]*?)<\/div>/);
    const question = questionMatch ? text(questionMatch[1]) : '';
    const radioTags = [...chunk.matchAll(/<input type="radio"[\s\S]*?>/g)].map((m) => m[0]);
    const options = radioTags.map((tag) => attr(tag, 'value'));
    if (!question || ![2, 4].includes(options.length)) return;

    const checkedIndex = radioTags.findIndex((tag) => /checked="checked"/.test(tag));
    const correctResult = /〇正解です/.test(chunk);
    const hiddenAnswerMatch = chunk.match(/<input\s+type="hidden"\s+value="([^"]+)"\s+name="penq\[/);
    let answer = hiddenAnswerMatch ? options.indexOf(text(hiddenAnswerMatch[1])) : -1;
    if (answer < 0 && options.length === 2 && checkedIndex >= 0) {
      answer = correctResult ? checkedIndex : 1 - checkedIndex;
    }
    if (answer < 0 && correctResult && checkedIndex >= 0) answer = checkedIndex;

    const explanationBlock = chunk.match(/<div class="d-md-table-cell col-auto border-md-left px-3 py-4">([\s\S]*?)<\/div>/);
    let explanation = explanationBlock ? text(explanationBlock[1]) : '';
    explanation = explanation.replace(/^[〇×](?:正解|不正解)です\s*/, '').trim();

    const idMatch = radioTags[0].match(/name="penq\[(\d+)\]"/);
    const id = `${subject}-${sourceType}-${idMatch ? idMatch[1] : index + 1}`;
    questions.push({
      id,
      subject,
      sourceType,
      format: options.length,
      question,
      options,
      answer,
      explanation: explanation || '元データに解説の記載はありません。',
      source: file,
    });
  });
}

fs.writeFileSync(path.join(root, 'questions.raw.json'), JSON.stringify(questions, null, 2));
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
const publicQuestions = questions.map(({ source, ...question }) => question);
fs.writeFileSync(path.join(root, 'docs', 'questions.js'), `window.QUESTIONS = ${JSON.stringify(publicQuestions)};\n`);
const unresolved = questions.filter((q) => q.answer < 0);
console.log(`Extracted: ${questions.length}`);
console.log(`2-choice: ${questions.filter((q) => q.format === 2).length}`);
console.log(`4-choice: ${questions.filter((q) => q.format === 4).length}`);
console.log(`Unresolved: ${unresolved.length}`);
unresolved.forEach((q) => console.log(`${q.id}\t${q.question}\t${q.options.join(' | ')}`));
