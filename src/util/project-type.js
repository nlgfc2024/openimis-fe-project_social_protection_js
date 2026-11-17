export const isTraining = (project) => project?.projectType === 'TRAINING';

export const datesInOrder = (project) => !project?.sessionStartDate || !project?.sessionEndDate
  || project.sessionStartDate <= project.sessionEndDate;

export const mandatoryFieldsEmpty = (project) => (
  !project?.activity || !project?.location || (!isTraining(project) && !project?.targetBeneficiaries) || !project?.workingDays
  || (isTraining(project) ? !project?.name?.trim() || project.name.length > 255 : !project?.hotspot)
  || !datesInOrder(project)
);

export const rawBenefitPlanId = (id) => {
  if (!id || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return id;
  try { return atob(id).split(':')[1] || id; } catch (error) { return id; }
};

export const validationErrorText = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) return error.map(validationErrorText).join('; ');
  return [error.message, error.detail].filter(Boolean).map(validationErrorText).join(': ');
};
