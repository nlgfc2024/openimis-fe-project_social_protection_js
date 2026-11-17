const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dependency = (name) => require(require.resolve(name, {
  paths: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../openimis-fe_js')],
}));
const babel = dependency('@babel/core');
const React = dependency('react');
const source = fs.readFileSync(path.join(__dirname, '../src/util/project-type.js'), 'utf8').replace(/import .*?;\s*/g, '').replace(/export const /g, 'const ');
const helpers = vm.runInNewContext(`${source}\n({isTraining, mandatoryFieldsEmpty, datesInOrder, rawBenefitPlanId, validationErrorText})`, { decodeId: (id) => atob(id).split(':')[1] });
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
for (const targetBeneficiaries of [null, undefined, '']) {
  assert.ok(!actions.updateProject({ ...valid, projectType: 'WORK', targetBeneficiaries }).includes('targetBeneficiaries:'));
  assert.ok(actions.updateProject({ ...valid, targetBeneficiaries }).includes('targetBeneficiaries: null'));
}
assert.ok(actions.updateProject({ ...valid, projectType: 'WORK', targetBeneficiaries: 10 }).includes('targetBeneficiaries: 10'));
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


// Exercise the actual dialog handlers: paginated household additions must retain
// earlier participants, deduplicate members and submit individual beneficiary IDs.
async function checkGroupAssignment() {
  const state = [];
  let cursor = 0;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
  };
  const fakeReact = { ...React, useState };
  let submitted;
  let fail = false;
  const calls = [];
  const decodeId = (id) => id.startsWith('encoded:') ? id.slice(8) : id;
  const fetchMembers = async (_, params) => {
    calls.push(params);
    if (fail) return { payload: { errors: [{ message: 'Denied' }] } };
    const secondPage = params.includes('offset: 100');
    return { payload: { data: { projectEligibleBeneficiaries: {
      totalCount: 101,
      edges: (secondPage ? ['member-100'] : Array.from({ length: 100 }, (_, i) => `member-${i}`))
        .map((id) => ({ node: { id: `encoded:${id}` } })),
    } } } };
  };
  const identity = (value) => value;
  const noop = () => {};
  const env = {
    React: fakeReact, useState, useEffect: noop, useRef: () => ({}),
    useModulesManager: () => ({}), useDispatch: () => noop,
    formatMessage: (_, __, key) => key, formatMessageWithValues: (_, __, key) => key,
    decodeId, rawBenefitPlanId: identity, injectIntl: identity,
    withTheme: identity, withStyles: () => identity, connect: () => identity,
    bindActionCreators: identity, fetchBeneficiaries: noop, fetchGroupBeneficiaries: noop,
    fetchTrainingGroupBeneficiaries: fetchMembers, enrollProject: noop, enrollGroupProject: noop,
    coreAlert: noop, journalize: noop, waitForMutation: noop,
    MODULE_NAME: 'projectSocialProtection', DEFAULT_PAGE_SIZE: 10,
    REQUEST: identity, ACTION_TYPE: {},
  };
  for (const name of ['Dialog', 'DialogTitle', 'DialogContent', 'DialogActions', 'IconButton', 'Button', 'TextField', 'CloseIcon', 'BeneficiaryTable']) env[name] = name;
  const { ProjectEnrollmentDialog } = load('dialogs/ProjectEnrollmentDialog.js', env);
  const props = {
    classes: {}, project: { id: 'project', projectType: 'TRAINING', benefitPlan: { id: 'plan' } },
    enrolledBeneficiaries: [], fetchTrainingGroupBeneficiaries: fetchMembers,
    enroll: async (params) => { submitted = params; return { payload: { data: { enrollProject: { clientMutationId: 'mutation' } } } }; },
    waitForMutation: async () => ({ status: 2 }), onClose: noop,
  };
  const render = () => { cursor = 0; return elements(ProjectEnrollmentDialog(props)); };
  render();
  state[0] = 'household';
  state[2] = new Set(['original', 'member-0']);
  const add = () => render().find((node) => node.type === 'Button' && node.props.children === 'projectBeneficiaries.group.add').props.onClick();
  await add();
  assert.strictEqual(state[2].size, 102);
  assert.ok(state[2].has('original'));
  assert.ok(calls[0].includes('status: ACTIVE'));
  assert.ok(calls[0].includes('eligibleForProject: "project"'));
  await render().find((node) => node.type === 'Button' && node.props.children === 'projectBeneficiaries.save').props.onClick();
  assert.strictEqual(submitted.ids.length, 102);
  assert.ok(submitted.ids.includes('original'));
  assert.ok(submitted.ids.includes('member-100'));
  fail = true;
  await add();
  assert.strictEqual(state[2].size, 102);
  assert.ok(state[5].message.includes('group.loadError'));
  console.log('Training household pagination, additive selection, save and error tests passed.');
}
checkGroupAssignment().catch((error) => { console.error(error); process.exitCode = 1; });
