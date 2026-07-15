import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  formatMessage,
  formatMessageWithValues,
  withModulesManager,
  coreConfirm,
  clearConfirm,
  journalize,
  useHistory,
} from '@openimis/fe-core';
import { injectIntl } from 'react-intl';
import { bindActionCreators } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { withTheme, withStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import UndoIcon from '@material-ui/icons/Undo';
import _ from 'lodash';

import {
  fetchBenefitPlan,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  undoDeleteProject,
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

function ProjectPage({
  intl,
  classes,
  rights,
  modulesManager,
  projectUuid,
  project,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  undoDeleteProject,
  submittingMutation,
  mutation,
  coreConfirm,
  clearConfirm,
  confirmed,
  journalize,
  isProjectNameValid,
}) {
  const history = useHistory();
  const locationState = history.location?.state;

  const benefitPlanIdFromState = locationState?.benefitPlanid;
  const benefitPlanNameFromState = locationState?.benefitPlanName;

  const pathMatch = history.location?.pathname?.match(/benefitPlan\/([^/]+)/);
  const benefitPlanIdFromPath = pathMatch?.[1];

  const benefitPlanId = benefitPlanIdFromState || benefitPlanIdFromPath;

  const [benefitPlanName, setBenefitPlanName] = useState(benefitPlanNameFromState);
  const [confirmedAction, setConfirmedAction] = useState(() => null);

  const [editedProject, setEditedProject] = useState({
    benefitPlan: { id: benefitPlanId, name: benefitPlanName },
    status: 'PREPARATION',
  });
  const [reset, setReset] = useState(() => false);

  const [activeTab, setActiveTab] = useState(PROJECT_BENEFICIARIES_TAB_VALUE);

  const dispatch = useDispatch();

  const prevSubmittingMutationRef = useRef();

  useEffect(() => {
    // Only fetch benefit plan name if project creation URL is visited directly
    if (!benefitPlanNameFromState && benefitPlanIdFromPath) {
      dispatch(fetchBenefitPlan(modulesManager, [`id: "${benefitPlanIdFromPath}"`]))
        .then((response) => {
          const plan = response?.payload?.data?.benefitPlan?.edges?.[0]?.node;
          if (plan?.name) setBenefitPlanName(plan.name);
        });
    }
  }, [benefitPlanIdFromPath]);

  useEffect(() => {
    if (!projectUuid && benefitPlanName) {
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
    if (projectUuid) {
      fetchProject(modulesManager, [`id: "${projectUuid}"`]);
    }
  }, [projectUuid]);

  useEffect(() => {
    if (projectUuid) {
      setEditedProject(project);
    }
    if (!projectUuid && project?.id) {
      // Full absolute path: /benefitPlans/benefitPlan/<benefitPlanId>/project/<projectId>.
      // The project route is nested under its benefit plan, so redirecting to just
      // /project/<id> (the bare route ref) 404s.
      const benefitPlanRoute = modulesManager.getRef('socialProtection.route.benefitPlan');
      const projectRoute = modulesManager.getRef('projectSocialProtection.route.project');
      history.replace(`/${benefitPlanRoute}/${benefitPlanId}/${projectRoute}/${project.id}`);
      setReset(true);
    }
  }, [project]);

  useEffect(() => {
    if (confirmed && confirmedAction) confirmedAction();
    return () => confirmed && clearConfirm(null);
  }, [confirmed]);

  const back = () => history.goBack();

  useEffect(() => {
    if (prevSubmittingMutationRef.current && !submittingMutation) {
      journalize(mutation);
      if ([
        ACTION_TYPE.DELETE_PROJECT,
        ACTION_TYPE.UNDO_DELETE_PROJECT,
      ].includes(mutation?.actionType)) {
        back();
      }
    }
    if (mutation?.clientMutationId && !projectUuid) {
      fetchProject(modulesManager, [`clientMutationId: "${mutation.clientMutationId}"`]);
    }
  }, [submittingMutation]);

  useEffect(() => {
    prevSubmittingMutationRef.current = submittingMutation;
  });

  const isMandatoryFieldsEmpty = () => (
    !editedProject?.name
    || !editedProject?.activity
    || !editedProject?.location
    || !editedProject?.targetBeneficiaries
    || !editedProject?.workingDays
  );

  const isValid = () => (project?.name ? isProjectNameValid : true);

  const doesProjectChange = () => {
    if (_.isEqual(project, editedProject)) return false;
    return true;
  };

  const canSave = () => !isMandatoryFieldsEmpty() && isValid() && doesProjectChange();

  const handleSave = () => {
    const mutationLabelKey = projectUuid
      ? 'project.update.mutationLabel'
      : 'project.create.mutationLabel';

    const action = projectUuid ? updateProject : createProject;

    action(
      editedProject,
      formatMessageWithValues(
        intl,
        'socialProtection',
        mutationLabelKey,
        editedProject,
      ),
    );
  };

  const deleteProjectCallback = () => deleteProject(
    project,
    formatMessageWithValues(intl, 'projectSocialProtection', 'project.delete.mutationLabel', {
      name: project?.name,
    }),
  );

  const openDeleteConfirmDialog = () => {
    setConfirmedAction(() => deleteProjectCallback);
    coreConfirm(
      formatMessageWithValues(intl, 'projectSocialProtection', 'project.delete.confirm.title', {
        name: project?.name,
      }),
      formatMessage(intl, 'projectSocialProtection', 'project.delete.confirm.message'),
    );
  };

  const undoProjectCallback = () => undoDeleteProject(
    project,
    formatMessageWithValues(intl, 'projectSocialProtection', 'project.undo.mutationLabel', {
      name: project?.name,
    }),
  );

  const openUndoConfirmDialog = () => {
    setConfirmedAction(() => undoProjectCallback);
    coreConfirm(
      formatMessageWithValues(intl, 'projectSocialProtection', 'project.undo.confirm.title', {
        name: project?.name,
      }),
      formatMessage(intl, 'projectSocialProtection', 'project.undo.confirm.message'),
    );
  };

  const actions = [
    !!project && (
      project.isDeleted ? {
        doIt: openUndoConfirmDialog,
        icon: <UndoIcon />,
        tooltip: formatMessage(intl, 'projectSocialProtection', 'undoButtonTooltip'),
      } : {
        doIt: openDeleteConfirmDialog,
        icon: <DeleteIcon />,
        tooltip: formatMessage(intl, 'projectSocialProtection', 'deleteButtonTooltip'),
      }),
  ];

  if (projectUuid && !project) return <div>Loading...</div>;

  return rights.includes(RIGHT_BENEFIT_PLAN_UPDATE) && (
    <div className={classes.page}>
      <Form
        module="projectSocialProtection"
        className={classes.form}
        title="project.pageTitle"
        openDirty
        project={project}
        edited={editedProject}
        onEditedChanged={setEditedProject}
        back={back}
        reset={reset}
        mandatoryFieldsEmpty={isMandatoryFieldsEmpty}
        canSave={canSave}
        save={handleSave}
        HeadPanel={ProjectHeadPanel}
        Panels={[ProjectTabPanel]}
        onActiveTabChange={setActiveTab}
        activeTab={activeTab}
        rights={rights}
        actions={actions}
        readOnly={editedProject?.isDeleted}
        saveTooltip={
          formatMessage(intl, 'projectSocialProtection', 'project.saveButton.tooltip')
        }
      />
    </div>
  );
}

const mapStateToProps = (state, props) => ({
  rights: state.core?.user?.i_user?.rights ?? [],
  projectUuid: props.match.params.project_uuid,
  project: state.projectSocialProtection.project,
  confirmed: state.core.confirmed,
  submittingMutation: state.projectSocialProtection.submittingMutation,
  mutation: state.projectSocialProtection.mutation,
  isProjectNameValid: state.projectSocialProtection.validationFields?.projectName?.isValid,
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  {
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    undoDeleteProject,
    coreConfirm,
    clearConfirm,
    journalize,
  },
  dispatch,
);

export default withModulesManager(
  injectIntl(
    withTheme(
      withStyles(styles)(
        connect(mapStateToProps, mapDispatchToProps)(ProjectPage),
      ),
    ),
  ),
);
