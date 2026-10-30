import React, {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import { injectIntl } from 'react-intl';
import {
  formatMessage,
  formatMessageWithValues,
  useModulesManager,
  coreAlert,
  waitForMutation,
} from '@openimis/fe-core';
import { connect, useDispatch } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  Button,
  Typography,
} from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DownloadIcon from '@material-ui/icons/CloudDownload';
import {
  MODULE_NAME,
  RIGHT_PROJECT_UPDATE,
} from '../constants';
import BeneficiaryTable from './BeneficiaryTable';
import {
  ProjectBeneficiariyEnrollmentDialog,
  ProjectGroupBeneficiaryEnrollmentDialog,
} from '../dialogs/ProjectEnrollmentDialog';
import { REQUEST } from '../util/action-type';
import { ACTION_TYPE } from '../reducer';
import {
  bulkUpdateBeneficiaryTimeEntries,
  bulkUpdateGroupBeneficiaryTimeEntries,
} from '../actions';
import { downloadLogSheetPdf } from '../util/log-sheet-export';

function BaseProjectBeneficiaryTable({
  project,
  isGroup,
  EnrollmentDialogComponent,
  rights,
  intl,
  fetchingBeneficiaries,
  beneficiaries,
  beneficiariesTotalCount,
  submittingMutation,
  mutation,
  coreAlert: showAlert,
  waitForMutation: waitForMutationStatus,
}) {
  const theme = useTheme();
  const orderBy = isGroup ? 'orderBy: ["group__code"]' : 'orderBy: ["individual__first_name", "individual__last_name"]';
  const actionType = isGroup
    ? ACTION_TYPE.SEARCH_PROJECT_GROUP_BENEFICIARIES
    : ACTION_TYPE.SEARCH_PROJECT_BENEFICIARIES;
  const modulesManager = useModulesManager();
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const tableTitle = formatMessageWithValues(
    intl,
    MODULE_NAME,
    'projectBeneficiaries.enrolled',
    { n: beneficiariesTotalCount },
  );
  const materialTableRef = useRef();
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [clientMutationId, setClientMutationId] = useState(null);
  const pendingChangesRef = useRef({});
  const attendanceSnapshotRef = useRef({});

  const dispatch = useDispatch();

  const handleTimeEntryChange = useCallback((enrollmentId, dayKey, value, originalEntry, rowData) => {
    setPendingChanges((prev) => {
      const existing = prev[enrollmentId];
      const oldData = existing?.oldData || rowData;
      const currentNewData = existing?.newData || rowData;

      const newData = {
        ...currentNewData,
        projectTimeEntriesDict: {
          ...currentNewData.projectTimeEntriesDict,
          [dayKey]: {
            ...currentNewData.projectTimeEntriesDict?.[dayKey],
            id: originalEntry?.id,
            percentComplete: value,
          },
        },
      };

      const nextChanges = {
        ...prev,
        [enrollmentId]: { oldData, newData },
      };

      // The table toolbar actions are memoized by MaterialTable. Keep a live
      // reference so the save action always reads the latest accumulated edits
      // instead of the empty state captured when the toolbar was created.
      pendingChangesRef.current = nextChanges;
      return nextChanges;
    });
  }, []);

  const mergedBeneficiaries = useMemo(() => (beneficiaries || []).map((row) => {
    const changes = pendingChanges[row.enrollmentId];
    if (!changes?.newData) return row;
    return changes.newData;
  }), [beneficiaries, pendingChanges]);
  // Trigger fetch: batch & concat handled in projectBeneficiariesMiddleware & reducers
  const triggerFetch = useCallback(() => {
    if (project?.id) {
      dispatch({
        type: REQUEST(actionType),
        meta: {
          fetchAllForProjectId: project.id,
          modulesManager,
        },
      });
    }
  }, [project?.id, actionType]);

  // Keyed on project.id (not benefitPlan.id) so switching projects under the same
  // benefit plan refetches.
  useEffect(() => {
    triggerFetch();
  }, [project?.id]);

  // Record a completed time-entry mutation, then check its mutation-log status
  // before claiming success or refreshing the grid.
  const prevSubmittingRef = useRef();
  useEffect(() => {
    if (prevSubmittingRef.current && !submittingMutation) {
      const isTimeEntryMutation = [
        ACTION_TYPE.BULK_UPDATE_BENEFICIARY_TIME_ENTRIES,
        ACTION_TYPE.BULK_UPDATE_GROUP_BENEFICIARY_TIME_ENTRIES,
      ].includes(mutation?.actionType);

      if (isTimeEntryMutation) {
        if (mutation?.id && mutation?.clientMutationId) {
          setClientMutationId(mutation.clientMutationId);
        }
      }
    }
    prevSubmittingRef.current = submittingMutation;
  }, [submittingMutation, mutation]);

  useEffect(() => {
    if (!clientMutationId) return undefined;

    let cancelled = false;
    const confirmTimeEntrySave = async () => {
      const result = await waitForMutationStatus(clientMutationId);

      if (cancelled) return;
      setClientMutationId(null);
      if (result?.status === 2) {
        triggerFetch();
        showAlert(
          formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.timeEntry.success.title'),
          formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.timeEntry.success.message'),
        );
      }
    };

    confirmTimeEntrySave();
    return () => { cancelled = true; };
  }, [clientMutationId, waitForMutationStatus, triggerFetch, showAlert, intl]);

  const handleDownloadLogSheet = () => {
    downloadLogSheetPdf({
      project,
      beneficiaries: mergedBeneficiaries,
      isGroup,
      translate: (key) => formatMessage(intl, MODULE_NAME, key),
    });
  };

  function scrollToFirstWorkingDayColumn() {
    const scrollContainer = materialTableRef.current?.tableContainerDiv?.current;
    if (!scrollContainer) return;

    const headerCells = scrollContainer.querySelectorAll('thead th');
    const targetHeader = Array.from(headerCells).find((th) => th.textContent.trim().startsWith('1'));

    if (targetHeader) {
      const numFrozenCols = 4;
      const frozenColumns = Array.from(headerCells).slice(0, numFrozenCols);
      const frozenWidth = frozenColumns.reduce((sum, th) => sum + th.offsetWidth, 0);

      scrollContainer.scrollTo({
        left: targetHeader.offsetLeft - frozenWidth,
        behavior: 'smooth',
      });
    }
  }

  const handleToggleEdit = () => {
    const materialTable = materialTableRef.current;
    if (!materialTable?.dataManager) return;

    const isEditing = materialTable.dataManager.bulkEditOpen;

    if (isEditing) {
      const timeEntries = [];
      // Read the rows directly from MaterialTable. These are the values visible
      // in the editor and include every cell changed during the edit session.
      // bulkEditChangedRows only keeps the latest change for a row, while React
      // callbacks can be stale when invoked from memoized toolbar actions.
      const editedRows = materialTable.dataManager.data || [];
      editedRows.forEach((newData) => {
        const newEntries = newData.projectTimeEntriesDict || {};
        const oldEntries = attendanceSnapshotRef.current[newData.enrollmentId] || {};

        const allDayKeys = new Set([
          ...Object.keys(newEntries).filter((k) => k.startsWith('day')),
          ...Object.keys(oldEntries).filter((k) => k.startsWith('day')),
        ]);

        allDayKeys.forEach((dayKey) => {
          const newEntry = newEntries[dayKey];
          const oldEntry = oldEntries[dayKey];
          const oldPercent = oldEntry?.percentComplete;
          const newPercent = newEntry?.percentComplete;

          const isBlank = newPercent === '' || newPercent === undefined || newPercent === null;

          // A missing entry means "not recorded".  Persist a clear operation
          // only when an attendance entry already exists; a newly created blank
          // cell has nothing to save.
          if (isBlank) {
            if (oldEntry?.id) {
              timeEntries.push({
                id: oldEntry.id,
                enrollmentId: newData.enrollmentId,
                dayNumber: parseInt(dayKey.replace('day', ''), 10),
                clear: true,
              });
            }
            return;
          }

          const normalizedNew = Number(newPercent);

          if (oldPercent !== normalizedNew) {
            timeEntries.push({
              id: newEntry?.id || oldEntry?.id || null,
              enrollmentId: newData.enrollmentId,
              dayNumber: parseInt(dayKey.replace('day', ''), 10),
              percentComplete: normalizedNew,
            });
          }
        });
      });

      const hasInvalidEntries = timeEntries.some(
        (e) => !e.clear && ![0, 100].includes(e.percentComplete),
      );

      if (hasInvalidEntries) {
        showAlert(
          formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.timeEntry.validation.title'),
          formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.timeEntry.validation.message'),
        );
        return;
      }

      if (timeEntries.length > 0) {
        const mutationLabel = formatMessageWithValues(
          intl,
          MODULE_NAME,
          'projectBeneficiaries.timeEntry.mutationLabel',
          { n: timeEntries.length, name: project.name },
        );

        const action = isGroup
          ? bulkUpdateGroupBeneficiaryTimeEntries({ timeEntries }, mutationLabel)
          : bulkUpdateBeneficiaryTimeEntries({ timeEntries }, mutationLabel);

        dispatch(action);
      }

      pendingChangesRef.current = {};
      attendanceSnapshotRef.current = {};
      setPendingChanges({});
    }

    const newState = !isEditing;
    materialTable.dataManager.changeBulkEditOpen(newState);
    materialTable.setState({
      ...materialTable.dataManager.getRenderState(),
    });
    setBulkEditOpen(newState);

    if (newState) {
      // Preserve immutable values from the beginning of the edit session.
      // MaterialTable updates nested row fields in place, so comparing against
      // the Redux rows after editing can otherwise hide genuine changes.
      attendanceSnapshotRef.current = (materialTable.dataManager.data || []).reduce((snapshot, row) => ({
        ...snapshot,
        [row.enrollmentId]: Object.entries(row.projectTimeEntriesDict || {}).reduce(
          (entries, [dayKey, entry]) => ({
            ...entries,
            [dayKey]: { ...entry },
          }),
          {},
        ),
      }), {});
      setTimeout(() => {
        scrollToFirstWorkingDayColumn();
      }, 300);
    }
  };

  const handleCancelEdit = () => {
    const materialTable = materialTableRef.current;
    if (!materialTable?.dataManager) return;

    materialTable.dataManager.changeBulkEditOpen(false);
    materialTable.setState({
      ...materialTable.dataManager.getRenderState(),
    });
    setBulkEditOpen(false);
    pendingChangesRef.current = {};
    attendanceSnapshotRef.current = {};
    setPendingChanges({});
  };

  return (
    !!project?.id && (
      <>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: theme.spacing(2),
            padding: theme.spacing(1, 2),
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            backgroundColor: theme.paper?.body?.backgroundColor,
          }}
        >
          <Button
            startIcon={<DownloadIcon />}
            variant="contained"
            color="primary"
            size="small"
            onClick={handleDownloadLogSheet}
          >
            <Typography variant="body2" noWrap>
              {formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.downloadLogSheet')}
            </Typography>
          </Button>
          {rights.includes(RIGHT_PROJECT_UPDATE) && (
            <>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                color="primary"
                size="small"
                onClick={() => setEnrollmentDialogOpen(true)}
              >
                <Typography variant="body2" noWrap>
                  {formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.enroll')}
                </Typography>
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleToggleEdit}
              >
                <Typography variant="body2" noWrap>
                  {bulkEditOpen
                    ? formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.saveTime')
                    : formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.enterTime')}
                </Typography>
              </Button>
              {bulkEditOpen && (
                <Button variant="outlined" color="default" size="small" onClick={handleCancelEdit}>
                  <Typography variant="body2" noWrap>
                    {formatMessage(intl, MODULE_NAME, 'projectBeneficiaries.cancelEdit')}
                  </Typography>
                </Button>
              )}
            </>
          )}
        </div>
        <BeneficiaryTable
          allRows={mergedBeneficiaries}
          fetchingBeneficiaries={fetchingBeneficiaries}
          tableTitle={tableTitle}
          isGroup={isGroup}
          actions={[]}
          workingDays={project.workingDays}
          tableRef={materialTableRef}
          onTimeEntryChange={handleTimeEntryChange}
          attendanceMode
          workLogEditMode={bulkEditOpen}
        />
        <EnrollmentDialogComponent
          open={enrollmentDialogOpen}
          onClose={() => setEnrollmentDialogOpen(false)}
          project={project}
          enrolledBeneficiaries={beneficiaries}
          fetchingEnrolledBeneficiaries={fetchingBeneficiaries}
          isGroup={isGroup}
          orderBy={orderBy}
        />
      </>
    )
  );
}

// For Individual Beneficiaries
const mapStateToPropsIndividual = (state) => ({
  rights: state.core?.user?.i_user?.rights ?? [],
  submittingMutation: state.projectSocialProtection.submittingMutation,
  mutation: state.projectSocialProtection.mutation,
  fetchingBeneficiaries: state.projectSocialProtection.fetchingProjectBeneficiaries,
  beneficiaries: state.projectSocialProtection.projectBeneficiaries,
  beneficiariesTotalCount: state.projectSocialProtection.projectBeneficiariesTotalCount,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ coreAlert, waitForMutation }, dispatch);

const ConnectedProjectBeneficiaryTable = connect(
  mapStateToPropsIndividual,
  mapDispatchToProps,
)(BaseProjectBeneficiaryTable);

export const ProjectBeneficiaryTable = injectIntl((props) => (
  <ConnectedProjectBeneficiaryTable
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
    EnrollmentDialogComponent={ProjectBeneficiariyEnrollmentDialog}
  />
));

// For Group Beneficiaries
const mapStateToPropsGroup = (state) => ({
  rights: state.core?.user?.i_user?.rights ?? [],
  submittingMutation: state.projectSocialProtection.submittingMutation,
  mutation: state.projectSocialProtection.mutation,
  fetchingBeneficiaries: state.projectSocialProtection.fetchingProjectGroupBeneficiaries,
  beneficiaries: state.projectSocialProtection.projectGroupBeneficiaries,
  beneficiariesTotalCount: state.projectSocialProtection.projectGroupBeneficiariesTotalCount,
});

const ConnectedProjectGroupBeneficiaryTable = connect(
  mapStateToPropsGroup,
  mapDispatchToProps,
)(BaseProjectBeneficiaryTable);

export const ProjectGroupBeneficiaryTable = injectIntl((props) => (
  <ConnectedProjectGroupBeneficiaryTable
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
    isGroup
    EnrollmentDialogComponent={ProjectGroupBeneficiaryEnrollmentDialog}
  />
));
