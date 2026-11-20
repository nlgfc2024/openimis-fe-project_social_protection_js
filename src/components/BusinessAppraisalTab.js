import React, { useMemo } from 'react';
import {
  Checkbox, FormControl, FormControlLabel, FormGroup, FormHelperText, FormLabel,
} from '@material-ui/core';
import {
  AmountInput, PublishedComponent, SelectInput, TextAreaInput, TextInput, useModulesManager, useTranslations,
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

export function BusinessAppraisalTabPanel({
  value, rights = [], beneficiary, groupBeneficiaries, benefitPlan,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage: t, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);
  const form = useBeneficiaryJsonExt({
    beneficiary, groupBeneficiaries, inputKeys: APPRAISAL_INPUT_KEYS, mutationLabel: t('beneficiaryGrant.mutationLabel'),
  });
  const { draft, saved, change } = form;
  const { jsonExt, errors, tranches } = useMemo(() => computeAppraisal({
    saved, draft, benefitPlan, today: form.today, approver: form.userName,
  }), [saved, draft, benefitPlan, form.today, form.userName]);

  if (!form.target || !canSeeGrantTabs(rights)) return null;

  const readOnly = !canEditWith(rights, RIGHT_PLANS_AND_GRANTS) || form.saving;
  const perBeneficiary = recordsGrantPerBeneficiary(benefitPlan);
  const allowed = allowedGrantTypes(benefitPlan);
  const selected = Array.isArray(draft.grant_types) ? draft.grant_types : [];
  const hasCash = selected.includes(CASH);
  const dirty = !sameJsonExt(saved, jsonExt);
  // Errors show once the user changes something, not on a record still to be appraised.
  const error = (key) => (!readOnly && dirty ? errorText(errors, key, t, formatMessageWithValues) : null);
  const inKindError = error('inKind');

  const toggleType = (type, checked) => change(
    'grant_types',
    allowed.filter((item) => (item === type ? checked : selected.includes(item))),
  );

  return (
    <GrantTabForm
      value={value}
      tabValue={BUSINESS_APPRAISAL_TAB_VALUE}
      title="beneficiaryGrant.businessAppraisal.title"
      readOnly={readOnly}
      dirty={dirty}
      valid={!Object.keys(errors).length}
      saving={form.saving}
      notice={form.notice}
      onSave={() => form.save(jsonExt, t)}
      onReset={form.reset}
      formatMessage={t}
    >
      {perBeneficiary ? (
        <GrantFieldGroup title="beneficiaryGrant.section.grant" formatMessage={t} divider={false}>
          <FieldCell wide>
            <FormControl component="fieldset" error={Boolean(error('grant_types'))} required>
              <FormLabel component="legend">{t(fieldLabel('grant_types'))}</FormLabel>
              <FormGroup row>
                {allowed.map((type) => (
                  <FormControlLabel
                    key={type}
                    label={t(`beneficiaryGrant.grantType.${type}`)}
                    control={(
                      <Checkbox
                        color="primary"
                        disabled={readOnly}
                        checked={selected.includes(type)}
                        onChange={(event) => toggleType(type, event.target.checked)}
                      />
                    )}
                  />
                ))}
              </FormGroup>
              {error('grant_types') && <FormHelperText>{error('grant_types')}</FormHelperText>}
            </FormControl>
          </FieldCell>
          <FieldCell>
            <AmountInput
              module={MODULE_NAME}
              label={fieldLabel('approved_grant_amount')}
              required
              readOnly={readOnly}
              value={draft.approved_grant_amount ?? ''}
              error={error('approved_grant_amount')}
              onChange={(amount) => change('approved_grant_amount', amount)}
            />
          </FieldCell>
          {IN_KIND_TYPES.filter((type) => selected.includes(type)).map((type) => {
            const key = trancheAmountKey(1, type);
            return (
              <FieldCell key={key}>
                <AmountInput
                  module={MODULE_NAME}
                  label={fieldLabel(`${type.toLowerCase()}_amount`)}
                  required
                  readOnly={readOnly}
                  displayZero
                  value={draft[key] ?? ''}
                  error={error(key) || inKindError}
                  onChange={(amount) => change(key, amount)}
                />
              </FieldCell>
            );
          })}
        </GrantFieldGroup>
      ) : null}
      {perBeneficiary && selected.length > 0 && (
        <GrantFieldGroup
          title="beneficiaryGrant.section.tranches"
          hint={t(hasCash ? 'beneficiaryGrant.section.tranches.cashHint' : 'beneficiaryGrant.section.tranches.inKindHint')}
          formatMessage={t}
        >
          {(hasCash ? [[1, CASH], [2, CASH]] : []).map(([tranche, type]) => {
            const key = trancheAmountKey(tranche, type);
            return (
              <FieldCell key={key}>
                <AmountInput
                  module={MODULE_NAME}
                  label={fieldLabel(key)}
                  readOnly
                  displayZero
                  value={tranches ? tranches[tranche][type] / 100 : ''}
                  onChange={() => {}}
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
