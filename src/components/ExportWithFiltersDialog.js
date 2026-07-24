import React, { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Typography,
} from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import GetAppIcon from '@material-ui/icons/GetApp';
import { formatMessage } from '@openimis/fe-core';
import ProjectFilter from './BenefitPlanProjectsFilter';

const styles = (theme) => ({
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  footerActions: {
    justifyContent: 'space-between',
    padding: theme.spacing(2),
  },
});

function ExportWithFiltersDialog({
  classes,
  intl,
  open,
  onClose,
  onConfirm,
  filters,
  exportFields,
  exportFieldsColumns,
  module,
}) {
  const [dialogFilters, setDialogFilters] = useState(filters || {});
  const [selectedFields, setSelectedFields] = useState(exportFields || []);

  useEffect(() => {
    if (open) {
      setDialogFilters(filters || {});
      setSelectedFields(exportFields || []);
    }
  }, [open, filters, exportFields]);

  const handleFilterChange = (updatedFilters) => {
    const nextFilters = { ...dialogFilters };
    updatedFilters.forEach((filter) => {
      if (filter.value === null) {
        delete nextFilters[filter.id];
      } else {
        nextFilters[filter.id] = { value: filter.value, filter: filter.filter };
      }
    });
    setDialogFilters(nextFilters);
  };

  const toggleField = (field) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleUnselectAll = () => {
    setSelectedFields([]);
  };

  const handleConfirm = () => {
    onConfirm(dialogFilters, selectedFields.length ? selectedFields : exportFields);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{formatMessage(intl, 'core', 'exportConfigDialog.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" className={classes.sectionTitle}>
          {formatMessage(intl, module, 'exportDialog.filterCriteriaTitle')}
        </Typography>
        <ProjectFilter filters={dialogFilters} onChangeFilters={handleFilterChange} />

        <Typography variant="subtitle1" className={classes.sectionTitle}>
          {formatMessage(intl, 'core', 'exportConfigDialog.selectColumns')}
        </Typography>
        <div className={classes.checkboxGrid}>
          {exportFields.map((field) => (
            <FormControlLabel
              key={field}
              control={(
                <Checkbox
                  color="primary"
                  checked={selectedFields.includes(field)}
                  onChange={() => toggleField(field)}
                />
              )}
              label={exportFieldsColumns[field] || field}
            />
          ))}
        </div>
      </DialogContent>
      <DialogActions className={classes.footerActions}>
        <Button onClick={handleUnselectAll} color="secondary">
          {formatMessage(intl, 'core', 'exportConfigDialog.clearAllColsButton')}
        </Button>
        <div>
          <Button onClick={onClose} color="primary">
            {formatMessage(intl, module, 'exportDialog.cancelButton')}
          </Button>
          <Button onClick={handleConfirm} color="primary" variant="contained" startIcon={<GetAppIcon />}>
            {formatMessage(intl, module, 'export.label')}
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
}

export default withStyles(styles)(ExportWithFiltersDialog);
