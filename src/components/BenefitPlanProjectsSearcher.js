import React, { useState, useEffect, useRef } from 'react';
import { injectIntl } from 'react-intl';
import {
  formatMessage,
  formatMessageWithValues,
  Searcher,
  withModulesManager,
  useModulesManager,
  useHistory,
  coreConfirm,
  clearConfirm,
  journalize,
  downloadExport,
} from '@openimis/fe-core';
import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import UndoIcon from '@material-ui/icons/Undo';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  MODULE_NAME,
  DEFAULT_PAGE_SIZE,
  ROWS_PER_PAGE_OPTIONS,
  RIGHT_PROJECT_CREATE,
  RIGHT_PROJECT_UPDATE,
  RIGHT_PROJECT_DELETE,
} from '../constants';
import {
  fetchBenefitPlanProjects,
  downloadProjects,
  deleteProject,
  undoDeleteProject,
  clearProjectExport,
} from '../actions';
import ProjectFilter from './BenefitPlanProjectsFilter';
import ExportWithFiltersDialog from './ExportWithFiltersDialog';
import { locationFormatter } from '../util/searcher-utils';

function BenefitPlanProjectsSearcher({
  intl,
  fetchBenefitPlanProjects,
  downloadProjects,
  deleteProject,
  undoDeleteProject,
  clearProjectExport,
  fetchingProjects,
  fetchedProjects,
  errorProjects,
  projects,
  projectsPageInfo,
  projectsTotalCount,
  benefitPlanId,
  benefitPlanName,
  rights,
  confirmed,
  coreConfirm,
  clearConfirm,
  journalize,
  submittingMutation,
  mutation,
  projectExport,
  errorProjectExport,
}) {
  const history = useHistory();
  const modulesManager = useModulesManager();
  const fetch = (params) => fetchBenefitPlanProjects(modulesManager, params);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectToUndo, setProjectToUndo] = useState(null);
  const [deletedProjectUuids, setDeletedProjectUuids] = useState([]);
  const [undoProjectUuids, setUndoProjectUuids] = useState([]);
  const prevSubmittingMutationRef = useRef();

  const openDeleteProjectConfirmDialog = () => coreConfirm(
    formatMessageWithValues(intl, MODULE_NAME, 'project.delete.confirm.title', {
      name: projectToDelete.name,
    }),
    formatMessage(intl, MODULE_NAME, 'project.delete.confirm.message'),
  );

  const openUndoProjectConfirmDialog = () => coreConfirm(
    formatMessageWithValues(intl, MODULE_NAME, 'project.undo.confirm.title', {
      name: projectToUndo.name,
    }),
    formatMessage(intl, MODULE_NAME, 'project.undo.confirm.message'),
  );

  // Absolute base for a project route nested under its benefit plan, e.g.
  // /benefitPlans/benefitPlan/<benefitPlanId>/project — built from route refs so it
  // is independent of the current URL (relative pushes broke after visiting a project).
  const projectRouteBase = () => `/${modulesManager.getRef('socialProtection.route.benefitPlan')}`
    + `/${benefitPlanId}`
    + `/${modulesManager.getRef('projectSocialProtection.route.project')}`;

  const onDelete = (project) => setProjectToDelete(project);
  const onUndo = (project) => setProjectToUndo(project);

  const defaultFilters = () => ({
    isDeleted: {
      value: false,
      filter: 'isDeleted: false',
    },
    ...(benefitPlanId && {
      benefitPlan_Id: {
        value: benefitPlanId,
        filter: `benefitPlan_Id: "${benefitPlanId}"`,
      },
    }),
  });

  const [activeFilters, setActiveFilters] = useState(defaultFilters());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const openProject = (project) => rights.includes(RIGHT_PROJECT_UPDATE)
    && history.push(`${projectRouteBase()}/${project?.id}`);

  useEffect(() => projectToDelete && openDeleteProjectConfirmDialog(), [projectToDelete]);
  useEffect(() => projectToUndo && openUndoProjectConfirmDialog(), [projectToUndo]);

  useEffect(() => {
    if (projectToDelete && confirmed) {
      deleteProject(
        projectToDelete,
        formatMessageWithValues(intl, MODULE_NAME, 'project.delete.mutationLabel', {
          name: projectToDelete?.name,
        }),
      );
      setDeletedProjectUuids([...deletedProjectUuids, projectToDelete.id]);
    }
    if (projectToUndo && confirmed) {
      undoDeleteProject(
        projectToUndo,
        formatMessageWithValues(intl, MODULE_NAME, 'project.undo.mutationLabel', {
          name: projectToUndo?.name,
        }),
      );
      setUndoProjectUuids([...undoProjectUuids, projectToUndo.id]);
    }
    if (projectToDelete && confirmed !== null) {
      setProjectToDelete(null);
    }
    if (projectToUndo && confirmed !== null) {
      setProjectToUndo(null);
    }
    return () => confirmed && clearConfirm(false);
  }, [confirmed]);

  useEffect(() => {
    if (prevSubmittingMutationRef.current && !submittingMutation) {
      journalize(mutation);
    }
  }, [submittingMutation]);

  useEffect(() => {
    prevSubmittingMutationRef.current = submittingMutation;
  });

  const [failedExport, setFailedExport] = useState(false);

  useEffect(() => {
    if (errorProjectExport) {
      setFailedExport(true);
    }
  }, [errorProjectExport]);

  useEffect(() => {
    if (projectExport) {
      downloadExport(
        projectExport,
        `${formatMessage(intl, MODULE_NAME, 'export.filename.projects')}.csv`,
      )();
      clearProjectExport();
      setFailedExport(false);
    }
  }, [projectExport]);

  const openExportDialog = () => setExportDialogOpen(true);
  const closeExportDialog = () => setExportDialogOpen(false);
  const exportWithFilters = (dialogFilters, selectedFields) => {
    const filterParams = Object.keys(dialogFilters)
      .filter((f) => !!dialogFilters[f]?.filter)
      .map((f) => dialogFilters[f].filter);
    const parameters = [...filterParams];
    parameters.push('fileFormat: "csv"');
    parameters.push(`fields: ${JSON.stringify(selectedFields)}`);
    parameters.push(`fieldsColumns: "${JSON.stringify(exportFieldsColumns).replace(/\"/g, '\\\"')}"`);
    downloadProjects(parameters);
    closeExportDialog();
  };

  const headers = () => {
    const baseHeaders = [
      'project.name',
      'project.status',
      'project.activity',
      'project.targetBeneficiaries',
      'project.workingDays',
      'location.locationType.0',
      'location.locationType.1',
      'project.microCatchment',
      'project.hotspot',
    ];

    if (rights.includes(RIGHT_PROJECT_UPDATE)) {
      baseHeaders.push('emptyLabel');
    }
    if (rights.includes(RIGHT_PROJECT_DELETE)) {
      baseHeaders.push('emptyLabel');
    }

    return baseHeaders;
  };

  const exportFields = [
    'name',
    'status',
    'activity.name',
    'targetBeneficiaries',
    'workingDays',
    'location.parent.name',
    'location.name',
    'microCatchment.name',
    'hotspot.name',
  ];

  const exportFieldsColumns = {
    name: formatMessage(intl, MODULE_NAME, 'project.name'),
    status: formatMessage(intl, MODULE_NAME, 'project.status'),
    activity__name: formatMessage(intl, MODULE_NAME, 'project.activity'),
    target_beneficiaries: formatMessage(intl, MODULE_NAME, 'project.targetBeneficiaries'),
    working_days: formatMessage(intl, MODULE_NAME, 'project.workingDays'),
    location__parent__name: formatMessage(intl, MODULE_NAME, 'location.locationType.0'),
    location__name: formatMessage(intl, MODULE_NAME, 'location.locationType.1'),
    micro_catchment__name: formatMessage(intl, MODULE_NAME, 'project.microCatchment'),
    hotspot__name: formatMessage(intl, MODULE_NAME, 'project.hotspot'),
  };

  const itemFormatters = () => {
    const baseFormatters = [
      (project) => project.name,
      (project) => formatMessage(intl, MODULE_NAME, `project.statusPicker.${project.status}`),
      (project) => project.activity?.name ?? '',
      (project) => project.targetBeneficiaries,
      (project) => project.workingDays,
    ];

    const formatters = [
      ...baseFormatters,
      (project) => locationFormatter(project?.location)[0] ?? '',
      (project) => locationFormatter(project?.location)[1] ?? '',
      (project) => project.microCatchment?.name ?? '',
      (project) => project.hotspot?.name ?? '',
    ];

    if (rights.includes(RIGHT_PROJECT_UPDATE)) {
      formatters.push((project) => (
        <Tooltip title={formatMessage(intl, MODULE_NAME, 'editButtonTooltip')}>
          <IconButton
            onClick={() => openProject(project)}
            disabled={deletedProjectUuids.includes(project.id)}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
      ));
    }
    if (rights.includes(RIGHT_PROJECT_DELETE)) {
      formatters.push((project) => (!project?.isDeleted ? (
        <Tooltip title={formatMessage(intl, MODULE_NAME, 'deleteButtonTooltip')}>
          <IconButton
            onClick={() => onDelete(project)}
            disabled={deletedProjectUuids.includes(project.id)}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title={formatMessage(intl, MODULE_NAME, 'undoButtonTooltip')}>
          <IconButton
            onClick={() => onUndo(project)}
            disabled={undoProjectUuids.includes(project.id)}
          >
            <UndoIcon />
          </IconButton>
        </Tooltip>
      )));
    }

    return formatters;
  };

  const rowIdentifier = (project) => project.id;

  const sorts = () => [
    ['name', true],
    ['status', true],
    ['activity', true],
    ['targetBeneficiaries', true],
    ['workingDays', true],
    ['location', true],
    ['location', true],
    ['microCatchment', true],
    ['hotspot', true],
  ];

  const benefitPlanProjectsFilter = (props) => (
    <ProjectFilter
      intl={props.intl}
      classes={props.classes}
      filters={props.filters}
      onChangeFilters={props.onChangeFilters}
    />
  );

  const onAdd = () => {
    history.push({
      pathname: `${projectRouteBase()}/create`,
      state: {
        benefitPlanId,
        benefitPlanName,
      },
    });
  };

  const onFiltersApplied = (appliedFilters) => {
    setActiveFilters(appliedFilters);
    setDeletedProjectUuids([]);
    setUndoProjectUuids([]);
  };

  const searcherActions = [
    {
      label: formatMessage(intl, MODULE_NAME, 'projects.searcherAddAction'),
      icon: <AddIcon />,
      authorized: rights.includes(RIGHT_PROJECT_CREATE),
      onClick: onAdd,
    },
  ];

  const isDeletedFilterActive = !!activeFilters?.isDeleted?.value;
  const items = projects.filter((p) => (
    isDeletedFilterActive ? !undoProjectUuids.includes(p.id) : !deletedProjectUuids.includes(p.id)
  ));

  return (
    !!benefitPlanId && (
      <div>
        <Searcher
          module={MODULE_NAME}
          FilterPane={benefitPlanProjectsFilter}
          fetch={fetch}
          items={items}
          itemsPageInfo={projectsPageInfo}
          fetchingItems={fetchingProjects}
          fetchedItems={fetchedProjects}
          errorItems={errorProjects}
          tableTitle={formatMessageWithValues(intl, MODULE_NAME, 'projects.searcherResultsTitle', {
            projectsTotalCount,
          })}
          headers={headers}
          itemFormatters={itemFormatters}
          sorts={sorts}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          defaultPageSize={DEFAULT_PAGE_SIZE}
          defaultOrderBy="-name"
          rowIdentifier={rowIdentifier}
          defaultFilters={defaultFilters()}
          searcherActions={searcherActions}
          enableActionButtons
          searcherActionsPosition="header-right"
          exportable
          exportFields={exportFields}
          exportFieldsColumns={exportFieldsColumns}
          exportFieldLabel={formatMessage(intl, MODULE_NAME, 'export.label')}
          // exportFetch is a dialog opener here; the Searcher's built-in export flow is bypassed
          // in favor of ExportWithFiltersDialog so active filters (e.g. benefitPlan scope) are preserved.
          exportFetch={openExportDialog}
          onDoubleClick={openProject}
          onFiltersApplied={onFiltersApplied}
        />
        <ExportWithFiltersDialog
          open={exportDialogOpen}
          onClose={closeExportDialog}
          onConfirm={exportWithFilters}
          intl={intl}
          filters={activeFilters}
          exportFields={exportFields}
          exportFieldsColumns={exportFieldsColumns}
          module={MODULE_NAME}
        />
        {failedExport && (
          <Dialog open={failedExport} fullWidth maxWidth="sm">
            <DialogTitle>{formatMessage(intl, MODULE_NAME, 'export.error.title')}</DialogTitle>
            <DialogContent>
              <strong>{formatMessage(intl, MODULE_NAME, 'export.error.code', { code: errorProjectExport?.code })}</strong>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setFailedExport(false)} color="primary" variant="contained">
                {formatMessage(intl, MODULE_NAME, 'ok')}
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </div>
    )
  );
}

const mapStateToProps = (state) => ({
  fetchingProjects: state.projectSocialProtection.fetchingProjects,
  fetchedProjects: state.projectSocialProtection.fetchedProjects,
  errorProjects: state.projectSocialProtection.errorProjects,
  projects: state.projectSocialProtection.projects,
  projectsPageInfo: state.projectSocialProtection.projectsPageInfo,
  projectsTotalCount: state.projectSocialProtection.projectsTotalCount,
  confirmed: state.core.confirmed,
  submittingMutation: state.projectSocialProtection.submittingMutation,
  mutation: state.projectSocialProtection.mutation,
  projectExport: state.projectSocialProtection.projectExport,
  errorProjectExport: state.projectSocialProtection.errorProjectExport,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({
  fetchBenefitPlanProjects,
  downloadProjects,
  deleteProject,
  undoDeleteProject,
  clearProjectExport,
  coreConfirm,
  clearConfirm,
  journalize,
}, dispatch);

const ConnectedBenefitPlanProjectsSearcher = withModulesManager(
  injectIntl(connect(mapStateToProps, mapDispatchToProps)(BenefitPlanProjectsSearcher)),
);
export default ConnectedBenefitPlanProjectsSearcher;
