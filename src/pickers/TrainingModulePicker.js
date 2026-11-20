import React, { useEffect, useRef, useState } from 'react';
import { TextField, Typography } from '@material-ui/core';
import { useDispatch } from 'react-redux';
import { Autocomplete, decodeId, useModulesManager, useTranslations } from '@openimis/fe-core';
import { fetchProgrammeModules } from '../actions';
import { MODULE_NAME } from '../constants';
import { decodeTrainingReferenceId } from '../util/trainingSetup';

export default function TrainingModulePicker({ programmeId, value, savedModules, readOnly, locked = readOnly,
  renderControl = true, autoSelectProgrammeModules = false, onStateChange }) {
  const dispatch = useDispatch();
  const manager = useModulesManager();
  const { formatMessage: t } = useTranslations(MODULE_NAME, manager);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const latest = useRef({ value, onStateChange });
  latest.current = { value, onStateChange };

  useEffect(() => {
    let active = true;
    if (locked || !programmeId) return undefined;
    setLoading(true);
    setError(false);
    latest.current.onStateChange({ trainingModuleLoading: true, trainingModuleLoadError: false });
    (async () => {
      try {
        const response = await dispatch(fetchProgrammeModules(programmeId));
        if (!active) return;
        const page = response?.payload?.data?.projectProgrammeModules;
        if (!Array.isArray(page) || response?.error || response?.payload?.errors?.length) {
          throw new Error(t('project.trainingModules.loadError'));
        }
        const modules = page.map((module) => ({ ...module,
          id: decodeTrainingReferenceId(module.id, decodeId) }));
        setOptions(modules);
        setLoading(false);
        latest.current.onStateChange({ trainingModuleLoading: false, trainingModuleLoadError: false,
          ...(autoSelectProgrammeModules || latest.current.value === undefined
            ? { trainingModules: modules } : {}) });
      } catch (_) {
        if (!active) return;
        setError(true);
        setLoading(false);
        latest.current.onStateChange({ trainingModuleLoading: false, trainingModuleLoadError: true });
      }
    })();
    return () => { active = false; };
  }, [dispatch, programmeId, locked, autoSelectProgrammeModules]);

  if (!renderControl) return null;
  return <>
    <Autocomplete multiple options={options} value={value || []} readOnly
      isLoading={loading} error={error} getOptionLabel={(module) => module.name}
      getOptionSelected={(option, selected) => option.id === selected.id}
      renderInput={(props) => <TextField {...props} required label={t('project.trainingModules')}
        error={error} helperText={error ? t('project.trainingModules.loadError') : ''} />} />
    {!loading && !error && !locked && options.length === 0 && (
      <Typography color="error">{t('project.trainingModules.empty')}</Typography>
    )}
  </>;
}
