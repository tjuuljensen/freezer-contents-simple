"""Diagnostics support for Freezer Management."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import ATTR_ITEMS, ATTR_UPDATED_AT
from .storage import FreezerInventoryStore

FreezerManagementConfigEntry = ConfigEntry[FreezerInventoryStore]


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: FreezerManagementConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    store = entry.runtime_data
    compartments = sorted(
        {
            item.get("compartment", "")
            for item in store.items
            if item.get("compartment", "")
        }
    )

    return {
        "entry_id": entry.entry_id,
        "title": entry.title,
        "item_count": len(store.items),
        "compartments": compartments,
        ATTR_UPDATED_AT: store.updated_at,
        ATTR_ITEMS: [
            {
                "id": item.get("id"),
                "compartment": item.get("compartment", ""),
                "date": item.get("date", ""),
                "contents_length": len(item.get("contents", "")),
            }
            for item in store.items
        ],
    }
