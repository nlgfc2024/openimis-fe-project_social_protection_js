// Read the same exposed backend configuration used to select the deployment type.
// Missing configuration fails closed to WORK; no second frontend type setting.
export const isTrainingDeployment = (manager) => manager?.getConf?.(
  'project_social_protection', 'project_type', 'WORK',
) === 'TRAINING';

// core.Boot runs before the authenticated menu is rendered. Keep the manager
// scoped to this module instance, so menu filters can read boot configuration.
export function deploymentMenuGate() {
  let manager;
  return {
    initialize: (value) => { manager = value; },
    enabled: () => isTrainingDeployment(manager),
  };
}
