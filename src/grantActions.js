import { graphqlMutation, graphqlWithVariables } from '@openimis/fe-core';

// Records a beneficiary's utilisation assessment (attendance-grant backend): only the
// assessment values are sent, and the backend merges them into the current record.
export const recordUtilisationAssessment = ({
  isGroup, beneficiary, values, label,
}) => graphqlMutation(
  'mutation ($input: RecordUtilisationAssessmentMutationInput!) { recordUtilisationAssessment(input: $input) '
  + '{ internalId clientMutationId } }',
  {
    input: {
      id: beneficiary.id,
      isGroup,
      jsonExt: JSON.stringify(values),
      clientMutationLabel: label,
    },
  },
  'PROJECT_SOCIAL_PROTECTION_RECORD_UTILISATION',
);

// Submits a beneficiary's grant details for approval (attendance-grant backend).
export const submitBeneficiaryPlan = ({
  isGroup, beneficiary, proposal, label,
}) => graphqlMutation(
  'mutation ($input: SubmitBeneficiaryPlanMutationInput!) { submitBeneficiaryPlan(input: $input) '
  + '{ internalId clientMutationId } }',
  {
    input: {
      id: beneficiary.id,
      isGroup,
      jsonExt: JSON.stringify(proposal),
      clientMutationLabel: label,
    },
  },
  'PROJECT_SOCIAL_PROTECTION_SUBMIT_BENEFICIARY_PLAN',
);

// The beneficiary's plan approval waiting for a decision, if any.
export const fetchPendingPlanApproval = ({ isGroup, id }) => graphqlWithVariables(
  `query ($id: UUID!, $isGroup: Boolean) {
    pendingBeneficiaryPlanApproval(beneficiaryId: $id, isGroup: $isGroup) {
      taskId origin submittedOn submittedBy incomingData
    }
  }`,
  { id, isGroup },
  'PROJECT_SOCIAL_PROTECTION_PENDING_PLAN_APPROVAL',
);

// Approves or rejects a plan approval task; a rejection carries its reason.
export const resolvePlanApproval = ({
  task, user, decision, reason, label,
}) => graphqlMutation(
  'mutation ($input: ResolveTaskMutationInput!) { resolveTask(input: $input) { internalId clientMutationId } }',
  {
    input: {
      id: task.id,
      businessStatus: JSON.stringify({ [user.id]: decision }),
      ...(reason ? { additionalData: JSON.stringify({ reason }) } : {}),
      clientMutationLabel: label,
    },
  },
  'PROJECT_SOCIAL_PROTECTION_RESOLVE_PLAN_APPROVAL',
);

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
