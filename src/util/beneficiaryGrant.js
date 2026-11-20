// Grant, business plan and utilisation keys on a beneficiary's jsonExt, and how the
// Business appraisal and Utilisation assessment tabs derive them from what the user
// enters. The attendance-grant backend module protects these keys and validates
// them again on save.

export const CASH = 'CASH';
export const GRANT_TYPES = [CASH, 'EQUIPMENT', 'SERVICE'];
export const IN_KIND_TYPES = ['EQUIPMENT', 'SERVICE'];
export const APPROVED = 'APPROVED';
export const REJECTED = 'REJECTED';
export const PLAN_STATUSES = ['PENDING', APPROVED, REJECTED];
export const YES_NO = ['YES', 'NO'];

// A grant with cash is paid 70:30 over two tranches; the payment plans' default
// tranche_percentage. A grant without cash is paid once, in full.
export const TRANCHE_SHARES = { 1: 70, 2: 30 };

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

// A programme with a single grant type (UPG, cash only) pays the payment plan's
// fixed amount, so its beneficiaries record no grant type, amount or tranches.
export const recordsGrantPerBeneficiary = (benefitPlan) => allowedGrantTypes(benefitPlan).length > 1;

export const trancheAmountKey = (tranche, type) => `tranche_${tranche}_${type.toLowerCase()}_amount`;

// UMEP, the INDIVIDUAL programme, records utilisation as YES/NO; UPG and RMEP as a
// percentage.
export const usesYesNoUtilization = (benefitPlan) => benefitPlan?.type === 'INDIVIDUAL';
export const utilizationResultKey = (benefitPlan) => (
  usesYesNoUtilization(benefitPlan) ? 'utilization_confirmed' : 'utilization_percentage');

const pad = (number) => String(number).padStart(2, '0');
export const localIsoDate = (date = new Date()) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);

// The signed-in user as recorded for an approval or assessment.
export const userDisplayName = (user) => {
  const name = [user?.i_user?.other_names, user?.i_user?.last_name].filter(Boolean).join(' ').trim();
  return name || user?.username || '';
};

const isBlank = (value) => value === undefined || value === null
  || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);

const text = (value) => (isBlank(value) ? undefined : String(value).trim());

// Amounts are handled in whole cents, so tranches round like the payroll does.
const toCents = (value) => {
  if (isBlank(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Number((number * 100).toFixed(4))) : NaN;
};
const fromCents = (cents) => cents / 100;
// cents x percentage / 100, rounded half up.
const shareOf = (cents, percentage) => Math.floor((cents * percentage + 50) / 100);

const setKey = (jsonExt, key, value) => {
  if (value === undefined || value === null) {
    delete jsonExt[key];
  } else {
    // eslint-disable-next-line no-param-reassign
    jsonExt[key] = value;
  }
};

// What the Business appraisal tab lets the user enter.
export const APPRAISAL_INPUT_KEYS = [
  'grant_types',
  'approved_grant_amount',
  trancheAmountKey(1, 'EQUIPMENT'),
  trancheAmountKey(1, 'SERVICE'),
  'business_plan_reference',
  'business_plan_status',
  'plan_rejection_reason',
];
export const UTILISATION_INPUT_KEYS = ['utilization_percentage', 'utilization_confirmed', 'utilization_notes'];

export const pickKeys = (jsonExt, keys) => keys.reduce((picked, key) => (
  jsonExt[key] === undefined ? picked : { ...picked, [key]: jsonExt[key] }), {});

// The beneficiary's jsonExt after a business appraisal, with the derived values:
// - tranche amounts: tranche 1 is 70% of a grant with cash (100% without cash) and
//   holds the equipment and service, the rest of it is cash; tranche 2 is the
//   remaining 30% in cash;
// - an approval is dated today and made by the signed-in user, and kept as recorded
//   while the plan stays approved (an approved record without them gets them with
//   its next change);
// - a rejection reason is kept only for a rejected plan.
// Returns {jsonExt, errors, tranches}; errors maps a key to {id, values}.
export const computeAppraisal = ({
  saved, draft, benefitPlan, today, approver,
}) => {
  const jsonExt = { ...parseJsonObject(saved) };
  const errors = {};
  let tranches = null;

  if (recordsGrantPerBeneficiary(benefitPlan)) {
    const allowed = allowedGrantTypes(benefitPlan);
    const selected = Array.isArray(draft.grant_types) ? draft.grant_types : [];
    const types = allowed.filter((type) => selected.includes(type));
    setKey(jsonExt, 'grant_types', types.length ? types : undefined);
    if (!types.length) errors.grant_types = { id: 'required' };

    const amount = toCents(draft.approved_grant_amount);
    setKey(jsonExt, 'approved_grant_amount', Number.isFinite(amount) && amount !== null ? fromCents(amount) : undefined);
    if (amount === null) errors.approved_grant_amount = { id: 'required' };
    else if (!(amount > 0)) errors.approved_grant_amount = { id: 'positive' };

    const inKind = {};
    IN_KIND_TYPES.filter((type) => types.includes(type)).forEach((type) => {
      const key = trancheAmountKey(1, type);
      const cents = toCents(draft[key]);
      if (cents === null) errors[key] = { id: 'required' };
      else if (!(cents >= 0)) errors[key] = { id: 'nonNegative' };
      else inKind[type] = cents;
    });

    const inputsValid = types.length && !errors.approved_grant_amount
      && Object.keys(inKind).length === IN_KIND_TYPES.filter((type) => types.includes(type)).length;
    if (inputsValid) {
      const inKindTotal = Object.values(inKind).reduce((sum, cents) => sum + cents, 0);
      if (types.includes(CASH)) {
        const share = shareOf(amount, TRANCHE_SHARES[1]);
        if (inKindTotal > share) {
          errors.inKind = { id: 'inKindAboveShare', values: { inKind: fromCents(inKindTotal), share: fromCents(share) } };
        } else {
          tranches = {
            1: { ...inKind, [CASH]: share - inKindTotal },
            2: { [CASH]: shareOf(amount, TRANCHE_SHARES[2]) },
          };
        }
      } else if (inKindTotal !== amount) {
        errors.inKind = { id: 'inKindNotGrant', values: { amount: fromCents(amount) } };
      } else {
        tranches = { 1: inKind, 2: {} };
      }
    }

    [1, 2].forEach((tranche) => GRANT_TYPES.forEach((type) => {
      const key = trancheAmountKey(tranche, type);
      if (!types.includes(type)) {
        setKey(jsonExt, key, undefined);
      } else if (tranches) {
        const cents = tranches[tranche][type];
        setKey(jsonExt, key, cents === undefined ? undefined : fromCents(cents));
      } else if (tranche === 1 && inKind[type] !== undefined) {
        setKey(jsonExt, key, fromCents(inKind[type]));
      }
    }));
  }

  setKey(jsonExt, 'business_plan_reference', text(draft.business_plan_reference));
  const status = text(draft.business_plan_status);
  setKey(jsonExt, 'business_plan_status', status);

  const reason = status === REJECTED ? text(draft.plan_rejection_reason) : undefined;
  setKey(jsonExt, 'plan_rejection_reason', reason);
  if (status === REJECTED && !reason) errors.plan_rejection_reason = { id: 'required' };

  const savedJsonExt = parseJsonObject(saved);
  const stillApproved = savedJsonExt.business_plan_status === APPROVED
    && !isBlank(savedJsonExt.plan_approved_on) && !isBlank(savedJsonExt.plan_approved_by);
  if (status !== APPROVED) {
    setKey(jsonExt, 'plan_approved_on', undefined);
    setKey(jsonExt, 'plan_approved_by', undefined);
  } else if (!stillApproved && !sameJsonExt(savedJsonExt, jsonExt)) {
    setKey(jsonExt, 'plan_approved_on', today);
    setKey(jsonExt, 'plan_approved_by', approver || undefined);
  }

  return { jsonExt, errors, tranches };
};

// The beneficiary's jsonExt after a utilisation assessment: a new or changed result
// or note is dated today and made by the signed-in user; without a result the
// assessment date and author are removed.
export const computeUtilisation = ({
  saved, draft, benefitPlan, today, assessor,
}) => {
  const savedJsonExt = parseJsonObject(saved);
  const jsonExt = { ...savedJsonExt };
  const errors = {};
  const resultKey = utilizationResultKey(benefitPlan);

  let result = draft[resultKey];
  if (resultKey === 'utilization_percentage') {
    if (isBlank(result)) {
      result = undefined;
    } else {
      const number = Number(result);
      if (!Number.isFinite(number) || number < 0 || number > 100) errors[resultKey] = { id: 'percentage' };
      result = Number.isFinite(number) ? number : undefined;
    }
  } else {
    result = text(result);
  }
  setKey(jsonExt, resultKey, result);
  setKey(jsonExt, 'utilization_notes', text(draft.utilization_notes));

  const changed = JSON.stringify(jsonExt[resultKey]) !== JSON.stringify(savedJsonExt[resultKey])
    || jsonExt.utilization_notes !== savedJsonExt.utilization_notes;
  if (result === undefined) {
    setKey(jsonExt, 'utilization_assessed_on', undefined);
    setKey(jsonExt, 'utilization_assessed_by', undefined);
  } else if (changed) {
    setKey(jsonExt, 'utilization_assessed_on', today);
    setKey(jsonExt, 'utilization_assessed_by', assessor || undefined);
  }
  return { jsonExt, errors };
};

// Whether two jsonExt values hold the same keys and values, in any key order.
export const sameJsonExt = (left, right) => {
  const a = parseJsonObject(left);
  const b = parseJsonObject(right);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
};
