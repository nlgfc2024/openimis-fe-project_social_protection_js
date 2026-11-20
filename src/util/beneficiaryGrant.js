// Grant, plan-approval and utilization keys on a beneficiary's jsonExt, and how the
// "Grant and utilization" tab edits them. The attendance-grant backend module
// protects these keys and validates them again on save.

export const GRANT_TYPES = ['CASH', 'EQUIPMENT', 'SERVICE'];
export const PLAN_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
export const YES_NO = ['YES', 'NO'];

export const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

// Grant types the programme allows (BenefitPlan.jsonExt.allowed_grant_types).
export const allowedGrantTypes = (benefitPlan) => {
  const allowed = parseJsonObject(benefitPlan?.jsonExt).allowed_grant_types;
  return Array.isArray(allowed) ? GRANT_TYPES.filter((type) => allowed.includes(type)) : [];
};

export const trancheAmountKey = (tranche, type) => `tranche_${tranche}_${type.toLowerCase()}_amount`;

// UMEP, the INDIVIDUAL programme, records utilization as YES/NO; UPG and RMEP as a
// percentage.
export const usesYesNoUtilization = (benefitPlan) => benefitPlan?.type === 'INDIVIDUAL';

// The fields of each section for this programme, as {key, kind}.
export const planFields = (benefitPlan) => {
  const allowed = allowedGrantTypes(benefitPlan);
  // A programme with a single grant type (UPG, cash only) uses the payment plan's
  // fixed amount and records no grant types, amount or tranche split.
  const perBeneficiaryGrant = allowed.length > 1;
  const trancheFields = perBeneficiaryGrant ? [1, 2].flatMap((tranche) => allowed.map((type) => ({
    key: trancheAmountKey(tranche, type), kind: 'amount', tranche, type,
  }))) : [];
  return [
    ...(perBeneficiaryGrant ? [
      { key: 'grant_types', kind: 'grantTypes', options: allowed },
      { key: 'approved_grant_amount', kind: 'amount' },
      ...trancheFields,
    ] : []),
    { key: 'business_plan_reference', kind: 'text' },
    { key: 'business_plan_status', kind: 'choice', options: PLAN_STATUSES },
    { key: 'plan_approved_on', kind: 'date' },
    { key: 'plan_approved_by', kind: 'text' },
  ];
};

export const utilizationFields = (benefitPlan) => [
  usesYesNoUtilization(benefitPlan)
    ? { key: 'utilization_confirmed', kind: 'choice', options: YES_NO }
    : { key: 'utilization_percentage', kind: 'percentage' },
  { key: 'utilization_assessed_on', kind: 'date' },
  { key: 'utilization_assessed_by', kind: 'text' },
  { key: 'utilization_notes', kind: 'text' },
];

const isBlank = (value) => value === undefined || value === null
  || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);

// The value a field stores: numbers as numbers, grant types in a stable order,
// dates as YYYY-MM-DD. A blank value means the key is removed.
export const storedValue = (field, value) => {
  if (isBlank(value)) return undefined;
  switch (field.kind) {
    case 'amount':
    case 'percentage': {
      const number = Number(value);
      return Number.isFinite(number) ? number : value;
    }
    case 'grantTypes':
      return GRANT_TYPES.filter((type) => value.includes(type));
    case 'date':
      return String(value).slice(0, 10);
    default:
      return typeof value === 'string' ? value.trim() : value;
  }
};

// The jsonExt to save: the saved one with the editable fields replaced by their
// edited values. Fields the user may not edit keep their saved value.
export const mergedJsonExt = (saved, edits, editableFields) => {
  const merged = { ...parseJsonObject(saved) };
  editableFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(edits, field.key)) return;
    const value = storedValue(field, edits[field.key]);
    if (value === undefined) {
      delete merged[field.key];
    } else {
      merged[field.key] = value;
    }
  });
  return merged;
};

// Whether two jsonExt values hold the same keys and values, in any key order.
export const sameJsonExt = (left, right) => {
  const a = parseJsonObject(left);
  const b = parseJsonObject(right);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
};
