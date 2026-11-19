import React from 'react';
import { Tab, Typography } from '@material-ui/core';
import { PublishedComponent, useModulesManager } from '@openimis/fe-core';

const VALUE = 'geospatial-boundary';

function useBoundaryAccess(rights) {
  const manager = useModulesManager();
  const mapping = manager.getConf('fe-mapping', 'enabled', false) === true;
  const has = (required) => Array.isArray(required) && required.length > 0
    && required.every((right) => rights.some((value) => String(value) === String(right)));
  return {
    mapping,
    allowed: mapping
      ? has(manager.getConf('fe-mapping', 'viewRights', [])) && has(manager.getConf('fe-mapping', 'projectRights', []))
      : rights.some((right) => String(right) === '121901'),
  };
}

export function ProjectBoundaryTabLabel({ onChange, tabStyle, isSelected, rights = [] }) {
  const { allowed } = useBoundaryAccess(rights);
  if (!allowed) return null;
  return <Tab onChange={onChange} className={tabStyle(VALUE)} selected={isSelected(VALUE)}
    value={VALUE} label="Boundary map" />;
}

export function ProjectBoundaryTabPanel({ value, project, rights = [] }) {
  const { allowed, mapping } = useBoundaryAccess(rights);
  if (value !== VALUE || !allowed) return null;
  return project?.microCatchment?.uuid
    ? <PublishedComponent pubRef={mapping ? "mapping.MappingMap" : "location.GeospatialDashboard"} key={project.id}
        microCatchmentUuid={project.microCatchment.uuid} />
    : <Typography style={{ padding: 20 }}>This project has no linked micro-catchment.</Typography>;
}
