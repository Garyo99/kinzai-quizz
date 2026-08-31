const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const inputDir = path.join(root, 'raw_questions');
const outputFile = path.join(root, 'data.txt');

function decodeEntities(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };

  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const number = code[1].toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });
}

function toText(html) {
  return decodeEntities(html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decodeEntities(match[2]).trim() : '';
}

function removeChoiceNumber(value) {
  return value
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
    .replace(/^○$/, '〇')
    .trim();
}

const files = fs.readdirSync(inputDir)
  .filter((name) => name.toLowerCase().endsWith('.html'))
  .sort((a, b) => a.localeCompare(b, 'ja'));

const data = Object.create(null);
const errors = [];
let extracted = 0;

for (const file of files) {
  const html = fs.readFileSync(path.join(inputDir, file), 'utf8');
  const chunks = html
    .split(/<div\s+class=["']card w-100 shadow mt-3 overflow-hidden["']>/i)
    .slice(1);

  chunks.forEach((chunk, index) => {
    const questionMatch = chunk.match(
      /<div\s+class=["']bg-light py-2 px-4 text-14px["']>([\s\S]*?)<\/div>/i,
    );
    const question = questionMatch ? toText(questionMatch[1]) : '';
    const radioTags = [...chunk.matchAll(/<input\b(?=[^>]*\btype=["']radio["'])[^>]*>/gi)]
      .map((match) => match[0]);

    if (!question || radioTags.length < 2) {
      errors.push(`${file} の設問${index + 1}: 問題文または選択肢を取得できません`);
      return;
    }

    const rawChoices = radioTags.map((tag) => getAttribute(tag, 'value'));
    const answerMatch = chunk.match(
      /<input\s+type=["']hidden["']\s+value=(["'])([\s\S]*?)\1\s+name=["']penq\[/i,
    );
    let rawAnswer = answerMatch ? decodeEntities(answerMatch[2]).trim() : '';

    if (!rawAnswer || !rawChoices.includes(rawAnswer)) {
      const checkedIndex = radioTags.findIndex((tag) => /\bchecked=["']checked["']/i.test(tag));
      const resultMatch = chunk.match(
        /<p\s+class=["']text-12px text-red mb-2 font-weight-bold["']>([\s\S]*?)<\/p>/i,
      );
      const result = resultMatch ? toText(resultMatch[1]) : '';
      const statedAnswer = result.match(/正しい答え\s*[：:]\s*(.+)$/)?.[1]?.trim();

      if (statedAnswer) {
        rawAnswer = rawChoices.find((choice) => (
          choice === statedAnswer || removeChoiceNumber(choice) === removeChoiceNumber(statedAnswer)
        )) ?? '';
      } else if (/〇正解です/.test(result) && checkedIndex >= 0) {
        rawAnswer = rawChoices[checkedIndex];
      } else if (/×不正解です/.test(result) && checkedIndex >= 0 && rawChoices.length === 2) {
        rawAnswer = rawChoices[1 - checkedIndex];
      }
    }

    if (!rawAnswer || !rawChoices.includes(rawAnswer)) {
      errors.push(`${file} の設問${index + 1}: 正解を特定できません`);
      return;
    }

    if (Object.hasOwn(data, question)) {
      errors.push(`${file} の設問${index + 1}: 同一の問題文が重複しています`);
      return;
    }

    const choices = rawChoices.map(removeChoiceNumber);
    const answer = removeChoiceNumber(rawAnswer);
    const isTrueFalse = choices.length === 2
      && choices.includes('〇')
      && choices.includes('×');

    data[question] = {
      choice: isTrueFalse ? [] : choices,
      ans: answer,
    };
    extracted += 1;
  });
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  fs.writeFileSync(outputFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`HTML: ${files.length}`);
  console.log(`Questions: ${extracted}`);
  console.log(`Output: ${outputFile}`);
}
