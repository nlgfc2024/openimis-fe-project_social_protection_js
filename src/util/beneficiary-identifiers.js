export const parseJsonExt = (value) => {
  if (typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

export const firstValue = (sources, keys) => {
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
    ? [row.group?.jsonExt, row.group?.primaryRecipient?.jsonExt, row.group?.head?.jsonExt, row.jsonExt]
    : [row.individual?.jsonExt, row.jsonExt];
  // Once a household has a validated primary recipient, identity and payment
  // values must come exclusively from that person. Falling back to the head
  // would display one member's name beside another member's payment account.
  const hasPrimaryRecipient = isGroup && !!row.group?.primaryRecipient;
  const personSources = isGroup
    ? (hasPrimaryRecipient ? [row.group.primaryRecipient.jsonExt] : [row.group?.head?.jsonExt, row.jsonExt])
    : [row.individual?.jsonExt, row.jsonExt];
  const paymentSources = isGroup
    ? (hasPrimaryRecipient ? [row.group.primaryRecipient.jsonExt] : [row.group?.head?.jsonExt, row.group?.jsonExt, row.jsonExt])
    : [row.individual?.jsonExt, row.jsonExt];
  const phoneNumber = hasPrimaryRecipient
    ? firstValue(
      [row.group.primaryRecipient.jsonExt],
      ['phone_number', 'phoneNumber', 'mobile_number', 'mobileNumber'],
    ) || firstValue(
      [row.group?.jsonExt, row.jsonExt],
      ['household_mobile_number', 'householdMobileNumber'],
    )
    : firstValue(paymentSources, [
      'phone_number', 'phoneNumber', 'mobile_number', 'mobileNumber',
      'household_mobile_number', 'householdMobileNumber',
    ]);

  return {
    formNumber: firstValue(formNumberSources, ['form_number', 'formNumber']),
    nationalId: firstValue(personSources, ['national_id', 'nationalId']),
    sex: firstValue(personSources, ['sex', 'gender']),
    paymentAccount: firstValue(paymentSources, [
      'payment_account_number', 'paymentAccountNumber', 'account_number', 'accountNumber',
      'bank_account_number', 'bankAccountNumber', 'account_no', 'accountNo',
    ]),
    phoneNumber,
  };
};
