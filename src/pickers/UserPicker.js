import React, { useState } from 'react';
import { TextField, Tooltip } from '@material-ui/core';
import {
  Autocomplete,
  useGraphqlQuery,
  useModulesManager,
  useTranslations,
  decodeId,
} from '@openimis/fe-core';

const userLabel = (user) => {
  if (!user) return '';
  const name = [user.iUser?.otherNames, user.iUser?.lastName].filter(Boolean).join(' ').trim();
  return name ? `${name} (${user.username})` : user.username;
};

// Picks a MIS user (core.User). Foreman / supervisor on a project link to a user.
function UserPicker({
  required,
  label,
  nullLabel,
  withLabel = false,
  placeholder,
  withPlaceholder = false,
  readOnly,
  value,
  onChange,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations('projectSocialProtection', modulesManager);

  const [search, setSearch] = useState(null);

  const { isLoading, data, error } = useGraphqlQuery(
    `
    query UserPicker($search: String, $first: Int) {
      users(str: $search, first: $first, orderBy: "iUser__lastName") {
        edges {
          node {
            id
            username
            iUser { lastName otherNames }
          }
        }
      }
    }
    `,
    { search, first: 20 },
    { skip: false },
  );

  const users = data?.users?.edges?.map((edge) => (
    { ...edge.node, id: decodeId(edge.node.id) }
  )) ?? [];

  return (
    <Autocomplete
      error={error}
      readOnly={readOnly}
      options={users}
      isLoading={isLoading}
      value={value ?? null}
      getOptionLabel={userLabel}
      getOptionSelected={(option, v) => option?.id === v?.id}
      onChange={(v) => onChange(v, v ? userLabel(v) : null)}
      onInputChange={(v) => setSearch(v || null)}
      renderInput={(inputProps) => (
        <Tooltip title="">
          <TextField
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...inputProps}
            required={required}
            label={(withLabel && (label || nullLabel)) || formatMessage(label || 'project.foreman')}
            placeholder={(withPlaceholder && placeholder) || formatMessage(label || 'project.foreman')}
          />
        </Tooltip>
      )}
    />
  );
}

export default UserPicker;
