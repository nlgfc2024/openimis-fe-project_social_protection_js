export const parseJsonExt = (value) => {
  if (typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const firstValue = (sources, keys) => {
  for (const source of sources) {
    const jsonExt = parseJsonExt(source);
    for (const key of keys) {
      if (jsonExt[key] !== undefined && jsonExt[key] !== null && jsonExt[key] !== '') {
        return jsonExt[key];
      }
    }
  }
  return '';
};

export const beneficiaryIdentifiers = (row, isGroup = false) => {
  const formNumberSources = isGroup
    ? [row.group?.jsonExt, row.group?.head?.jsonExt, row.jsonExt]
    : [row.individual?.jsonExt, row.jsonExt];
  const personSources = isGroup
    ? [row.group?.head?.jsonExt, row.jsonExt]
    : [row.individual?.jsonExt, row.jsonExt];

  return {
    formNumber: firstValue(formNumberSources, ['form_number', 'formNumber']),
    nationalId: firstValue(personSources, ['national_id', 'nationalId']),
  };
};
