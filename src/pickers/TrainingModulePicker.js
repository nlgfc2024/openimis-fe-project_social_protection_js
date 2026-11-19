import React, { useEffect, useRef, useState } from 'react';
import { TextField, Typography } from '@material-ui/core';
import { useDispatch } from 'react-redux';
import { Autocomplete, decodeId, useModulesManager, useTranslations } from '@openimis/fe-core';
import { fetchTrainingModules } from '../trainingCatalogueActions';
import { MODULE_NAME } from '../constants';
import { decodeTrainingReferenceId } from '../util/trainingSetup';

export default function TrainingModulePicker({ programmeId, value, savedModules, readOnly, locked = readOnly,
  renderControl = true, onStateChange }) {
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
        let after;
        const modules = [];
        do {
          const response = await dispatch(fetchTrainingModules([
            `benefitPlans_Id: "${decodeTrainingReferenceId(programmeId, decodeId)}"`, 'first: 100', 'orderBy: ["name", "id"]',
            ...(after ? [`after: "${after}"`] : []),
          ]));
          if (!active) return;
          const page = response?.payload?.data?.trainingModule;
          if (!page || response?.payload?.errors?.length) throw new Error('Catalogue unavailable');
          modules.push(...page.edges.map(({ node }) => ({ id: decodeTrainingReferenceId(node.id, decodeId), name: node.name, topicCount: node.topics.length })));
          const next = page.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
          if (next && next === after) throw new Error('Invalid catalogue cursor');
          after = next;
        } while (after);
        setOptions(modules);
        setLoading(false);
        latest.current.onStateChange({ trainingModuleLoading: false, trainingModuleLoadError: false,
          ...(latest.current.value === undefined ? { trainingModules: modules } : {}) });
      } catch (_) {
        if (!active) return;
        setError(true);
        setLoading(false);
        latest.current.onStateChange({ trainingModuleLoading: false, trainingModuleLoadError: true });
      }
    })();
    return () => { active = false; };
  }, [dispatch, programmeId, locked]);

  if (!renderControl) return null;
  return <>
    <Autocomplete multiple options={options} value={value || []} readOnly={readOnly || loading}
      isLoading={loading} error={error} getOptionLabel={(module) => module.name}
      // The shared autocomplete requires this callback on open and search;
      // all programme options are already loaded and filtered locally.
      onInputChange={() => {}}
      getOptionSelected={(option, selected) => option.id === selected.id}
      onChange={(modules) => {
        const selected = modules || [];
        const unchanged = savedModules?.length === selected.length
          && selected.every((module, index) => module.id === savedModules[index].id);
        latest.current.onStateChange({ trainingModules: unchanged ? savedModules : selected.map((module) => (
          options.find((option) => option.id === module.id) || module
        )) });
      }}
      renderInput={(props) => <TextField {...props} required label={t('project.trainingModules')}
        error={error} helperText={error ? t('project.trainingModules.loadError') : ''} />} />
    {!loading && !error && !locked && options.length === 0 && (
      <Typography color="error">{t('project.trainingModules.empty')}</Typography>
    )}
    {locked && <Typography variant="caption">{t('project.trainingModules.locked')}</Typography>}
  </>;
}
