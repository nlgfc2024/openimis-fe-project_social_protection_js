import React, { useState, useEffect } from 'react';
import { TextField } from '@material-ui/core';
import {
  Autocomplete,
  useGraphqlQuery,
  useModulesManager,
  useTranslations,
  decodeId,
} from '@openimis/fe-core';

function ProjectPicker({
  benefitPlanId,
  status,
  parentLocation,
  microCatchment,
  hotspot,
  multiple = true,
  required = false,
  label,
  withLabel = true,
  placeholder,
  withPlaceholder = true,
  readOnly = false,
  value,
  onChange,
  filter,
  filterSelectedOptions,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations('projectSocialProtection', modulesManager);

  const [filters, setFilters] = useState({
    benefitPlan_Id: benefitPlanId,
    status,
    parentLocation: parentLocation?.uuid,
    microCatchment_Id: microCatchment?.id,
    hotspot_Id: hotspot?.gqlId,
    isDeleted: false,
  });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      benefitPlan_Id: benefitPlanId,
      status,
      parentLocation: parentLocation?.uuid,
      microCatchment_Id: microCatchment?.id,
      hotspot_Id: hotspot?.gqlId,
    }));
  }, [
    benefitPlanId,
    status,
    parentLocation?.uuid,
    microCatchment?.id,
    hotspot?.gqlId,
  ]);

  const { isLoading, data, error } = useGraphqlQuery(
    `
    query ProjectPicker(
      $search: String,
      $first: Int,
      $benefitPlan_Id: ID,
      $status: ProjectStatus,
      $parentLocation: String,
      $microCatchment_Id: ID,
      $hotspot_Id: ID,
      $isDeleted: Boolean
    ) {
      project(
        name_Icontains: $search,
        first: $first,
        benefitPlan_Id: $benefitPlan_Id,
        status: $status,
        parentLocation: $parentLocation,
        microCatchment_Id: $microCatchment_Id,
        hotspot_Id: $hotspot_Id,
        isDeleted: $isDeleted,
        orderBy: "name"
      ) {
        edges {
          node {
            id
            name
            status
          }
        }
      }
    }
    `,
    filters,
    { skip: !benefitPlanId },
  );

  const projects = data?.project?.edges?.map((edge) => ({
    ...edge.node,
    id: decodeId(edge.node.id),
  })) ?? [];

  const normalizedValue = React.useMemo(() => {
    if (!value) return multiple ? [] : null;

    if (multiple && Array.isArray(value)) {
      return value.map((item) => {
        if (item.name) return item;
        return projects.find((p) => p.id === item.id) || item;
      }).filter(Boolean);
    }

    if (!multiple) {
      if (value.name) return value;
      return projects.find((p) => p.id === value.id) || value;
    }

    return value;
  }, [value, projects, multiple]);

  const placeholderStr = readOnly
    ? ''
    : (withPlaceholder && placeholder) || formatMessage('project.picker.placeholder');

  return (
    <Autocomplete
      multiple={multiple}
      error={error}
      readOnly={readOnly || !benefitPlanId}
      options={projects}
      isLoading={isLoading}
      value={normalizedValue}
      getOptionLabel={(option) => option.name ?? ''}
      getOptionSelected={(option, v) => option?.id === v?.id}
      onChange={(v) => onChange?.(v)}
      filterOptions={filter}
      filterSelectedOptions={filterSelectedOptions}
      onInputChange={(search) => setFilters({
        search,
        benefitPlan_Id: benefitPlanId,
        status,
        parentLocation: parentLocation?.uuid,
        microCatchment_Id: microCatchment?.id,
        hotspot_Id: hotspot?.gqlId,
        isDeleted: false,
      })}
      renderInput={(inputProps) => (
        <TextField
          /* eslint-disable-next-line react/jsx-props-no-spreading */
          {...inputProps}
          required={required}
          label={(withLabel && label) || formatMessage('project.picker.label')}
          placeholder={placeholderStr}
        />
      )}
    />
  );
}

export default ProjectPicker;
