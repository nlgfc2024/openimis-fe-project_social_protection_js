import React, { useMemo } from 'react';
import { Grid } from '@material-ui/core';
import {
  Autocomplete, NumberInput, PublishedComponent, TextAreaInput, TextInput, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import { BUSINESS_APPRAISAL_TAB_VALUE, MODULE_NAME, RIGHT_PLANS_AND_GRANTS } from '../constants';
import {
  allowedGrantTypes, APPRAISAL_INPUT_KEYS, APPROVED, computeProposal, IN_KIND_TYPES, pickKeys,
  recordsGrantPerBeneficiary, REJECTED, trancheAmountKey,
} from '../util/beneficiaryGrant';
import {
  canSeeGrantTabs, errorText, GrantTabForm, GrantTabLabel, useBeneficiaryJsonExt, useGrantTabStyles,
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
  const { formatMessage: t, formatMessageWithValues, formatDateFromISO } = useTranslations(MODULE_NAME, modulesManager);
  const form = useBeneficiaryJsonExt({
    beneficiary,
    groupBeneficiaries,
    inputKeys: APPRAISAL_INPUT_KEYS,
    mutationLabel: t('beneficiaryGrant.mutationLabel'),
    withApproval: true,
  });
  const { saved, change, pending } = form;
  // While an approval waits, the tab shows what was submitted.
  const draft = pending ? pickKeys({ ...saved, ...pending.incomingData }, APPRAISAL_INPUT_KEYS) : form.draft;
  const { proposal, errors } = useMemo(
    () => computeProposal({ saved, draft, benefitPlan }),
    [saved, draft, benefitPlan],
  );

  if (!form.target || !canSeeGrantTabs(rights, modulesManager)) return null;

  // Submitting needs only the plans-and-grants right; the approval records the rest.
  const readOnly = !rights.includes(RIGHT_PLANS_AND_GRANTS) || Boolean(pending) || form.saving;
  const allowed = allowedGrantTypes(benefitPlan);
  const typeOptions = allowed.map((type) => ({ id: type, label: t(`beneficiaryGrant.grantType.${type}`) }));
  const selected = Array.isArray(draft.grant_types) ? allowed.filter((type) => draft.grant_types.includes(type)) : [];
  const dirty = !pending && Object.keys(proposal).length > 0;
  // Errors show once the user changes something, not on a record still to be appraised.
  const error = (key) => (!readOnly && dirty ? errorText(errors, key, t, formatMessageWithValues) : null);
  const status = saved.business_plan_status;
  const banner = pending && formatMessageWithValues('beneficiaryGrant.pendingApproval', {
    submittedBy: pending.submittedBy || '-',
    submittedOn: pending.submittedOn ? formatDateFromISO(pending.submittedOn) : '-',
  });

  return (
    <GrantTabForm
      value={value}
      tabValue={BUSINESS_APPRAISAL_TAB_VALUE}
      readOnly={readOnly}
      banner={banner}
      dirty={dirty}
      valid={!Object.keys(errors).length}
      saving={form.saving}
      notice={form.notice}
      actionLabel="beneficiaryGrant.submitForApproval"
      onSave={() => form.submit(proposal, t)}
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
        <TextInput
          module={MODULE_NAME}
          label={fieldLabel('business_plan_reference')}
          readOnly={readOnly}
          value={draft.business_plan_reference ?? ''}
          inputProps={{ maxLength: 255 }}
          onChange={(reference) => change('business_plan_reference', reference)}
        />
      </Grid>
      <Grid item xs={4} className={classes.item}>
        <TextInput
          module={MODULE_NAME}
          label={fieldLabel('business_plan_status')}
          readOnly
          value={status ? t(`beneficiaryGrant.status.${status}`) : ''}
        />
      </Grid>
      {status === APPROVED && (
        <>
          <Grid item xs={4} className={classes.item}>
            <PublishedComponent
              pubRef="core.DatePicker"
              module={MODULE_NAME}
              label={fieldLabel('plan_approved_on')}
              readOnly
              value={saved.plan_approved_on || null}
              onChange={() => {}}
            />
          </Grid>
          <Grid item xs={4} className={classes.item}>
            <TextInput module={MODULE_NAME} label={fieldLabel('plan_approved_by')} readOnly
              value={saved.plan_approved_by ?? ''} />
          </Grid>
        </>
      )}
      {status === REJECTED && (
        <Grid item xs={12} className={classes.item}>
          <TextAreaInput module={MODULE_NAME} label={fieldLabel('plan_rejection_reason')} readOnly rows={2}
            value={saved.plan_rejection_reason ?? ''} />
        </Grid>
      )}
    </GrantTabForm>
  );
}
