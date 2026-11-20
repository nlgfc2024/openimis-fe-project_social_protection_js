# Project social protection frontend

## Configurable Training creation fields

The creation form obtains its field settings from the backend's
`projectTrainingFormConfig` query. Configure `training_form.fields` in Django admin
under **project_social_protection / backend / 1.0.0**. Each field accepts `visible`,
`required`, `readOnly`, and a typed `default` where applicable. See the backend's
`training-form-config.example.json` for all field names and a complete example.
Merge it with existing module configuration and reload the page after saving.
No frontend rebuild is required for later configuration changes.

Creation defaults do not overwrite an existing record. Hidden fields do not leave
empty layout cells or use CSS hiding; hidden module metadata still loads so the
derived topic count stays correct. Programme, initial status and topic count
remain system-controlled. WORK fields keep their current behavior.

## Training form modules

When the backend deployment type is TRAINING, the form shows programme modules
instead of a work Activity. Creation loads every catalogue page and preselects
programme modules. No moduleIds or workingDays are sent: the backend creates the
fixed topic list from all programme modules. Details use that fixed membership
and order, with current catalogue labels. The number of topics is read-only.
WORK fields and payloads are unchanged.

Requires the backend topic-list migrations and companion language-pack labels.
Related: nlgfc2024/openimis-be-project_social_protection_py#21,
nlgfc2024/openimis-be-project_social_protection_py#26 and
nlgfc2024/openimis-be-project_social_protection_py#28.
Training attendance uses ordered topic codes as checkbox
columns, with topic names available on hover. Each module has a read-only
completion column showing the backend enrollment's moduleCompletion values for
saved rows. Only rows with unsaved attendance edits in the open grid get a local
preview; undoing the edits restores the backend values. Percentages show one
decimal, truncated to avoid rounding a value below a payroll threshold up to it
(35/44 shows 79.5%). The UI does not apply payment thresholds or display pass/fail.
Saving waits for mutation confirmation before discarding edits; failed saves keep
the editor open. WORK retains numbered day columns.

## Training module catalogue

The catalogue is under **Administration > Training modules**, at
`/front/trainingModules`. Viewing requires Activity search right **208001**;
create, edit, and delete require **208002**, **208003**, and **208004** respectively.

If a deployment configures `fe-core.menus`, its Administration submenu list must
include the contribution ID below. The core menu renderer hides contributions
that are omitted from a configured list, even when the user has the required right.

Add this entry to the existing `AdminMainMenu.submenus` array in the frontend
`fe-core` ModuleConfiguration, using an available position and preserving the
other entries:

```json
{
  "id": "projectSocialProtection.trainingModules",
  "position": 11,
  "name": "Training modules"
}
```

Reload the application after changing menu configuration. The page manages module
names, programme links, and ordered topics; participant attendance is separate.

For programme-specific fields, add `training_form.programs.202646268.fields` (RMEP)
and `training_form.programs.<UPG_PROGRAM_CODE>.fields` (UPG) to that backend configuration.
These override shared fields per property. The creation page requests effective
rules for its selected BenefitPlan; the backend matches the programme code. Replace `<UPG_PROGRAM_CODE>` with its actual code.
See the backend `training-form-config.example.json` for both programmes.
