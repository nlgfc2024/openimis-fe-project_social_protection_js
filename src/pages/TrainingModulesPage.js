import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, Typography,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import {
  Form, Searcher, decodeId, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import { MODULE_NAME, DEFAULT_PAGE_SIZE, ROWS_PER_PAGE_OPTIONS } from '../constants';
import TrainingModulesFilter from '../components/TrainingModulesFilter';
import TrainingModuleHeadPanel from '../components/TrainingModuleHeadPanel';
import { fetchTrainingModules, saveTrainingModule, deleteTrainingModule } from '../trainingCatalogueActions';
import { validTrainingModule, trainingModuleInput, trainingCatalogueError } from '../util/trainingCatalogue';

export default function TrainingModulesPage() {
  const dispatch = useDispatch();
  const manager = useModulesManager();
  const { formatMessage: t } = useTranslations(MODULE_NAME, manager);
  const rights = useSelector((state) => state.core?.user?.i_user?.rights || []);
  const [list, setList] = useState({ items: [], pageInfo: {}, loading: false, fetched: false, error: null });
  const [edited, setEdited] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const mounted = useRef(true);
  const canRead = rights.includes(208001);
  const canEdit = edited?.uuid ? rights.includes(208003) : rights.includes(208002);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetch = useCallback(async (params) => {
    if (!canRead) return;
    const current = ++request.current;
    setList((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await dispatch(fetchTrainingModules(params));
      if (!mounted.current || current !== request.current) return;
      const connection = response?.payload?.data?.trainingModule;
      if (!connection || response?.payload?.errors?.length) {
        throw new Error(trainingCatalogueError(response, t('trainingModules.loadError')));
      }
      setList({ items: connection.edges.map(({ node }) => node),
        pageInfo: { ...connection.pageInfo, totalCount: connection.totalCount },
        loading: false, fetched: true, error: null });
    } catch (failure) {
      if (mounted.current && current === request.current) setList((previous) => ({
        ...previous, loading: false, fetched: true, error: failure.message,
      }));
    }
  }, [dispatch, canRead]);

  const save = async () => {
    if (saving || !canEdit || !validTrainingModule(edited)) return;
    setSaving(true);
    setError('');
    try {
      const response = await dispatch(saveTrainingModule(edited.uuid, trainingModuleInput(edited, decodeId)));
      if (response?.status !== 2) {
        throw new Error(trainingCatalogueError(response, t('trainingModules.saveError')));
      }
      if (mounted.current) { setEdited(null); setRevision((previous) => previous + 1); }
    } catch (failure) {
      if (mounted.current) setError(failure.message);
    } finally {
      if (mounted.current) { setSaving(false); setSaveAttempt((previous) => previous + 1); }
    }
  };

  const remove = async () => {
    if (saving || !deleting || !rights.includes(208004)) return;
    setSaving(true);
    setError('');
    try {
      const response = await dispatch(deleteTrainingModule(deleting.uuid));
      if (response?.status !== 2) {
        throw new Error(trainingCatalogueError(response, t('trainingModules.deleteError')));
      }
      if (mounted.current) { setDeleting(null); setRevision((previous) => previous + 1); }
    } catch (failure) {
      if (mounted.current) setError(failure.message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  if (!canRead) return null;
  return (
    <div style={{ padding: 16 }}>
      <Searcher key={revision} module={MODULE_NAME} FilterPane={TrainingModulesFilter}
        fetch={fetch} items={list.items} itemsPageInfo={list.pageInfo} fetchingItems={list.loading}
        fetchedItems={list.fetched} errorItems={list.error}
        tableTitle={t('trainingModules.title')} defaultFilters={{}} defaultOrderBy="name"
        defaultPageSize={DEFAULT_PAGE_SIZE} rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        headers={() => ['trainingModules.name', 'trainingModules.programmes', 'trainingModules.topicCount', 'trainingModules.actions']}
        itemFormatters={() => [
          (module) => module.name,
          (module) => module.programmes.map((plan) => `${plan.code} ${plan.name}`).join(', '),
          (module) => module.topics.length,
          (module) => <>
            {rights.includes(208003) && <IconButton aria-label={t('trainingModules.edit')}
              onClick={() => { setError(''); setEdited({ ...module, topics: module.topics.map((topic) => ({ ...topic })) }); }}>
              <EditIcon /></IconButton>}
            {rights.includes(208004) && <IconButton aria-label={t('trainingModules.delete')}
              onClick={() => { setError(''); setDeleting(module); }}><DeleteIcon /></IconButton>}
          </>,
        ]} sorts={() => [['name', true], null, null, null]} rowIdentifier={(module) => module.uuid}
        searcherActions={[{ label: t('trainingModules.create'), icon: <AddIcon />,
          authorized: rights.includes(208002), onClick: () => {
            setError(''); setEdited({ name: '', programmes: [], topics: [{ key: 'initial', code: '', name: '' }] });
          } }]} enableActionButtons enableHeaderActionButtons />

      <Dialog open={Boolean(edited)} maxWidth="lg" fullWidth onClose={() => !saving && setEdited(null)}>
        <DialogContent>
          {error && <Typography color="error" role="alert">{error}</Typography>}
          {edited && <Form module={MODULE_NAME} title={edited.uuid ? 'trainingModules.edit' : 'trainingModules.create'}
            openDirty edited={edited} edited_id={edited.uuid || 'new'} update={saveAttempt}
            onEditedChanged={setEdited} HeadPanel={TrainingModuleHeadPanel}
            readOnly={!canEdit || saving} canSave={() => !saving && canEdit && validTrainingModule(edited)}
            save={() => { save(); }} saveTooltip={t('trainingModules.save')} />}
        </DialogContent>
        <DialogActions><Button disabled={saving} onClick={() => setEdited(null)}>{t('trainingModules.cancel')}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => !saving && setDeleting(null)}>
        <DialogTitle>{t('trainingModules.delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('trainingModules.deleteConfirm')} {deleting?.name}</DialogContentText>
          {error && <Typography color="error" role="alert">{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setDeleting(null)}>{t('trainingModules.cancel')}</Button>
          <Button disabled={saving} color="primary" onClick={remove}>{t('trainingModules.delete')}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
