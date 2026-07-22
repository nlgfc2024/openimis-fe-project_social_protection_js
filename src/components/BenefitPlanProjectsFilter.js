import React from 'react';
import { Grid } from '@material-ui/core';
import {
  Filter,
  PublishedComponent,
} from '@openimis/fe-core';
import { CONTAINS_LOOKUP, MODULE_NAME } from '../constants';
import ProjectStatusPicker from '../pickers/ProjectStatusPicker';
import ActivityPicker from '../pickers/ActivityPicker';
import HotspotPicker from '../pickers/HotspotPicker';

function ProjectFilter({
  filters, onChangeFilters,
}) {
  const filterValue = (k) => (
    !!filters && !!filters[k] ? filters[k].value : null
  );

  const handleRegionChange = (v) => {
    onChangeFilters([{
      id: 'parentLocation',
      value: v,
      filter: v ? `parentLocation: "${v.uuid}", parentLocationLevel: 0` : null,
    }]);
  };

  const handleDistrictChange = (v) => {
    onChangeFilters([{
      id: 'parentLocation',
      value: v,
      filter: v ? `parentLocation: "${v.uuid}", parentLocationLevel: 1` : null,
    }]);
  };

  const pickerFields = [
    { name: 'status', component: ProjectStatusPicker, props: { nullLabel: 'any', withNull: true } },
    { name: 'activity', component: ActivityPicker },
    { name: 'microCatchment', component: PublishedComponent, props: { pubRef: 'location.MicroCatchmentPicker' } },
    { name: 'hotspot', component: HotspotPicker },
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
          pubRef="location.RegionPicker"
          value={filterValue('parentLocation')}
          withNull
          onChange={(v) => handleRegionChange(v)}
        />
      </Grid>
      <Grid item xs={6}>
        <PublishedComponent
          pubRef="location.DistrictPicker"
          value={filterValue('parentLocation')}
          region={filterValue('parentLocation')}
          withNull
          onChange={(v) => handleDistrictChange(v)}
        />
      </Grid>
    </Grid>
  );
}

export default ProjectFilter;
