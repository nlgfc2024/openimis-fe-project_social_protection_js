const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('../../openimis-fe_js/node_modules/@babel/core');
const React = require('../../openimis-fe_js/node_modules/react');

function load(file, dependencies = {}) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    babelrc: false, configFile: false,
    presets: [require.resolve('../../openimis-fe_js/node_modules/@babel/preset-react')],
    plugins: [require.resolve('../../openimis-fe_js/node_modules/@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, (name) => {
    if (dependencies[name]) return dependencies[name];
    throw new Error(`Unexpected dependency ${name}`);
  });
  return module.exports;
}

const helpers = load('util/trainingFormConfig.js');
const rule = (updates = {}) => ({ visible: true, required: false, readOnly: false, ...updates });

test('backend JSON is parsed safely and defaults preserve typed values', () => {
  const config = helpers.parseTrainingFormConfig(JSON.stringify({ fields: {
    name: rule({ default: 'Default name' }), knownPlace: rule({ default: 'Fixed', readOnly: true }),
  } }));
  const project = helpers.applyTrainingFormDefaults({ name: 'Typed name', knownPlace: 'Attempted override' }, config);
  assert.equal(project.name, 'Typed name');
  assert.equal(project.knownPlace, 'Fixed');
  for (const value of [null, 'invalid', {}, { fields: null }, { fields: [] }]) {
    assert.throws(() => helpers.parseTrainingFormConfig(value));
  }
});

test('required flags control validation, including optional Training targets', () => {
  const config = { fields: { name: rule({ required: true }), knownPlace: rule({ required: true }),
    targetBeneficiaries: rule({ required: false }) } };
  assert.equal(helpers.trainingCreationFieldsMissing({ name: 'Training' }, config), true);
  assert.equal(helpers.trainingCreationFieldsMissing({ name: 'Training', knownPlace: 'Market' }, config), false);
  assert.equal(helpers.trainingTargetInRange({}, config, 200), true);
  assert.equal(helpers.trainingTargetInRange({ targetBeneficiaries: 1 }, config, 200), true);
  assert.equal(helpers.trainingTargetInRange({ targetBeneficiaries: 201 }, config, 200), false);
  assert.equal(helpers.trainingTargetInRange({ targetBeneficiaries: 0 }, config, 200), false);
});

test('required district can be derived from a default location', () => {
  const config = { fields: { district: rule({ required: true }), location: rule({ required: true }) } };
  assert.equal(helpers.trainingCreationFieldsMissing({ location: { type: 'D', parent: { type: 'R' } } }, config), false);
});

test('hidden inputs are omitted while hidden defaults and programme context are retained', () => {
  const payload = helpers.trainingCreationPayload({ hotspot: { id: 1 }, knownPlace: 'Changed',
    trainingModules: [{ id: 'one' }], benefitPlan: { id: 'plan' }, status: 'PREPARATION' }, { fields: {
    hotspot: rule({ visible: false }), knownPlace: rule({ visible: false, default: 'Configured' }),
    trainingModules: rule({ visible: false }), benefitPlan: rule({ visible: false, readOnly: true }),
    status: rule({ visible: false, readOnly: true }),
  } });
  assert.equal('hotspot' in payload, false);
  assert.equal('trainingModules' in payload, false);
  assert.equal(payload.knownPlace, 'Configured');
  assert.equal(payload.benefitPlan.id, 'plan');
  assert.equal(payload.status, 'PREPARATION');
});

const identity = (component) => component;
const Head = load('components/ProjectHeadPanel.js', {
  react: React, '@material-ui/core': { Grid: 'Grid' },
  '@material-ui/core/styles': { withTheme: identity, withStyles: () => identity },
  'react-intl': { injectIntl: identity },
  '@openimis/fe-core': { FormPanel: React.Component, NumberInput: 'NumberInput', TextInput: 'TextInput',
    PublishedComponent: 'PublishedComponent', formatMessage: (_, __, key) => key, withModulesManager: identity },
  '../constants': { MODULE_NAME: 'projectSocialProtection', getMaxTargetBeneficiaries: () => 200 },
  '../pickers/ActivityPicker': 'ActivityPicker', '../pickers/TrainingModulePicker': 'TrainingModulePicker',
  '../pickers/ProjectStatusPicker': 'StatusPicker', '../pickers/HotspotPicker': 'HotspotPicker',
  '../pickers/UserPicker': 'UserPicker', '../util/trainingFormConfig': helpers,
}).default;
const nodes = (node) => !node || typeof node !== 'object' ? []
  : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
const render = (config, project = { projectType: 'TRAINING' }) => nodes(new Head({
  edited: project, trainingFormConfig: config, classes: {}, intl: {}, readOnly: false,
}).render());

test('JSON controls field visibility, required markers and read-only state', () => {
  const elements = render({ fields: { hotspot: rule({ visible: false }),
    knownPlace: rule({ required: true, readOnly: true, default: 'Market' }),
    targetBeneficiaries: rule({ required: false }),
  } });
  assert.equal(elements.some((node) => node.type === 'HotspotPicker'), false);
  const place = elements.find((node) => node.type === 'TextInput' && node.props.label === 'project.knownPlace');
  assert.equal(place.props.required, true);
  assert.equal(place.props.readOnly, true);
  assert.equal(elements.find((node) => node.type === 'NumberInput'
    && node.props.label === 'project.targetBeneficiaries').props.required, false);
});

test('programme module summary remains visible even when legacy configuration hides the input', () => {
  const elements = render({ fields: { trainingModules: rule({ visible: false }) } });
  const picker = elements.find((node) => node.type === 'TrainingModulePicker');
  assert.ok(picker);
  assert.notEqual(picker.props.renderControl, false);
  assert.equal(elements.some((node) => node.type === 'Grid' && node.props['data-training-field'] === 'trainingModules'), true);
});

test('read-only module configuration does not skip automatic programme loading', () => {
  const elements = render({ fields: { trainingModules: rule({ readOnly: true }) } });
  const picker = elements.find((node) => node.type === 'TrainingModulePicker');
  assert.equal(picker.props.readOnly, true);
  assert.equal(picker.props.locked, false);
});

test('programme module editing follows config on creation and details', () => {
  for (const project of [{ projectType: 'TRAINING' }, { projectType: 'TRAINING', id: 'existing' }]) {
    for (const readOnly of [false, true]) {
      const elements = render({ fields: { trainingModules: rule({ readOnly }) } }, project);
      const picker = elements.find((node) => node.type === 'TrainingModulePicker');
      assert.equal(picker.props.readOnly, readOnly);
      assert.equal(picker.props.autoSelectProgrammeModules, !project.id);
      assert.equal(picker.props.locked, false);
    }
  }
});

test('programme configuration hides fields on existing Training records and preserves WORK fields', () => {
  const config = { fields: { hotspot: rule({ visible: false }) } };
  assert.ok(render(config, { projectType: 'WORK' }).some((node) => node.type === 'HotspotPicker'));
  assert.equal(render(config, { projectType: 'TRAINING', id: 'existing' }).some((node) => node.type === 'HotspotPicker'), false);
});

test('Training details honour readonly rules without applying creation defaults', () => {
  const config = { fields: { knownPlace: rule({ readOnly: true, default: 'New default' }),
    targetBeneficiaries: rule({ required: false }), location: rule({ visible: false }) } };
  const elements = render(config, { projectType: 'TRAINING', id: 'existing', knownPlace: 'Saved venue' });
  const venue = elements.find((node) => node.type === 'TextInput' && node.props.label === 'project.knownPlace');
  assert.equal(venue.props.value, 'Saved venue');
  assert.equal(venue.props.readOnly, true);
  assert.equal(elements.some((node) => node.props['data-training-field'] === 'location'), false);
});

function pageHarness({ type = 'TRAINING', fail = false, saveStatus = 2 } = {}) {
  const states = [], calls = [], alerts = [];
  let cursor = 0, effect, submitted, redirect, redirectState;
  const config = { fields: {
    name: rule({ required: true, readOnly: true, default: 'Configured training' }),
    location: rule({ required: true, default: { uuid: 'location', type: 'D', parent: { type: 'R' } } }),
    trainingModules: rule({ required: true, default: [{ id: 'module', topicCount: 1 }] }),
    targetBeneficiaries: rule({ required: false, default: null }),
    hotspot: rule({ visible: false }),
  } };
  const dispatch = async (action) => {
    if (action.kind === 'wait') return { status: saveStatus, error: [{ message: 'Training validation failed' }] };
    calls.push(action.kind);
    if (action.kind === 'type') return { payload: { data: { projectDeploymentType: type } } };
    return fail ? { payload: { errors: [{ message: 'Invalid configuration' }] } }
      : { payload: { data: { projectTrainingFormConfig: JSON.stringify(config) } } };
  };
  const Page = load('pages/ProjectCreatePage.js', {
    react: { ...React,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
      },
      useEffect: (callback) => { if (callback.toString().includes('fetchProjectDeploymentType')) effect = callback; },
      useRef: (current) => ({ current }),
    },
    '@openimis/fe-core': { Form: 'Form', formatMessage: (_, __, key) => key,
      formatMessageWithValues: (_, __, key) => key, withModulesManager: identity,
      useHistory: () => ({ location: { pathname: '/benefitPlans/benefitPlan/plan/project/create',
        state: { benefitPlanId: 'plan', benefitPlanName: 'Programme' } },
      replace: (path, state) => { redirect = path; redirectState = state; } }), coreAlert: () => {},
      waitForMutation: () => ({ kind: 'wait' }),
    },
    'react-intl': { injectIntl: identity }, redux: { bindActionCreators: () => ({}) },
    'react-redux': { connect: () => identity, useDispatch: () => dispatch },
    '@material-ui/core': { Typography: 'Typography' },
    '@material-ui/core/styles': { withTheme: identity, withStyles: () => identity },
    '../actions': { fetchProjectDeploymentType: () => ({ kind: 'type' }),
      fetchTrainingFormConfiguration: () => ({ kind: 'config' }) },
    '../reducer': { ACTION_TYPE: {} }, '../components/ProjectHeadPanel': () => null,
    '../components/ProjectTabPanel': () => null,
    '../util/trainingSetup': load('util/trainingSetup.js'), '../util/trainingFormConfig': helpers,
    '../constants': { RIGHT_BENEFIT_PLAN_UPDATE: 160003, getMaxTargetBeneficiaries: () => 200,
      MIN_TARGET_BENEFICIARIES: 5, BENEFIT_PLAN_PROJECTS_TAB_VALUE: 'BenefitPlanProjectsTab' },
  }).default;
  const props = { intl: {}, classes: {}, rights: [160003], modulesManager: {
    getRef: (key) => key === 'socialProtection.route.benefitPlan' ? 'benefitPlans/benefitPlan' : 'projects',
  }, projectNameIsValid: true,
    coreAlert: (...args) => { alerts.push(args); },
    createProject: (payload) => { submitted = payload;
      return Promise.resolve({ payload: { data: { createProject: { clientMutationId: 'save-id' } } } }); } };
  return {
    render: () => { cursor = 0; return nodes(Page(props)); },
    run: () => effect(), calls, alerts, submitted: () => submitted, redirect: () => redirect,
    redirectState: () => redirectState,
  };
}

test('create page fetches backend configuration and applies defaults to validation and payload', async () => {
  const page = pageHarness();
  page.render(); page.run();
  await new Promise(setImmediate);
  let form = page.render().find((node) => node.type === 'Form');
  assert.deepEqual(page.calls, ['type', 'config']);
  assert.equal(form.props.edited.name, 'Configured training');
  assert.equal(form.props.canSave(), true);
  form.props.onEditedChanged((previous) => ({ ...previous, name: 'Attempted override', hotspot: { id: 1 } }));
  form = page.render().find((node) => node.type === 'Form');
  assert.equal(form.props.edited.name, 'Configured training');
  form.props.save();
  await new Promise(setImmediate);
  assert.equal(page.submitted().name, 'Configured training');
  assert.equal(page.submitted().targetBeneficiaries, null);
  assert.equal('hotspot' in page.submitted(), false);
  assert.equal(page.redirect(), '/projects');
});

test('failed Training save stays on the form and displays its error', async () => {
  const page = pageHarness({ saveStatus: 1 });
  page.render(); page.run();
  await new Promise(setImmediate);
  page.render().find((node) => node.type === 'Form').props.save();
  await new Promise(setImmediate);
  assert.equal(page.redirect(), undefined);
  assert.deepEqual(page.alerts, []);
  assert.ok(page.render().some((node) => node.type === 'Typography'
    && node.props.children === 'Training validation failed'));
});

test('successful WORK creation returns to its phase Projects tab', async () => {
  const page = pageHarness({ type: 'WORK' });
  page.render(); page.run();
  await new Promise(setImmediate);
  page.render().find((node) => node.type === 'Form').props.save();
  await new Promise(setImmediate);
  assert.equal(page.redirect(), '/benefitPlans/benefitPlan/plan');
  assert.deepEqual(page.redirectState(), { activeTab: 'BenefitPlanProjectsTab' });
});

test('failed WORK creation uses a standard alert without redirecting', async () => {
  const page = pageHarness({ type: 'WORK', saveStatus: 1 });
  page.render(); page.run();
  await new Promise(setImmediate);
  page.render().find((node) => node.type === 'Form').props.save();
  await new Promise(setImmediate);
  assert.equal(page.redirect(), undefined);
  assert.deepEqual(page.alerts, [['FatalError.GenericError.title', 'Training validation failed']]);
  assert.equal(page.render().some((node) => node.type === 'Typography'
    && node.props.children === 'Training validation failed'), false);
});

test('unavailable Training configuration blocks saving and shows a configuration error', async () => {
  const page = pageHarness({ fail: true });
  page.render(); page.run();
  await new Promise(setImmediate);
  const elements = page.render();
  assert.equal(elements.find((node) => node.type === 'Form').props.canSave(), false);
  assert.ok(elements.some((node) => node.type === 'Typography'
    && node.props.children === 'project.trainingFormConfig.error'));
});

test('WORK creation does not fetch or apply Training configuration', async () => {
  const page = pageHarness({ type: 'WORK' });
  page.render(); page.run();
  await new Promise(setImmediate);
  const form = page.render().find((node) => node.type === 'Form');
  assert.deepEqual(page.calls, ['type']);
  assert.equal(form.props.edited.projectType, 'WORK');
  assert.equal(form.props.edited.name, undefined);
});
