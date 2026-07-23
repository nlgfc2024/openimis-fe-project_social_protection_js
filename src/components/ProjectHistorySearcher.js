import React, { useState, useEffect } from 'react';
import { injectIntl } from 'react-intl';
import {
  clearConfirm,
  coreConfirm,
  formatMessageWithValues,
  journalize,
  Searcher,
  withHistory,
  formatDateFromISO,
  withModulesManager,
  downloadExport,
} from '@openimis/fe-core';
import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
} from '@material-ui/core';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  DEFAULT_PAGE_SIZE,
  ROWS_PER_PAGE_OPTIONS,
} from '../constants';
import {
  fetchProjectHistory,
  downloadProjectHistory,
  clearProjectHistoryExport,
} from '../actions';
import ProjectFilter from './BenefitPlanProjectsFilter';
import ExportWithFiltersDialog from './ExportWithFiltersDialog';
import {
  LOC_LEVELS,
  locationFormatter,
} from '../util/searcher-utils';

function ProjectHistorySearcher({
  intl,
  modulesManager,
  fetchProjectHistory,
  downloadProjectHistory,
  clearProjectHistoryExport,
  fetchingProjectsHistory,
  fetchedProjectsHistory,
  errorProjectsHistory,
  projectsHistory,
  projectsHistoryPageInfo,
  projectsHistoryTotalCount,
  projectId,
  projectHistoryExport,
  errorProjectHistoryExport,
}) {
  const fetch = (params) => fetchProjectHistory(modulesManager, params);

  const [failedExport, setFailedExport] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(defaultFilters());

  useEffect(() => {
    if (errorProjectHistoryExport) {
      setFailedExport(true);
    }
  }, [errorProjectHistoryExport]);

  useEffect(() => {
    if (projectHistoryExport) {
      downloadExport(
        projectHistoryExport,
        `${formatMessage(intl, MODULE_NAME, 'export.filename.projectHistory')}.csv`,
      )();
      clearProjectHistoryExport();
    }
    setFailedExport(false);
  }, [projectHistoryExport]);

  const openExportDialog = () => setExportDialogOpen(true);
  const closeExportDialog = () => setExportDialogOpen(false);

  const headers = () => {
    const baseHeaders = [
      'project.name',
      'project.status',
      'project.activity',
      'project.targetBeneficiaries',
      'project.workingDays',
    ];
    baseHeaders.push(...Array.from({ length: LOC_LEVELS }, (_, i) => `location.locationType.${i}`));

    baseHeaders.push(...[
      'project.version',
      'project.dateUpdated',
      'project.userUpdated',
    ]);

    return baseHeaders;
  };

  const itemFormatters = () => {
    const baseFormatters = [
      (project) => project.name,
      (project) => project.status,
      (project) => project.activity.name,
      (project) => project.targetBeneficiaries,
      (project) => project.workingDays,
    ];
    const formatters = [
      ...baseFormatters,
      ...Array.from({ length: LOC_LEVELS }, (_, i) => (project) => locationFormatter(project?.location)[i]),
      ...[
        (project) => project.version,
        (project) => (project.dateUpdated
          ? formatDateFromISO(modulesManager, intl, project.dateUpdated)
          : ''),
        (project) => project.userUpdated?.username ?? '',
      ],
    ];
    return formatters;
  };

  const exportFields = [
    'name',
    'status',
    'activity.name',
    'targetBeneficiaries',
    'workingDays',
    'version',
    'dateUpdated',
    'userUpdated.username',
  ];

  const exportFieldsColumns = {
    name: formatMessage(intl, MODULE_NAME, 'project.name'),
    status: formatMessage(intl, MODULE_NAME, 'project.status'),
    'activity.name': formatMessage(intl, MODULE_NAME, 'project.activity'),
    targetBeneficiaries: formatMessage(intl, MODULE_NAME, 'project.targetBeneficiaries'),
    workingDays: formatMessage(intl, MODULE_NAME, 'project.workingDays'),
    version: formatMessage(intl, MODULE_NAME, 'project.version'),
    dateUpdated: formatMessage(intl, MODULE_NAME, 'project.dateUpdated'),
    'userUpdated.username': formatMessage(intl, MODULE_NAME, 'project.userUpdated'),
  };

  const exportWithFilters = (dialogFilters, selectedFields) => {
    const filterParams = Object.keys(dialogFilters)
      .filter((f) => !!dialogFilters[f]?.filter)
      .map((f) => dialogFilters[f].filter);
    const parameters = [...filterParams];
    const fields = selectedFields?.length ? selectedFields : exportFields;
    parameters.push(`fileFormat: "csv"`);
    parameters.push(`fields: ${JSON.stringify(fields)}`);
    parameters.push(`fieldsColumns: "${JSON.stringify(exportFieldsColumns).replace(/\"/g, '\\\"')}"`);
    downloadProjectHistory(parameters);
    closeExportDialog();
  };

  const rowIdentifier = (projectsHistory) => projectsHistory.id;

  const sorts = () => [
    ['version', true],
    ['dateUpdated', true],
    ['userUpdated', true],
  ];

  const defaultFilters = () => ({
    isDeleted: {
      value: false,
      filter: 'isDeleted: false',
    },
    ...(projectId !== null && projectId !== undefined && {
      projectId: {
        value: projectId,
        filter: `id: "${projectId}"`,
      },
    }),
  });

  const projectHistoryFilter = (props) => (
    <ProjectFilter
      filters={props.filters}
      onChangeFilters={props.onChangeFilters}
    />
  );

  return (
    <div>
      <Searcher
        module={MODULE_NAME}
        FilterPane={projectHistoryFilter}
        fetch={fetch}
        items={projectsHistory}
        itemsPageInfo={projectsHistoryPageInfo}
        fetchingItems={fetchingProjectsHistory}
        fetchedItems={fetchedProjectsHistory}
        errorItems={errorProjectsHistory}
        tableTitle={formatMessageWithValues(intl, 'projectSocialProtection', 'project.searcherResultsTitleHistory', {
          projectsHistoryTotalCount,
        })}
        headers={headers}
        itemFormatters={itemFormatters}
        sorts={sorts}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        defaultPageSize={DEFAULT_PAGE_SIZE}
        defaultOrderBy="-version"
        rowIdentifier={rowIdentifier}
        defaultFilters={defaultFilters()}
        exportable
        exportFields={exportFields}
        exportFieldsColumns={exportFieldsColumns}
        exportFieldLabel={formatMessage(intl, MODULE_NAME, 'export.label')}
        exportFetch={openExportDialog}
        onFiltersApplied={(appliedFilters) => setActiveFilters(appliedFilters)}
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
            <strong>{formatMessage(intl, MODULE_NAME, 'export.error.code', { code: errorProjectHistoryExport?.code })}</strong>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFailedExport(false)} color="primary" variant="contained">
              {formatMessage(intl, MODULE_NAME, 'ok')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

const mapStateToProps = (state) => ({
  fetchingProjectsHistory: state.projectSocialProtection.fetchingProjectsHistory,
  fetchedProjectsHistory: state.projectSocialProtection.fetchedProjectsHistory,
  errorProjectsHistory: state.projectSocialProtection.errorProjectsHistory,
  projectsHistory: state.projectSocialProtection.projectsHistory,
  projectsHistoryPageInfo: state.projectSocialProtection.projectsHistoryPageInfo,
  projectsHistoryTotalCount: state.projectSocialProtection.projectsHistoryTotalCount,
  confirmed: state.core.confirmed,
  submittingMutation: state.projectSocialProtection.submittingMutation,
  mutation: state.projectSocialProtection.mutation,
  projectHistoryExport: state.projectSocialProtection.projectHistoryExport,
  errorProjectHistoryExport: state.projectSocialProtection.errorProjectHistoryExport,
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  {
    fetchProjectHistory,
    downloadProjectHistory,
    clearProjectHistoryExport,
    coreConfirm,
    clearConfirm,
    journalize,
  },
  dispatch,
);

export default withHistory(
  withModulesManager(injectIntl(connect(mapStateToProps, mapDispatchToProps)(ProjectHistorySearcher))),
);
