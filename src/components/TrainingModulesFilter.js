import React from 'react';
import { Filter, PublishedComponent, decodeId, useTranslations, useModulesManager } from '@openimis/fe-core';
import { MODULE_NAME, BENEFIT_PLAN_TYPE } from '../constants';

export default function TrainingModulesFilter({ filters, onChangeFilters }) {
  const manager = useModulesManager();
  const { formatMessage: t } = useTranslations(MODULE_NAME, manager);
  return (
    <Filter moduleName={MODULE_NAME} filters={filters} onChangeFilters={onChangeFilters}
      filterFields={[]} checkboxFields={[]}
      pickerFields={[{
        name: 'programme', component: PublishedComponent,
        props: {
          pubRef: 'socialProtection.BenefitPlanPicker',
          type: BENEFIT_PLAN_TYPE.EVERY_TYPE,
          label: t('trainingModules.programmes'),
          onChange: (value) => onChangeFilters([{
              id: 'programme', value,
              filter: value?.id ? `benefitPlans_Id: "${decodeId(value.id)}"` : null,
          }]),
        },
      }]} />
  );
}
