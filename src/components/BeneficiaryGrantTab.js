import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Button, Checkbox, FormControlLabel, FormGroup, FormLabel, Grid, Tab, Typography,
} from '@material-ui/core';
import {
  formatMessage, NumberInput, PublishedComponent, SelectInput, TextInput, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import {
  BENEFICIARY_GRANT_TAB_VALUE,
  MODULE_NAME,
  RIGHT_BENEFICIARY_DATA_UPDATE,
  RIGHT_BENEFICIARY_UPDATE,
  RIGHT_PLANS_AND_GRANTS,
  RIGHT_UTILIZATION_ASSESSMENT,
} from '../constants';
import { fetchBeneficiaryJsonExt, mutationErrorMessages, saveBeneficiaryJsonExt } from '../grantActions';
import {
  mergedJsonExt, parseJsonObject, planFields, sameJsonExt, utilizationFields,
} from '../util/beneficiaryGrant';

const MUTATION_SUCCESS = 2;

const canSeeGrantTab = (rights = []) => rights.includes(RIGHT_PLANS_AND_GRANTS)
  || rights.includes(RIGHT_UTILIZATION_ASSESSMENT);

function BeneficiaryGrantTabLabel({
  intl, rights, onChange, tabStyle, isSelected,
}) {
  if (!canSeeGrantTab(rights)) return null;
  return (
    <Tab
      onChange={onChange}
      className={tabStyle(BENEFICIARY_GRANT_TAB_VALUE)}
      selected={isSelected(BENEFICIARY_GRANT_TAB_VALUE)}
      value={BENEFICIARY_GRANT_TAB_VALUE}
      label={formatMessage(intl, MODULE_NAME, 'beneficiaryGrant.tab.label')}
    />
  );
}

function GrantField({
  field, value, readOnly, onChange, formatMessage: t,
}) {
  const label = `beneficiaryGrant.field.${field.key}`;
  switch (field.kind) {
    case 'grantTypes': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <FormGroup>
          <FormLabel component="legend">{t(label)}</FormLabel>
          <Grid container>
            {field.options.map((type) => (
              <FormControlLabel
                key={type}
                label={t(`beneficiaryGrant.grantType.${type}`)}
                control={(
                  <Checkbox
                    color="primary"
                    disabled={readOnly}
                    checked={selected.includes(type)}
                    onChange={(event) => onChange(event.target.checked
                      ? [...selected, type] : selected.filter((item) => item !== type))}
                  />
                )}
              />
            ))}
          </Grid>
        </FormGroup>
      );
    }
    case 'amount':
      return (
        <NumberInput module={MODULE_NAME} label={label} min={0} displayZero value={value ?? ''}
          readOnly={readOnly} onChange={onChange} />
      );
    case 'percentage':
      return (
        <NumberInput module={MODULE_NAME} label={label} min={0} max={100} displayZero value={value ?? ''}
          readOnly={readOnly} onChange={onChange} />
      );
    case 'choice': {
      const prefix = field.key === 'business_plan_status' ? 'beneficiaryGrant.status' : 'beneficiaryGrant.yesNo';
      return (
        <SelectInput module={MODULE_NAME} label={label} value={value ?? ''} readOnly={readOnly}
          options={field.options.map((option) => ({ value: option, label: t(`${prefix}.${option}`) }))}
          onChange={onChange} />
      );
    }
    case 'date':
      return (
        <PublishedComponent pubRef="core.DatePicker" module={MODULE_NAME} label={label} value={value || null}
          readOnly={readOnly} onChange={onChange} />
      );
    default:
      return (
        <TextInput module={MODULE_NAME} label={label} value={value ?? ''} readOnly={readOnly}
          inputProps={{ maxLength: 255 }} onChange={onChange} />
      );
  }
}

function GrantSection({
  title, fields, values, readOnly, onChange, formatMessage: t,
}) {
  return (
    <Grid container spacing={2} style={{ padding: 16 }}>
      <Grid item xs={12}>
        <Typography variant="h6">{t(title)}</Typography>
        {readOnly && <Typography variant="caption">{t('beneficiaryGrant.readOnly')}</Typography>}
      </Grid>
      {fields.map((field) => (
        <Grid item xs={field.kind === 'grantTypes' ? 12 : 3} key={field.key}>
          <GrantField field={field} value={values[field.key]} readOnly={readOnly}
            onChange={(value) => onChange(field.key, value)} formatMessage={t} />
        </Grid>
      ))}
    </Grid>
  );
}

function BeneficiaryGrantTabPanel({
  value, rights = [], beneficiary, groupBeneficiaries, benefitPlan,
}) {
  const dispatch = useDispatch();
  const modulesManager = useModulesManager();
  const { formatMessage: t } = useTranslations(MODULE_NAME, modulesManager);
  const isGroup = Boolean(groupBeneficiaries);
  const target = groupBeneficiaries || beneficiary;
  const [saved, setSaved] = useState(() => parseJsonObject(target?.jsonExt));
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setSaved(parseJsonObject(target?.jsonExt));
    setEdits({});
  }, [target?.id, target?.jsonExt]);

  const plan = useMemo(() => planFields(benefitPlan), [benefitPlan]);
  const utilization = useMemo(() => utilizationFields(benefitPlan), [benefitPlan]);
  // The update mutations also need social_protection's beneficiary and data rights.
  const canSave = rights.includes(RIGHT_BENEFICIARY_UPDATE) && rights.includes(RIGHT_BENEFICIARY_DATA_UPDATE);
  const canEditPlan = canSave && rights.includes(RIGHT_PLANS_AND_GRANTS);
  const canEditUtilization = canSave && rights.includes(RIGHT_UTILIZATION_ASSESSMENT);
  const editable = [...(canEditPlan ? plan : []), ...(canEditUtilization ? utilization : [])];
  const values = { ...saved, ...edits };
  const next = mergedJsonExt(saved, edits, editable);
  const dirty = !sameJsonExt(saved, next);

  if (!target || !canSeeGrantTab(rights)) return null;

  const onChange = (key, fieldValue) => {
    setNotice(null);
    setEdits((previous) => ({ ...previous, [key]: fieldValue }));
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await dispatch(saveBeneficiaryJsonExt({
        isGroup, beneficiary: target, jsonExt: next, label: t('beneficiaryGrant.mutationLabel'),
      }));
      if (result?.status !== MUTATION_SUCCESS) {
        const messages = mutationErrorMessages(result);
        setNotice({ error: true, text: messages.length ? messages.join(' ') : t('beneficiaryGrant.saveError') });
        return;
      }
      // An update that needs approval succeeds as a task and leaves the record as it was.
      const response = await dispatch(fetchBeneficiaryJsonExt({ isGroup, id: target.id }));
      const node = response?.payload?.data?.[isGroup ? 'groupBeneficiary' : 'beneficiary']?.edges?.[0]?.node;
      const current = parseJsonObject(node?.jsonExt);
      const applied = sameJsonExt(current, next);
      setSaved(node ? current : saved);
      setEdits({});
      setNotice({ error: false, text: t(applied ? 'beneficiaryGrant.saved' : 'beneficiaryGrant.pendingApproval') });
    } catch (error) {
      setNotice({ error: true, text: t('beneficiaryGrant.saveError') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PublishedComponent
      pubRef="policyHolder.TabPanel"
      module={MODULE_NAME}
      index={BENEFICIARY_GRANT_TAB_VALUE}
      value={value}
    >
      <GrantSection title="beneficiaryGrant.plan.title" fields={plan} values={values}
        readOnly={!canEditPlan || saving} onChange={onChange} formatMessage={t} />
      <GrantSection title="beneficiaryGrant.utilization.title" fields={utilization} values={values}
        readOnly={!canEditUtilization || saving} onChange={onChange} formatMessage={t} />
      <Grid container spacing={2} style={{ padding: 16 }} alignItems="center">
        {(canEditPlan || canEditUtilization) && (
          <Grid item>
            <Button variant="contained" color="primary" disabled={!dirty || saving} onClick={save}>
              {t('beneficiaryGrant.save')}
            </Button>
            <Button disabled={!dirty || saving} onClick={() => { setEdits({}); setNotice(null); }}>
              {t('beneficiaryGrant.reset')}
            </Button>
          </Grid>
        )}
        {notice && (
          <Grid item>
            <Typography color={notice.error ? 'error' : 'primary'} role={notice.error ? 'alert' : 'status'}>
              {notice.text}
            </Typography>
          </Grid>
        )}
      </Grid>
    </PublishedComponent>
  );
}

export { BeneficiaryGrantTabLabel, BeneficiaryGrantTabPanel };
