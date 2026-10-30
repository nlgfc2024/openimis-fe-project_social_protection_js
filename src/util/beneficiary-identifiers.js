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
  const paymentSources = isGroup
    ? [row.group?.head?.jsonExt, row.group?.jsonExt, row.jsonExt]
    : [row.individual?.jsonExt, row.jsonExt];

  return {
    formNumber: firstValue(formNumberSources, ['form_number', 'formNumber']),
    nationalId: firstValue(personSources, ['national_id', 'nationalId']),
    sex: firstValue(personSources, ['sex', 'gender']),
    paymentAccount: firstValue(paymentSources, [
      'payment_account_number', 'paymentAccountNumber', 'account_number', 'accountNumber',
      'bank_account_number', 'bankAccountNumber', 'account_no', 'accountNo',
    ]),
    phoneNumber: firstValue(paymentSources, [
      'phone_number', 'phoneNumber', 'mobile_number', 'mobileNumber',
      'household_mobile_number', 'householdMobileNumber',
    ]),
  };
};
