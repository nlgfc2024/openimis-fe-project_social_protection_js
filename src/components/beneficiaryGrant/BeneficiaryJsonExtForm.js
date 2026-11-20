import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button, Divider, Grid, Tab, Typography,
} from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { formatMessage } from '@openimis/fe-core';
import {
  MODULE_NAME,
  RIGHT_BENEFICIARY_DATA_UPDATE,
  RIGHT_BENEFICIARY_UPDATE,
  RIGHT_PLANS_AND_GRANTS,
  RIGHT_UTILIZATION_ASSESSMENT,
} from '../../constants';
import { fetchBeneficiaryJsonExt, mutationErrorMessages, saveBeneficiaryJsonExt } from '../../grantActions';
import {
  localIsoDate, parseJsonObject, pickKeys, sameJsonExt, userDisplayName,
} from '../../util/beneficiaryGrant';

const MUTATION_SUCCESS = 2;

// Both tabs are shown to anyone who records appraisals or assessments; each tab is
// editable only with its own right.
export const canSeeGrantTabs = (rights = []) => rights.includes(RIGHT_PLANS_AND_GRANTS)
  || rights.includes(RIGHT_UTILIZATION_ASSESSMENT);

// The update mutations also need social_protection's beneficiary and data rights.
export const canEditWith = (rights = [], right) => rights.includes(RIGHT_BENEFICIARY_UPDATE)
  && rights.includes(RIGHT_BENEFICIARY_DATA_UPDATE) && rights.includes(right);

export function GrantTabLabel({
  intl, rights, onChange, tabStyle, isSelected, tabValue, labelKey,
}) {
  if (!canSeeGrantTabs(rights)) return null;
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
// saved jsonExt, the draft of the keys this tab enters, and saving it.
export const useBeneficiaryJsonExt = ({
  beneficiary, groupBeneficiaries, inputKeys, mutationLabel,
}) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.core?.user);
  const isGroup = Boolean(groupBeneficiaries);
  const target = groupBeneficiaries || beneficiary;
  const [saved, setSaved] = useState(() => parseJsonObject(target?.jsonExt));
  const [draft, setDraft] = useState(() => pickKeys(saved, inputKeys));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

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

  const save = async (jsonExt, t) => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await dispatch(saveBeneficiaryJsonExt({
        isGroup, beneficiary: target, jsonExt, label: mutationLabel,
      }));
      if (result?.status !== MUTATION_SUCCESS) {
        const messages = mutationErrorMessages(result);
        setNotice({ error: true, text: messages.length ? messages.join(' ') : t('beneficiaryGrant.saveError') });
        return;
      }
      // An update that needs approval succeeds as a task and leaves the record as it was.
      const response = await dispatch(fetchBeneficiaryJsonExt({ isGroup, id: target.id }));
      const node = response?.payload?.data?.[isGroup ? 'groupBeneficiary' : 'beneficiary']?.edges?.[0]?.node;
      const current = node ? parseJsonObject(node.jsonExt) : saved;
      restart(current);
      setNotice({
        error: false,
        text: t(sameJsonExt(current, jsonExt) ? 'beneficiaryGrant.saved' : 'beneficiaryGrant.pendingApproval'),
      });
    } catch (error) {
      setNotice({ error: true, text: t('beneficiaryGrant.saveError') });
    } finally {
      setSaving(false);
    }
  };

  return {
    target, saved, draft, change, reset, save, saving, notice,
    today: localIsoDate(), userName: userDisplayName(user),
  };
};

const styles = (theme) => ({
  tableTitle: theme.table.title,
  item: theme.paper.item,
});

// One tab of the beneficiary page laid out like the other forms: a title bar, the
// field groups, and the save actions for users who may edit. It renders its own tab
// panel, without the padding policyHolder.TabPanel adds, so the title bar spans the
// tab like the other forms' title bars.
function GrantTabFormBase({
  classes, value, tabValue, title, readOnly, dirty, valid, saving, notice, onSave, onReset, formatMessage: t,
  children,
}) {
  if (value !== tabValue) return null;
  return (
    <div role="tabpanel">
      <Grid container className={classes.tableTitle}>
        <Grid item xs={12} className={classes.tableTitle}>
          <Typography>{t(title)}</Typography>
        </Grid>
      </Grid>
      {readOnly && (
        <Grid container className={classes.item}>
          <Grid item xs={12} className={classes.item}>
            <Typography variant="caption" color="textSecondary">{t('beneficiaryGrant.readOnly')}</Typography>
          </Grid>
        </Grid>
      )}
      {children}
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
                  {t('beneficiaryGrant.save')}
                </Button>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </div>
  );
}

export const GrantTabForm = withStyles(styles)(GrantTabFormBase);

// A titled group of fields within a tab.
function GrantFieldGroupBase({
  classes, title, hint, children, formatMessage: t, divider = true,
}) {
  return (
    <>
      {divider && <Divider />}
      <Grid container className={classes.item}>
        {title && (
          <Grid item xs={12} className={classes.item}>
            <Typography variant="subtitle2">{t(title)}</Typography>
            {hint && <Typography variant="caption" color="textSecondary">{hint}</Typography>}
          </Grid>
        )}
        {children}
      </Grid>
    </>
  );
}

export const GrantFieldGroup = withStyles(styles)(GrantFieldGroupBase);

function FieldCellBase({ classes, wide, children }) {
  return <Grid item xs={wide ? 12 : 3} className={classes.item}>{children}</Grid>;
}

export const FieldCell = withStyles(styles)(FieldCellBase);

// The message of a computed validation error, or null.
export const errorText = (errors, key, t, formatMessageWithValues) => {
  const error = errors[key];
  if (!error) return null;
  return error.values
    ? formatMessageWithValues(`beneficiaryGrant.error.${error.id}`, error.values)
    : t(`beneficiaryGrant.error.${error.id}`);
};
