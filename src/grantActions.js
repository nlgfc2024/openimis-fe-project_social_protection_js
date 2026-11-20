import { graphqlMutation, graphqlWithVariables } from '@openimis/fe-core';

// Saves a beneficiary's (or household beneficiary's) jsonExt through the existing
// update mutation and waits for its journalled result. The backend checks the
// grant and utilization rights and may turn the update into an approval task.
export const saveBeneficiaryJsonExt = ({ isGroup, beneficiary, jsonExt, label }) => {
  const mutation = isGroup ? 'updateGroupBeneficiary' : 'updateBeneficiary';
  const inputType = isGroup ? 'UpdateGroupBeneficiaryMutationInput' : 'UpdateBeneficiaryMutationInput';
  return graphqlMutation(
    `mutation ($input: ${inputType}!) { ${mutation}(input: $input) { internalId clientMutationId } }`,
    {
      input: {
        id: beneficiary.id,
        benefitPlanId: beneficiary.benefitPlan?.id,
        status: beneficiary.status,
        jsonExt: JSON.stringify(jsonExt),
        clientMutationLabel: label,
      },
    },
    'PROJECT_SOCIAL_PROTECTION_SAVE_BENEFICIARY_GRANT',
  );
};

// The beneficiary's current jsonExt, to tell a saved change from one waiting for
// approval.
export const fetchBeneficiaryJsonExt = ({ isGroup, id }) => graphqlWithVariables(
  `query ($id: ID) { ${isGroup ? 'groupBeneficiary' : 'beneficiary'}(id: $id) { edges { node { jsonExt } } } }`,
  { id },
  'PROJECT_SOCIAL_PROTECTION_BENEFICIARY_GRANT',
);

// Messages from a failed mutation log entry or a failed request.
export const mutationErrorMessages = (result) => {
  const errors = result?.error;
  if (!errors) return [];
  const list = Array.isArray(errors) ? errors : [errors];
  return list.map((error) => (typeof error === 'string' ? error : error.detail || error.message)).filter(Boolean);
};
