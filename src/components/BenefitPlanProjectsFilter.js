import React from 'react';
import { Grid } from '@material-ui/core';
import {
  decodeId,
  Filter,
  PublishedComponent,
} from '@openimis/fe-core';
import {
  BENEFIT_PLAN_TYPE,
  CONTAINS_LOOKUP,
  MODULE_NAME,
} from '../constants';
import ProjectStatusPicker from '../pickers/ProjectStatusPicker';
import ActivityPicker from '../pickers/ActivityPicker';
import HotspotPicker from '../pickers/HotspotPicker';

function ProjectFilter({
  filters,
  onChangeFilters = () => {},
  standalone = false,
}) {
  const filterValue = (key) => (
    filters?.[key]?.value ?? null
  );

  const handleDistrictChange = (v) => {
    onChangeFilters([{
      id: 'district',
      value: v,
      filter: null,
    }, {
      id: 'ta',
      value: null,
      filter: null,
    }, {
      id: 'parentLocation',
      value: v,
      filter: v ? `parentLocation: "${v.uuid}", parentLocationLevel: 0` : null,
    }]);
  };

  const handleTaChange = (v) => {
    onChangeFilters([{
      id: 'district',
      value: filterValue('district'),
      filter: null,
    }, {
      id: 'ta',
      value: v,
      filter: null,
    }, {
      id: 'parentLocation',
      value: v,
      filter: v ? `parentLocation: "${v.uuid}", parentLocationLevel: 1` : null,
    }]);
  };

  const handleBenefitPlanChange = (v) => {
    onChangeFilters([{
      id: 'benefitPlan',
      value: v,
      filter: v?.id ? `benefitPlan_Id: "${decodeId(v.id)}"` : null,
    }]);
  };

  const handleMicroCatchmentChange = (v) => {
    onChangeFilters([{
      id: 'microCatchment',
      value: v,
      filter: v?.id ? `microCatchment_Id: "${v.id}"` : null,
    }]);
  };

  const handleHotspotChange = (v) => {
    onChangeFilters([{
      id: 'hotspot',
      value: v,
      filter: v?.gqlId ? `hotspot_Id: "${v.gqlId}"` : null,
    }]);
  };

  const pickerFields = [
    ...(standalone ? [{
      name: 'benefitPlan',
      component: PublishedComponent,
      props: {
        type: BENEFIT_PLAN_TYPE.EVERY_TYPE,
        pubRef: 'socialProtection.BenefitPlanPicker',
        withNull: true,
        onChange: handleBenefitPlanChange,
      },
    }] : []),
    { name: 'status', component: ProjectStatusPicker, props: { nullLabel: 'any', withNull: true } },
    { name: 'activity', component: ActivityPicker },
    {
      name: 'microCatchment',
      component: PublishedComponent,
      props: {
        pubRef: 'location.MicroCatchmentPicker',
        onChange: handleMicroCatchmentChange,
      },
    },
    {
      name: 'hotspot',
      component: HotspotPicker,
      props: { onChange: handleHotspotChange },
    },
  ];

  return (
    <Grid container>
      <Filter
        moduleName={MODULE_NAME}
        filters={filters}
        onChangeFilters={onChangeFilters}
        filterFields={[
          { name: 'name', label: 'project.name', lookup: CONTAINS_LOOKUP },
        ]}
        pickerFields={pickerFields}
        checkboxFields={[
          { name: 'isDeleted', label: 'project.isDeleted' },
        ]}
      />
      <Grid item xs={6}>
        <PublishedComponent
          pubRef="location.MwDistrictPicker"
          value={filterValue('district')}
          withNull
          onChange={(v) => handleDistrictChange(v)}
        />
      </Grid>
      <Grid item xs={6}>
        <PublishedComponent
          pubRef="location.MwTAPicker"
          parentLocation={filterValue('district')}
          value={filterValue('ta')}
          withNull
          onChange={(v) => handleTaChange(v)}
        />
      </Grid>
    </Grid>
  );
}

export default ProjectFilter;
