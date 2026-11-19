import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  formatMessage,
  formatMessageWithValues,
  withModulesManager,
  useHistory,
  coreAlert,
} from '@openimis/fe-core';
import { injectIntl } from 'react-intl';
import { bindActionCreators } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { Typography } from '@material-ui/core';
import { withTheme, withStyles } from '@material-ui/core/styles';

import {
  fetchBenefitPlan,
  fetchProjectDeploymentType,
  fetchTrainingFormConfiguration,
  createProject,
  clearProject,
  projectNameValidationCheck,
  projectNameValidationClear,
} from '../actions';
import { ACTION_TYPE } from '../reducer';
import ProjectHeadPanel from '../components/ProjectHeadPanel';
import { isSessionDateOrderValid, isTrainingNameValid, isProjectRequiredFieldsMissing } from '../util/trainingSetup';
import ProjectTabPanel from '../components/ProjectTabPanel';
import {
  parseTrainingFormConfig, applyTrainingFormDefaults, trainingCreationFieldsMissing,
  trainingCreationPayload, trainingTargetInRange,
  trainingFieldRule,
} from '../util/trainingFormConfig';
import {
  RIGHT_BENEFIT_PLAN_UPDATE,
  BENEFIT_PLAN_PROJECTS_TAB_VALUE,
  PROJECT_BENEFICIARIES_TAB_VALUE,
  MIN_TARGET_BENEFICIARIES,
  getMaxTargetBeneficiaries,
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
  projectNameValidationCheck,
  projectNameValidationClear,
  coreAlert,
  submittingMutation,
  mutation,
  projectNameIsValid,
  projectNameIsValidating,
  projectNameValidationError,
}) {
  const history = useHistory();
  const maxTargetBeneficiaries = getMaxTargetBeneficiaries(modulesManager);
  const locationState = history.location?.state;

  const benefitPlanIdFromState = locationState?.benefitPlanId;
  const benefitPlanNameFromState = locationState?.benefitPlanName;

  const pathMatch = history.location?.pathname?.match(/benefitPlan\/([^/]+)/);
  const benefitPlanIdFromPath = pathMatch?.[1];

  const benefitPlanId = benefitPlanIdFromState || benefitPlanIdFromPath;

  const [benefitPlanName, setBenefitPlanName] = useState(benefitPlanNameFromState);
  const [activeTab, setActiveTab] = useState(PROJECT_BENEFICIARIES_TAB_VALUE);

  const dispatch = useDispatch();
  const [deploymentError, setDeploymentError] = useState(false);
  const [trainingFormConfig, setTrainingFormConfig] = useState(null);
  const [trainingConfigurationError, setTrainingConfigurationError] = useState(false);
  const prevSubmittingMutationRef = useRef();

  const [editedProject, setEditedProject] = useState({
    benefitPlan: { id: benefitPlanId, name: benefitPlanName },
    status: 'PREPARATION',
  });

  useEffect(() => {
    let active = true;
    let loadingTrainingConfiguration = false;
    setTrainingFormConfig(null);
    setDeploymentError(false);
    setTrainingConfigurationError(false);
    setEditedProject({ benefitPlan: { id: benefitPlanId, name: benefitPlanNameFromState }, status: 'PREPARATION' });
    dispatch(fetchProjectDeploymentType()).then(async (response) => {
      if (!active) return;
      const type = response?.payload?.data?.projectDeploymentType;
      if (!['WORK', 'TRAINING'].includes(type) || response?.payload?.errors?.length) {
        setDeploymentError(true);
        return;
      }
      if (type === 'TRAINING') {
        loadingTrainingConfiguration = true;
        const configuration = await dispatch(fetchTrainingFormConfiguration(benefitPlanId));
        if (!active) return;
        if (configuration?.payload?.errors?.length) throw new Error('Training form configuration unavailable');
        const config = parseTrainingFormConfig(configuration?.payload?.data?.projectTrainingFormConfig);
        setTrainingFormConfig(config);
        setEditedProject((previous) => ({ ...applyTrainingFormDefaults(previous, config), projectType: type }));
      } else {
        setEditedProject((previous) => ({ ...previous, projectType: type }));
      }
    }).catch(() => {
      if (active) {
        setDeploymentError(true);
        setTrainingConfigurationError(loadingTrainingConfiguration);
      }
    });
    return () => { active = false; };
  }, [dispatch, benefitPlanId]);

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
    if (
      prevSubmittingMutationRef.current
      && !submittingMutation
      && mutation?.actionType === ACTION_TYPE.CREATE_PROJECT
    ) {
      coreAlert(
        formatMessage(intl, 'projectSocialProtection', 'project.create.success.title'),
        formatMessage(intl, 'projectSocialProtection', 'project.create.success.message'),
      );
      const benefitPlanRoute = modulesManager.getRef('socialProtection.route.benefitPlan');
      const benefitPlanId = benefitPlanIdFromPath || benefitPlanIdFromState;
      if (benefitPlanId) {
        // On create, return to the benefit plan's project list instead of opening the detail view.
        history.replace(`/${benefitPlanRoute}/${benefitPlanId}`, {
          activeTab: BENEFIT_PLAN_PROJECTS_TAB_VALUE,
        });
      }
    }
  }, [
    submittingMutation,
    mutation,
    history,
    modulesManager,
    benefitPlanIdFromPath,
    benefitPlanIdFromState,
    intl,
    coreAlert,
  ]);

  useEffect(() => {
    prevSubmittingMutationRef.current = submittingMutation;
  });

  const generatedProjectName = [
    editedProject?.hotspot?.name,
    editedProject?.activity?.name,
    editedProject?.benefitPlan?.name,
  ].filter(Boolean).join('-');
  const generatedName = editedProject?.knownPlace
    ? `${generatedProjectName} - ${editedProject.knownPlace}`
    : generatedProjectName;
  const projectName = editedProject?.projectType === 'TRAINING' ? editedProject?.name || '' : generatedName;
  const canValidateProjectName = Boolean(projectName && editedProject?.benefitPlan?.id);

  useEffect(() => {
    if (!canValidateProjectName) {
      projectNameValidationClear();
      return undefined;
    }

    const validationTimeout = setTimeout(() => {
      projectNameValidationCheck(modulesManager, {
        projectName,
        benefitPlanId: editedProject.benefitPlan.id,
      });
    }, 300);

    return () => clearTimeout(validationTimeout);
  }, [
    canValidateProjectName,
    editedProject?.benefitPlan?.id,
    modulesManager,
    projectName,
    projectNameValidationCheck,
    projectNameValidationClear,
  ]);

  const back = () => history.goBack();

  const isMandatoryFieldsEmpty = () => editedProject.projectType === 'TRAINING'
    ? trainingCreationFieldsMissing(editedProject, trainingFormConfig) : isProjectRequiredFieldsMissing(editedProject);

  const isTargetBeneficiariesInRange = () => {
    if (editedProject.projectType === 'TRAINING') return trainingTargetInRange(editedProject, trainingFormConfig, maxTargetBeneficiaries);
    const target = Number(editedProject?.targetBeneficiaries);
    return Number.isFinite(target)
      && target >= MIN_TARGET_BENEFICIARIES
      && target <= maxTargetBeneficiaries;
  };

  const doesProjectChange = () => {
    return Object.keys(editedProject).some((key) => {
      const value = editedProject[key];
      const isObject = value && typeof value === 'object' && !Array.isArray(value);
      if (isObject) return true;
      return value !== '' && value !== undefined && value !== null;
    });
  };

  const canSave = () => (
    ['WORK', 'TRAINING'].includes(editedProject?.projectType)
    && !deploymentError
    && isSessionDateOrderValid(editedProject)
    && isTrainingNameValid(editedProject)
    && !isMandatoryFieldsEmpty()
    && isTargetBeneficiariesInRange()
    && doesProjectChange()
    && projectNameIsValid === true
    && !projectNameIsValidating
  );

  const showTargetBeneficiariesRangeError = Boolean(editedProject?.targetBeneficiaries)
    && !isTargetBeneficiariesInRange();

  const handleSave = () => {
    createProject(
      editedProject.projectType === 'TRAINING' ? trainingCreationPayload(editedProject, trainingFormConfig) : editedProject,
      formatMessageWithValues(
        intl,
        'projectSocialProtection',
        'project.create.mutationLabel',
        editedProject,
      ),
    );
  };

  const onEditedChanged = (update) => setEditedProject((previous) => {
    const next = typeof update === 'function' ? update(previous) : update;
    return next.projectType === 'TRAINING' && trainingFormConfig
      ? applyTrainingFormDefaults(next, trainingFormConfig) : next;
  });

  if (!benefitPlanId) {
    return <div>{formatMessage(intl, 'projectSocialProtection', 'project.loading')}</div>;
  }

  return rights.includes(RIGHT_BENEFIT_PLAN_UPDATE) && (
    <div className={classes.page}>
      {deploymentError && (
        <Typography color="error">
          {formatMessage(intl, 'projectSocialProtection', trainingConfigurationError
            ? 'project.trainingFormConfig.error' : 'project.deploymentType.error')}
        </Typography>
      )}
      {trainingFormConfig && !trainingFieldRule(trainingFormConfig, 'trainingModules').visible
        && (editedProject.trainingModuleLoadError || !editedProject.trainingModuleLoading
          && Array.isArray(editedProject.trainingModules) && !editedProject.trainingModules.length) && (
        <Typography color="error">
          {formatMessage(intl, 'projectSocialProtection', editedProject.trainingModuleLoadError
            ? 'project.trainingModules.loadError' : 'project.trainingModules.empty')}
        </Typography>
      )}
      {!isSessionDateOrderValid(editedProject) && (
        <Typography color="error">
          {formatMessage(intl, 'projectSocialProtection', 'project.sessionDates.invalid')}
        </Typography>
      )}
      {showTargetBeneficiariesRangeError && (
        <Typography color="error">
          {formatMessageWithValues(
            intl,
            'projectSocialProtection',
            'project.targetBeneficiaries.outOfRange',
            {
              min: MIN_TARGET_BENEFICIARIES,
              max: maxTargetBeneficiaries,
            },
          )}
        </Typography>
      )}
      {canValidateProjectName && !projectNameIsValidating && projectNameIsValid === false && (
        <Typography color="error">
          {projectNameValidationError || formatMessage(
            intl,
            'projectSocialProtection',
            'project.name.alreadyTaken',
          )}
        </Typography>
      )}
      <Form
        module="projectSocialProtection"
        className={classes.form}
        title="project.createPageTitle"
        openDirty
        edited={editedProject}
        onEditedChanged={onEditedChanged}
        back={back}
        mandatoryFieldsEmpty={isMandatoryFieldsEmpty}
        canSave={canSave}
        save={handleSave}
        HeadPanel={ProjectHeadPanel}
        previewProjectName={projectName}
        trainingFormConfig={trainingFormConfig}
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
  projectNameIsValid: state.projectSocialProtection.validationFields?.projectName?.isValid,
  projectNameIsValidating: state.projectSocialProtection.validationFields?.projectName?.isValidating,
  projectNameValidationError: state.projectSocialProtection.validationFields?.projectName?.validationError,
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  {
    createProject,
    clearProject,
    projectNameValidationCheck,
    projectNameValidationClear,
    coreAlert,
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
