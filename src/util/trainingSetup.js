export const isSessionDateOrderValid = (project) => (
  !project?.sessionStartDate || !project?.sessionEndDate
  || project.sessionStartDate <= project.sessionEndDate
);

export const isTrainingNameValid = (project) => (
  project?.projectType !== 'TRAINING'
  || (typeof project.name === 'string' && Boolean(project.name.trim()) && project.name.length <= 255)
);

export const isProjectRequiredFieldsMissing = (project) => (
  !project?.location || (project?.projectType === 'TRAINING'
    ? !project.trainingModules?.length || project.trainingModuleLoading || project.trainingModuleLoadError
    : !project?.hotspot || !project?.targetBeneficiaries || !project?.activity || !project?.workingDays)
);

export const persistedProjectData = (project) => Object.fromEntries(
  Object.entries(project || {}).filter(([key]) => !['trainingModuleLoading', 'trainingModuleLoadError'].includes(key)),
);

export const decodeTrainingReferenceId = (id, decodeId) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id : decodeId(id)
);
