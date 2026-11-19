export const trainingFieldRule = (config, field) => config?.fields?.[field]
  || { visible: true, required: false, readOnly: false };

export const parseTrainingFormConfig = (raw) => {
  const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!config || !config.fields || typeof config.fields !== 'object' || Array.isArray(config.fields)) {
    throw new Error('Invalid Training form configuration');
  }
  return config;
};

export const applyTrainingFormDefaults = (project, config) => {
  const next = { ...project };
  Object.entries(config.fields).forEach(([field, rule]) => {
    if (Object.prototype.hasOwnProperty.call(rule, 'default')
      && (!Object.prototype.hasOwnProperty.call(next, field) || rule.readOnly || !rule.visible)) {
      next[field] = rule.default;
    }
  });
  return next;
};

const districtOf = (location) => {
  let current = location;
  const seen = new Set();
  while (current && !seen.has(current)) {
    if (current.type === 'R') return current;
    seen.add(current);
    current = current.parent;
  }
  return null;
};

export const trainingCreationFieldsMissing = (project, config) => {
  if (!config || project.trainingModuleLoading || project.trainingModuleLoadError) return true;
  return Object.entries(config.fields).some(([field, rule]) => {
    if (!rule.required) return false;
    let value = project[field];
    if (field === 'district') value = value || districtOf(project.location);
    if (field === 'topicCount') value = project.trainingModules?.reduce((sum, module) => sum + module.topicCount, 0);
    return value === null || value === undefined || value === ''
      || typeof value === 'string' && !value.trim() || Array.isArray(value) && value.length === 0;
  });
};

export const trainingCreationPayload = (project, config) => {
  const next = applyTrainingFormDefaults(project, config);
  Object.entries(config.fields).forEach(([field, rule]) => {
    if ((!rule.visible || rule.readOnly) && !Object.prototype.hasOwnProperty.call(rule, 'default')
      && !['benefitPlan', 'status', 'topicCount'].includes(field)) delete next[field];
  });
  return next;
};

export const trainingTargetInRange = (project, config, maximum) => {
  const value = project.targetBeneficiaries;
  if (value === null || value === undefined || value === '') {
    return !trainingFieldRule(config, 'targetBeneficiaries').required;
  }
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= maximum;
};
