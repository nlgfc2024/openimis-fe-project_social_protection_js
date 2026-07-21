// Disabled due to consistency with other modules
/* eslint-disable default-param-last */

import {
  decodeId,
  dispatchMutationErr,
  dispatchMutationReq,
  dispatchMutationResp,
  formatGraphQLError,
  formatServerError,
  pageInfo,
  parseData,
} from '@openimis/fe-core';
import {
  CLEAR, ERROR, REQUEST, SUCCESS,
} from './util/action-type';

export const ACTION_TYPE = {
  MUTATION: 'PROJECT_SOCIAL_PROTECTION_MUTATION',
  SEARCH_PROJECTS: 'PROJECT_SOCIAL_PROTECTION_PROJECTS',
  SEARCH_PROJECTS_HISTORY: 'PROJECT_SOCIAL_PROTECTION_PROJECTS_HISTORY',
  GET_PROJECT: 'PROJECT_SOCIAL_PROTECTION_PROJECT',
  CREATE_PROJECT: 'PROJECT_SOCIAL_PROTECTION_CREATE_PROJECT',
  UPDATE_PROJECT: 'PROJECT_SOCIAL_PROTECTION_UPDATE_PROJECT',
  DELETE_PROJECT: 'PROJECT_SOCIAL_PROTECTION_DELETE_PROJECT',
  UNDO_DELETE_PROJECT: 'PROJECT_SOCIAL_PROTECTION_UNDO_DELETE_PROJECT',
  PROJECT_NAME_FIELDS_VALIDATION: 'PROJECT_SOCIAL_PROTECTION_NAME_FIELDS_VALIDATION',
  PROJECT_NAME_SET_VALID: 'PROJECT_SOCIAL_PROTECTION_NAME_SET_VALID',
  PROJECT_ENROLL: 'PROJECT_SOCIAL_PROTECTION_ENROLL',
  PROJECT_ENROLL_GROUP: 'PROJECT_SOCIAL_PROTECTION_ENROLL_GROUP',
  BULK_UPDATE_BENEFICIARY_TIME_ENTRIES: 'PROJECT_SOCIAL_PROTECTION_BULK_UPDATE_TIME_ENTRIES',
  BULK_UPDATE_GROUP_BENEFICIARY_TIME_ENTRIES: 'PROJECT_SOCIAL_PROTECTION_BULK_UPDATE_GROUP_TIME_ENTRIES',
  // Enrolled-beneficiary lists shown on a project (fetched via the project
  // module's projectEligibleBeneficiaries query with enrolledInProject).
  SEARCH_PROJECT_BENEFICIARIES: 'PROJECT_SOCIAL_PROTECTION_BENEFICIARIES',
  SEARCH_PROJECT_GROUP_BENEFICIARIES: 'PROJECT_SOCIAL_PROTECTION_GROUP_BENEFICIARIES',
  // Eligible-to-enroll lists shown in the enrollment dialog (spinner flags only;
  // the dialog reads the response payload directly).
  SEARCH_PROJECT_ELIGIBLE_BENEFICIARIES: 'PROJECT_SOCIAL_PROTECTION_ELIGIBLE_BENEFICIARIES',
  SEARCH_PROJECT_ELIGIBLE_GROUP_BENEFICIARIES: 'PROJECT_SOCIAL_PROTECTION_ELIGIBLE_GROUP_BENEFICIARIES',
  PROJECT_EXPORT: 'PROJECT_SOCIAL_PROTECTION_PROJECT_EXPORT',
};

function reducer(
  state = {
    submittingMutation: false,
    mutation: {},
    fetchingProjects: false,
    errorProjects: null,
    fetchedProjects: false,
    projects: [],
    projectsPageInfo: {},
    projectsTotalCount: 0,
    fetchingProject: false,
    errorProject: null,
    fetchedProject: false,
    project: null,
    fetchingProjectsHistory: false,
    errorProjectsHistory: null,
    fetchedProjectsHistory: false,
    projectsHistory: [],
    projectsHistoryPageInfo: {},
    projectsHistoryTotalCount: 0,
    fetchingProjectBeneficiaries: false,
    fetchedProjectBeneficiaries: false,
    projectBeneficiaries: [],
    projectBeneficiariesPageInfo: {},
    projectBeneficiariesTotalCount: 0,
    errorProjectBeneficiaries: null,
    fetchingProjectGroupBeneficiaries: false,
    fetchedProjectGroupBeneficiaries: false,
    projectGroupBeneficiaries: [],
    projectGroupBeneficiariesPageInfo: {},
    projectGroupBeneficiariesTotalCount: 0,
    errorProjectGroupBeneficiaries: null,
    fetchingProjectEligibleBeneficiaries: false,
    fetchingProjectEligibleGroupBeneficiaries: false,
    validationFields: {},
    fetchingProjectExport: false,
    fetchedProjectExport: false,
    projectExport: null,
    projectExportPageInfo: {},
    errorProjectExport: null,
  },
  action,
) {
  switch (action.type) {
    case REQUEST(ACTION_TYPE.SEARCH_PROJECTS):
      return {
        ...state,
        fetchingProjects: true,
        fetchedProjects: false,
        projects: [],
        projectsPageInfo: {},
        projectsTotalCount: 0,
        errorProjects: null,
      };
    case SUCCESS(ACTION_TYPE.SEARCH_PROJECTS):
      return {
        ...state,
        fetchingProjects: false,
        fetchedProjects: true,
        projects: parseData(action.payload.data.project)?.map((project) => ({
          ...project,
          benefitPlan: { id: project?.benefitPlan?.id ? decodeId(project.benefitPlan.id) : null },
          microCatchment: project?.microCatchment?.id
            ? { ...project.microCatchment, id: decodeId(project.microCatchment.id) } : null,
          id: decodeId(project.id),
        })),
        projectsPageInfo: pageInfo(action.payload.data.project),
        projectsTotalCount: action.payload.data.project ? action.payload.data.project.totalCount : null,
        errorProjects: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.SEARCH_PROJECTS):
      return {
        ...state,
        fetchingProjects: false,
        errorProjects: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.GET_PROJECT):
      return {
        ...state,
        fetchingProject: true,
        fetchedProject: false,
        project: null,
      };
    case SUCCESS(ACTION_TYPE.GET_PROJECT):
      return {
        ...state,
        fetchingProject: false,
        fetchedProject: true,
        project: parseData(action.payload.data.project)?.map((project) => ({
          ...project,
          benefitPlan: {
            ...project?.benefitPlan,
            id: project?.benefitPlan?.id ? decodeId(project.benefitPlan.id) : null,
          },
          activity: {
            ...project?.activity,
            id: project?.activity?.id ? decodeId(project.activity.id) : null,
          },
          microCatchment: project?.microCatchment?.id
            ? { ...project.microCatchment, id: decodeId(project.microCatchment.id) } : null,
          hotspot: project?.hotspot?.id
            ? { ...project.hotspot, id: decodeId(project.hotspot.id) } : null,
          foreman: project?.foreman?.id
            ? { ...project.foreman, id: decodeId(project.foreman.id) } : null,
          supervisor: project?.supervisor?.id
            ? { ...project.supervisor, id: decodeId(project.supervisor.id) } : null,
          id: decodeId(project.id),
        }))?.[0],
        errorProject: null,
      };
    case ERROR(ACTION_TYPE.GET_PROJECT):
      return {
        ...state,
        fetchingProject: false,
        errorProject: formatServerError(action.payload),
      };
    case CLEAR(ACTION_TYPE.GET_PROJECT):
      return {
        ...state,
        fetchingProject: false,
        fetchedProject: false,
        project: null,
        errorProject: null,
      };
    case REQUEST(ACTION_TYPE.SEARCH_PROJECTS_HISTORY):
      return {
        ...state,
        fetchingProjectsHistory: true,
        fetchedProjectsHistory: false,
        projectsHistory: [],
        projectsHistoryPageInfo: {},
        projectsHistoryTotalCount: 0,
        errorProjectsHistory: null,
      };
    case SUCCESS(ACTION_TYPE.SEARCH_PROJECTS_HISTORY):
      return {
        ...state,
        fetchingProjectsHistory: false,
        fetchedProjectsHistory: true,
        projectsHistory: parseData(action.payload.data.projectHistory)?.map((projectHistory) => ({
          ...projectHistory,
          id: decodeId(projectHistory.id),
        })),
        projectsHistoryPageInfo: pageInfo(action.payload.data.projectHistory),
        // eslint-disable-next-line max-len
        projectsHistoryTotalCount: action.payload.data.projectHistory ? action.payload.data.projectHistory.totalCount : null,
        errorProjectsHistory: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.SEARCH_PROJECTS_HISTORY):
      return {
        ...state,
        fetchingProjectsHistory: false,
        errorProjectsHistory: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.SEARCH_PROJECT_BENEFICIARIES):
      return {
        ...state,
        fetchingProjectBeneficiaries: true,
        fetchedProjectBeneficiaries: false,
        projectBeneficiaries: action.meta?.isBatch ? state.projectBeneficiaries : [],
        projectBeneficiariesPageInfo: {},
        projectBeneficiariesTotalCount: 0,
        errorProjectBeneficiaries: null,
      };
    case SUCCESS(ACTION_TYPE.SEARCH_PROJECT_BENEFICIARIES):
      /* eslint-disable no-case-declarations */
      const parsedBeneficiaries = parseData(action.payload.data.beneficiaryProjectEnrollment)?.map((enrollment) => {
        const beneficiary = enrollment.beneficiary || {};
        const projectTimeEntriesDict = {};
        (enrollment.timeEntries || []).forEach((entry) => {
          projectTimeEntriesDict[`day${entry.dayNumber}`] = {
            ...entry,
            id: entry.id ? decodeId(entry.id) : null,
          };
        });
        return {
          ...beneficiary,
          enrollmentId: enrollment.id ? decodeId(enrollment.id) : null,
          jsonExt: typeof beneficiary.jsonExt === 'string' ? JSON.parse(beneficiary.jsonExt) : beneficiary.jsonExt,
          id: beneficiary.id ? decodeId(beneficiary.id) : null,
          projectTimeEntriesDict,
        };
      });
      return {
        ...state,
        fetchingProjectBeneficiaries: false,
        fetchedProjectBeneficiaries: true,
        projectBeneficiaries: action.meta?.isBatch
          ? [...state.projectBeneficiaries, ...parsedBeneficiaries]
          : parsedBeneficiaries,
        projectBeneficiariesPageInfo: pageInfo(action.payload.data.beneficiaryProjectEnrollment),
        projectBeneficiariesTotalCount: action.payload.data.beneficiaryProjectEnrollment
          ? action.payload.data.beneficiaryProjectEnrollment.totalCount
          : null,
        errorProjectBeneficiaries: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.SEARCH_PROJECT_BENEFICIARIES):
      return {
        ...state,
        fetchingProjectBeneficiaries: false,
        errorProjectBeneficiaries: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.SEARCH_PROJECT_GROUP_BENEFICIARIES):
      return {
        ...state,
        fetchingProjectGroupBeneficiaries: true,
        fetchedProjectGroupBeneficiaries: false,
        projectGroupBeneficiaries: action.meta?.isBatch ? state.projectGroupBeneficiaries : [],
        projectGroupBeneficiariesPageInfo: {},
        projectGroupBeneficiariesTotalCount: 0,
        errorProjectGroupBeneficiaries: null,
      };
    case SUCCESS(ACTION_TYPE.SEARCH_PROJECT_GROUP_BENEFICIARIES):
      /* eslint-disable no-case-declarations */
      const parsedGroupBeneficiaries = parseData(action.payload.data.groupBeneficiaryProjectEnrollment)
        ?.map((enrollment) => {
          const groupBeneficiary = enrollment.groupBeneficiary || {};
          const projectTimeEntriesDict = {};
          (enrollment.timeEntries || []).forEach((entry) => {
            projectTimeEntriesDict[`day${entry.dayNumber}`] = {
              ...entry,
              id: entry.id ? decodeId(entry.id) : null,
            };
          });
          const response = ({
            ...groupBeneficiary,
            enrollmentId: enrollment.id ? decodeId(enrollment.id) : null,
            jsonExt: typeof groupBeneficiary.jsonExt === 'string'
              ? JSON.parse(groupBeneficiary.jsonExt)
              : groupBeneficiary.jsonExt,
            id: groupBeneficiary.id ? decodeId(groupBeneficiary.id) : null,
            projectTimeEntriesDict,
          });
          if (response?.group?.id) {
            response.group = ({
              ...response.group,
              id: decodeId(response.group.id),
            });
          }
          return response;
        });
      return {
        ...state,
        fetchingProjectGroupBeneficiaries: false,
        fetchedProjectGroupBeneficiaries: true,
        projectGroupBeneficiaries: action.meta?.isBatch
          ? [...state.projectGroupBeneficiaries, ...parsedGroupBeneficiaries]
          : parsedGroupBeneficiaries,
        projectGroupBeneficiariesPageInfo: pageInfo(action.payload.data.groupBeneficiaryProjectEnrollment),
        projectGroupBeneficiariesTotalCount: action.payload.data.groupBeneficiaryProjectEnrollment
          ? action.payload.data.groupBeneficiaryProjectEnrollment.totalCount : null,
        errorProjectGroupBeneficiaries: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.SEARCH_PROJECT_GROUP_BENEFICIARIES):
      return {
        ...state,
        fetchingProjectGroupBeneficiaries: false,
        errorProjectGroupBeneficiaries: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.SEARCH_PROJECT_ELIGIBLE_BENEFICIARIES):
      return { ...state, fetchingProjectEligibleBeneficiaries: true };
    case SUCCESS(ACTION_TYPE.SEARCH_PROJECT_ELIGIBLE_BENEFICIARIES):
    case ERROR(ACTION_TYPE.SEARCH_PROJECT_ELIGIBLE_BENEFICIARIES):
      return { ...state, fetchingProjectEligibleBeneficiaries: false };
    case REQUEST(ACTION_TYPE.SEARCH_PROJECT_ELIGIBLE_GROUP_BENEFICIARIES):
      return { ...state, fetchingProjectEligibleGroupBeneficiaries: true };
    case SUCCESS(ACTION_TYPE.SEARCH_PROJECT_ELIGIBLE_GROUP_BENEFICIARIES):
    case ERROR(ACTION_TYPE.SEARCH_PROJECT_ELIGIBLE_GROUP_BENEFICIARIES):
      return { ...state, fetchingProjectEligibleGroupBeneficiaries: false };
    case REQUEST(ACTION_TYPE.PROJECT_NAME_FIELDS_VALIDATION):
      return {
        ...state,
        validationFields: {
          ...state.validationFields,
          projectName: { isValidating: true, isValid: false, validationError: null },
        },
      };
    case SUCCESS(ACTION_TYPE.PROJECT_NAME_FIELDS_VALIDATION):
      return {
        ...state,
        validationFields: {
          ...state.validationFields,
          projectName: {
            isValidating: false,
            isValid: action.payload?.data.isValid.isValid,
            validationError: formatGraphQLError(action.payload),
          },
        },
      };
    case ERROR(ACTION_TYPE.PROJECT_NAME_FIELDS_VALIDATION):
      return {
        ...state,
        validationFields: {
          ...state.validationFields,
          projectName: {
            isValidating: false,
            isValid: false,
            validationError: formatServerError(action.payload),
          },
        },
      };
    case CLEAR(ACTION_TYPE.PROJECT_NAME_FIELDS_VALIDATION):
      return {
        ...state,
        validationFields: {
          ...state.validationFields,
          projectName: { isValidating: false, isValid: false, validationError: null },
        },
      };
    case ACTION_TYPE.PROJECT_NAME_SET_VALID:
      return {
        ...state,
        validationFields: {
          ...state.validationFields,
          projectName: { isValidating: false, isValid: true, validationError: null },
        },
      };
    case REQUEST(ACTION_TYPE.MUTATION):
      return dispatchMutationReq(state, action);
    case ERROR(ACTION_TYPE.MUTATION):
      return dispatchMutationErr(state, action);
    case SUCCESS(ACTION_TYPE.CREATE_PROJECT):
      return dispatchMutationResp(state, 'createProject', action);
    case SUCCESS(ACTION_TYPE.UPDATE_PROJECT):
      return dispatchMutationResp(state, 'updateProject', action);
    case SUCCESS(ACTION_TYPE.DELETE_PROJECT):
      return dispatchMutationResp(state, 'deleteProject', action);
    case SUCCESS(ACTION_TYPE.UNDO_DELETE_PROJECT):
      return dispatchMutationResp(state, 'undoDeleteProject', action);
    case SUCCESS(ACTION_TYPE.PROJECT_ENROLL):
      return dispatchMutationResp(state, 'enrollProject', action);
    case SUCCESS(ACTION_TYPE.PROJECT_ENROLL_GROUP):
      return dispatchMutationResp(state, 'enrollGroupProject', action);
    case SUCCESS(ACTION_TYPE.BULK_UPDATE_BENEFICIARY_TIME_ENTRIES):
      return dispatchMutationResp(state, 'bulkUpdateBeneficiaryTimeEntries', action);
    case SUCCESS(ACTION_TYPE.BULK_UPDATE_GROUP_BENEFICIARY_TIME_ENTRIES):
      return dispatchMutationResp(state, 'bulkUpdateGroupBeneficiaryTimeEntries', action);
    case CLEAR(ACTION_TYPE.PROJECT_EXPORT):
      return {
        ...state,
        fetchingProjectExport: false,
        fetchedProjectExport: false,
        projectExport: null,
        projectExportPageInfo: {},
        errorProjectExport: null,
      };
    case REQUEST(ACTION_TYPE.PROJECT_EXPORT):
      return {
        ...state,
        fetchingProjectExport: true,
        fetchedProjectExport: false,
        projectExport: null,
        projectExportPageInfo: {},
        errorProjectExport: null,
      };
    case SUCCESS(ACTION_TYPE.PROJECT_EXPORT):
      return {
        ...state,
        fetchingProjectExport: false,
        fetchedProjectExport: true,
        projectExport: action.payload.data.projectExport,
        projectExportPageInfo: pageInfo(action.payload.data.projectExport),
        errorProjectExport: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.PROJECT_EXPORT):
      return {
        ...state,
        fetchingProjectExport: false,
        errorProjectExport: formatServerError(action.payload),
      };
    default:
      return state;
  }
}

export default reducer;
