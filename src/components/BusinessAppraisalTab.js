import React, { useMemo } from 'react';
import {
  Checkbox, FormControl, FormHelperText, InputLabel, ListItemText, MenuItem, Select,
} from '@material-ui/core';
import {
  NumberInput, PublishedComponent, SelectInput, TextAreaInput, TextInput, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import { BUSINESS_APPRAISAL_TAB_VALUE, MODULE_NAME, RIGHT_PLANS_AND_GRANTS } from '../constants';
import {
  allowedGrantTypes, APPRAISAL_INPUT_KEYS, APPROVED, CASH, computeAppraisal, IN_KIND_TYPES, PLAN_STATUSES,
  recordsGrantPerBeneficiary, REJECTED, sameJsonExt, trancheAmountKey,
} from '../util/beneficiaryGrant';
import {
  canEditWith, canSeeGrantTabs, errorText, FieldCell, GrantFieldGroup, GrantTabForm, GrantTabLabel,
  useBeneficiaryJsonExt,
} from './beneficiaryGrant/BeneficiaryJsonExtForm';

export function BusinessAppraisalTabLabel(props) {
  return (
    <GrantTabLabel {...props} tabValue={BUSINESS_APPRAISAL_TAB_VALUE} labelKey="beneficiaryGrant.tab.businessAppraisal" />
  );
}

const fieldLabel = (key) => `beneficiaryGrant.field.${key}`;

// The grant types as a multi-select, read-only like the core SelectInput.
function GrantTypesInput({
  allowed, value, readOnly, error, onChange, formatMessage: t,
}) {
  const typeLabel = (type) => t(`beneficiaryGrant.grantType.${type}`);
  if (readOnly) {
    return (
      <TextInput module={MODULE_NAME} label={fieldLabel('grant_types')} readOnly value={value.map(typeLabel).join(', ')} />
    );
  }
  return (
    <FormControl required fullWidth error={Boolean(error)}>
      <InputLabel shrink>{t(fieldLabel('grant_types'))}</InputLabel>
      <Select
        multiple
        displayEmpty
        value={value}
        renderValue={(selected) => selected.map(typeLabel).join(', ')}
        onChange={(event) => onChange(allowed.filter((type) => event.target.value.includes(type)))}
      >
        {allowed.map((type) => (
          <MenuItem key={type} value={type}>
            <Checkbox color="primary" checked={value.includes(type)} />
            <ListItemText primary={typeLabel(type)} />
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}

export function BusinessAppraisalTabPanel({
  value, rights = [], beneficiary, groupBeneficiaries, benefitPlan,
}) {
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
  const perBeneficiary = recordsGrantPerBeneficiary(benefitPlan);
  const allowed = allowedGrantTypes(benefitPlan);
  const selected = Array.isArray(draft.grant_types) ? allowed.filter((type) => draft.grant_types.includes(type)) : [];
  const dirty = !sameJsonExt(saved, jsonExt);
  // Errors show once the user changes something, not on a record still to be appraised.
  const error = (key) => (!readOnly && dirty ? errorText(errors, key, t, formatMessageWithValues) : null);
  const inKindTypes = IN_KIND_TYPES.filter((type) => selected.includes(type));
  let grantHint = null;
  if (inKindTypes.length) {
    grantHint = t(selected.includes(CASH) ? 'beneficiaryGrant.section.grant.cashHint' : 'beneficiaryGrant.section.grant.inKindHint');
  }

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
      {perBeneficiary && (
        <GrantFieldGroup title="beneficiaryGrant.section.grant" hint={grantHint} formatMessage={t} divider={false}>
          <FieldCell>
            <GrantTypesInput
              allowed={allowed}
              value={selected}
              readOnly={readOnly}
              error={error('grant_types')}
              onChange={(types) => change('grant_types', types)}
              formatMessage={t}
            />
          </FieldCell>
          <FieldCell>
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
          </FieldCell>
          {inKindTypes.map((type) => {
            const key = trancheAmountKey(1, type);
            return (
              <FieldCell key={key}>
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
              </FieldCell>
            );
          })}
        </GrantFieldGroup>
      )}
      <GrantFieldGroup
        title="beneficiaryGrant.section.businessPlan"
        hint={perBeneficiary ? null : t('beneficiaryGrant.section.businessPlan.planGrantHint')}
        formatMessage={t}
        divider={perBeneficiary}
      >
        <FieldCell>
          <TextInput
            module={MODULE_NAME}
            label={fieldLabel('business_plan_reference')}
            readOnly={readOnly}
            value={draft.business_plan_reference ?? ''}
            inputProps={{ maxLength: 255 }}
            onChange={(reference) => change('business_plan_reference', reference)}
          />
        </FieldCell>
        <FieldCell>
          <SelectInput
            module={MODULE_NAME}
            label={fieldLabel('business_plan_status')}
            readOnly={readOnly}
            value={draft.business_plan_status ?? ''}
            options={PLAN_STATUSES.map((status) => ({ value: status, label: t(`beneficiaryGrant.status.${status}`) }))}
            onChange={(status) => change('business_plan_status', status)}
          />
        </FieldCell>
        {jsonExt.business_plan_status === APPROVED && (
          <FieldCell>
            <PublishedComponent
              pubRef="core.DatePicker"
              module={MODULE_NAME}
              label={fieldLabel('plan_approved_on')}
              readOnly
              value={jsonExt.plan_approved_on || null}
              onChange={() => {}}
            />
          </FieldCell>
        )}
        {jsonExt.business_plan_status === APPROVED && (
          <FieldCell>
            <TextInput
              module={MODULE_NAME}
              label={fieldLabel('plan_approved_by')}
              readOnly
              value={jsonExt.plan_approved_by ?? ''}
              onChange={() => {}}
            />
          </FieldCell>
        )}
        {draft.business_plan_status === REJECTED && (
          <FieldCell wide>
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
          </FieldCell>
        )}
      </GrantFieldGroup>
    </GrantTabForm>
  );
}
