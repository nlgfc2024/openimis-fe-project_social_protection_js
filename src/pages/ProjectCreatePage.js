import React, { useState, useEffect } from 'react';
import {
  Form,
  formatMessage,
  formatMessageWithValues,
  withModulesManager,
  useHistory,
  coreAlert,
  waitForMutation,
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
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

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
    && !saving
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
    setSaveError(null);
    setSaving(true);
    Promise.resolve().then(() => createProject(
      editedProject.projectType === 'TRAINING' ? trainingCreationPayload(editedProject, trainingFormConfig) : editedProject,
      formatMessageWithValues(
        intl,
        'projectSocialProtection',
        'project.create.mutationLabel',
        editedProject,
      ),
    )).then(async (response) => {
      const errors = response?.payload?.errors;
      if (response?.error || errors?.length) {
        throw new Error(errors?.map((error) => error.message).join('; ') || 'Unable to save Training. Please try again.');
      }
      const clientMutationId = response?.payload?.data?.createProject?.clientMutationId;
      if (!clientMutationId) throw new Error('Unable to confirm the save. Check the Training list before retrying.');
      const result = await dispatch(waitForMutation(clientMutationId));
      if (result?.status !== 2) {
        const errors = Array.isArray(result?.error) ? result.error : [];
        throw new Error(errors.map((error) => error.detail || error.message).filter(Boolean).join('; ')
          || 'Save could not be confirmed. Check the Training list before retrying.');
      }
      coreAlert(
        formatMessage(intl, 'projectSocialProtection', 'project.create.success.title'),
        formatMessage(intl, 'projectSocialProtection', 'project.create.success.message'),
      );
      history.replace(`/${modulesManager.getRef('projectSocialProtection.route.projects')}`);
    }).catch((error) => {
      setSaveError(error.message || 'Unable to save Training. Please try again.');
    }).finally(() => setSaving(false));
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
      {saveError && <Typography color="error">{saveError}</Typography>}
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
