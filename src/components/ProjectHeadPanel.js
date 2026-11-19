import React from 'react';
import { Grid } from '@material-ui/core';
import {
  FormPanel,
  NumberInput,
  PublishedComponent,
  TextInput,
  formatMessage,
  withModulesManager,
} from '@openimis/fe-core';
import { injectIntl } from 'react-intl';
import { withTheme, withStyles } from '@material-ui/core/styles';
import ProjectStatusPicker from '../pickers/ProjectStatusPicker';
import ActivityPicker from '../pickers/ActivityPicker';
import TrainingModulePicker from '../pickers/TrainingModulePicker';
import HotspotPicker from '../pickers/HotspotPicker';
import UserPicker from '../pickers/UserPicker';
import {
  getMaxTargetBeneficiaries,
  MODULE_NAME,
} from '../constants';

// Walk the location parent chain (from the flat projection) and return the
// ancestor whose `type` matches. Used to derive District (R) / TA (D) from the
// single location selected in the cascader so the Micro-Catchment / Hotspot
// pickers can be filtered by the chosen TA.
function findLocationByType(location, type) {
  let loc = location;
  while (loc) {
    if (loc.type === type) return loc;
    loc = loc.parent;
  }
  return null;
}

const styles = (theme) => ({
  item: theme.paper.item,
});

class ProjectHeadPanel extends FormPanel {
  shouldValidate(inputValue, savedValue) {
    if (!savedValue) return false;
    return !this.props.edited?.id || inputValue !== savedValue;
  }

  render() {
    const {
      intl,
      edited,
      classes,
      readOnly,
      previewProjectName,
    } = this.props;

    const project = { ...edited };
    const isNewProject = !project?.id;
    const isTraining = project?.projectType === 'TRAINING';
    const maxTargetBeneficiaries = getMaxTargetBeneficiaries(this.props.modulesManager);
    const canPreviewGeneratedName = Boolean(project?.hotspot?.name && project?.activity?.name);
    const displayProjectName = project?.name || (canPreviewGeneratedName ? previewProjectName : '') || '';
    // The District is kept as a transient field; fall back to deriving it from the
    // stored TA (project.location) so it displays correctly when editing.
    const district = project?.district || findLocationByType(project?.location, 'R');

    return (
      <Grid container className={classes.item}>
        <Grid item xs={4} className={classes.item}>
          {/* WORK names are generated; TRAINING names are entered by the user. */}
          <TextInput
            module="projectSocialProtection"
            label="project.name"
            value={isTraining ? project?.name || '' : displayProjectName}
            required={isTraining}
            readOnly={readOnly}
            inputProps={{ readOnly: !isTraining, maxLength: 255 }}
            onChange={(v) => this.updateAttribute('name', v)}
            placeholder={isTraining ? '' : formatMessage(intl, MODULE_NAME, 'project.name.autoHint')}
          />
        </Grid>

        {isTraining && ['sessionStartDate', 'sessionEndDate'].map((field) => (
          <Grid item xs={4} className={classes.item} key={field}>
            <PublishedComponent
              pubRef="core.DatePicker"
              module="projectSocialProtection"
              label={`project.${field}`}
              value={project[field] || ''}
              readOnly={readOnly}
              onChange={(v) => this.updateAttribute(field, v)}
            />
          </Grid>
        ))}

        {!isNewProject && (
          <Grid item xs={4} className={classes.item}>
            <TextInput
              module="projectSocialProtection"
              label="project.code"
              value={project?.code ?? ''}
              readOnly
            />
          </Grid>
        )}

        <Grid item xs={4} className={classes.item}>
          <PublishedComponent
            pubRef="location.MwDistrictPicker"
            module="projectSocialProtection"
            label={formatMessage(intl, MODULE_NAME, 'project.district')}
            required
            withNull={false}
            readOnly={readOnly}
            value={district}
            onChange={(v) => {
              if (!v?.uuid) return;
              if (district?.uuid !== v?.uuid) {
                this.updateAttributes({
                  district: v,
                  location: null,
                  microCatchment: null,
                  hotspot: null,
                });
              }
            }}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <PublishedComponent
            pubRef="location.MwTAPicker"
            module="projectSocialProtection"
            label={formatMessage(intl, MODULE_NAME, 'project.ta')}
            required
            withNull={false}
            readOnly={readOnly || !district}
            parentLocation={district}
            value={project?.location}
            onChange={(v) => {
              if (!v?.uuid) return;
              if (project?.location?.uuid !== v?.uuid) {
                this.updateAttributes({
                  microCatchment: null,
                  hotspot: null,
                  location: v,
                });
              } else {
                this.updateAttribute('location', v);
              }
            }}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <PublishedComponent
            pubRef="location.MicroCatchmentPicker"
            module="projectSocialProtection"
            label="project.microCatchment"
            required
            withNull={false}
            readOnly={readOnly}
            value={project?.microCatchment}
            district={district}
            onChange={(v) => {
              if (project?.microCatchment?.id !== v?.id) {
                this.updateAttributes({
                  hotspot: null,
                  microCatchment: v,
                });
              } else {
                this.updateAttribute('microCatchment', v);
              }
            }}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <HotspotPicker
            label={formatMessage(intl, MODULE_NAME, 'project.hotspot')}
            withLabel
            required
            readOnly={readOnly}
            value={project?.hotspot}
            microCatchmentUuid={project?.microCatchment?.uuid}
            onChange={(v) => this.updateAttribute('hotspot', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          {isTraining ? <TrainingModulePicker
            programmeId={project?.benefitPlan?.id}
            value={project?.trainingModules}
            savedModules={this.props.project?.trainingModules}
            readOnly={readOnly || project?.trainingModulesLocked}
            onStateChange={(updates) => this.props.onEditedChanged((current) => ({ ...current, ...updates }))}
          /> : (
          <ActivityPicker
            label="project.activity"
            required
            withNull={false}
            readOnly={readOnly}
            value={project?.activity}
            onChange={(v) => this.updateAttribute('activity', v)}
          />
          )}
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <TextInput
            module="projectSocialProtection"
            label="project.knownPlace"
            value={project?.knownPlace ?? ''}
            readOnly={readOnly}
            onChange={(v) => this.updateAttribute('knownPlace', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <NumberInput
            module="projectSocialProtection"
            label="project.targetBeneficiaries"
            required
            readOnly={readOnly}
            min={1}
            max={maxTargetBeneficiaries}
            value={project?.targetBeneficiaries}
            onChange={(v) => this.updateAttribute('targetBeneficiaries', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <NumberInput
            module="projectSocialProtection"
            label={isTraining ? 'project.topicCount' : 'project.workingDays'}
            required={!isTraining}
            readOnly={readOnly || isTraining}
            min={1}
            value={isTraining ? project?.trainingModules?.reduce((total, module) => total + module.topicCount, 0) : project?.workingDays}
            onChange={(v) => this.updateAttribute('workingDays', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <ProjectStatusPicker
            required
            readOnly={readOnly || isNewProject}
            value={project?.status || 'PREPARATION'}
            onChange={(v) => this.updateAttribute('status', v)}
            withNull={false}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <TextInput
            module="projectSocialProtection"
            label="project.benefitPlan"
            value={project?.benefitPlan?.name ?? ''}
            readOnly
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <UserPicker
            label="project.foreman"
            readOnly={readOnly}
            value={project?.foreman}
            onChange={(v) => this.updateAttribute('foreman', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <UserPicker
            label="project.supervisor"
            readOnly={readOnly}
            value={project?.supervisor}
            onChange={(v) => this.updateAttribute('supervisor', v)}
          />
        </Grid>
      </Grid>
    );
  }
}

export default withModulesManager(injectIntl(withTheme(withStyles(styles)(ProjectHeadPanel))));
