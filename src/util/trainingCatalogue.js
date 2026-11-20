export const moveTopic = (topics, index, offset) => {
  const next = index + offset;
  if (index < 0 || index >= topics.length || next < 0 || next >= topics.length) return topics;
  const ordered = [...topics];
  [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  return ordered;
};

export const validTrainingModule = (module) => {
  if (!module?.name?.trim() || module.name.trim().length > 255 || !module.programmes?.length
      || !module.topics?.length) return false;
  const codes = module.topics.map((topic) => topic.code?.trim());
  return new Set(codes).size === codes.length && module.topics.every((topic) => (
    topic.code?.trim() && topic.code.trim().length <= 64
    && topic.name?.trim() && topic.name.trim().length <= 255
  ));
};

export const trainingModuleInput = (module, decodeId) => ({
  name: module.name.trim(),
  programmeIds: module.programmes.map((plan) => decodeId(plan.id)),
  topics: module.topics.map((topic) => ({
    ...(topic.id ? { id: topic.id } : {}), code: topic.code.trim(), name: topic.name.trim(),
  })),
});

export const trainingCatalogueError = (response, fallback) => {
  const errors = response?.payload?.errors || response?.errors || response?.error;
  if (typeof errors === 'string') return errors;
  if (!errors?.length) return fallback;
  return errors.map((error) => (typeof error === 'string' ? error : error.detail || error.message || fallback)).join(' ');
};
