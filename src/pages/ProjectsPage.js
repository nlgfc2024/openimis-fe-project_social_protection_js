import React from 'react';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { withStyles, withTheme } from '@material-ui/core/styles';
import {
  Helmet,
  formatMessage,
  withModulesManager,
} from '@openimis/fe-core';

import BenefitPlanProjectsSearcher from '../components/BenefitPlanProjectsSearcher';
import {
  MODULE_NAME,
  RIGHT_PROJECT_SEARCH,
} from '../constants';

const styles = (theme) => ({
  page: theme.page,
});

function ProjectsPage({ intl, classes, rights }) {
  if (!rights.includes(RIGHT_PROJECT_SEARCH)) return null;

  return (
    <div className={classes.page}>
      <Helmet title={formatMessage(intl, MODULE_NAME, 'projects.pageTitle')} />
      <BenefitPlanProjectsSearcher
        rights={rights}
        standalone
      />
    </div>
  );
}

const mapStateToProps = (state) => ({
  rights: state.core?.user?.i_user?.rights ?? [],
});

export default withModulesManager(
  injectIntl(
    withTheme(
      withStyles(styles)(
        connect(mapStateToProps)(ProjectsPage),
      ),
    ),
  ),
);