import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  formatMessage,
  formatMessageWithValues,
  withModulesManager,
  useHistory,
} from '@openimis/fe-core';
import { injectIntl } from 'react-intl';
import { bindActionCreators } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { withTheme, withStyles } from '@material-ui/core/styles';
import _ from 'lodash';

import {
  fetchBenefitPlan,
  createProject,
  clearProject,
} from '../actions';
import { ACTION_TYPE } from '../reducer';
import ProjectHeadPanel from '../components/ProjectHeadPanel';
import ProjectTabPanel from '../components/ProjectTabPanel';
import {
  RIGHT_BENEFIT_PLAN_UPDATE,
  PROJECT_BENEFICIARIES_TAB_VALUE,
} from '../constants';

const styles = (theme) => ({
  page: theme.page,
  form: {
    paper: theme.paper.classes,
  },
});

function ProjectCreatePage({
  intl,
  classes,
  rights,
  modulesManager,
  project,
  createProject,
  clearProject,
  submittingMutation,
  mutation,
}) {
  const history = useHistory();
  const locationState = history.location?.state;

  const benefitPlanIdFromState = locationState?.benefitPlanId;
  const benefitPlanNameFromState = locationState?.benefitPlanName;

  const pathMatch = history.location?.pathname?.match(/benefitPlan\/([^/]+)/);
  const benefitPlanIdFromPath = pathMatch?.[1];

  const benefitPlanId = benefitPlanIdFromState || benefitPlanIdFromPath;

  const [benefitPlanName, setBenefitPlanName] = useState(benefitPlanNameFromState);
  const [activeTab, setActiveTab] = useState(PROJECT_BENEFICIARIES_TAB_VALUE);

  const dispatch = useDispatch();

  const [editedProject, setEditedProject] = useState({
    benefitPlan: { id: benefitPlanId, name: benefitPlanName },
    status: 'INITIATED',
  });

  useEffect(() => {
    if (!benefitPlanNameFromState && benefitPlanIdFromPath) {
      dispatch(fetchBenefitPlan(modulesManager, [`id: "${benefitPlanIdFromPath}"`]))
        .then((response) => {
          const plan = response?.payload?.data?.benefitPlan?.edges?.[0]?.node;
          if (plan?.name) setBenefitPlanName(plan.name);
        });
    }
  }, [benefitPlanIdFromPath]);

  useEffect(() => {
    if (benefitPlanName) {
      setEditedProject((prev) => ({
        ...prev,
        benefitPlan: {
          ...prev.benefitPlan,
          name: benefitPlanName,
        },
      }));
    }
  }, [benefitPlanName]);

  useEffect(() => {
    return () => {
      clearProject();
    };
  }, [clearProject]);

  useEffect(() => {
    if (!submittingMutation && (mutation?.id || mutation?.clientMutationId) && mutation?.actionType === ACTION_TYPE.CREATE_PROJECT) {
      const benefitPlanRoute = modulesManager.getRef('socialProtection.route.benefitPlan');
      const benefitPlanId = benefitPlanIdFromPath || benefitPlanIdFromState;
      if (benefitPlanId) {
        // On create, return to the benefit plan's project list instead of opening the detail view.
        history.replace(`/${benefitPlanRoute}/${benefitPlanId}`);
      }
    }
  }, [submittingMutation, mutation, history, modulesManager, benefitPlanIdFromPath, benefitPlanIdFromState]);

  const back = () => history.goBack();

  const isMandatoryFieldsEmpty = () => (
    !editedProject?.hotspot
    || !editedProject?.activity
    || !editedProject?.location
    || !editedProject?.targetBeneficiaries
    || !editedProject?.workingDays
  );

  const doesProjectChange = () => {
    return Object.keys(editedProject).some((key) => {
      const value = editedProject[key];
      const isObject = value && typeof value === 'object' && !Array.isArray(value);
      if (isObject) return true;
      return value !== '' && value !== undefined && value !== null;
    });
  };

  const canSave = () => !isMandatoryFieldsEmpty() && doesProjectChange();

  const handleSave = () => {
    createProject(
      editedProject,
      formatMessageWithValues(
        intl,
        'projectSocialProtection',
        'project.create.mutationLabel',
        editedProject,
      ),
    );
  };

  if (!benefitPlanId) {
    return <div>{formatMessage(intl, 'projectSocialProtection', 'project.loading')}</div>;
  }

  return rights.includes(RIGHT_BENEFIT_PLAN_UPDATE) && (
    <div className={classes.page}>
      <Form
        module="projectSocialProtection"
        className={classes.form}
        title="project.createPageTitle"
        openDirty
        edited={editedProject}
        onEditedChanged={setEditedProject}
        back={back}
        mandatoryFieldsEmpty={isMandatoryFieldsEmpty}
        canSave={canSave}
        save={handleSave}
        HeadPanel={ProjectHeadPanel}
        Panels={[ProjectTabPanel]}
        onActiveTabChange={setActiveTab}
        activeTab={activeTab}
        rights={rights}
        saveTooltip={
          formatMessage(intl, 'projectSocialProtection', 'project.saveButton.tooltip')
        }
      />
    </div>
  );
}

const mapStateToProps = (state) => ({
  rights: state.core?.user?.i_user?.rights ?? [],
  project: state.projectSocialProtection.project,
  submittingMutation: state.projectSocialProtection.submittingMutation,
  mutation: state.projectSocialProtection.mutation,
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  {
    createProject,
    clearProject,
  },
  dispatch,
);

export default withModulesManager(
  injectIntl(
    withTheme(
      withStyles(styles)(
        connect(mapStateToProps, mapDispatchToProps)(ProjectCreatePage),
      ),
    ),
  ),
);
