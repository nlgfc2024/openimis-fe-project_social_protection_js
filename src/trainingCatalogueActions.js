import { graphql, graphqlWithVariables, formatPageQueryWithCount } from '@openimis/fe-core';

const PROJECTION = ['id', 'uuid', 'name', 'programmes {id, code, name}', 'topics {id, code, name, sequence}'];

export const fetchTrainingModules = (params) => graphql(
  formatPageQueryWithCount('trainingModule', params, PROJECTION), 'TRAINING_MODULE_CATALOGUE',
);

export const saveTrainingModule = (id, input) => {
  const mutation = id ? 'updateTrainingModule' : 'createTrainingModule';
  return graphqlWithVariables(`mutation SaveTrainingModule($input: TrainingModuleInput!${id ? ', $id: UUID!' : ''}) {
    result: ${mutation}(input: $input${id ? ', id: $id' : ''}) { success errors module {uuid} }
  }`, { input, ...(id ? { id } : {}) }, 'SAVE_TRAINING_MODULE');
};

export const deleteTrainingModule = (id) => graphqlWithVariables(`mutation DeleteTrainingModule($id: UUID!) {
  result: deleteTrainingModule(id: $id) { success errors }
}`, { id }, 'DELETE_TRAINING_MODULE');
