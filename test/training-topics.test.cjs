const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('../../openimis-fe_js/node_modules/@babel/core');
const React = require('../../openimis-fe_js/node_modules/react');

function load(file, dependencies) {
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

function pickerHarness({ value, readOnly = false, fail = false } = {}) {
  const states = [];
  let cursor = 0;
  let effect;
  let currentValue = value;
  const updates = [];
  const requests = [];
  const ref = { current: null };
  const dispatch = async (params) => {
    requests.push(params);
    if (fail) throw new Error('Network unavailable');
    const second = params.some((param) => param.startsWith('after:'));
    return { payload: { data: { trainingModule: {
      edges: [{ node: { id: second ? 'encoded-b' : 'encoded-a', name: second ? 'B' : 'A', topics: [{}, {}] } }],
      pageInfo: { hasNextPage: !second, endCursor: second ? 'done' : 'page-1' },
    } } } };
  };
  const Picker = load('pickers/TrainingModulePicker.js', {
    react: { ...React,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next) => { states[index] = next; }];
      },
      useRef: () => ref, useEffect: (callback) => { effect = callback; },
    },
    'react-redux': { useDispatch: () => dispatch },
    '@material-ui/core': { TextField: 'TextField', Typography: 'Typography' },
    '@openimis/fe-core': { Autocomplete: 'Autocomplete', decodeId: (id) => id.replace('encoded-', ''),
      useModulesManager: () => ({}), useTranslations: () => ({ formatMessage: (key) => key }) },
    '../trainingCatalogueActions': { fetchTrainingModules: (params) => params },
    '../constants': { MODULE_NAME: 'projectSocialProtection' },
    '../util/trainingSetup': load('util/trainingSetup.js', {}),
  }).default;
  const render = () => {
    cursor = 0;
    return Picker({ programmeId: 'encoded-plan', value: currentValue, savedModules: value, readOnly,
      onStateChange: (update) => { updates.push(update); if ('trainingModules' in update) currentValue = update.trainingModules; } });
  };
  return { render, run: () => effect(), updates, requests };
}

const nodes = (node) => !node || typeof node !== 'object' ? []
  : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];

test('picker loads every page and defaults to all programme modules in one state update', async () => {
  const harness = pickerHarness();
  harness.render(); harness.run();
  await new Promise(setImmediate);
  assert.equal(harness.requests.length, 2);
  assert.ok(harness.requests[0].includes('benefitPlans_Id: "plan"'));
  const update = harness.updates.at(-1);
  assert.equal(update.trainingModuleLoading, false);
  assert.deepEqual(update.trainingModules.map((module) => module.id), ['a', 'b']);
  assert.equal(update.trainingModules[0].topicCount, 2);
});

test('picker retains explicit selections and lets users choose a subset', async () => {
  const harness = pickerHarness({ value: [{ id: 'b', name: 'Snapshot B', topicCount: 1 }] });
  harness.render(); harness.run();
  await new Promise(setImmediate);
  assert.equal('trainingModules' in harness.updates.at(-1), false);
  const picker = nodes(harness.render()).find((node) => node.type === 'Autocomplete');
  assert.equal(picker.props.value[0].name, 'Snapshot B');
  picker.props.onChange([{ id: 'a' }]);
  assert.deepEqual(harness.updates.at(-1).trainingModules, [{ id: 'a', name: 'A', topicCount: 2 }]);
});

test('locked picker preserves deleted catalogue snapshots without querying or resetting', () => {
  const harness = pickerHarness({ value: [{ id: 'deleted', name: 'Saved module' }], readOnly: true });
  const tree = harness.render(); harness.run();
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.updates.length, 0);
  const picker = nodes(tree).find((node) => node.type === 'Autocomplete');
  assert.equal(picker.props.readOnly, true);
  assert.equal(picker.props.value[0].name, 'Saved module');
  assert.equal(nodes(tree).some((node) => node.props.children === 'project.trainingModules.locked'), false);
});

test('picker exposes load errors and prevents save while catalogue is unavailable', async () => {
  const harness = pickerHarness({ fail: true });
  harness.render(); harness.run();
  await new Promise(setImmediate);
  assert.equal(harness.updates.at(-1).trainingModuleLoadError, true);
  assert.equal(nodes(harness.render()).find((node) => node.type === 'Autocomplete').props.error, true);
});

test('opening and typing in the shared autocomplete does not refetch or crash', async () => {
  const harness = pickerHarness();
  harness.render(); harness.run();
  await new Promise(setImmediate);
  const picker = nodes(harness.render()).find((node) => node.type === 'Autocomplete');
  const states = [], effects = [];
  let cursor = 0;
  const identity = (component) => component;
  const SharedAutocomplete = load('../../openimis-fe_js/node_modules/@openimis/fe-core/src/components/inputs/Autocomplete.js', {
    react: { ...React,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next) => { states[index] = next; }];
      },
      useEffect: (effect) => effects.push(effect),
    },
    '@material-ui/core/styles': { withTheme: identity, withStyles: () => identity },
    '@material-ui/lab': { Autocomplete: 'MuiAutocomplete' },
    '@material-ui/core': { TextField: 'TextField' },
    '../../helpers/hooks': { useDebounceCb: (callback) => callback },
    '../../helpers/i18n': { useTranslations: () => ({ formatMessage: (key) => key }) },
    '../../helpers/modules': { useModulesManager: () => ({ getConf: (_, __, fallback) => fallback }) },
  }).default;
  SharedAutocomplete(picker.props).props.onOpen();
  cursor = 0; effects.length = 0;
  const opened = SharedAutocomplete(picker.props);
  assert.doesNotThrow(() => effects[0]());
  assert.doesNotThrow(() => opened.props.onInputChange(null, 'business'));
  assert.equal(harness.requests.length, 2);
});

test('form switches Training to module selection and a derived read-only topic count', () => {
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
    '../pickers/UserPicker': 'UserPicker',
  }).default;
  let current;
  const render = (edited) => {
    current = edited;
    return nodes(new Head({ edited, intl: {}, classes: {}, readOnly: false,
      onEditedChanged: (change) => { current = typeof change === 'function' ? change(current) : change; },
    }).render());
  };
  const training = render({ projectType: 'TRAINING', trainingModules: [{ topicCount: 2 }, { topicCount: 3 }] });
  assert.ok(training.some((node) => node.type === 'TrainingModulePicker'));
  assert.equal(training.some((node) => node.type === 'ActivityPicker'), false);
  const count = training.find((node) => node.type === 'NumberInput' && node.props.label === 'project.topicCount');
  assert.equal(count.props.value, 5);
  assert.equal(count.props.readOnly, true);
  // Module loading must merge into current form state, including changes made
  // after the head panel rendered, rather than its asynchronous local copy.
  current = { ...current, name: 'Typed while modules load' };
  training.find((node) => node.type === 'TrainingModulePicker').props.onStateChange({ trainingModuleLoading: true });
  assert.equal(current.projectType, 'TRAINING');
  assert.equal(current.name, 'Typed while modules load');
  assert.equal(current.trainingModuleLoading, true);
  const work = render({ projectType: 'WORK', workingDays: 10 });
  assert.ok(work.some((node) => node.type === 'ActivityPicker'));
  assert.equal(work.some((node) => node.type === 'TrainingModulePicker'), false);
  assert.equal(work.find((node) => node.type === 'NumberInput' && node.props.label === 'project.workingDays').props.readOnly, false);
  assert.equal(render({ projectType: 'TRAINING', trainingModulesLocked: true })
    .find((node) => node.type === 'TrainingModulePicker').props.readOnly, true);
});
