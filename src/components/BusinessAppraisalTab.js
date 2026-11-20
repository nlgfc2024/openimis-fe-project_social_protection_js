import React, { useMemo } from 'react';
import { Grid } from '@material-ui/core';
import {
  Autocomplete, NumberInput, PublishedComponent, TextAreaInput, TextInput, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import { BUSINESS_APPRAISAL_TAB_VALUE, MODULE_NAME, RIGHT_PLANS_AND_GRANTS } from '../constants';
import {
  allowedGrantTypes, APPRAISAL_INPUT_KEYS, APPROVED, computeAppraisal, IN_KIND_TYPES, PLAN_STATUSES,
  recordsGrantPerBeneficiary, REJECTED, sameJsonExt, trancheAmountKey,
} from '../util/beneficiaryGrant';
import {
  canEditWith, canSeeGrantTabs, errorText, GrantTabForm, GrantTabLabel, useBeneficiaryJsonExt, useGrantTabStyles,
} from './beneficiaryGrant/BeneficiaryJsonExtForm';

export function BusinessAppraisalTabLabel(props) {
  return (
    <GrantTabLabel {...props} tabValue={BUSINESS_APPRAISAL_TAB_VALUE} labelKey="beneficiaryGrant.tab.businessAppraisal" />
  );
}

const fieldLabel = (key) => `beneficiaryGrant.field.${key}`;

export function BusinessAppraisalTabPanel({
  value, rights = [], beneficiary, groupBeneficiaries, benefitPlan,
}) {
  const classes = useGrantTabStyles();
  const modulesManager = useModulesManager();
  const { formatMessage: t, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);
  const form = useBeneficiaryJsonExt({
    beneficiary, groupBeneficiaries, inputKeys: APPRAISAL_INPUT_KEYS, mutationLabel: t('beneficiaryGrant.mutationLabel'),
  });
  const { draft, saved, change } = form;
  const { jsonExt, errors } = useMemo(() => computeAppraisal({
    saved, draft, benefitPlan, today: form.today, approver: form.userName,
  }), [saved, draft, benefitPlan, form.today, form.userName]);

  if (!form.target || !canSeeGrantTabs(rights)) return null;

  const readOnly = !canEditWith(rights, RIGHT_PLANS_AND_GRANTS) || form.saving;
  const allowed = allowedGrantTypes(benefitPlan);
  const typeOptions = allowed.map((type) => ({ id: type, label: t(`beneficiaryGrant.grantType.${type}`) }));
  const selected = Array.isArray(draft.grant_types) ? allowed.filter((type) => draft.grant_types.includes(type)) : [];
  const statusOptions = PLAN_STATUSES.map((status) => ({ id: status, label: t(`beneficiaryGrant.status.${status}`) }));
  const dirty = !sameJsonExt(saved, jsonExt);
  // Errors show once the user changes something, not on a record still to be appraised.
  const error = (key) => (!readOnly && dirty ? errorText(errors, key, t, formatMessageWithValues) : null);

  return (
    <GrantTabForm
      value={value}
      tabValue={BUSINESS_APPRAISAL_TAB_VALUE}
      readOnly={readOnly}
      dirty={dirty}
      valid={!Object.keys(errors).length}
      saving={form.saving}
      notice={form.notice}
      onSave={() => form.save(jsonExt, t)}
      onReset={form.reset}
      formatMessage={t}
    >
      {recordsGrantPerBeneficiary(benefitPlan) && (
        <>
          <Grid item xs={4} className={classes.item}>
            <Autocomplete
              multiple
              required
              readOnly={readOnly}
              label={t(fieldLabel('grant_types'))}
              withPlaceholder={false}
              filterSelectedOptions
              options={typeOptions}
              value={typeOptions.filter((option) => selected.includes(option.id))}
              onChange={(chosen) => change('grant_types', (chosen || []).map((option) => option.id))}
              onInputChange={() => {}}
            />
          </Grid>
          <Grid item xs={4} className={classes.item}>
            <NumberInput
              module={MODULE_NAME}
              label={fieldLabel('approved_grant_amount')}
              required
              min={0}
              readOnly={readOnly}
              value={draft.approved_grant_amount ?? ''}
              error={error('approved_grant_amount')}
              onChange={(amount) => change('approved_grant_amount', amount)}
            />
          </Grid>
          {IN_KIND_TYPES.filter((type) => selected.includes(type)).map((type) => {
            const key = trancheAmountKey(1, type);
            return (
              <Grid item xs={4} className={classes.item} key={key}>
                <NumberInput
                  module={MODULE_NAME}
                  label={fieldLabel(`${type.toLowerCase()}_amount`)}
                  required
                  min={0}
                  displayZero
                  readOnly={readOnly}
                  value={draft[key] ?? ''}
                  error={error(key) || error('inKind')}
                  onChange={(amount) => change(key, amount)}
                />
              </Grid>
            );
          })}
        </>
      )}
      <Grid item xs={4} className={classes.item}>
        <Autocomplete
          readOnly={readOnly}
          label={t(fieldLabel('business_plan_status'))}
          withPlaceholder={false}
          options={statusOptions}
          value={statusOptions.find((option) => option.id === draft.business_plan_status) ?? null}
          onChange={(option) => change('business_plan_status', option?.id)}
          onInputChange={() => {}}
        />
      </Grid>
      {jsonExt.business_plan_status === APPROVED && (
        <>
          <Grid item xs={3} className={classes.item}>
            <PublishedComponent
              pubRef="core.DatePicker"
              module={MODULE_NAME}
              label={fieldLabel('plan_approved_on')}
              readOnly
              value={jsonExt.plan_approved_on || null}
              onChange={() => {}}
            />
          </Grid>
          <Grid item xs={3} className={classes.item}>
            <TextInput
              module={MODULE_NAME}
              label={fieldLabel('plan_approved_by')}
              readOnly
              value={jsonExt.plan_approved_by ?? ''}
              onChange={() => {}}
            />
          </Grid>
        </>
      )}
      {draft.business_plan_status === REJECTED && (
        <Grid item xs={12} className={classes.item}>
          <TextAreaInput
            module={MODULE_NAME}
            label={fieldLabel('plan_rejection_reason')}
            required
            readOnly={readOnly}
            rows={3}
            value={draft.plan_rejection_reason ?? ''}
            error={error('plan_rejection_reason')}
            inputProps={{ maxLength: 1000 }}
            onChange={(reason) => change('plan_rejection_reason', reason)}
          />
        </Grid>
      )}
    </GrantTabForm>
  );
}
