const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('../../openimis-fe_js/node_modules/@babel/core');

function load(file, environment = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const { code } = babel.transformSync(source, {
    babelrc: false, configFile: false,
    plugins: [require.resolve('../../openimis-fe_js/node_modules/@babel/plugin-transform-modules-commonjs')],
  });
  const output = { exports: {} };
  new Function('module', 'exports', 'require', code)(output, output.exports, (name) => {
    if (environment[name]) return environment[name];
    throw new Error(`Unexpected dependency ${name}`);
  });
  return output.exports;
}

test('training names and session date order gate saving', () => {
  const { isTrainingNameValid, isSessionDateOrderValid } = load('util/trainingSetup.js');
  assert.equal(isTrainingNameValid({ projectType: 'TRAINING', name: '  ' }), false);
  assert.equal(isTrainingNameValid({ projectType: 'TRAINING', name: 'x'.repeat(256) }), false);
  assert.equal(isTrainingNameValid({ projectType: 'TRAINING', name: 'Business skills' }), true);
  assert.equal(isTrainingNameValid({ projectType: 'WORK' }), true);
  assert.equal(isSessionDateOrderValid({}), true);
  assert.equal(isSessionDateOrderValid({ sessionStartDate: '2026-12-02', sessionEndDate: '2026-12-01' }), false);
  assert.equal(isSessionDateOrderValid({ sessionStartDate: '2026-12-02', sessionEndDate: '2026-12-02' }), true);
});

const actions = load('actions.js', {
  '@openimis/fe-core': {
    graphql: (payload) => payload,
    graphqlWithVariables: (query, variables) => ({ query, variables }),
    formatPageQueryWithCount: (field, params, projection) => JSON.stringify({ field, projection }),
    formatMutation: (_, input) => ({ payload: input }),
    formatGQLString: (value) => value.replace(/"/g, '\\"'),
    decodeId: (id) => id,
  },
  './reducer': { ACTION_TYPE: {} },
  './util/trainingSetup': load('util/trainingSetup.js'),
  './util/action-type': { REQUEST: () => '', SUCCESS: () => '', ERROR: () => '' },
});

test('training configuration is requested for the selected programme UUID', () => {
  const id = '01a1e45f-92eb-7cbd-a645-e5987d331147';
  const request = actions.fetchTrainingFormConfiguration(id);
  assert.deepEqual(request.variables, { benefitPlanId: id });
  assert.match(request.query, /projectTrainingFormConfig\(benefitPlanId: \$benefitPlanId\)/);
});

test('individual and household enrollment queries request backend module completion', () => {
  const manager = { getProjection: () => '{uuid}' };
  for (const fetch of [actions.fetchProjectBeneficiaries, actions.fetchProjectGroupBeneficiaries]) {
    const query = JSON.parse(fetch(manager, []));
    assert.ok(query.projection.includes('moduleCompletion { module { id name } tickedTopics totalTopics percentage }'));
  }
});

test('training sends manual name and nullable dates but never accepts a type input', () => {
  const payload = actions.createProject({ projectType: 'TRAINING', name: 'Business "skills"',
    sessionStartDate: '2026-12-02', sessionEndDate: null });
  assert.match(payload, /name: "Business \\"skills\\""/);
  assert.match(payload, /sessionStartDate: "2026-12-02"/);
  assert.doesNotMatch(payload, /sessionEndDate:/);
  assert.doesNotMatch(payload, /projectType:/);
});

test('work keeps generated naming and omitted dates intact', () => {
  const payload = actions.updateProject({ projectType: 'WORK', name: 'Ignore this', workingDays: 5 });
  assert.doesNotMatch(payload, /name:|sessionStartDate:|sessionEndDate:|projectType:/);
  assert.match(payload, /workingDays: 5/);
});

test('create form queries the backend deployment type', () => {
  assert.equal(actions.fetchProjectDeploymentType(), 'query { projectDeploymentType }');
});

test('Training create and update omit module IDs and work fields', () => {
  for (const action of [actions.createProject, actions.updateProject]) {
    const payload = action({ id: 'training', projectType: 'TRAINING', name: 'Training',
      trainingModules: [{ id: 'second' }, { id: 'first' }], workingDays: 10, activity: { id: 'legacy' } });
    assert.doesNotMatch(payload, /moduleIds:|workingDays:|activityId:/);
  }
});

test('required fields use modules for training and activity/work days for work', () => {
  const { isProjectRequiredFieldsMissing: missing } = load('util/trainingSetup.js');
  const base = { hotspot: {}, location: {}, targetBeneficiaries: 10 };
  assert.equal(Boolean(missing({ ...base, projectType: 'TRAINING', trainingModules: [{ id: 'module' }] })), false);
  assert.equal(Boolean(missing({ ...base, projectType: 'TRAINING', trainingModules: [] })), true);
  assert.equal(Boolean(missing({ ...base, projectType: 'TRAINING', trainingModules: [{}], trainingModuleLoadError: true })), true);
  assert.equal(Boolean(missing({ ...base, projectType: 'TRAINING', trainingModules: [{}], trainingModuleLoading: true })), true);
  assert.equal(Boolean(missing({ ...base, projectType: 'WORK', activity: {}, workingDays: 5 })), false);
  assert.equal(Boolean(missing({ ...base, projectType: 'WORK', trainingModules: [{}] })), true);
});

test('catalogue loading alone does not count as a project edit', () => {
  const { persistedProjectData } = load('util/trainingSetup.js');
  const saved = { id: 'training', name: 'Saved', trainingModules: [{ id: 'module' }] };
  assert.deepEqual(persistedProjectData({ ...saved, trainingModuleLoading: false, trainingModuleLoadError: false }), saved);
  assert.notDeepEqual(persistedProjectData({ ...saved, name: 'Edited' }), saved);
});

test('route and snapshot UUIDs bypass the Relay-only decoder', () => {
  const { decodeTrainingReferenceId } = load('util/trainingSetup.js');
  const id = '01a1e45f-92eb-7cbd-a645-e5987d331147';
  assert.equal(decodeTrainingReferenceId(id, () => { throw new Error('Raw UUID must not be decoded'); }), id);
  assert.equal(decodeTrainingReferenceId('encoded', () => id), id);
  assert.doesNotMatch(actions.updateProject({ projectType: 'TRAINING', trainingModules: [{ id }] }), /moduleIds:/);
});

test('empty optional Training target is omitted from creation without inline null literals', () => {
  for (const targetBeneficiaries of [null, undefined, '']) {
    const payload = actions.createProject({ projectType: 'TRAINING', targetBeneficiaries,
      sessionStartDate: null, sessionEndDate: null });
    assert.doesNotMatch(payload, /targetBeneficiaries:|sessionStartDate:|sessionEndDate:|:\s*null/);
  }
  assert.doesNotMatch(actions.createProject({ projectType: 'WORK', targetBeneficiaries: null }), /targetBeneficiaries:/);
});
