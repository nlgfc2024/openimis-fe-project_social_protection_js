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
  coreAlert,
} from '@openimis/fe-core';
import { injectIntl } from 'react-intl';
import { bindActionCreators } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { withTheme, withStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import UndoIcon from '@material-ui/icons/Undo';

import {
  fetchProject,
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
  updateProject,
  deleteProject,
  undoDeleteProject,
  submittingMutation,
  mutation,
  coreConfirm,
  clearConfirm,
  confirmed,
  journalize,
  coreAlert,
}) {
  const history = useHistory();

  const [benefitPlanName, setBenefitPlanName] = useState();
  const [confirmedAction, setConfirmedAction] = useState(() => null);

  const [editedProject, setEditedProject] = useState({});
  const [reset, setReset] = useState(() => false);

  const [activeTab, setActiveTab] = useState(PROJECT_BENEFICIARIES_TAB_VALUE);

  const dispatch = useDispatch();

  const prevSubmittingMutationRef = useRef();

  useEffect(() => {
    if (projectUuid) {
      fetchProject(modulesManager, [`id: "${projectUuid}"`]);
    }
  }, [projectUuid]);

  useEffect(() => {
    if (projectUuid && project) {
      setEditedProject(project);
    }
    if (!projectUuid && project?.id) {
      const benefitPlanRoute = modulesManager.getRef('socialProtection.route.benefitPlan');
      const projectRoute = modulesManager.getRef('projectSocialProtection.route.project');
      const benefitPlanId = project?.benefitPlan?.id || project?.benefit_plan?.id;
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
      } else if (mutation?.actionType === ACTION_TYPE.UPDATE_PROJECT) {
        coreAlert(
          formatMessageWithValues(intl, 'projectSocialProtection', 'project.update.success.title', project),
          formatMessageWithValues(intl, 'projectSocialProtection', 'project.update.success.message', project),
        );
      }
    }
  }, [submittingMutation]);

  useEffect(() => {
    prevSubmittingMutationRef.current = submittingMutation;
  });

  const isMandatoryFieldsEmpty = () => (
    !editedProject?.hotspot
    || !editedProject?.activity
    || !editedProject?.location
    || !editedProject?.targetBeneficiaries
    || !editedProject?.workingDays
  );

  const doesProjectChange = () => {
    if (_.isEqual(project, editedProject)) return false;
    return true;
  };

  const canSave = () => !isMandatoryFieldsEmpty() && doesProjectChange();

  const handleSave = () => {
    updateProject(
      editedProject,
      formatMessageWithValues(
        intl,
        'projectSocialProtection',
        'project.update.mutationLabel',
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
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  {
    fetchProject,
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
