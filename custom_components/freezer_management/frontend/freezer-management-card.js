import Resources from "./freezer-management-resources.js";

const CARD_TYPE = "freezer-management-card";
const CARD_NAME = "Freezer Management Card";
const CARD_VERSION = "1.0.0";
const DOMAIN = "freezer_management";
const SORT_OPTIONS = ["compartment", "newest", "oldest", "contents"];

class FreezerManagementCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this.config = null;
    this.items = [];
    this.form = {
      contents: "",
      compartment: "",
    };
    this.errorMessage = "";
    this.pending = false;
    this.entityUnavailable = true;
    this._lastLanguage = null;
    this._lastStateSignature = null;
  }

  static getStubConfig() {
    return {
      title: "Freezer",
      entity: "",
      sort_by: "compartment",
      contents_header: "",
      compartment_header: "",
      date_header: "",
      show_shortcuts: true,
      shortcuts: [],
    };
  }

  static getConfigElement() {
    return document.createElement("freezer-management-card-editor");
  }

  setConfig(config) {
    this.config = this._normalizeConfig(config);
    this.style.display = "block";
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.refreshFromHass();
  }

  getCardSize() {
    return Math.max(4, Math.ceil((this.items.length + 6) / 3));
  }

  getGridOptions() {
    return {
      columns: 6,
      min_columns: 4,
      rows: Math.max(5, Math.ceil((this.items.length + 6) / 2)),
      min_rows: 4,
    };
  }

  refreshFromHass() {
    if (!this.config || !this._hass) {
      return;
    }

    const stateObj = this.config.entity ? this._hass.states?.[this.config.entity] ?? null : null;
    const signature = stateObj ? JSON.stringify([stateObj.state, stateObj.attributes?.items, stateObj.attributes?.updated_at]) : "missing";
    const language = this._getLanguage();

    if (this._lastStateSignature !== signature || this._lastLanguage !== language) {
      this._lastStateSignature = signature;
      this._lastLanguage = language;
      this.items = this._parseItems(stateObj);
      this.render();
      return;
    }

    if (!this.shadowRoot?.innerHTML) {
      this.render();
    }
  }

  render() {
    if (!this.config || !this.shadowRoot) {
      return;
    }

    const stateObj = this.config.entity ? this._hass?.states?.[this.config.entity] ?? null : null;
    const resolvedTitle =
      this.config.title?.trim() ||
      stateObj?.attributes?.friendly_name ||
      this._label("card-title", "Freezer Management");

    const shortcuts = this._getShortcuts();
    const formDisabled = this.pending || this.entityUnavailable || !this.config.entity;
    const canClearInventory = !formDisabled && this.items.length > 0;

    let bodyHtml = "";
    if (!this.config.entity) {
      bodyHtml = `<div class="fm-empty">${this._escapeHtml(this._label("setup-required", "Select a Freezer Management inventory entity in the card configuration."))}</div>`;
    } else {
      bodyHtml = `
        ${this._renderPanel(shortcuts, formDisabled)}
        ${this.items.length > 0
          ? this._renderTable()
          : `<div class="fm-empty">${this._escapeHtml(this._label("freezer-empty", "No items saved yet."))}</div>`}
      `;
    }

    const statusParts = [];
    if (this.config.entity) {
      if (this.entityUnavailable) {
        statusParts.push(this._label("inventory-unavailable", "The freezer inventory entity is unavailable."));
      } else {
        statusParts.push(`${this._label("status-items", "Items")}: ${this.items.length}`);
      }
    }
    if (this.errorMessage) {
      statusParts.push(this.errorMessage);
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .fm-card {
          color: var(--primary-text-color);
        }

        .fm-panel {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .fm-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .fm-panel-title {
          font-weight: 600;
        }

        .fm-status {
          font-size: 0.9rem;
          color: var(--secondary-text-color);
        }

        .fm-shortcuts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .fm-form {
          display: grid;
          gap: 12px;
          grid-template-columns: minmax(0, 2fr) minmax(140px, 1fr) auto;
          align-items: end;
        }

        .fm-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
        }

        .fm-table-wrap {
          overflow-x: auto;
        }

        .fm-table {
          width: 100%;
          border-collapse: collapse;
        }

        .fm-table th,
        .fm-table td {
          padding: 8px 4px;
          border-bottom: 1px solid var(--divider-color);
          vertical-align: middle;
        }

        .fm-table th {
          text-align: left;
          font-weight: 600;
        }

        .fm-table td.fm-date,
        .fm-table th.fm-date,
        .fm-table td.fm-action,
        .fm-table th.fm-action {
          text-align: right;
          white-space: nowrap;
        }

        .fm-empty {
          padding: 12px 0 4px;
          color: var(--secondary-text-color);
        }

        .fm-row-content {
          word-break: break-word;
        }

        .fm-footer-note {
          margin-top: 4px;
          font-size: 0.8rem;
          color: var(--secondary-text-color);
        }

        button {
          appearance: none;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          font: inherit;
          cursor: pointer;
          background: var(--primary-color);
          color: var(--text-primary-color, white);
        }

        button.fm-secondary {
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
        }

        button.fm-icon {
          padding: 8px 10px;
          border-radius: 10px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        label.fm-field {
          display: grid;
          gap: 6px;
          font-size: 0.9rem;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }

        .fm-warning {
          font-size: 0.85rem;
          color: var(--warning-color, #db4437);
        }

        @media (max-width: 700px) {
          .fm-form {
            grid-template-columns: 1fr;
          }

          .fm-actions {
            justify-content: stretch;
          }

          .fm-actions button {
            flex: 1 1 auto;
          }
        }
      </style>

      <ha-card header="${this._escapeAttr(resolvedTitle)}">
        <div class="card-content fm-card">
          ${bodyHtml}
          ${statusParts.length ? `<div class="fm-footer-note">${this._escapeHtml(statusParts.join(" • "))}</div>` : ""}
          ${this.config.entity && this.entityUnavailable
            ? `<div class="fm-warning">${this._escapeHtml(this._label("inventory-warning-readonly", "Editing is disabled until the freezer inventory is available again."))}</div>`
            : ""}
          ${this.config.entity && !this.entityUnavailable && this.items.length > 0
            ? `<div class="fm-actions" style="margin-top: 12px;">
                <button class="fm-secondary" id="clear-inventory-btn" ${canClearInventory ? "" : "disabled"}>
                  ${this._escapeHtml(this._label("clear-inventory-button", "Clear inventory"))}
                </button>
              </div>`
            : ""}
        </div>
      </ha-card>
    `;

    this._bindEvents();
  }

  _renderPanel(shortcuts, formDisabled) {
    const shortcutHtml = this.config.show_shortcuts && shortcuts.length
      ? `
        <div class="fm-shortcuts">
          ${shortcuts
            .map(
              (shortcut) => `
                <button
                  type="button"
                  class="fm-secondary fm-shortcut"
                  data-shortcut="${this._escapeAttr(shortcut)}"
                  ${formDisabled ? "disabled" : ""}
                >
                  ${this._escapeHtml(shortcut)}
                </button>
              `
            )
            .join("")}
        </div>
      `
      : "";

    return `
      <div class="fm-panel">
        <div class="fm-panel-header">
          <div class="fm-panel-title">${this._escapeHtml(this._label("form-title", "Add freezer item"))}</div>
        </div>

        ${shortcutHtml}

        <div class="fm-form">
          <label class="fm-field">
            <span>${this._escapeHtml(this._label("item-contents-label", "Contents"))}</span>
            <input
              id="fm-contents"
              type="text"
              value="${this._escapeAttr(this.form.contents || "")}"
              placeholder="${this._escapeAttr(this._label("item-contents-placeholder", "Soup, bolognese, ..."))}"
              ${formDisabled ? "disabled" : ""}
            />
          </label>

          <label class="fm-field">
            <span>${this._escapeHtml(this._label("item-compartment-label", "Compartment"))}</span>
            <input
              id="fm-compartment"
              type="text"
              value="${this._escapeAttr(this.form.compartment || "")}"
              ${formDisabled ? "disabled" : ""}
            />
          </label>

          <div class="fm-actions">
            <button id="save-item-btn" ${formDisabled ? "disabled" : ""}>
              ${this._escapeHtml(this.pending
                ? this._label("saving-button", "Saving...")
                : this._label("save-item-button", "Save"))}
            </button>
            <button id="clear-form-btn" class="fm-secondary" ${formDisabled ? "disabled" : ""}>
              ${this._escapeHtml(this._label("clear-form-button", "Clear"))}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTable() {
    const headers = {
      contents: this.config.contents_header?.trim() || this._label("table-header-contents", "Contents"),
      compartment: this.config.compartment_header?.trim() || this._label("table-header-compartment", "Cmp"),
      date: this.config.date_header?.trim() || this._label("table-header-date", "Date"),
    };

    return `
      <div class="fm-table-wrap">
        <table class="fm-table">
          <thead>
            <tr>
              <th>${this._escapeHtml(headers.contents)}</th>
              <th>${this._escapeHtml(headers.compartment)}</th>
              <th class="fm-date">${this._escapeHtml(headers.date)}</th>
              <th class="fm-action"></th>
            </tr>
          </thead>
          <tbody>
            ${this.items
              .map(
                (item) => `
                  <tr>
                    <td class="fm-row-content">${this._escapeHtml(item.contents || "")}</td>
                    <td>${this._escapeHtml(item.compartment || "")}</td>
                    <td class="fm-date">${this._escapeHtml(this._displayDate(item))}</td>
                    <td class="fm-action">
                      <button
                        class="fm-secondary fm-icon fm-delete"
                        data-item-id="${this._escapeAttr(item.id || "")}"
                        aria-label="${this._escapeAttr(this._label("delete-item-label", "Delete item"))}"
                        title="${this._escapeAttr(this._label("delete-item-label", "Delete item"))}"
                        ${this.pending || this.entityUnavailable ? "disabled" : ""}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  _bindEvents() {
    const contentsInput = this.shadowRoot.getElementById("fm-contents");
    const compartmentInput = this.shadowRoot.getElementById("fm-compartment");
    const saveButton = this.shadowRoot.getElementById("save-item-btn");
    const clearButton = this.shadowRoot.getElementById("clear-form-btn");
    const clearInventoryButton = this.shadowRoot.getElementById("clear-inventory-btn");

    if (contentsInput) {
      contentsInput.addEventListener("input", (event) => {
        this.form.contents = event.target.value;
        this.errorMessage = "";
      });
      contentsInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this._saveItem();
        }
      });
    }

    if (compartmentInput) {
      compartmentInput.addEventListener("input", (event) => {
        this.form.compartment = event.target.value;
      });
      compartmentInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this._saveItem();
        }
      });
    }

    if (saveButton) {
      saveButton.addEventListener("click", () => this._saveItem());
    }

    if (clearButton) {
      clearButton.addEventListener("click", () => this._clearForm());
    }

    if (clearInventoryButton) {
      clearInventoryButton.addEventListener("click", () => this._clearInventory());
    }

    this.shadowRoot.querySelectorAll(".fm-shortcut").forEach((button) => {
      button.addEventListener("click", () => {
        this.form.contents = button.dataset.shortcut || "";
        this.errorMessage = "";
        this.render();

        const newContentsInput = this.shadowRoot.getElementById("fm-contents");
        if (newContentsInput) {
          newContentsInput.focus();
          newContentsInput.select();
        }
      });
    });

    this.shadowRoot.querySelectorAll(".fm-delete").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.dataset.itemId;
        if (itemId) {
          this._deleteItem(itemId);
        }
      });
    });
  }

  async _saveItem() {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable) {
      return;
    }

    const contents = (this.form.contents || "").trim();
    const compartment = (this.form.compartment || "").trim();

    if (!contents) {
      this.errorMessage = this._label("validation-missing-contents", "Enter contents before saving.");
      this.render();
      return;
    }

    this.pending = true;
    this.errorMessage = "";
    this.render();

    try {
      await this._hass.callService(DOMAIN, "add_item", {
        entity_id: this.config.entity,
        contents,
        compartment,
      });
      this.form = {
        contents: "",
        compartment: "",
      };
    } catch (error) {
      this.errorMessage = `${this._label("save-error", "Could not save freezer contents.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  async _deleteItem(itemId) {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable) {
      return;
    }

    this.pending = true;
    this.errorMessage = "";
    this.render();

    try {
      await this._hass.callService(DOMAIN, "remove_item", {
        entity_id: this.config.entity,
        item_id: itemId,
      });
    } catch (error) {
      this.errorMessage = `${this._label("delete-error", "Could not delete freezer item.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  async _clearInventory() {
    if (!this._hass || !this.config?.entity || this.pending || this.entityUnavailable || !this.items.length) {
      return;
    }

    this.pending = true;
    this.errorMessage = "";
    this.render();

    try {
      await this._hass.callService(DOMAIN, "clear_inventory", {
        entity_id: this.config.entity,
      });
    } catch (error) {
      this.errorMessage = `${this._label("clear-error", "Could not clear freezer inventory.")} ${error?.message || ""}`.trim();
    } finally {
      this.pending = false;
      this.render();
    }
  }

  _clearForm() {
    this.form = {
      contents: "",
      compartment: "",
    };
    this.errorMessage = "";
    this.render();
  }

  _parseItems(stateObj) {
    const unavailableStates = new Set(["unavailable", "unknown"]);
    this.entityUnavailable = !stateObj || unavailableStates.has(String(stateObj.state));

    if (!stateObj || !Array.isArray(stateObj.attributes?.items)) {
      return [];
    }

    const items = stateObj.attributes.items
      .map((item, index) => ({
        id: String(item?.id || `row-${index}`),
        contents: String(item?.contents || item?.potContents || "").trim(),
        compartment: String(item?.compartment || item?.potCompartment || "").trim(),
        date: String(item?.date || "").trim(),
        iso_date: String(item?.iso_date || "").trim(),
      }))
      .filter((item) => item.contents);

    return this._sortItems(items);
  }

  _sortItems(items) {
    const sortBy = this.config?.sort_by || "compartment";
    const collator = new Intl.Collator(this._getLanguage(), { numeric: true, sensitivity: "base" });

    return [...items].sort((left, right) => {
      if (sortBy === "contents") {
        return collator.compare(left.contents, right.contents);
      }

      if (sortBy === "newest" || sortBy === "oldest") {
        const leftDate = this._dateValue(left);
        const rightDate = this._dateValue(right);
        return sortBy === "newest" ? rightDate - leftDate : leftDate - rightDate;
      }

      const compartmentCompare = collator.compare(left.compartment || "", right.compartment || "");
      if (compartmentCompare !== 0) {
        return compartmentCompare;
      }
      return collator.compare(left.contents, right.contents);
    });
  }

  _dateValue(item) {
    const candidate = item.iso_date || item.date || "";
    const timestamp = Date.parse(candidate);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  _displayDate(item) {
    if (item.date) {
      return item.date;
    }

    if (!item.iso_date) {
      return "";
    }

    const parsed = new Date(item.iso_date);
    if (Number.isNaN(parsed.getTime())) {
      return item.iso_date;
    }

    return new Intl.DateTimeFormat(this._getLanguage(), {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(parsed);
  }

  _getShortcuts() {
    if (!Array.isArray(this.config?.shortcuts)) {
      return [];
    }

    return this.config.shortcuts
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  _normalizeConfig(config) {
    return {
      ...FreezerManagementCard.getStubConfig(),
      ...config,
      sort_by: SORT_OPTIONS.includes(config?.sort_by) ? config.sort_by : "compartment",
      show_shortcuts: config?.show_shortcuts !== false,
      shortcuts: Array.isArray(config?.shortcuts) ? config.shortcuts : [],
    };
  }

  _getLanguage() {
    return (
      this._hass?.locale?.language ||
      this._hass?.language ||
      document.documentElement.lang ||
      "en"
    ).split("-")[0];
  }

  _label(key, fallback) {
    const language = this._getLanguage();
    return Resources[language]?.[key] || Resources.en?.[key] || fallback;
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _escapeAttr(value) {
    return this._escapeHtml(value);
  }
}

class FreezerManagementCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = {
      ...FreezerManagementCard.getStubConfig(),
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = {
      ...FreezerManagementCard.getStubConfig(),
      ...this._config,
    };

    const language = this._getLanguage();
    const labels = Resources[language] || Resources.en;
    const sensorEntities = this._inventoryEntities();
    const shortcutsText = Array.isArray(config.shortcuts) ? config.shortcuts.join("\n") : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .editor {
          display: grid;
          gap: 16px;
        }

        .section {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          background: var(--secondary-background-color);
        }

        .section-title {
          font-weight: 600;
        }

        .grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 0.95rem;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
        }

        .checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.95rem;
        }

        .checkbox input {
          width: auto;
        }

        .hint {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
        }
      </style>

      <div class="editor">
        <div class="section">
          <div class="section-title">${this._escape(labels["editor-section-connection"] || "Connection")}</div>
          <div class="grid">
            <label>
              <span>${this._escape(labels["editor-title"] || "Title")}</span>
              <input data-field="title" type="text" value="${this._escape(config.title || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-entity"] || "Inventory entity")}</span>
              <input
                data-field="entity"
                type="text"
                list="inventory-entities"
                value="${this._escape(config.entity || "")}"
                placeholder="sensor.freezer_inventory"
              />
              <datalist id="inventory-entities">
                ${sensorEntities.map((entityId) => `<option value="${this._escape(entityId)}"></option>`).join("")}
              </datalist>
            </label>

            <label>
              <span>${this._escape(labels["editor-sort-by"] || "Sort by")}</span>
              <select data-field="sort_by">
                ${SORT_OPTIONS.map((option) => `
                  <option value="${option}" ${config.sort_by === option ? "selected" : ""}>${option}</option>
                `).join("")}
              </select>
            </label>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${this._escape(labels["editor-section-display"] || "Display")}</div>
          <div class="grid">
            <label>
              <span>${this._escape(labels["editor-contents-header"] || "Contents header")}</span>
              <input data-field="contents_header" type="text" value="${this._escape(config.contents_header || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-compartment-header"] || "Compartment header")}</span>
              <input data-field="compartment_header" type="text" value="${this._escape(config.compartment_header || "")}" />
            </label>

            <label>
              <span>${this._escape(labels["editor-date-header"] || "Date header")}</span>
              <input data-field="date_header" type="text" value="${this._escape(config.date_header || "")}" />
            </label>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${this._escape(labels["editor-section-shortcuts"] || "Shortcuts")}</div>
          <label class="checkbox">
            <input data-field="show_shortcuts" type="checkbox" ${config.show_shortcuts ? "checked" : ""} />
            <span>${this._escape(labels["editor-show-shortcuts"] || "Show shortcut buttons")}</span>
          </label>

          <label>
            <span>${this._escape(labels["editor-shortcuts"] || "Shortcut items")}</span>
            <textarea data-field="shortcuts">${this._escape(shortcutsText)}</textarea>
            <span class="hint">${this._escape(labels["editor-shortcuts-hint"] || "One shortcut label per line.")}</span>
          </label>
        </div>
      </div>
    `;

    this._bindEditorEvents();
  }

  _bindEditorEvents() {
    this.shadowRoot.querySelectorAll("[data-field]").forEach((element) => {
      const eventName = element.tagName === "SELECT" || element.type === "checkbox" ? "change" : "input";
      element.addEventListener(eventName, (event) => this._handleChange(event));
    });
  }

  _handleChange(event) {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }

    const nextConfig = {
      ...this._config,
    };

    if (field === "show_shortcuts") {
      nextConfig.show_shortcuts = Boolean(event.target.checked);
    } else if (field === "shortcuts") {
      nextConfig.shortcuts = String(event.target.value || "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
    } else {
      nextConfig[field] = event.target.value;
    }

    this._config = nextConfig;
    this._fireConfigChanged(nextConfig);
  }

  _fireConfigChanged(config) {
    const event = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    event.detail = { config };
    this.dispatchEvent(event);
  }

  _inventoryEntities() {
    const states = this._hass?.states || {};
    const entityIds = Object.keys(states).filter((entityId) => entityId.startsWith("sensor."));
    const freezerManagement = entityIds.filter((entityId) => {
      const stateObj = states[entityId];
      const integration = stateObj?.attributes?.source || stateObj?.attributes?.integration;
      return entityId.endsWith("_inventory") || integration === DOMAIN || Array.isArray(stateObj?.attributes?.items);
    });

    return freezerManagement.length ? freezerManagement.sort() : entityIds.sort();
  }

  _getLanguage() {
    return (
      this._hass?.locale?.language ||
      this._hass?.language ||
      document.documentElement.lang ||
      "en"
    ).split("-")[0];
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, FreezerManagementCard);
}

if (!customElements.get("freezer-management-card-editor")) {
  customElements.define("freezer-management-card-editor", FreezerManagementCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === `custom:${CARD_TYPE}`)) {
  window.customCards.push({
    type: `custom:${CARD_TYPE}`,
    name: CARD_NAME,
    description: "Storage-backed freezer inventory card with inline add/remove actions.",
    preview: true,
  });
}

console.info(
  `%c ${CARD_NAME} %c ${CARD_VERSION} `,
  "color: white; background: #1976d2; font-weight: 700;",
  "color: #1976d2; background: white; font-weight: 700;"
);
