const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('../../openimis-fe_js/node_modules/@babel/core');

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const { code } = babel.transformSync(source, {
    babelrc: false, configFile: false,
    presets: [require.resolve('../../openimis-fe_js/node_modules/@babel/preset-react')],
    plugins: [require.resolve('../../openimis-fe_js/node_modules/@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, (name) => {
    if (dependencies[name]) return dependencies[name];
    throw new Error(`Unexpected import ${name}`);
  });
  return module.exports;
}

const helpers = load('util/trainingCatalogue.js');
const moduleData = () => ({ name: 'Entrepreneurship', programmes: [{ id: 'encoded-plan' }],
  topics: [{ id: 'topic-1', code: 'E01', name: 'Business idea' }, { id: 'topic-2', code: 'E02', name: 'Planning' }] });

test('topic reorder preserves original data, IDs and bounds', () => {
  const module = moduleData();
  const result = helpers.moveTopic(module.topics, 1, -1);
  assert.deepEqual(result.map((topic) => topic.id), ['topic-2', 'topic-1']);
  assert.equal(module.topics[0].id, 'topic-1');
  assert.equal(helpers.moveTopic(module.topics, 0, -1), module.topics);
  assert.equal(helpers.moveTopic(module.topics, 1, 1), module.topics);
});

test('module validation requires name, programmes, topics and unique topic codes', () => {
  assert.equal(helpers.validTrainingModule(moduleData()), true);
  for (const changes of [{ name: '  ' }, { name: 'X'.repeat(256) }, { programmes: [] }, { topics: [] },
    { topics: [{ code: 'E01', name: '' }] },
    { topics: [{ code: 'E01', name: 'One' }, { code: ' E01 ', name: 'Two' }] }]) {
    assert.equal(helpers.validTrainingModule({ ...moduleData(), ...changes }), false);
  }
});

test('mutation payload sends complete ordered topics and decoded programme IDs', () => {
  const module = moduleData();
  module.name = ' Entrepreneurship ';
  module.topics = [...helpers.moveTopic(module.topics, 1, -1), { key: 'local', code: ' E03 ', name: ' Marketing ' }];
  assert.deepEqual(helpers.trainingModuleInput(module, () => 'raw-plan-uuid'), {
    name: 'Entrepreneurship', programmeIds: ['raw-plan-uuid'], topics: [
      { id: 'topic-2', code: 'E02', name: 'Planning' },
      { id: 'topic-1', code: 'E01', name: 'Business idea' },
      { code: 'E03', name: 'Marketing' },
    ],
  });
});

test('GraphQL errors become readable text without rendering objects', () => {
  assert.equal(helpers.trainingCatalogueError({ payload: { errors: [{ message: 'Denied' }] } }, 'Failed'), 'Denied');
  assert.equal(helpers.trainingCatalogueError({}, 'Failed'), 'Failed');
  assert.equal(helpers.trainingCatalogueError({ status: 1, error: [{ message: 'Failed mutation', detail: 'Module is in use' }] }, 'Failed'), 'Module is in use');
});

const actions = load('trainingCatalogueActions.js', { '@openimis/fe-core': {
  graphql: (query) => ({ query }),
  graphqlMutation: (query, variables) => ({ query, variables }),
  formatPageQueryWithCount: (field, params, projection) => JSON.stringify({ field, params, projection }),
} });

test('create, edit and delete use typed mutation variables', () => {
  const input = { name: 'Business "skills"', programmeIds: ['plan'], topics: [{ code: 'E01', name: 'Idea' }] };
  const created = actions.saveTrainingModule(null, input);
  assert.match(created.query, /createTrainingModule/);
  assert.match(created.query, /CreateTrainingModuleInput!/);
  assert.deepEqual(created.variables.input, { ...input, clientMutationLabel: `Create Training module ${input.name}` });
  const updated = actions.saveTrainingModule('module-id', input);
  assert.match(updated.query, /updateTrainingModule/);
  assert.match(updated.query, /UpdateTrainingModuleInput!/);
  assert.deepEqual(updated.variables.input, { ...input, id: 'module-id', clientMutationLabel: `Update Training module ${input.name}` });
  const deleted = actions.deleteTrainingModule('module-id');
  assert.match(deleted.query, /DeleteTrainingModuleInput!/);
  assert.deepEqual(deleted.variables, { input: { id: 'module-id', clientMutationLabel: 'Delete Training module' } });
});

test('search retains programme filters and requests ordered topic details', () => {
  const request = actions.fetchTrainingModules(['benefitPlans_Id: "plan"', 'first: 10']);
  const query = JSON.parse(request.query);
  assert.equal(query.field, 'trainingModule');
  assert.deepEqual(query.params, ['benefitPlans_Id: "plan"', 'first: 10']);
  assert.ok(query.projection.some((field) => field.includes('topics {id, code, name, sequence}')));
});

const React = require('../../openimis-fe_js/node_modules/react');
const core = {
  useModulesManager: () => ({}), useTranslations: () => ({ formatMessage: (key) => key }),
  PublishedComponent: 'PublishedComponent', TextInput: 'TextInput', Filter: 'Filter',
  decodeId: () => 'raw-programme-id',
};
const constants = { MODULE_NAME: 'projectSocialProtection', BENEFIT_PLAN_TYPE: { EVERY_TYPE: 'EVERY_TYPE' } };

test('programme filter configures the existing Filter and decodes programme IDs', () => {
  const Filter = load('components/TrainingModulesFilter.js', {
    react: React, '@openimis/fe-core': core, '../constants': constants,
  }).default;
  let emitted;
  const tree = Filter({ filters: {}, onChangeFilters: (value) => { emitted = value; } });
  assert.deepEqual(tree.props.filterFields, []);
  assert.deepEqual(tree.props.checkboxFields, []);
  tree.props.pickerFields[0].props.onChange({ id: 'encoded-id' });
  assert.equal(emitted[0].filter, 'benefitPlans_Id: "raw-programme-id"');
  tree.props.pickerFields[0].props.onChange(null);
  assert.equal(emitted[0].filter, null);
});

test('topic editor supports add and reorder and hides editing controls when read-only', () => {
  const material = Object.fromEntries(['Button', 'Grid', 'IconButton', 'Table', 'TableBody', 'TableCell',
    'TableHead', 'TableRow', 'Tooltip'].map((name) => [name, name]));
  const dependencies = { react: React, '@openimis/fe-core': core, '@material-ui/core': material,
    '../constants': constants, '../util/trainingCatalogue': helpers };
  for (const icon of ['ArrowUpward', 'ArrowDownward', 'Delete']) dependencies[`@material-ui/icons/${icon}`] = () => null;
  const Head = load('components/TrainingModuleHeadPanel.js', dependencies).default;
  const nodes = (node) => !node || typeof node !== 'object' ? []
    : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  let changed;
  const props = { edited: moduleData(), onEditedChanged: (value) => { changed = value; } };
  const elements = nodes(Head(props));
  elements.find((node) => node.type === 'Button').props.onClick();
  assert.equal(changed.topics.length, 3);
  const upButtons = elements.filter((node) => node.type === 'IconButton' && node.props['aria-label'] === 'trainingModules.moveUp');
  assert.equal(upButtons[0].props.disabled, true);
  upButtons[1].props.onClick();
  assert.deepEqual(changed.topics.map((topic) => topic.id), ['topic-2', 'topic-1']);
  const readonly = nodes(Head({ ...props, readOnly: true }));
  assert.equal(readonly.some((node) => node.type === 'Button' || node.type === 'IconButton'), false);
  assert.ok(readonly.filter((node) => node.type === 'TextInput').every((node) => node.props.readOnly));
});

test('shared Form save receives no Promise and a failed save remains editable for retry', async () => {
  const states = [];
  let cursor = 0;
  let fail = true;
  let saves = 0;
  const fakeReact = { ...React,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect: () => {}, useCallback: (callback) => callback, useRef: (current) => ({ current }),
  };
  const Page = load('pages/TrainingModulesPage.js', {
    react: fakeReact,
    'react-redux': {
      useSelector: (select) => select({ core: { user: { i_user: { rights: [208001, 208002] } } } }),
      useDispatch: () => async () => {
        saves += 1;
        return fail ? { status: 1, error: [{ detail: 'Duplicate topic code' }] } : { status: 2 };
      },
    },
    '@material-ui/core': Object.fromEntries(['Button', 'Dialog', 'DialogActions', 'DialogContent',
      'DialogContentText', 'DialogTitle', 'IconButton', 'Typography'].map((name) => [name, name])),
    '@material-ui/icons/Add': () => null, '@material-ui/icons/Edit': () => null, '@material-ui/icons/Delete': () => null,
    '@openimis/fe-core': { ...core, Form: 'Form', Searcher: 'Searcher' },
    '../constants': constants, '../components/TrainingModulesFilter': () => null,
    '../components/TrainingModuleHeadPanel': () => null,
    '../trainingCatalogueActions': { saveTrainingModule: () => ({ type: 'save' }) },
    '../util/trainingCatalogue': helpers,
  }).default;
  const nodes = (node) => !node || typeof node !== 'object' ? []
    : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const render = () => { cursor = 0; return nodes(Page()); };
  render().find((node) => node.type === 'Searcher').props.searcherActions[0].onClick();
  render().find((node) => node.type === 'Form').props.onEditedChanged(moduleData());
  let form = render().find((node) => node.type === 'Form');
  assert.equal(form.props.canSave(), true);
  assert.equal(form.props.save(), undefined);
  await new Promise(setImmediate);
  let elements = render();
  form = elements.find((node) => node.type === 'Form');
  assert.ok(form);
  assert.equal(form.props.update, 1);
  assert.equal(form.props.canSave(), true);
  assert.ok(elements.some((node) => node.type === 'Typography' && node.props.children === 'Duplicate topic code'));
  fail = false;
  assert.equal(form.props.save(), undefined);
  await new Promise(setImmediate);
  assert.equal(render().some((node) => node.type === 'Form'), false);
  assert.equal(saves, 2);
});
