import { graphql, graphqlMutation, formatPageQueryWithCount } from '@openimis/fe-core';

const PROJECTION = ['id', 'uuid', 'name', 'programmes {id, code, name}', 'topics {id, code, name, sequence}'];

export const fetchTrainingModules = (params) => graphql(
  formatPageQueryWithCount('trainingModule', params, PROJECTION), 'TRAINING_MODULE_CATALOGUE',
);

export const saveTrainingModule = (id, input) => {
  const mutation = id ? 'updateTrainingModule' : 'createTrainingModule';
  const inputType = id ? 'UpdateTrainingModuleInput' : 'CreateTrainingModuleInput';
  return graphqlMutation(`mutation SaveTrainingModule($input: ${inputType}!) {
    result: ${mutation}(input: $input) { internalId clientMutationId }
  }`, { input: { ...input, ...(id ? { id } : {}), clientMutationLabel: `${id ? 'Update' : 'Create'} Training module ${input.name}` } },
  'SAVE_TRAINING_MODULE');
};

export const deleteTrainingModule = (id) => graphqlMutation(`mutation DeleteTrainingModule($input: DeleteTrainingModuleInput!) {
  result: deleteTrainingModule(input: $input) { internalId clientMutationId }
}`, { input: { id, clientMutationLabel: 'Delete Training module' } }, 'DELETE_TRAINING_MODULE');
