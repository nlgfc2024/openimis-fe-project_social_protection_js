import { makeStyles } from '@material-ui/core/styles';
import React from 'react';
import {
  Button, Grid, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip,
} from '@material-ui/core';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import DeleteIcon from '@material-ui/icons/Delete';
import { PublishedComponent, TextInput, useTranslations, useModulesManager } from '@openimis/fe-core';
import { MODULE_NAME, BENEFIT_PLAN_TYPE } from '../constants';
import { moveTopic } from '../util/trainingCatalogue';

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(2) },
}));

export default function TrainingModuleHeadPanel({ edited, onEditedChanged, readOnly }) {
  const manager = useModulesManager();
  const classes = useStyles();
  const { formatMessage: t } = useTranslations(MODULE_NAME, manager);
  const topics = edited.topics || [];
  const change = (updates) => onEditedChanged({ ...edited, ...updates });
  const changeTopic = (index, updates) => change({
    topics: topics.map((topic, position) => (position === index ? { ...topic, ...updates } : topic)),
  });
  return (
    <Grid container spacing={2} className={classes.root}>
      <Grid item xs={12} md={6}>
        <TextInput module={MODULE_NAME} label="trainingModules.name" required readOnly={readOnly}
          value={edited.name || ''} inputProps={{ maxLength: 255 }} onChange={(name) => change({ name })} />
      </Grid>
      <Grid item xs={12} md={6}>
        <PublishedComponent pubRef="socialProtection.BenefitPlanPicker" multiple required withLabel
          type={BENEFIT_PLAN_TYPE.EVERY_TYPE} label={t('trainingModules.programmes')}
          readOnly={readOnly} value={edited.programmes || []}
          onChange={(programmes) => change({ programmes: programmes || [] })} />
      </Grid>
      <Grid item xs={12}>
        <Table size="small" aria-label={t('trainingModules.topics')}>
          <TableHead><TableRow>
            <TableCell>{t('trainingModules.sequence')}</TableCell>
            <TableCell>{t('trainingModules.topicCode')}</TableCell>
            <TableCell>{t('trainingModules.topicName')}</TableCell>
            <TableCell>{t('trainingModules.actions')}</TableCell>
          </TableRow></TableHead>
          <TableBody>{topics.map((topic, index) => (
            <TableRow key={topic.id || topic.key}>
              <TableCell>{index + 1}</TableCell>
              <TableCell><TextInput module={MODULE_NAME} label="trainingModules.topicCode" required
                readOnly={readOnly} value={topic.code || ''} inputProps={{ maxLength: 64 }}
                onChange={(code) => changeTopic(index, { code })} /></TableCell>
              <TableCell><TextInput module={MODULE_NAME} label="trainingModules.topicName" required
                readOnly={readOnly} value={topic.name || ''} inputProps={{ maxLength: 255 }}
                onChange={(name) => changeTopic(index, { name })} /></TableCell>
              <TableCell>
                {!readOnly && <>
                  <Tooltip title={t('trainingModules.moveUp')}><span><IconButton
                    aria-label={t('trainingModules.moveUp')} disabled={index === 0}
                    onClick={() => change({ topics: moveTopic(topics, index, -1) })}>
                    <ArrowUpward /></IconButton></span></Tooltip>
                  <Tooltip title={t('trainingModules.moveDown')}><span><IconButton
                    aria-label={t('trainingModules.moveDown')} disabled={index === topics.length - 1}
                    onClick={() => change({ topics: moveTopic(topics, index, 1) })}>
                    <ArrowDownward /></IconButton></span></Tooltip>
                  <Tooltip title={t('trainingModules.removeTopic')}><IconButton
                    aria-label={t('trainingModules.removeTopic')}
                    onClick={() => change({ topics: topics.filter((_, position) => position !== index) })}>
                    <DeleteIcon /></IconButton></Tooltip>
                </>}
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        {!readOnly && <Button onClick={() => change({ topics: [...topics, {
          key: `${Date.now()}-${Math.random()}`, code: '', name: '',
        }] })}>{t('trainingModules.addTopic')}</Button>}
      </Grid>
    </Grid>
  );
}
