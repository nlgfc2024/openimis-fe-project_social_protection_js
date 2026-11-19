# Project social protection frontend

## Training form modules

When the backend deployment type is TRAINING, the form selects programme modules
instead of a work Activity. All programme modules are selected by default on
creation; the picker loads every catalogue page and allows a subset. The number
of topics is read-only and working days is never sent for training. Editing uses
the saved module names/counts; after attendance the selection is locked and no
live catalogue lookup is needed. WORK fields and payloads are unchanged.

Requires backend migration `0009_training_topic_snapshots` and the companion
language-pack labels. This step supplies the form and saved topic structure for
issue #130; its attendance grid is separate.

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
