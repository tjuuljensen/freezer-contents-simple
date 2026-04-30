# Freezer Management

A storage-backed Home Assistant companion integration plus custom dashboard card for tracking freezer contents with compartment-based organization.

## 1.1.3 changes

- Add row spacing is now even and horizontal.
- Form labels and table headers are aligned around:
  - Item
  - Packaging
  - Compartment
  - Added
  - Expiry
- `Clear inventory` now requires confirmation.
- Schema renamed:
  - `storageDate` → `addedDate`
  - `storageIsoDate` → `addedIsoDate`
- Added:
  - `expiryDate`
  - `expiryIsoDate`
- Added `expiryDate` sort mode.
- Added configurable date display:
  - `locale_short`
  - `locale_medium`
  - `locale_long`
  - `iso`
  - `relative`
- Card editor text fields now commit on blur/change instead of every keystroke.

## Resetting old contents

If the card still shows old contents:

1. Make sure the card uses the integration sensor, not the old file-backed sensor.
2. Remove old `notify.file` / `command_line` freezer entities.
3. Call:

```yaml
action: freezer_management.clear_inventory
data:
  entity_id: sensor.main_freezer_inventory