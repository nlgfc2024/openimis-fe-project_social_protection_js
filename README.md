# Project social protection frontend

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
