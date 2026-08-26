export const MODULE_NAME = 'projectSocialProtection';

export const CONTAINS_LOOKUP = 'Icontains';
export const DEFAULT_DEBOUNCE_TIME = 500;
export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_STRING = '';
export const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
export const MAX_CODE_LENGTH = 8;
export const MIN_TARGET_BENEFICIARIES = 5;
export const DEFAULT_MAX_TARGET_BENEFICIARIES = 200;
export const MODULE_CONF_NAME = 'fe-project_social_protection';

export const getMaxTargetBeneficiaries = (modulesManager) => {
  const configuredValue = modulesManager?.getConf(
    MODULE_CONF_NAME,
    'maxTargetBeneficiaries',
    DEFAULT_MAX_TARGET_BENEFICIARIES,
  );
  const parsedValue = Number(configuredValue);
  return Number.isFinite(parsedValue) && parsedValue >= MIN_TARGET_BENEFICIARIES
    ? parsedValue
    : DEFAULT_MAX_TARGET_BENEFICIARIES;
};

// Project rights (owned by project_social_protection BE config).
export const RIGHT_PROJECT_SEARCH = 209001;
export const RIGHT_PROJECT_CREATE = 209002;
export const RIGHT_PROJECT_UPDATE = 209003;
export const RIGHT_PROJECT_DELETE = 209004;

// Benefit plan rights are still needed by ProjectPage (project lives under a
// benefit plan / "Phase"); resolved against social_protection's numbering.
export const RIGHT_BENEFIT_PLAN_SEARCH = 160001;
export const RIGHT_BENEFIT_PLAN_UPDATE = 160003;

export const PROJECT_STATUS_LIST = ['INITIATED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED'];

// Upper bound on the number of daily time-entry ("Day N") columns rendered in the
// logsheet grid. Overridable per-instance via the `maxWorkingDays` module conf.
export const DEFAULT_MAX_WORKING_DAYS = 1000;

export const BENEFIT_PLAN_TYPE = {
  INDIVIDUAL: 'INDIVIDUAL',
  GROUP: 'GROUP',
  EVERY_TYPE: 'EVERY_TYPE',
};

// Contribution seams. The project module contributes a Projects tab into the
// benefit-plan tab point owned by social_protection, and owns its own
// project.TabPanel point for the sub-tabs of a project.
export const BENEFIT_PLAN_TABS_LABEL_CONTRIBUTION_KEY = 'benefitPlan.TabPanel.label';
export const BENEFIT_PLAN_TABS_PANEL_CONTRIBUTION_KEY = 'benefitPlan.TabPanel.panel';
export const BENEFIT_PLAN_PROJECTS_TAB_VALUE = 'BenefitPlanProjectsTab';

export const PROJECT_TABS_LABEL_CONTRIBUTION_KEY = 'project.TabPanel.label';
export const PROJECT_TABS_PANEL_CONTRIBUTION_KEY = 'project.TabPanel.panel';
export const PROJECT_BENEFICIARIES_TAB_VALUE = 'projectBeneficiariesTab';
export const PROJECT_CHANGELOG_TAB_VALUE = 'projectChangelogTab';

export const CLEARED_STATE_FILTER = {
  field: '', filter: '', type: '', value: '',
};
