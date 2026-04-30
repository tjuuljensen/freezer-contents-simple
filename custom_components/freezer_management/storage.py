"""Storage helpers for Freezer Management."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Callable, NotRequired, TypedDict
from uuid import uuid4

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import (
    ATTR_COMPARTMENT,
    ATTR_CONTENTS,
    ATTR_DATE,
    ATTR_ISO_DATE,
    ATTR_ITEM_ID,
    ATTR_ITEMS,
    ATTR_UPDATED_AT,
    STORAGE_KEY_PREFIX,
    STORAGE_VERSION,
)


class FreezerItem(TypedDict):
    """Stored freezer item."""

    id: str
    contents: str
    compartment: str
    date: str
    iso_date: str


class LegacyFreezerItem(TypedDict):
    """Legacy item shape from older card versions."""

    potContents: NotRequired[str]
    potCompartment: NotRequired[str]
    contents: NotRequired[str]
    compartment: NotRequired[str]
    date: NotRequired[str]
    iso_date: NotRequired[str]
    id: NotRequired[str]


class FreezerStoreData(TypedDict):
    """Persisted store payload."""

    items: list[FreezerItem]
    updated_at: str


Listener = Callable[[], None]


@dataclass(slots=True)
class FreezerInventoryStore:
    """Storage-backed freezer inventory."""

    hass: HomeAssistant
    entry_id: str
    _store: Store[FreezerStoreData] = field(init=False)
    _data: FreezerStoreData = field(
        default_factory=lambda: {
            ATTR_ITEMS: [],
            ATTR_UPDATED_AT: "",
        }
    )
    _listeners: list[Listener] = field(default_factory=list)
    loaded: bool = False

    def __post_init__(self) -> None:
        """Initialize the storage helper."""
        self._store = Store[FreezerStoreData](
            self.hass,
            STORAGE_VERSION,
            f"{STORAGE_KEY_PREFIX}.{self.entry_id}",
        )

    @property
    def items(self) -> list[FreezerItem]:
        """Return stored items."""
        return self._data[ATTR_ITEMS]

    @property
    def updated_at(self) -> str:
        """Return last update timestamp."""
        return self._data[ATTR_UPDATED_AT]

    async def async_load(self) -> None:
        """Load persisted state."""
        raw = await self._store.async_load()
        self._data = self._normalize_store(raw)
        self.loaded = True
        self._notify()

    @callback
    def async_add_listener(self, listener: Listener) -> Callable[[], None]:
        """Subscribe to store updates."""
        self._listeners.append(listener)

        @callback
        def remove_listener() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return remove_listener

    async def async_add_item(
        self,
        *,
        contents: str,
        compartment: str = "",
        date: str | None = None,
    ) -> FreezerItem:
        """Add an item to storage."""
        now = datetime.now(UTC)
        item: FreezerItem = {
            ATTR_ITEM_ID: uuid4().hex,
            ATTR_CONTENTS: contents.strip(),
            ATTR_COMPARTMENT: compartment.strip(),
            ATTR_DATE: date.strip() if date else now.date().isoformat(),
            ATTR_ISO_DATE: now.isoformat(),
        }
        self._data[ATTR_ITEMS].append(item)
        self._touch_updated_at(now)
        await self._async_save()
        self._notify()
        return item

    async def async_remove_item(self, item_id: str) -> bool:
        """Remove an item from storage."""
        original_count = len(self._data[ATTR_ITEMS])
        self._data[ATTR_ITEMS] = [
            item for item in self._data[ATTR_ITEMS] if item[ATTR_ITEM_ID] != item_id
        ]
        removed = len(self._data[ATTR_ITEMS]) != original_count
        if removed:
            self._touch_updated_at()
            await self._async_save()
            self._notify()
        return removed

    async def async_clear(self) -> None:
        """Clear all items."""
        self._data[ATTR_ITEMS] = []
        self._touch_updated_at()
        await self._async_save()
        self._notify()

    async def _async_save(self) -> None:
        """Persist the current store payload."""
        await self._store.async_save(self._data)

    @callback
    def _notify(self) -> None:
        """Notify listeners of updates."""
        for listener in list(self._listeners):
            listener()

    @staticmethod
    def _normalize_store(raw: FreezerStoreData | dict[str, Any] | None) -> FreezerStoreData:
        """Normalize raw persisted data."""
        items: list[FreezerItem] = []
        updated_at = ""

        if isinstance(raw, dict):
            updated_at = str(raw.get(ATTR_UPDATED_AT, "") or "")
            raw_items = raw.get(ATTR_ITEMS, [])
            if isinstance(raw_items, list):
                for raw_item in raw_items:
                    normalized = FreezerInventoryStore._normalize_item(raw_item)
                    if normalized is not None:
                        items.append(normalized)

        return {
            ATTR_ITEMS: items,
            ATTR_UPDATED_AT: updated_at,
        }

    @staticmethod
    def _normalize_item(raw_item: Any) -> FreezerItem | None:
        """Normalize one item from storage."""
        if not isinstance(raw_item, dict):
            return None

        item = raw_item

        contents = str(
            item.get(ATTR_CONTENTS)
            or item.get("potContents")
            or ""
        ).strip()
        compartment = str(
            item.get(ATTR_COMPARTMENT)
            or item.get("potCompartment")
            or ""
        ).strip()
        date = str(item.get(ATTR_DATE) or "").strip()
        iso_date = str(item.get(ATTR_ISO_DATE) or "").strip()
        item_id = str(item.get(ATTR_ITEM_ID) or "").strip() or uuid4().hex

        if not contents:
            return None

        if not date and iso_date:
            date = iso_date[:10]
        if not iso_date:
            iso_date = datetime.now(UTC).isoformat()

        return {
            ATTR_ITEM_ID: item_id,
            ATTR_CONTENTS: contents,
            ATTR_COMPARTMENT: compartment,
            ATTR_DATE: date,
            ATTR_ISO_DATE: iso_date,
        }

    def _touch_updated_at(self, now: datetime | None = None) -> None:
        """Update the store timestamp."""
        self._data[ATTR_UPDATED_AT] = (now or datetime.now(UTC)).isoformat()
