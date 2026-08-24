// Disable due to core architecture
/* eslint-disable import/prefer-default-export */
import React from 'react';
import WorkIcon from '@material-ui/icons/Work';
import { FormattedMessage } from '@openimis/fe-core';
import flatten from 'flat';
import messages_en from './translations/en.json';
import reducer from './reducer';
import ProjectPage from './pages/ProjectPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectHistorySearcher from './components/ProjectHistorySearcher';
import BenefitPlanProjectsSearcher from './components/BenefitPlanProjectsSearcher';
import ProjectPicker from './pickers/ProjectPicker';
import {
  BenefitPlanProjectsTabLabel,
  BenefitPlanProjectsTabPanel,
} from './components/BenefitPlanProjectsTab';
import {
  ProjectBeneficiariesTabPanel,
  ProjectBeneficiariesTabLabel,
} from './components/ProjectBeneficiariesTab';
import {
  ProjectChangelogTabLabel,
  ProjectChangelogTabPanel,
} from './components/ProjectChangelogTab';
import projectBeneficiariesMiddleware from './middlewares';
import { RIGHT_PROJECT_SEARCH } from './constants';

// Kept identical to social_protection's route roots so the project route stays
// nested under a benefit plan ("Phase") page.
const ROUTE_PROJECTS = 'projects';
const ROUTE_BENEFIT_PLAN = 'benefitPlans/benefitPlan';
const ROUTE_PROJECT = 'project';
const ROUTE_PROJECT_CREATE = 'project/create';

const DEFAULT_CONFIG = {
  translations: [{ key: 'en', messages: flatten(messages_en) }],
  reducers: [{ key: 'projectSocialProtection', reducer }],
  'core.Router': [
    {
      path: ROUTE_PROJECTS,
      component: ProjectsPage,
    },
    {
      path: `${ROUTE_BENEFIT_PLAN}/:benefit_plan_uuid?/${ROUTE_PROJECT_CREATE}`,
      component: ProjectCreatePage,
    },
    {
      path: `${ROUTE_BENEFIT_PLAN}/:benefit_plan_uuid?/${ROUTE_PROJECT}/:project_uuid?`,
      component: ProjectPage,
    },
  ],
  refs: [
    { key: 'projectSocialProtection.route.projects', ref: ROUTE_PROJECTS },
    { key: 'projectSocialProtection.route.project', ref: ROUTE_PROJECT },
    { key: 'projectSocialProtection.route.projectCreate', ref: ROUTE_PROJECT_CREATE },
    { key: 'projectSocialProtection.ProjectHistorySearcher', ref: ProjectHistorySearcher },
    { key: 'projectSocialProtection.BenefitPlanProjectsSearcher', ref: BenefitPlanProjectsSearcher },
    { key: 'projectSocialProtection.ProjectPicker', ref: ProjectPicker },
    // Legacy key: fe-payroll's payroll FilterDialog resolves the project filter through
    // `socialProtection.ProjectPicker`, which social_protection registered until the project
    // domain was extracted into this module. Registering it here keeps that filter working
    // without forking fe-payroll. Remove once fe-payroll consumes the namespaced key above.
    { key: 'socialProtection.ProjectPicker', ref: ProjectPicker },
  ],
  'socialProtection.MainMenu': [
    {
      text: (
        <FormattedMessage
          module="projectSocialProtection"
          id="menu.projects"
        />
      ),
      icon: <WorkIcon />,
      route: `/${ROUTE_PROJECTS}`,
      filter: (rights) => rights.includes(RIGHT_PROJECT_SEARCH),
      id: 'projectSocialProtection.projects',
    },
  ],
  'benefitPlan.TabPanel.label': [
    BenefitPlanProjectsTabLabel,
  ],
  'benefitPlan.TabPanel.panel': [
    BenefitPlanProjectsTabPanel,
  ],
  'project.TabPanel.label': [
    ProjectBeneficiariesTabLabel,
    ProjectChangelogTabLabel,
  ],
  'project.TabPanel.panel': [
    ProjectBeneficiariesTabPanel,
    ProjectChangelogTabPanel,
  ],
  middlewares: [projectBeneficiariesMiddleware],
};

export const ProjectSocialProtectionModule = (cfg) => ({ ...DEFAULT_CONFIG, ...cfg });
