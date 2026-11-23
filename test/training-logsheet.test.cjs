const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('../../openimis-fe_js/node_modules/@babel/core');

function exportSheet(project) {
  const texts = [], tables = [];
  class PDF {
    addImage() {} setFont() {} setFontSize() {} addPage() {} setPage() {} save() {}
    getNumberOfPages() { return 1; }
    text(value) { texts.push(Array.isArray(value) ? value.join(' ') : value); }
    splitTextToSize(value) { return [value]; }
    getTextWidth(value) { return String(value).length; }
  }
  const dependencies = {
    jspdf: { jsPDF: PDF },
    'jspdf-autotable': (doc, options) => { tables.push(options); options.didDrawPage(); },
    '../assets/malawi-coat-of-arms.png': 'image',
    './beneficiary-identifiers': { firstValue: () => '', beneficiaryIdentifiers: () => ({}) },
    './searcher-utils': { locationFormatter: () => ['Balaka'] },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/util/log-sheet-export.js'), 'utf8');
  const { code } = babel.transformSync(source, { babelrc: false, configFile: false,
    plugins: [require.resolve('../../openimis-fe_js/node_modules/@babel/plugin-transform-modules-commonjs')] });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  });
  module.exports.downloadLogSheetPdf({ project, beneficiaries: [], translate: (key) => key });
  return { texts, tables };
}

test('Training logsheet shows Training details and ordered snapshot topic codes', () => {
  const result = exportSheet({ projectType: 'TRAINING', name: 'Training A', workingDays: 2,
    benefitPlan: { name: 'RMEP' }, status: 'PREPARATION', sessionStartDate: '2026-11-19',
    sessionEndDate: '2026-11-30', trainingTopics: [
      { sequence: 2, code: 'BM01', module: { name: 'Business Management' } },
      { sequence: 1, code: 'E01', module: { name: 'Entrepreneurship' } },
    ] });
  assert.ok(result.texts.some((text) => text.includes('trainingTitle')));
  assert.ok(result.texts.some((text) => text.includes('Training A')));
  assert.ok(result.texts.some((text) => text.includes('RMEP')));
  assert.ok(result.texts.some((text) => text.includes('2026-11-19 - 2026-11-30')));
  assert.ok(result.texts.some((text) => text.includes('Entrepreneurship, Business Management')));
  assert.deepEqual(result.tables[0].head[1], ['E01', 'BM01']);
  assert.match(result.tables[0].head[0].at(-1).content, /trainingAttendance$/);
});

test('WORK logsheet preserves Work headings and numbered day columns', () => {
  const result = exportSheet({ projectType: 'WORK', name: 'Work A', workingDays: 2 });
  assert.ok(result.texts.includes('projectBeneficiaries.logSheetPdf.title'));
  assert.ok(result.texts.includes('projectBeneficiaries.logSheetPdf.subtitle'));
  assert.deepEqual(result.tables[0].head[1], ['project.day\n1', 'project.day\n2']);
  assert.match(result.tables[0].head[0].at(-1).content, /amountOfWorkDone$/);
});
