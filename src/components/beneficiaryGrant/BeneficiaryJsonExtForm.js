import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button, Divider, Grid, Tab, Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { formatMessage, useModulesManager } from '@openimis/fe-core';
import {
  MODULE_NAME,
  RIGHT_PLAN_APPROVAL,
  RIGHT_PLANS_AND_GRANTS,
  RIGHT_UTILIZATION_ASSESSMENT,
} from '../../constants';
import {
  fetchBeneficiaryJsonExt, fetchPendingPlanApproval, mutationErrorMessages, recordUtilisationAssessment,
  submitBeneficiaryPlan,
} from '../../grantActions';
import {
  localIsoDate, parseJsonObject, pickKeys, userDisplayName,
} from '../../util/beneficiaryGrant';
import { isTrainingDeployment } from '../../util/projectDeployment';

const MUTATION_SUCCESS = 2;

// Both tabs exist only on a training deployment (the backend's project_type, as for
// the Training menu; a WORK deployment such as PWP never shows them). There they are
// shown to anyone who enters, approves or assesses grants; each tab is editable only
// with its own right.
export const canSeeGrantTabs = (rights = [], modulesManager) => isTrainingDeployment(modulesManager)
  && (rights.includes(RIGHT_PLANS_AND_GRANTS) || rights.includes(RIGHT_PLAN_APPROVAL)
    || rights.includes(RIGHT_UTILIZATION_ASSESSMENT));


export function GrantTabLabel({
  intl, rights, onChange, tabStyle, isSelected, tabValue, labelKey,
}) {
  const modulesManager = useModulesManager();
  if (!canSeeGrantTabs(rights, modulesManager)) return null;
  return (
    <Tab
      onChange={onChange}
      className={tabStyle(tabValue)}
      selected={isSelected(tabValue)}
      value={tabValue}
      label={formatMessage(intl, MODULE_NAME, labelKey)}
    />
  );
}

// The beneficiary (UMEP) or household beneficiary (UPG, RMEP) the page shows, its
// saved jsonExt, the draft of the keys this tab enters, recording the utilisation
// assessment or submitting grant details for approval, and, with withApproval, the
// approval waiting for it. Responses that arrive after the page moved to another
// beneficiary are ignored.
export const useBeneficiaryJsonExt = ({
  beneficiary, groupBeneficiaries, inputKeys, mutationLabel, withApproval = false,
}) => {
  const dispatch = useDispatch();
  const modulesManager = useModulesManager();
  const user = useSelector((state) => state.core?.user);
  const isGroup = Boolean(groupBeneficiaries);
  const target = groupBeneficiaries || beneficiary;
  const [saved, setSaved] = useState(() => parseJsonObject(target?.jsonExt));
  const [draft, setDraft] = useState(() => pickKeys(saved, inputKeys));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(null);
  const shownId = useRef(target?.id);
  shownId.current = target?.id;
  const stillShown = (id) => shownId.current === id;

  const loadPending = async (id) => {
    if (!withApproval || !id || !isTrainingDeployment(modulesManager)) return;
    const response = await dispatch(fetchPendingPlanApproval({ isGroup, id }));
    if (!stillShown(id)) return;
    const approval = response?.payload?.data?.pendingBeneficiaryPlanApproval;
    setPending(approval ? { ...approval, incomingData: parseJsonObject(approval.incomingData) } : null);
  };

  useEffect(() => {
    setPending(null);
    setNotice(null);
    loadPending(target?.id);
  }, [target?.id]);

  const restart = (jsonExt) => {
    setSaved(jsonExt);
    setDraft(pickKeys(jsonExt, inputKeys));
  };

  useEffect(() => restart(parseJsonObject(target?.jsonExt)), [target?.id, target?.jsonExt]);

  const change = (key, value) => {
    setNotice(null);
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const reset = () => {
    setNotice(null);
    restart(saved);
  };

  const fetchCurrent = async (id) => {
    const response = await dispatch(fetchBeneficiaryJsonExt({ isGroup, id }));
    const node = response?.payload?.data?.[isGroup ? 'groupBeneficiary' : 'beneficiary']?.edges?.[0]?.node;
    return node ? parseJsonObject(node.jsonExt) : null;
  };

  // Runs a mutation for the beneficiary shown now; onSuccess runs only while it is
  // still the one shown.
  const run = async (mutate, onSuccess, t) => {
    const id = target.id;
    setSaving(true);
    setNotice(null);
    try {
      const result = await dispatch(mutate());
      if (!stillShown(id)) return;
      if (result?.status !== MUTATION_SUCCESS) {
        const messages = mutationErrorMessages(result);
        setNotice({ error: true, text: messages.length ? messages.join(' ') : t('beneficiaryGrant.saveError') });
        return;
      }
      await onSuccess(id);
    } catch (error) {
      if (stillShown(id)) setNotice({ error: true, text: t('beneficiaryGrant.saveError') });
    } finally {
      if (stillShown(id)) setSaving(false);
    }
  };

  // Sends only the assessment values; the backend merges them into the current record.
  const record = (values, t) => run(
    () => recordUtilisationAssessment({
      isGroup, beneficiary: target, values, label: mutationLabel,
    }),
    async (id) => {
      const current = await fetchCurrent(id);
      if (!stillShown(id) || !current) return;
      restart(current);
      // An update that needs approval succeeds as a task and leaves the record as it was.
      const applied = Object.entries(values).every(([key, value]) => (value === null
        ? current[key] === undefined : JSON.stringify(current[key]) === JSON.stringify(value)));
      setNotice({ error: false, text: t(applied ? 'beneficiaryGrant.saved' : 'beneficiaryGrant.savedForApproval') });
    },
    t,
  );

  const submit = (proposal, t) => run(
    () => submitBeneficiaryPlan({
      isGroup, beneficiary: target, proposal, label: mutationLabel,
    }),
    async (id) => {
      await loadPending(id);
      if (stillShown(id)) setNotice({ error: false, text: t('beneficiaryGrant.submitted') });
    },
    t,
  );

  return {
    target, saved, draft, change, reset, record, submit, saving, notice, pending,
    today: localIsoDate(), userName: userDisplayName(user),
  };
};

export const useGrantTabStyles = makeStyles((theme) => ({
  item: theme.paper.item,
}));

// One tab of the beneficiary page: its fields, as grid items, and the save actions
// for users who may edit. It renders its own tab panel, without the padding
// policyHolder.TabPanel adds.
export function GrantTabForm({
  value, tabValue, readOnly, dirty, valid, saving, notice, onSave, onReset, formatMessage: t, children,
  actionLabel = 'beneficiaryGrant.save', banner = null,
}) {
  const classes = useGrantTabStyles();
  if (value !== tabValue) return null;
  return (
    <div role="tabpanel">
      <Grid container className={classes.item}>
        {(banner || readOnly) && (
          <Grid item xs={12} className={classes.item}>
            <Typography variant="caption" color="textSecondary">{banner || t('beneficiaryGrant.readOnly')}</Typography>
          </Grid>
        )}
        {children}
      </Grid>
      {(!readOnly || notice) && (
        <>
          <Divider />
          <Grid container className={classes.item} alignItems="center" justify="flex-end">
            {notice && (
              <Grid item className={classes.item}>
                <Typography color={notice.error ? 'error' : 'primary'} role={notice.error ? 'alert' : 'status'}>
                  {notice.text}
                </Typography>
              </Grid>
            )}
            {!readOnly && (
              <Grid item className={classes.item}>
                <Button disabled={!dirty || saving} onClick={onReset}>{t('beneficiaryGrant.reset')}</Button>
                <Button variant="contained" color="primary" disabled={!dirty || !valid || saving} onClick={onSave}>
                  {t(actionLabel)}
                </Button>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </div>
  );
}

// The message of a computed validation error, or null.
export const errorText = (errors, key, t, formatMessageWithValues) => {
  const error = errors[key];
  if (!error) return null;
  return error.values
    ? formatMessageWithValues(`beneficiaryGrant.error.${error.id}`, error.values)
    : t(`beneficiaryGrant.error.${error.id}`);
};
