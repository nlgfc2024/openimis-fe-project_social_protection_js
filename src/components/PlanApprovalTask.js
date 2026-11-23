import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  TextAreaInput, useHistory, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import { MODULE_NAME } from '../constants';
import { mutationErrorMessages, resolvePlanApproval } from '../grantActions';
import { parseJsonObject } from '../util/beneficiaryGrant';

const MUTATION_SUCCESS = 2;
const APPROVED = 'APPROVED';
const FAILED = 'FAILED';
const ACCEPTED = 'ACCEPTED';

const useStyles = makeStyles((theme) => ({
  paper: theme.paper.paper,
  item: theme.paper.item,
  current: { color: theme.palette.text.secondary },
}));

// The rows a plan approval task holds: one for a form submission, one per beneficiary
// for an upload file.
const approvalRows = (task) => {
  const data = parseJsonObject(task?.data);
  if (Array.isArray(data.rows)) return data.rows;
  return [{
    id: task?.entityId, label: data.label, incoming_data: data.incoming_data, current_data: data.current_data,
  }];
};

function PlanApprovalTaskPreview({ task }) {
  const classes = useStyles();
  const modulesManager = useModulesManager();
  const { formatMessage: t } = useTranslations(MODULE_NAME, modulesManager);
  const rows = approvalRows(task);
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row.incoming_data || {})))];

  const display = (key, value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (key === 'grant_types' && Array.isArray(value)) {
      return value.map((type) => t(`beneficiaryGrant.grantType.${type}`)).join(', ');
    }
    return String(value);
  };

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('beneficiaryGrant.task.beneficiary')}</TableCell>
            {keys.map((key) => <TableCell key={key}>{t(`beneficiaryGrant.field.${key}`)}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.label || row.id}</TableCell>
              {keys.map((key) => {
                const proposed = (row.incoming_data || {})[key];
                const current = (row.current_data || {})[key];
                const inProposal = Object.prototype.hasOwnProperty.call(row.incoming_data || {}, key);
                return (
                  <TableCell key={key}>
                    {inProposal ? <strong>{display(key, proposed)}</strong> : display(key, current)}
                    {inProposal && JSON.stringify(proposed) !== JSON.stringify(current) && (
                      <div className={classes.current}>
                        {t('beneficiaryGrant.task.current')}
                        {' '}
                        {display(key, current)}
                      </div>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// Approve or reject a plan approval task. A rejection needs a reason, which the
// backend records on each beneficiary.
function PlanApprovalConfirmationPanel({ defaultDisabled }) {
  const classes = useStyles();
  const dispatch = useDispatch();
  const history = useHistory();
  const modulesManager = useModulesManager();
  const { formatMessage: t } = useTranslations(MODULE_NAME, modulesManager);
  const task = useSelector((state) => state.tasksManagement?.task);
  const user = useSelector((state) => state.core?.user);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const disabled = defaultDisabled || saving || task?.status !== ACCEPTED;

  const resolve = async () => {
    const chosen = decision;
    setDecision(null);
    setSaving(true);
    setNotice(null);
    try {
      const result = await dispatch(resolvePlanApproval({
        task, user, decision: chosen, reason: chosen === FAILED ? reason.trim() : null,
        label: t('beneficiaryGrant.task.resolveLabel'),
      }));
      if (result?.status !== MUTATION_SUCCESS) {
        const messages = mutationErrorMessages(result);
        setNotice(messages.length ? messages.join(' ') : t('beneficiaryGrant.saveError'));
        setSaving(false);
        return;
      }
      history.goBack();
    } catch (error) {
      setNotice(t('beneficiaryGrant.saveError'));
      setSaving(false);
    }
  };

  return (
    <Paper className={classes.paper}>
      <Grid container className={classes.item} alignItems="center">
        <Grid item xs={8} className={classes.item}>
          <TextAreaInput
            module={MODULE_NAME}
            label="beneficiaryGrant.field.plan_rejection_reason"
            rows={2}
            readOnly={disabled}
            value={reason}
            inputProps={{ maxLength: 1000 }}
            onChange={setReason}
          />
        </Grid>
        <Grid item xs={4} className={classes.item}>
          <Button disabled={disabled || !reason.trim()} onClick={() => setDecision(FAILED)}>
            {t('beneficiaryGrant.task.reject')}
          </Button>
          <Button variant="contained" color="primary" disabled={disabled} onClick={() => setDecision(APPROVED)}>
            {t('beneficiaryGrant.task.approve')}
          </Button>
        </Grid>
        {notice && (
          <Grid item xs={12} className={classes.item}>
            <Typography color="error" role="alert">{notice}</Typography>
          </Grid>
        )}
      </Grid>
      <Dialog open={Boolean(decision)} onClose={() => setDecision(null)}>
        <DialogTitle>{t('beneficiaryGrant.task.confirmTitle')}</DialogTitle>
        <DialogContent>
          {t(decision === FAILED ? 'beneficiaryGrant.task.confirmReject' : 'beneficiaryGrant.task.confirmApprove')}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)}>{t('beneficiaryGrant.task.cancel')}</Button>
          <Button color="primary" variant="contained" onClick={resolve}>{t('beneficiaryGrant.task.confirm')}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export { PlanApprovalTaskPreview, PlanApprovalConfirmationPanel };
