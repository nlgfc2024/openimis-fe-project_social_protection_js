const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dependency = (name) => require(require.resolve(name, {
  paths: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../openimis-fe_js')],
}));
const babel = dependency('@babel/core');
const React = dependency('react');
const source = fs.readFileSync(path.join(__dirname, '../src/util/project-type.js'), 'utf8').replace(/export const /g, 'const ');
const helpers = vm.runInNewContext(`${source}\n({isTraining, mandatoryFieldsEmpty, datesInOrder, rawBenefitPlanId, validationErrorText})`, { atob });
const valid = { projectType: 'TRAINING', name: 'Session', activity: { id: '1' }, location: { uuid: 'location' }, targetBeneficiaries: 5, workingDays: 3 };
assert.strictEqual(helpers.mandatoryFieldsEmpty(valid), false);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, targetBeneficiaries: null }), false);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, projectType: 'WORK', targetBeneficiaries: null, hotspot: {} }), true);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, name: ' ' }), true);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, name: 'x'.repeat(256) }), true);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, location: null }), true);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, projectType: 'WORK' }), true);
assert.strictEqual(helpers.mandatoryFieldsEmpty({ ...valid, projectType: 'WORK', hotspot: { id: '1' } }), false);
assert.strictEqual(helpers.datesInOrder({ sessionStartDate: '2026-05-03', sessionEndDate: '2026-05-02' }), false);
assert.strictEqual(helpers.datesInOrder({ sessionStartDate: '2026-05-03' }), true);
const uuid = '01a116e2-3613-7846-972a-6b43a3b16366';
assert.strictEqual(helpers.rawBenefitPlanId(uuid), uuid);
assert.strictEqual(helpers.rawBenefitPlanId(btoa(`BenefitPlanGQLType:${uuid}`)), uuid);
assert.strictEqual(helpers.validationErrorText({ message: 'Invalid', detail: 'Name' }), 'Invalid: Name');

function load(file, environment) {
  const { code } = babel.transformFileSync(path.join(__dirname, '../src', file), {
    babelrc: false, configFile: false,
    presets: [[dependency('@babel/preset-env'), { targets: { node: 'current' } }], dependency('@babel/preset-react')],
    plugins: [() => ({ visitor: { ImportDeclaration(p) { p.remove(); }, ExportDefaultDeclaration(p) { p.remove(); } } })],
  });
  const exports = {};
  Function('exports', ...Object.keys(environment), code)(exports, ...Object.values(environment));
  return exports;
}
const actions = load('actions.js', {
  ...helpers,
  ACTION_TYPE: new Proxy({}, { get: (_, name) => name }),
  REQUEST: (name) => name, SUCCESS: (name) => name, ERROR: (name) => name,
  formatMutation: (_, payload) => ({ payload }),
  formatGQLString: (text) => text.replace(/"/g, '\\"'),
  graphql: (payload) => payload,
  graphqlWithVariables: (_, variables) => variables,
});
const payload = actions.createProject({ ...valid, name: 'Session "A"', sessionStartDate: '2026-05-02', sessionEndDate: null });
assert.ok(payload.includes('name: "Session \\"A\\""'));
assert.ok(payload.includes('sessionEndDate: null'));
assert.ok(!payload.includes('projectType:'));
assert.ok(!actions.createProject({ ...valid, projectType: 'WORK' }).includes('name:'));
assert.strictEqual(actions.projectNameValidationCheck(null, { benefitPlanId: btoa(`BenefitPlanGQLType:${uuid}`) }).benefitPlanId, uuid);

class FormPanel {
  constructor(props) { this.props = props; }
  updateAttributes(value) { this.changes = value; }
  updateAttribute(field, value) { this.changes = { [field]: value }; }
}
const env = { React, FormPanel, isTraining: helpers.isTraining, getMaxTargetBeneficiaries: () => 200,
  formatMessage: (_, __, key) => key, MODULE_NAME: 'projectSocialProtection' };
for (const name of ['Grid', 'TextInput', 'PublishedComponent', 'NumberInput', 'ActivityPicker', 'HotspotPicker', 'ProjectStatusPicker', 'UserPicker']) env[name] = name;
const { ProjectHeadPanel } = load('components/ProjectHeadPanel.js', env);
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
}
for (const projectType of ['WORK', 'TRAINING']) {
  const panel = new ProjectHeadPanel({ edited: { ...valid, projectType }, classes: {}, modulesManager: {} });
  const nodes = elements(panel.render());
  assert.strictEqual(nodes.some((node) => node.type === 'HotspotPicker'), projectType === 'WORK');
  assert.strictEqual(nodes.filter((node) => node.props.pubRef === 'core.DatePicker').length, projectType === 'TRAINING' ? 2 : 0);
  const name = nodes.find((node) => node.props.label === 'project.name');
  assert.strictEqual(nodes.find((node) => node.props.label === 'project.targetBeneficiaries').props.required, projectType === 'WORK');
  assert.strictEqual(nodes.find((node) => node.props.label === 'project.targetBeneficiaries').props.max, projectType === 'WORK' ? 200 : undefined);
  assert.strictEqual(name.props.inputProps.readOnly, projectType === 'WORK');
  if (projectType === 'TRAINING') {
    panel.props.edited = { ...valid, workingDays: null };
    const activity = elements(panel.render()).find((node) => node.type === 'ActivityPicker');
    activity.props.onChange({ id: '2', defaultWorkingDays: 6 });
    assert.strictEqual(panel.changes.workingDays, 6);
    panel.props.edited = { ...valid, workingDays: 9 };
    elements(panel.render()).find((node) => node.type === 'ActivityPicker').props.onChange({ id: '3', defaultWorkingDays: 2 });
    assert.strictEqual(panel.changes.workingDays, undefined);
  }
}
console.log('Training/WORK rendering, payload, duration, date and UUID tests passed.');
