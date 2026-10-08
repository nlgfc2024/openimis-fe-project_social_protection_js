import React, {
  useMemo, useEffect, useRef, useCallback,
} from 'react';
import { injectIntl } from 'react-intl';
import MaterialTable from 'material-table';
import _ from 'lodash';
import {
  Checkbox,
  Select,
  MenuItem,
  Paper,
} from '@material-ui/core';
import {
  withTheme,
  withStyles,
  ThemeProvider,
  createMuiTheme,
} from '@material-ui/core/styles';
import { useDispatch } from 'react-redux';
import {
  formatMessage,
  fetchCustomFilter,
  useModulesManager,
} from '@openimis/fe-core';
import {
  LOC_LEVELS,
  locationFormatter,
} from '../util/searcher-utils';
import {
  MODULE_NAME,
  DEFAULT_PAGE_SIZE,
  DEFAULT_MAX_WORKING_DAYS,
} from '../constants';
import NumberFilter from './MaterialTableNumberFilter';

const DEFAULT_CELL_PADDING = '0 0 0 10px';

const createNumericFilterFn = (getValue) => (filter, rowData) => {
  const value = getValue(rowData);
  const numValue = (value === null || value === undefined) ? 0 : Number(value);

  // Handle case when filter is a string (global search)
  if (typeof filter === 'string') {
    if (filter === '') return true;
    const searchNum = Number(filter);
    if (Number.isNaN(searchNum)) return false;
    return numValue === searchNum;
  }

  // Handle case when filter is an object (column filter)
  const filterValue = Number(filter?.value);
  if (Number.isNaN(numValue)) return false;
  if (filter?.value === undefined || filter?.value === '') return true;
  if (Number.isNaN(filterValue)) return false;

  switch (filter?.operator) {
    case 'exact': return numValue === filterValue;
    case 'lt': return numValue < filterValue;
    case 'lte': return numValue <= filterValue;
    case 'gt': return numValue > filterValue;
    case 'gte': return numValue >= filterValue;
    default: return numValue === filterValue;
  }
};

const styles = (theme) => ({
  page: theme.page,
  paper: theme.paper.classes,
  containerWrapper: {
    padding: '0 20px',
    // Patch style of a nested material-table element
    // so frozen columns work correctly
    '& > div:nth-child(2) > div:nth-child(2)': {
      position: 'relative',
    },

    '& td': {
      padding: DEFAULT_CELL_PADDING,
    },
  },
});

const getDynamicColumns = (translateFn, customFilters = []) => {
  if (!customFilters || !customFilters.length) return [];

  return customFilters
    .map((filter) => {
      const { field, type } = filter;
      let renderFn = (rowData) => {
        const value = rowData.jsonExt?.[field];
        return value === null || value === undefined ? '' : String(value);
      };
      let filterFn = (term, rowData) => {
        const value = rowData.jsonExt?.[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(term.toLowerCase());
      };
      let filterComponent;

      switch (type) {
        case 'boolean':
          renderFn = (rowData) => (rowData.jsonExt?.[field] ? translateFn('common.true') : translateFn('common.false'));
          filterFn = (term, rowData) => {
            if (term === 'all') return true;
            return term === String(rowData.jsonExt?.[field]);
          };
          filterComponent = ({ columnDef, onFilterChanged }) => (
            <Select
              fullWidth
              value={columnDef.tableData.filterValue || 'all'}
              onChange={({ target }) => {
                onFilterChanged(columnDef.tableData.id, target.value);
              }}
              displayEmpty
            >
              <MenuItem value="all">{translateFn('common.any')}</MenuItem>
              <MenuItem value="true">{translateFn('common.true')}</MenuItem>
              <MenuItem value="false">{translateFn('common.false')}</MenuItem>
            </Select>
          );
          break;

        case 'integer':
        case 'numeric':
          filterComponent = NumberFilter;
          filterFn = createNumericFilterFn((rowData) => rowData.jsonExt?.[field]);
          break;

        case 'date':
          renderFn = (rowData) => {
            const date = new Date(rowData.jsonExt?.[field]);
            return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
          };
          filterFn = (term, rowData) => {
            const value = rowData.jsonExt?.[field];
            if (value === null || value === undefined) return false;
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return false;
            return date.toISOString().substring(0, 10).includes(term);
          };
          break;

        default:
          break;
      }

      return {
        title: _.startCase(field),
        field: `jsonExt.${field}`,
        type,
        render: renderFn,
        filterComponent,
        customFilterAndSearch: filterFn,
        align: 'left',
        editable: 'never',
      };
    });
};

function AttendanceEditField({
  value, onChange, columnDef, rowData, onTimeEntryChange, dayKey,
}) {
  const effectiveDayKey = dayKey || columnDef?.dayKey;

  const handleChange = ({ target: { checked } }) => {
    // The empty state remains untouched until a user clicks a cell. This keeps
    // an unrecorded day distinct from an explicitly recorded absence.
    const newValue = checked ? 100 : 0;
    onChange(newValue);

    if (onTimeEntryChange && rowData?.enrollmentId && effectiveDayKey) {
      const originalEntry = rowData.projectTimeEntriesDict?.[effectiveDayKey];
      onTimeEntryChange(rowData.enrollmentId, effectiveDayKey, newValue, originalEntry, rowData);
    }
  };

  return (
    <Checkbox
      checked={value === 100}
      color="primary"
      inputProps={{ 'aria-label': columnDef?.title }}
      onChange={handleChange}
    />
  );
}

function TableContainer({ children, className }) {
  return (
    <Paper elevation={2} className={className}>
      {children}
    </Paper>
  );
}

const getWorkDayColumns = (
  translateFn,
  onTimeEntryChange,
  workingDays = 0,
  maxColumns = DEFAULT_MAX_WORKING_DAYS,
  attendanceMode = false,
  theme,
) => {
  if (!workingDays) return [];
  const cappedDays = Math.min(workingDays, maxColumns);
  return Array.from({ length: cappedDays }, (_, i) => {
    const dayNumber = i + 1;
    const dayKey = `day${dayNumber}`;
    return {
      title: attendanceMode ? String(dayNumber) : `${translateFn('project.day')} ${dayNumber}`,
      field: `projectTimeEntriesDict.${dayKey}.percentComplete`,
      dayKey,
      presentLabel: translateFn('projectBeneficiaries.present'),
      absentLabel: translateFn('projectBeneficiaries.absent'),
      notRecordedLabel: translateFn('projectBeneficiaries.notRecorded'),
      render: (rowData) => {
        const value = rowData.projectTimeEntriesDict?.[dayKey]?.percentComplete;
        if (attendanceMode) {
          return (
            <Checkbox
              checked={value === 100}
              color="primary"
              disabled
              style={{ color: value === 100 ? theme.palette.primary.main : undefined }}
            />
          );
        }
        if (value === 100) return translateFn('projectBeneficiaries.present');
        if (value === 0) return translateFn('projectBeneficiaries.absent');
        return translateFn('projectBeneficiaries.notRecorded');
      },
      editComponent: (props) => (
        // eslint-disable-next-line react/jsx-props-no-spreading
        <AttendanceEditField {...props} onTimeEntryChange={onTimeEntryChange} dayKey={dayKey} />
      ),
      customSort: (a, b) => {
        const aVal = a.projectTimeEntriesDict?.[dayKey]?.percentComplete ?? -1;
        const bVal = b.projectTimeEntriesDict?.[dayKey]?.percentComplete ?? -1;
        return aVal - bVal;
      },
      align: 'center',
      width: attendanceMode ? '48px' : '120px',
      ...(attendanceMode && {
        headerStyle: {
          borderLeft: `1px solid ${theme.palette.primary.dark}`,
          padding: 0,
          textAlign: 'center',
        },
        cellStyle: {
          borderLeft: `1px solid ${theme.palette.divider}`,
          padding: 0,
          textAlign: 'center',
        },
      }),
    };
  });
};

function BeneficiaryTable({
  intl,
  theme,
  allRows, // expect either allRows or onQueryChange to be specified, not both at the same time
  onQueryChange,
  fetchingBeneficiaries,
  onSelectionChange,
  tableTitle,
  actions,
  isGroup,
  appliedFilters,
  appliedPageSize,
  workingDays,
  tableRef,
  classes,
  onTimeEntryChange,
  attendanceMode = false,
}) {
  const nameDoBFieldPrefix = isGroup ? 'group.head' : 'individual';
  const locationFieldPrefix = isGroup ? 'group' : 'individual';

  const translate = useCallback((key) => formatMessage(intl, MODULE_NAME, key), [intl, MODULE_NAME]);

  const translateRef = useRef(translate);
  translateRef.current = translate;

  const initialFiltersRef = useRef(appliedFilters || {});
  const [jsonExtFilters, setJsonExtFilters] = React.useState({});

  const dispatch = useDispatch();
  const modulesManager = useModulesManager();
  const maxWorkingDays = modulesManager.getConf('fe-project_social_protection', 'maxWorkingDays', DEFAULT_MAX_WORKING_DAYS);

  const dynamicColumns = React.useMemo(() => (
    getDynamicColumns(translateRef.current, jsonExtFilters)
  ), [jsonExtFilters]);

  useEffect(() => {
    if (appliedFilters) {
      initialFiltersRef.current = appliedFilters;
    }
  }, [appliedFilters]);

  const params = [
    'moduleName: "individual"',
    'objectTypeName: "Individual"',
    'additionalParams: "{\\"type\\":\\"INDIVIDUAL\\"}"',
  ];
  useEffect(() => {
    dispatch(fetchCustomFilter(params))
      .then((response) => {
        const customFilters = response?.payload.data.customFilters.possibleFilters;
        setJsonExtFilters(customFilters);
      });
  }, [fetchCustomFilter]);

  const tableTheme = createMuiTheme({
    palette: {
      primary: theme.palette.primary,
      secondary: theme.palette.primary,
    },
    typography: {
      h6: {
        color: theme.palette.primary.main,
        fontSize: '1rem',
      },
    },
    overrides: {
      MuiTableBody: {
        root: {
          fontSize: '0.875rem',
        },
      },
      MuiInputBase: {
        root: {
          fontSize: '0.875rem',
          color: theme.palette.text.primary,
          '&.Mui-focused': {
            color: theme.palette.primary.main,
          },
        },
      },
      MuiList: {
        root: {
          color: theme.palette.text.primary,
        },
      },
      MuiIcon: {
        root: {
          color: theme.palette.primary.main,
        },
      },
      MuiIconButton: {
        root: {
          color: theme.palette.primary.main,
          '&:hover': {
            backgroundColor: 'transparent',
          },
        },
      },
      MuiToolbar: {
        root: {
          backgroundColor: theme.paper.body.backgroundColor,
          margin: '0 -20px -15px',
        },
      },
      MuiTablePagination: {
        toolbar: {
          backgroundColor: 'white',
          marginBottom: 0,
        },
      },
    },
  });

  const columns = useMemo(() => {
    const additionalColumns = attendanceMode ? [
      {
        title: translateRef.current('projectBeneficiaries.formNumber'),
        field: isGroup ? 'group.code' : 'jsonExt.form_number',
        editable: 'never',
        defaultSort: 'asc',
        render: (rowData) => (isGroup ? rowData.group?.code : rowData.jsonExt?.form_number) || '',
      },
    ] : isGroup ? [
      {
        title: translateRef.current('socialProtection.groupBeneficiary.code'),
        field: 'group.code',
        editable: 'never',
        defaultSort: 'asc',
      },
    ] : [];
    const workDayColumns = getWorkDayColumns(
      translateRef.current,
      onTimeEntryChange,
      workingDays,
      maxWorkingDays,
      attendanceMode,
      theme,
    );
    const allColumns = [
      ...additionalColumns,
      {
        title: translateRef.current('socialProtection.beneficiary.firstName'),
        field: `${nameDoBFieldPrefix}.firstName`,
        editable: 'never',
        ...(isGroup && { orderField: 'head_first_name' }),
      },
      {
        title: translateRef.current('socialProtection.beneficiary.lastName'),
        field: `${nameDoBFieldPrefix}.lastName`,
        editable: 'never',
        ...(!isGroup && { defaultSort: 'asc' }),
        ...(isGroup && { orderField: 'head_last_name' }),
      },
      ...(attendanceMode ? [{
        title: translateRef.current('projectBeneficiaries.nationalId'),
        field: 'jsonExt.national_id',
        editable: 'never',
        render: (rowData) => rowData.jsonExt?.national_id || rowData.jsonExt?.nationalId || '',
      }] : []),
      {
        title: translateRef.current('socialProtection.beneficiary.dob'),
        field: `${nameDoBFieldPrefix}.dob`,
        editable: 'never',
        ...(isGroup && { orderField: 'head_dob' }),
      },
      ...Array.from({ length: LOC_LEVELS }, (_, i) => {
        // Build the orderField path for remote sorting: level 3 (village) = location__name,
        // level 2 (ward) = location__parent__name, etc.
        const parentChain = Array(LOC_LEVELS - 1 - i).fill('parent').join('__');
        const locationPath = parentChain ? `location__${parentChain}__name` : 'location__name';
        const orderField = `${locationFieldPrefix}__${locationPath}`;

        return {
          title: translateRef.current(`location.locationType.${i}`),
          type: 'location',
          level: i,
          orderField,
          render: (rowData) => locationFormatter(rowData?.[locationFieldPrefix]?.location)[i] || '',
          customSort: (a, b) => {
            const aLoc = locationFormatter(a?.[locationFieldPrefix]?.location)[i] || '';
            const bLoc = locationFormatter(b?.[locationFieldPrefix]?.location)[i] || '';
            return aLoc.localeCompare(bLoc);
          },
          customFilterAndSearch: (term, rowData) => {
            const locName = locationFormatter(rowData?.[locationFieldPrefix]?.location)[i].toLowerCase() || '';
            return locName.includes(term.toLowerCase());
          },
        };
      }),
      ...dynamicColumns,
      ...workDayColumns,
    ];

    return allColumns.map((c) => ({
      ...c,
      width: c.width || (typeof c.field === 'string' && c.field.includes('email') ? '200px' : '140px'),
      tableData: { filterValue: initialFiltersRef.current[c.title] || '' },
    }));
  }, [
    isGroup, nameDoBFieldPrefix, locationFieldPrefix,
    dynamicColumns, workingDays, onTimeEntryChange, maxWorkingDays, attendanceMode, theme,
  ]);

  const isSelectable = !!onSelectionChange;

  const cellPadding = isSelectable ? '0' : DEFAULT_CELL_PADDING;

  const ContainerComponent = useCallback(
    (props) => <TableContainer className={classes.containerWrapper}>{props.children}</TableContainer>,
    [classes.containerWrapper],
  );

  const tableComponents = useMemo(
    () => ({ Container: ContainerComponent }),
    [ContainerComponent],
  );

  return (
    <ThemeProvider theme={tableTheme}>
      <MaterialTable
        components={tableComponents}
        title={tableTitle}
        columns={columns}
        data={onQueryChange || allRows}
        isLoading={fetchingBeneficiaries}
        options={{
          selection: isSelectable,
          selectionProps: {
            color: 'primary',
          },
          search: true,
          filtering: !attendanceMode,
          paging: true,
          pageSize: appliedPageSize || DEFAULT_PAGE_SIZE,
          pageSizeOptions: [10, 50, 100],
          showSelectAllCheckbox: isSelectable,
          headerStyle: {
            padding: cellPadding,
            fontWeight: 500,
            color: attendanceMode ? theme.palette.primary.contrastText : theme.palette.primary.main,
            backgroundColor: attendanceMode ? theme.palette.primary.main : undefined,
            whiteSpace: 'nowrap',
          },
          cellStyle: {
            padding: cellPadding,
            fontWeight: 400,
            color: theme.palette.primary.main,
            whiteSpace: 'nowrap',
          },
          filterCellStyle: {
            padding: cellPadding,
            color: theme.palette.primary.main,
          },
          rowStyle: (rowData, index) => ({
            height: attendanceMode ? '40px' : '42px',
            backgroundColor: attendanceMode && index % 2 === 1
              ? theme.palette.action.hover
              : undefined,
          }),
          doubleHorizontalScroll: false,
          tableLayout: 'fixed',
          emptyRowsWhenPaging: false,
          fixedColumns: { left: attendanceMode ? 4 : (isGroup ? 3 : 2), right: 0 },
          actionsColumnIndex: -1,
        }}
        localization={{
          toolbar: {
            nRowsSelected: isSelectable ? tableTitle : '',
          },
          body: {
            filterRow: {
              filterPlaceHolder: translate('projectBeneficiaries.filterPlaceholder'),
            },
          },
        }}
        onSelectionChange={(rows) => (isSelectable && onSelectionChange(rows))}
        actions={actions}
        tableRef={tableRef}
      />
    </ThemeProvider>
  );
}

export default injectIntl(withTheme(withStyles(styles)(BeneficiaryTable)));
