import React from 'react';
import { Grid } from '@material-ui/core';
import { connect } from 'react-redux';
import {
  FormPanel,
  ValidatedTextInput,
  NumberInput,
  PublishedComponent,
  TextInput,
  withModulesManager,
} from '@openimis/fe-core';
import { injectIntl } from 'react-intl';
import { withTheme, withStyles } from '@material-ui/core/styles';
import {
  projectNameSetValid,
  projectNameValidationCheck,
  projectNameValidationClear,
} from '../actions';
import ProjectStatusPicker from '../pickers/ProjectStatusPicker';
import ActivityPicker from '../pickers/ActivityPicker';

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
      edited,
      classes,
      isProjectNameValid,
      isProjectNameValidating,
      projectNameValidationError,
      savedProjectName,
      readOnly,
    } = this.props;

    const project = { ...edited };
    const isNewProject = !project?.id;

    return (
      <Grid container className={classes.item}>
        <Grid item xs={4} className={classes.item}>
          <ValidatedTextInput
            module="projectSocialProtection"
            label="project.name"
            value={project?.name ?? ''}
            required
            readOnly={readOnly}
            onChange={(v) => this.updateAttribute('name', v)}
            itemQueryIdentifier="projectName"
            additionalQueryArgs={{
              benefitPlanId: project?.benefitPlan?.id,
            }}
            action={projectNameValidationCheck}
            clearAction={projectNameValidationClear}
            setValidAction={projectNameSetValid}
            shouldValidate={(v) => this.shouldValidate(v, savedProjectName)}
            codeTakenLabel="project.name.alreadyTaken"
            isValid={isProjectNameValid}
            isValidating={isProjectNameValidating}
            validationError={projectNameValidationError}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <ActivityPicker
            label="project.activity"
            required
            withNull={false}
            readOnly={readOnly}
            value={project?.activity}
            onChange={(v) => this.updateAttribute('activity', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <PublishedComponent
            pubRef="location.LocationCascader"
            module="projectSocialProtection"
            label="Location"
            required
            withNull={false}
            readOnly={readOnly}
            value={project?.location}
            onChange={(v) => this.updateAttribute('location', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <NumberInput
            module="projectSocialProtection"
            label="project.targetBeneficiaries"
            required
            readOnly={readOnly}
            min={1}
            value={project?.targetBeneficiaries}
            onChange={(v) => this.updateAttribute('targetBeneficiaries', v)}
          />
        </Grid>

        <Grid item xs={4} className={classes.item}>
          <NumberInput
            module="projectSocialProtection"
            label="project.workingDays"
            required
            readOnly={readOnly}
            min={1}
            value={project?.workingDays}
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
      </Grid>
    );
  }
}

const mapStateToProps = (state) => ({
  isProjectNameValid: state.projectSocialProtection.validationFields?.projectName?.isValid,
  isProjectNameValidating: state.projectSocialProtection.validationFields?.projectName?.isValidating,
  projectNameValidationError: state.projectSocialProtection.validationFields?.projectName?.validationError,
  savedProjectName: state.projectSocialProtection?.project?.name,
});

export default withModulesManager(injectIntl(withTheme(withStyles(styles)(
  connect(mapStateToProps)(ProjectHeadPanel),
))));
