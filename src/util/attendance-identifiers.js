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

export const attendanceIdentifiers = (row, isGroup = false) => {
  const sources = isGroup
    ? [row.group?.jsonExt, row.group?.head?.jsonExt, row.jsonExt]
    : [row.individual?.jsonExt, row.jsonExt];

  return {
    formNumber: firstValue(sources, ['form_number', 'formNumber']),
    nationalId: firstValue(sources, ['national_id', 'nationalId']),
    sex: firstValue(sources, ['sex', 'gender']),
  };
};
