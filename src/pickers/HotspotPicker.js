import React, { useState } from 'react';
import { TextField, Tooltip } from '@material-ui/core';
import {
  Autocomplete,
  useGraphqlQuery,
  useModulesManager,
  useTranslations,
  decodeId,
} from '@openimis/fe-core';

function HotspotPicker({
  multiple,
  required,
  label,
  nullLabel,
  withLabel = false,
  placeholder,
  withPlaceholder = false,
  readOnly,
  value,
  onChange,
  filter,
  filterSelectedOptions,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations('projectSocialProtection', modulesManager);

  const [filters, setFilters] = useState({});

  const { isLoading, data, error } = useGraphqlQuery(
    `
    query HotspotPicker($search: String, $first: Int) {
      hotspots(name_Icontains: $search, first: $first, orderBy: "name") {
        edges {
          node {
            id
            name
            code
          }
        }
      }
    }
    `,
    { ...filters, first: 20 },
    { skip: false },
  );

  const hotspots = data?.hotspots?.edges?.map((edge) => (
    { ...edge.node, id: decodeId(edge.node.id) }
  )) ?? [];

  return (
    <Autocomplete
      multiple={multiple}
      error={error}
      readOnly={readOnly}
      options={hotspots}
      isLoading={isLoading}
      value={value ?? null}
      getOptionLabel={(option) => (option?.code ? `${option.name} (${option.code})` : option?.name ?? '')}
      getOptionSelected={(option, v) => option?.id === v?.id}
      onChange={(v) => onChange(v, (v && !Array.isArray(v)) ? v.name : null)}
      filterOptions={filter}
      filterSelectedOptions={filterSelectedOptions}
      onInputChange={(search) => setFilters({ search })}
      renderInput={(inputProps) => (
        <Tooltip title="">
          <TextField
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...inputProps}
            required={required}
            label={(withLabel && (label || nullLabel)) || formatMessage('project.hotspot')}
            placeholder={(withPlaceholder && placeholder) || formatMessage('project.hotspot')}
          />
        </Tooltip>
      )}
    />
  );
}

export default HotspotPicker;
