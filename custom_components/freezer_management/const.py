"""Constants for the Freezer Management integration."""

from __future__ import annotations

DOMAIN = "freezer_management"
PLATFORMS = ["sensor"]

STORAGE_VERSION = 1
STORAGE_KEY_PREFIX = f"{DOMAIN}.inventory"

ATTR_CONTENTS = "contents"
ATTR_COMPARTMENT = "compartment"
ATTR_DATE = "date"
ATTR_ISO_DATE = "iso_date"
ATTR_ITEM_ID = "item_id"
ATTR_ITEMS = "items"
ATTR_UPDATED_AT = "updated_at"

SERVICE_ADD_ITEM = "add_item"
SERVICE_REMOVE_ITEM = "remove_item"
SERVICE_CLEAR_INVENTORY = "clear_inventory"

DEFAULT_TITLE = "Freezer"
INVENTORY_ENTITY_NAME = "Inventory"

STATIC_URL_PATH = f"/api/{DOMAIN}/static"

DATA_ENTRIES = "entries"
