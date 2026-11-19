export const isSessionDateOrderValid = (project) => (
  !project?.sessionStartDate || !project?.sessionEndDate
  || project.sessionStartDate <= project.sessionEndDate
);

export const isTrainingNameValid = (project) => (
  project?.projectType !== 'TRAINING'
  || (typeof project.name === 'string' && Boolean(project.name.trim()) && project.name.length <= 255)
);
