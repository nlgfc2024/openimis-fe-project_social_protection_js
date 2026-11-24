// Grant, business plan and utilisation keys on a beneficiary's jsonExt, and how the
// Business appraisal and Utilisation assessment tabs derive them from what the user
// enters. The attendance-grant backend module protects these keys: grant details are
// submitted for approval, and the approval records the plan status and approver.

export const CASH = 'CASH';
export const GRANT_TYPES = [CASH, 'EQUIPMENT', 'SERVICE'];
export const IN_KIND_TYPES = ['EQUIPMENT', 'SERVICE'];
export const APPROVED = 'APPROVED';
export const REJECTED = 'REJECTED';
// The plan approval task source, as configured on the approvers' task group.
export const PLAN_APPROVAL_TASK_SOURCE = 'calcrule_attendance_grant.plan_approval';
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

// Amounts are handled in whole cents, so sums compare exactly.
const toCents = (value) => {
  if (isBlank(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Number((number * 100).toFixed(4))) : NaN;
};
const fromCents = (cents) => cents / 100;

const setKey = (jsonExt, key, value) => {
  if (value === undefined || value === null) {
    delete jsonExt[key];
  } else {
    // eslint-disable-next-line no-param-reassign
    jsonExt[key] = value;
  }
};

// What the Business appraisal tab lets the user enter and submit for approval.
export const APPRAISAL_INPUT_KEYS = [
  'grant_types',
  'approved_grant_amount',
  trancheAmountKey(1, 'EQUIPMENT'),
  trancheAmountKey(1, 'SERVICE'),
  'business_plan_reference',
];
export const UTILISATION_INPUT_KEYS = ['utilization_percentage', 'utilization_confirmed', 'utilization_notes'];

export const pickKeys = (jsonExt, keys) => keys.reduce((picked, key) => (
  jsonExt[key] === undefined ? picked : { ...picked, [key]: jsonExt[key] }), {});

// The grant details to submit for approval: the keys whose value differs from the
// saved ones (null removes a key). Equipment and service are delivered in tranche
// one; the payroll pays the rest of each tranche's share in cash, from its payment
// plan's tranche percentage, so a recorded cash amount is cleared when the grant
// changes. Returns {proposal, errors}; errors maps a key to {id, values}.
export const computeProposal = ({ saved, draft, benefitPlan }) => {
  const savedJsonExt = parseJsonObject(saved);
  const next = { ...savedJsonExt };
  const errors = {};

  if (recordsGrantPerBeneficiary(benefitPlan)) {
    const allowed = allowedGrantTypes(benefitPlan);
    const selected = Array.isArray(draft.grant_types) ? draft.grant_types : [];
    const types = allowed.filter((type) => selected.includes(type));
    setKey(next, 'grant_types', types.length ? types : undefined);
    if (!types.length) errors.grant_types = { id: 'required' };

    const amount = toCents(draft.approved_grant_amount);
    setKey(next, 'approved_grant_amount', Number.isFinite(amount) && amount !== null ? fromCents(amount) : undefined);
    if (amount === null) errors.approved_grant_amount = { id: 'required' };
    else if (!(amount > 0)) errors.approved_grant_amount = { id: 'positive' };

    let inKindTotal = 0;
    IN_KIND_TYPES.forEach((type) => {
      const key = trancheAmountKey(1, type);
      if (!types.includes(type)) {
        [1, 2].forEach((tranche) => setKey(next, trancheAmountKey(tranche, type), undefined));
        return;
      }
      const cents = toCents(draft[key]);
      if (cents === null) errors[key] = { id: 'required' };
      else if (!(cents >= 0)) errors[key] = { id: 'nonNegative' };
      else inKindTotal += cents;
      setKey(next, key, Number.isFinite(cents) && cents !== null ? fromCents(cents) : undefined);
    });

    const inKindValid = IN_KIND_TYPES.every((type) => !errors[trancheAmountKey(1, type)]);
    if (types.length && !errors.approved_grant_amount && inKindValid) {
      if (types.includes(CASH) && inKindTotal > amount) {
        errors.inKind = { id: 'inKindAboveGrant', values: { inKind: fromCents(inKindTotal), amount: fromCents(amount) } };
      } else if (!types.includes(CASH) && inKindTotal !== amount) {
        errors.inKind = { id: 'inKindNotGrant', values: { amount: fromCents(amount) } };
      }
    }

    const grantKeys = ['grant_types', 'approved_grant_amount', ...IN_KIND_TYPES.map((type) => trancheAmountKey(1, type))];
    const grantChanged = grantKeys.some((key) => JSON.stringify(next[key]) !== JSON.stringify(savedJsonExt[key]));
    if (grantChanged) [1, 2].forEach((tranche) => setKey(next, trancheAmountKey(tranche, CASH), undefined));
  }
  setKey(next, 'business_plan_reference', text(draft.business_plan_reference));

  const proposal = {};
  new Set([...Object.keys(next), ...Object.keys(savedJsonExt)]).forEach((key) => {
    if (JSON.stringify(next[key]) !== JSON.stringify(savedJsonExt[key])) {
      proposal[key] = next[key] === undefined ? null : next[key];
    }
  });
  return { proposal, errors };
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
