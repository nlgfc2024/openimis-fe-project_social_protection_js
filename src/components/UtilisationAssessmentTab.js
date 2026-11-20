import React, { useMemo } from 'react';
import {
  NumberInput, PublishedComponent, SelectInput, TextAreaInput, TextInput, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import { MODULE_NAME, RIGHT_UTILIZATION_ASSESSMENT, UTILISATION_ASSESSMENT_TAB_VALUE } from '../constants';
import {
  computeUtilisation, sameJsonExt, usesYesNoUtilization, UTILISATION_INPUT_KEYS, utilizationResultKey, YES_NO,
} from '../util/beneficiaryGrant';
import {
  canEditWith, canSeeGrantTabs, errorText, FieldCell, GrantFieldGroup, GrantTabForm, GrantTabLabel,
  useBeneficiaryJsonExt,
} from './beneficiaryGrant/BeneficiaryJsonExtForm';

export function UtilisationAssessmentTabLabel(props) {
  return (
    <GrantTabLabel
      {...props}
      tabValue={UTILISATION_ASSESSMENT_TAB_VALUE}
      labelKey="beneficiaryGrant.tab.utilisationAssessment"
    />
  );
}

const fieldLabel = (key) => `beneficiaryGrant.field.${key}`;

export function UtilisationAssessmentTabPanel({
  value, rights = [], beneficiary, groupBeneficiaries, benefitPlan,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage: t, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);
  const form = useBeneficiaryJsonExt({
    beneficiary,
    groupBeneficiaries,
    inputKeys: UTILISATION_INPUT_KEYS,
    mutationLabel: t('beneficiaryGrant.utilisationMutationLabel'),
  });
  const { draft, saved, change } = form;
  const { jsonExt, errors } = useMemo(() => computeUtilisation({
    saved, draft, benefitPlan, today: form.today, assessor: form.userName,
  }), [saved, draft, benefitPlan, form.today, form.userName]);

  if (!form.target || !canSeeGrantTabs(rights)) return null;

  const readOnly = !canEditWith(rights, RIGHT_UTILIZATION_ASSESSMENT) || form.saving;
  const dirty = !sameJsonExt(saved, jsonExt);
  const resultKey = utilizationResultKey(benefitPlan);
  const error = (key) => (!readOnly && dirty ? errorText(errors, key, t, formatMessageWithValues) : null);
  const assessed = jsonExt.utilization_assessed_on || jsonExt.utilization_assessed_by;

  return (
    <GrantTabForm
      value={value}
      tabValue={UTILISATION_ASSESSMENT_TAB_VALUE}
      readOnly={readOnly}
      dirty={dirty}
      valid={!Object.keys(errors).length}
      saving={form.saving}
      notice={form.notice}
      onSave={() => form.save(jsonExt, t)}
      onReset={form.reset}
      formatMessage={t}
    >
      <GrantFieldGroup divider={false} formatMessage={t}>
        <FieldCell>
          {usesYesNoUtilization(benefitPlan) ? (
            <SelectInput
              module={MODULE_NAME}
              label={fieldLabel(resultKey)}
              readOnly={readOnly}
              value={draft[resultKey] ?? ''}
              options={YES_NO.map((option) => ({ value: option, label: t(`beneficiaryGrant.yesNo.${option}`) }))}
              onChange={(result) => change(resultKey, result)}
            />
          ) : (
            <NumberInput
              module={MODULE_NAME}
              label={fieldLabel(resultKey)}
              min={0}
              max={100}
              displayZero
              readOnly={readOnly}
              value={draft[resultKey] ?? ''}
              error={error(resultKey)}
              onChange={(result) => change(resultKey, result)}
            />
          )}
        </FieldCell>
        {assessed && (
          <FieldCell>
            <PublishedComponent
              pubRef="core.DatePicker"
              module={MODULE_NAME}
              label={fieldLabel('utilization_assessed_on')}
              readOnly
              value={jsonExt.utilization_assessed_on || null}
              onChange={() => {}}
            />
          </FieldCell>
        )}
        {assessed && (
          <FieldCell>
            <TextInput
              module={MODULE_NAME}
              label={fieldLabel('utilization_assessed_by')}
              readOnly
              value={jsonExt.utilization_assessed_by ?? ''}
              onChange={() => {}}
            />
          </FieldCell>
        )}
        <FieldCell wide>
          <TextAreaInput
            module={MODULE_NAME}
            label={fieldLabel('utilization_notes')}
            readOnly={readOnly}
            rows={3}
            value={draft.utilization_notes ?? ''}
            inputProps={{ maxLength: 1000 }}
            onChange={(notes) => change('utilization_notes', notes)}
          />
        </FieldCell>
      </GrantFieldGroup>
    </GrantTabForm>
  );
}
