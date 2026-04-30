"""Config flow for Freezer Management."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DEFAULT_TITLE, DOMAIN


class FreezerManagementConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Freezer Management."""

    VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> FlowResult:
        """Handle the initial step."""
        if user_input is not None:
            title = user_input["title"].strip() or DEFAULT_TITLE
            return self.async_create_entry(title=title, data={"title": title})

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("title", default=DEFAULT_TITLE): str,
                }
            ),
        )
