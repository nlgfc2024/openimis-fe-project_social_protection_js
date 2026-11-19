import React from 'react';
import { Tab, Typography } from '@material-ui/core';
import { PublishedComponent } from '@openimis/fe-core';

const VALUE = 'geospatial-boundary';

export function ProjectBoundaryTabLabel({ onChange, tabStyle, isSelected, rights = [] }) {
  if (!rights.some((right) => String(right) === '121901')) return null;
  return <Tab onChange={onChange} className={tabStyle(VALUE)} selected={isSelected(VALUE)}
    value={VALUE} label="Boundary map" />;
}

export function ProjectBoundaryTabPanel({ value, project, rights = [] }) {
  if (value !== VALUE || !rights.some((right) => String(right) === '121901')) return null;
  return project?.microCatchment?.uuid
    ? <PublishedComponent pubRef="location.GeospatialDashboard" key={project.id}
        microCatchmentUuid={project.microCatchment.uuid} />
    : <Typography style={{ padding: 20 }}>This project has no linked micro-catchment.</Typography>;
}
