/**
 * Lights Card
 * A standalone, fully configurable Lovelace card for toggling and dimming lights.
 * Extracted from the Kitchen Dashboard Card lights section.
 *
 * Author: robman2026
 * GitHub: https://github.com/robman2026/lights-card
 * Version: 1.1.0
 * License: MIT
 *
 * Features:
 *  - Configurable list of lights (add/remove in the visual editor)
 *  - Per-light: entity, label, icon, "dimmable" flag
 *  - Tap = toggle · hold (600ms) = more-info popup · drag = set brightness (dimmable)
 *  - Two themes: Classic (Dark Navy) and Holo Home (cyan HUD)
 *  - Optional Frosted Glass mode (opacity + blur)
 *  - Optional header (title, icon, date/time, status dot)
 *  - Configurable columns (1-4), responsive via ResizeObserver (no Shadow-DOM media queries)
 *  - Full visual editor with ha-entity-picker / ha-icon-picker (loadCardHelpers preload)
 */

const LC_VERSION = "1.1.0";

// ── LitElement bootstrap (same pattern as all robman2026 cards) ──────────────
const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const { html, css } = LitElement.prototype;

// ════════════════════════════════════════════════════════════════════════════
// Inline MDI fallback paths (used only when an icon name isn't an mdi:/hass: id)
// ════════════════════════════════════════════════════════════════════════════
const LC_MDI = {
  bulb:   'M9 21h6m-3-3v3M12 3a6 6 0 016 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8A6 6 0 016 9a6 6 0 016-6z',
  sensor: 'M12 2a10 10 0 100 20A10 10 0 0012 2zm0 4a6 6 0 016 6 6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-6z',
};

function lcMdiSVG(name, color, size) {
  color = color || 'rgba(255,255,255,.38)';
  size  = size  || 18;
  const path = LC_MDI[name] || LC_MDI.bulb;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
}

function lcRenderIcon(iconName, color, size) {
  size  = size  || 18;
  color = color || 'rgba(255,255,255,.38)';
  if (!iconName) return lcMdiSVG('bulb', color, size);
  // Any string with ':' is passed straight to ha-icon (mdi:, hass:, phu:, custom:, etc.)
  if (iconName.includes(':')) {
    return '<ha-icon icon="' + iconName + '" style="color:' + color + ';--mdc-icon-size:' + size + 'px;display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;"></ha-icon>';
  }
  if (LC_MDI[iconName]) return lcMdiSVG(iconName, color, size);
  return '<ha-icon icon="mdi:' + iconName + '" style="color:' + color + ';--mdc-icon-size:' + size + 'px;display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;"></ha-icon>';
}

// ════════════════════════════════════════════════════════════════════════════
// State helpers
// ════════════════════════════════════════════════════════════════════════════
function lcStateVal(hass, id)  { if (!id || !hass) return null; const e = hass.states[id]; return e ? e.state : null; }
function lcStateAttr(hass, id, attr) { if (!id || !hass) return undefined; const e = hass.states[id]; return e ? e.attributes[attr] : undefined; }
function lcIsOn(s)      { return s === 'on' || s === 'true' || s === 'home' || s === 'open'; }
function lcIsUnavail(s) { return !s || s === 'unavailable' || s === 'unknown'; }

// Returns a human-readable "X ago" string from a HA last_changed ISO timestamp
function lcAgoStr(lastChanged) {
  if (!lastChanged) return '';
  const diff = Math.floor((Date.now() - new Date(lastChanged).getTime()) / 1000);
  if (diff < 60)    return diff + 's ago';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ════════════════════════════════════════════════════════════════════════════
// Default / stub config
// ════════════════════════════════════════════════════════════════════════════
function lcStubConfig() {
  return {
    // Header
    show_header:     true,
    card_title:      'Lights',
    card_icon:       'mdi:lightbulb-group',
    title_position:  'left',
    show_datetime:   true,
    show_status_dot: false,
    status_entity:   '',

    // Section label + layout
    label_lights:    'Lights',
    lights_columns:  2,

    // Lights list
    lights:          [],

    // Appearance
    theme:           'classic',   // 'classic' | 'holo'
    frosted_glass:   false,
    frosted_opacity: 0.52,
    frosted_blur:    22,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Theme-aware inline colors
// ════════════════════════════════════════════════════════════════════════════
function lcThemeColors(theme) {
  if (theme === 'holo') {
    return {
      lightOn:   '#00e5ff',
      lightOff:  'rgba(0,229,255,.4)',
      lightFill: 'rgba(0,229,255,.08)',
      lightsDot: '#00e5ff',
    };
  }
  return {
    lightOn:   '#ffd26d',
    lightOff:  'rgba(255,255,255,.5)',
    lightFill: 'rgba(255,180,60,.22)',
    lightsDot: '#ffd26d',
  };
}

function lcGetCardCSS(theme) {
  return theme === 'holo' ? LC_CSS_HOLO : LC_CSS_CLASSIC;
}

// ════════════════════════════════════════════════════════════════════════════
// CSS — CLASSIC THEME (Dark Navy)
// ════════════════════════════════════════════════════════════════════════════
const LC_CSS_CLASSIC = [
  "ha-card{background:transparent!important;box-shadow:none!important;border:none!important;border-radius:0!important;}",
  ":host{display:block;font-family:'Segoe UI',system-ui,sans-serif;}",
  "*{box-sizing:border-box;margin:0;padding:0;}",
  ".lc-card{background:linear-gradient(145deg,#1a1f35,#0f1628,#141929);border-radius:16px;border:1px solid rgba(99,179,237,0.15);box-shadow:0 0 0 1px rgba(255,255,255,0.04),0 8px 32px rgba(0,0,0,0.6),0 0 60px rgba(99,179,237,0.05);padding:18px;position:relative;overflow:hidden;}",
  ".lc-card::before{content:'';position:absolute;width:280px;height:280px;border-radius:50%;top:-100px;right:-60px;background:#e07c4f;filter:blur(80px);opacity:.05;pointer-events:none;}",
  ".lc-inner{width:100%;position:relative;z-index:1;}",
  // Header
  ".lc-header{display:flex;align-items:center;gap:10px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,.05);position:relative;}",
  ".lc-header.pos-left{justify-content:space-between;}",
  ".lc-header.pos-center{justify-content:space-between;}",
  ".lc-header.pos-center .lc-title-wrap{position:absolute;left:50%;transform:translateX(-50%);}",
  ".lc-title-wrap{display:flex;align-items:center;gap:8px;min-width:0;}",
  ".lc-title-icon{color:rgba(255,255,255,.45);display:flex;align-items:center;flex-shrink:0;}",
  ".lc-title-icon ha-icon{--mdc-icon-size:20px;}",
  ".lc-zone-label{display:none;}",
  ".lc-title{font-size:16px;font-weight:700;letter-spacing:1.4px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
  ".lc-head-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}",
  ".lc-datetime{display:flex;flex-direction:column;align-items:flex-end;gap:1px;}",
  ".lc-date{font-size:12px;font-weight:600;color:rgba(255,255,255,.75);letter-spacing:.5px;}",
  ".lc-time{font-size:11px;font-weight:400;color:rgba(255,255,255,.4);letter-spacing:1px;font-family:monospace;}",
  ".lc-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}",
  ".lc-dot.online{background:#34d399;box-shadow:0 0 8px rgba(52,211,153,.8);animation:lc-pulse-dot 2s ease-in-out infinite;}",
  ".lc-dot.offline{background:#6b7280;}",
  "@keyframes lc-pulse-dot{0%,100%{opacity:1;box-shadow:0 0 8px rgba(52,211,153,.8);}50%{opacity:.6;box-shadow:0 0 14px rgba(52,211,153,.4);}}",
  // Section label
  ".lc-sec{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:500;margin-bottom:9px;display:flex;align-items:center;gap:5px;}",
  ".lc-sec-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}",
  // Light tiles
  ".lc-lights-grid{display:grid;gap:7px;}",
  ".lc-light-tile{position:relative;border-radius:12px;padding:11px 12px;display:flex;align-items:center;gap:11px;cursor:pointer;overflow:hidden;border:1px solid rgba(255,255,255,.06);transition:border-color .15s;min-width:0;-webkit-user-select:none;user-select:none;touch-action:none;}",
  ".lc-light-tile.lt-off{background:rgba(255,255,255,.04);}",
  ".lc-light-tile.lt-on{background:rgba(255,210,109,.04);border-color:rgba(255,210,109,.15);}",
  ".lc-light-tile.lt-unavail{opacity:.35;pointer-events:none;}",
  ".lc-lt-fill{position:absolute;inset:0;pointer-events:none;border-radius:11px;transition:width .12s,opacity .15s;}",
  ".lt-off .lc-lt-fill{opacity:0;}",
  ".lc-lt-icon{width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;}",
  ".lc-lt-info{flex:1;min-width:0;z-index:1;}",
  ".lc-lt-name{font-size:13px;font-weight:600;color:rgba(255,255,255,.92);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;margin-bottom:3px;}",
  ".lt-on .lc-lt-name{color:#fff;}",
  ".lc-lt-sub{font-size:11px;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
  ".lt-on .lc-lt-sub{color:rgba(255,210,109,.75);}",
  ".lc-lt-ago{font-size:10px;color:rgba(255,255,255,.28);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}",
  ".lc-lt-bar-wrap{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.06);z-index:2;}",
  ".lc-lt-bar{height:3px;border-radius:0;background:rgba(255,210,109,.7);transition:width .1s;}",
  // Responsive (ResizeObserver classes)
  ".lc-inner.bp-xs .lc-lights-grid{grid-template-columns:repeat(2,1fr)!important;}",
  // Frosted glass
  ".lc-frosted.lc-card{background:var(--lc-fg-bg,rgba(8,14,30,.52))!important;backdrop-filter:blur(var(--lc-fg-blur,22px))!important;-webkit-backdrop-filter:blur(var(--lc-fg-blur,22px))!important;border:1px solid rgba(255,255,255,0.12)!important;}",
  ".lc-frosted .lc-light-tile.lt-off{background:rgba(255,255,255,0.05)!important;backdrop-filter:blur(var(--lc-fg-blur,22px))!important;-webkit-backdrop-filter:blur(var(--lc-fg-blur,22px))!important;border-color:rgba(255,255,255,0.1)!important;}",
  ".lc-frosted .lc-light-tile.lt-on{background:rgba(255,210,109,0.08)!important;border-color:rgba(255,210,109,0.2)!important;}",
];

// ════════════════════════════════════════════════════════════════════════════
// CSS — HOLO THEME (cyan HUD)
// ════════════════════════════════════════════════════════════════════════════
const LC_CSS_HOLO = [
  "ha-card{background:transparent!important;box-shadow:none!important;border:none!important;border-radius:0!important;}",
  ":host{display:block;font-family:'Courier New',Courier,monospace;}",
  "*{box-sizing:border-box;margin:0;padding:0;}",
  ".lc-card{background:linear-gradient(160deg,#040d1a 0%,#060f20 50%,#030a16 100%);border-radius:4px;border:1px solid rgba(0,229,255,0.18);box-shadow:0 0 0 1px rgba(0,229,255,0.04),0 8px 32px rgba(0,0,0,0.7),0 0 40px rgba(0,229,255,0.04);padding:16px;position:relative;overflow:hidden;}",
  ".lc-card::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(0,229,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.03) 1px,transparent 1px);background-size:28px 28px;border-radius:4px;}",
  ".lc-card::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px);border-radius:4px;}",
  ".lc-inner{width:100%;position:relative;z-index:1;}",
  // Header
  ".lc-header{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(0,229,255,0.1);position:relative;}",
  ".lc-header.pos-left{justify-content:space-between;}",
  ".lc-header.pos-center{justify-content:space-between;}",
  ".lc-header.pos-center .lc-title-wrap{position:absolute;left:50%;transform:translateX(-50%);}",
  ".lc-title-wrap{display:flex;align-items:center;gap:8px;min-width:0;}",
  ".lc-title-icon{color:rgba(0,229,255,.55);display:flex;align-items:center;flex-shrink:0;}",
  ".lc-title-icon ha-icon{--mdc-icon-size:18px;}",
  ".lc-zone-label{font-size:8px;font-weight:700;letter-spacing:.15em;color:rgba(0,229,255,.45);text-transform:uppercase;margin-bottom:2px;}",
  ".lc-title{font-size:14px;font-weight:700;letter-spacing:.2em;color:#fff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 10px rgba(0,229,255,0.3);}",
  ".lc-head-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}",
  ".lc-datetime{display:flex;flex-direction:column;align-items:flex-end;gap:1px;}",
  ".lc-date{font-size:10px;font-weight:700;color:rgba(0,229,255,.85);letter-spacing:.06em;text-transform:uppercase;}",
  ".lc-time{font-size:11px;font-weight:400;color:rgba(0,229,255,.4);letter-spacing:.12em;font-family:'Courier New',monospace;}",
  ".lc-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}",
  ".lc-dot.online{background:#00e5ff;box-shadow:0 0 8px rgba(0,229,255,.9);animation:lc-pulse-dot 2s ease-in-out infinite;}",
  ".lc-dot.offline{background:#334155;}",
  "@keyframes lc-pulse-dot{0%,100%{opacity:1;box-shadow:0 0 8px rgba(0,229,255,.9);}50%{opacity:.5;box-shadow:0 0 14px rgba(0,229,255,.25);}}",
  // Section label
  ".lc-sec{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:rgba(0,229,255,.5);font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;}",
  ".lc-sec-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}",
  ".lc-sec::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(0,229,255,.15),transparent);}",
  // Light tiles
  ".lc-lights-grid{display:grid;gap:5px;}",
  ".lc-light-tile{position:relative;border-radius:3px;padding:10px 11px;display:flex;align-items:center;gap:10px;cursor:pointer;overflow:hidden;border:1px solid rgba(0,229,255,.1);transition:border-color .15s;min-width:0;-webkit-user-select:none;user-select:none;touch-action:none;}",
  ".lc-light-tile.lt-off{background:rgba(0,10,25,0.8);}",
  ".lc-light-tile.lt-on{background:rgba(0,25,40,0.85);border-color:rgba(0,229,255,.3);box-shadow:0 0 10px rgba(0,229,255,0.05),inset 0 0 20px rgba(0,229,255,0.025);}",
  ".lc-light-tile.lt-unavail{opacity:.3;pointer-events:none;}",
  ".lc-lt-fill{position:absolute;inset:0;pointer-events:none;border-radius:2px;transition:width .12s,opacity .15s;}",
  ".lt-off .lc-lt-fill{opacity:0;}",
  ".lc-lt-icon{width:36px;height:36px;border-radius:3px;background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;}",
  ".lt-on .lc-lt-icon{background:rgba(0,229,255,.1);border-color:rgba(0,229,255,.3);box-shadow:0 0 8px rgba(0,229,255,.12);}",
  ".lc-lt-info{flex:1;min-width:0;z-index:1;}",
  ".lc-lt-name{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;margin-bottom:3px;}",
  ".lt-on .lc-lt-name{color:#fff;text-shadow:0 0 8px rgba(0,229,255,.25);}",
  ".lc-lt-sub{font-size:10px;color:rgba(0,229,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Courier New',monospace;}",
  ".lt-on .lc-lt-sub{color:rgba(0,229,255,.7);}",
  ".lc-lt-ago{font-size:9px;color:rgba(0,229,255,.22);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;font-family:'Courier New',monospace;}",
  ".lc-lt-bar-wrap{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(0,229,255,.07);z-index:2;}",
  ".lc-lt-bar{height:2px;border-radius:0;background:rgba(0,229,255,.6);transition:width .1s;box-shadow:0 0 4px rgba(0,229,255,.35);}",
  // Responsive
  ".lc-inner.bp-xs .lc-lights-grid{grid-template-columns:repeat(2,1fr)!important;}",
  // Frosted glass
  ".lc-frosted.lc-card{background:var(--lc-fg-bg,rgba(4,13,26,.52))!important;backdrop-filter:blur(var(--lc-fg-blur,22px))!important;-webkit-backdrop-filter:blur(var(--lc-fg-blur,22px))!important;border:1px solid rgba(0,229,255,0.16)!important;}",
  ".lc-frosted .lc-light-tile.lt-off{background:rgba(0,229,255,0.04)!important;backdrop-filter:blur(var(--lc-fg-blur,22px))!important;-webkit-backdrop-filter:blur(var(--lc-fg-blur,22px))!important;border-color:rgba(0,229,255,0.12)!important;}",
  ".lc-frosted .lc-light-tile.lt-on{background:rgba(0,229,255,0.08)!important;border-color:rgba(0,229,255,0.22)!important;}",
];

// ════════════════════════════════════════════════════════════════════════════
// Card
// ════════════════════════════════════════════════════════════════════════════
class LightsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config  = {};
    this._hass    = null;
    this._built   = false;
    this._tickInt = null;
    this._ro      = null;
  }

  static getConfigElement() { return document.createElement('lights-card-editor'); }
  static getStubConfig()    { return lcStubConfig(); }

  setConfig(config) {
    this._config = Object.assign({}, lcStubConfig(), config || {});
    this._built  = false;
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass  = hass;
    if (!this._built || first) {
      this._render();
    } else {
      this._update();
    }
  }

  connectedCallback() {
    if (!this._tickInt) {
      this._tickInt = setInterval(() => this._tickClock(), 1000);
    }
  }
  disconnectedCallback() {
    if (this._tickInt) { clearInterval(this._tickInt); this._tickInt = null; }
    if (this._ro)      { this._ro.disconnect(); this._ro = null; }
  }

  _moreInfo(id) {
    if (!id) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: id } }));
  }
  _toggle(id) {
    if (!id || !this._hass) return;
    this._hass.callService('homeassistant', 'toggle', { entity_id: id });
  }

  // ── Header ──────────────────────────────────────────────────────────────
  _headerHTML() {
    const cfg = this._config;
    if (!cfg.show_header) return '';
    const isHolo = (cfg.theme === 'holo');
    const iconHTML = cfg.card_icon
      ? '<span class="lc-title-icon"><ha-icon icon="' + cfg.card_icon + '"></ha-icon></span>'
      : '';

    const titleInner = isHolo
      ? '<div style="display:flex;flex-direction:column;gap:2px;min-width:0;">' +
          '<div class="lc-zone-label">Lighting Control</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' + iconHTML +
            '<div class="lc-title">' + String(cfg.card_title || 'Lights').toUpperCase() + '</div>' +
          '</div>' +
        '</div>'
      : iconHTML + '<div class="lc-title">' + String(cfg.card_title || 'Lights').toUpperCase() + '</div>';

    const titleHTML = '<div class="lc-title-wrap">' + titleInner + '</div>';

    const now = new Date();
    const dtHTML = cfg.show_datetime
      ? '<div class="lc-datetime">' +
          '<div class="lc-date" id="lc-date">' + now.toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' }) + '</div>' +
          '<div class="lc-time" id="lc-time">' + now.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + '</div>' +
        '</div>'
      : '';

    let dotHTML = '';
    if (cfg.show_status_dot) {
      const online = cfg.status_entity ? !lcIsUnavail(lcStateVal(this._hass, cfg.status_entity)) : true;
      dotHTML = '<div class="lc-dot ' + (online ? 'online' : 'offline') + '"></div>';
    }

    const pos = cfg.title_position === 'center' ? 'pos-center' : 'pos-left';
    const rightHTML = (dtHTML || dotHTML) ? '<div class="lc-head-right">' + dtHTML + dotHTML + '</div>' : '';
    return '<div class="lc-header ' + pos + '">' + titleHTML + rightHTML + '</div>';
  }

  _tickClock() {
    const cfg = this._config;
    const sr  = this.shadowRoot;
    if (cfg.show_header && cfg.show_datetime) {
      const dEl = sr && sr.getElementById('lc-date');
      const tEl = sr && sr.getElementById('lc-time');
      const now = new Date();
      if (dEl) dEl.textContent = now.toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' });
      if (tEl) tEl.textContent = now.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }
    // Keep "X ago" strings ticking even without a hass state update
    if (sr && this._hass) {
      const hass = this._hass;
      (cfg.lights || []).forEach(function(lt, i) {
        const agoEl = sr.getElementById('lc-lt-ago-' + i);
        if (!agoEl) return;
        const stateObj = hass.states[lt.entity];
        if (!stateObj || lcIsUnavail(stateObj.state)) { agoEl.textContent = ''; return; }
        agoEl.textContent = lcAgoStr(stateObj.last_changed);
      });
    }
  }

  // ── Lights ────────────────────────────────────────────────────────────────
  _lightsHTML() {
    const cfg   = this._config;
    const hass  = this._hass;
    const items = cfg.lights || [];
    const cols  = Math.max(1, Math.min(4, parseInt(cfg.lights_columns) || 2));
    const tc    = lcThemeColors(cfg.theme);

    if (!items.length) {
      // Friendly empty state so the card isn't blank before any lights are added
      return '<div class="lc-sec"><span class="lc-sec-dot" style="background:' + tc.lightsDot + ';box-shadow:0 0 5px ' + tc.lightsDot + '"></span>' + (cfg.label_lights || 'Lights') + '</div>' +
        '<div class="lc-lt-sub" style="padding:6px 2px;">No lights configured — add some in the visual editor.</div>';
    }

    const tilesHTML = items.map(function(lt, i) {
      const state    = lcStateVal(hass, lt.entity);
      const on       = lcIsOn(state), unavail = lcIsUnavail(state);
      const domain   = (lt.entity || '').split('.')[0];
      const isLight  = lt.dimmable || domain === 'light';
      const bri      = isLight ? Math.round((lcStateAttr(hass, lt.entity, 'brightness') || 0) / 2.55) : (on ? 100 : 0);
      const briPct   = Math.max(0, Math.min(100, bri));
      const cls      = 'lc-light-tile ' + (unavail ? 'lt-unavail' : on ? 'lt-on' : 'lt-off');
      const icolor   = on ? tc.lightOn : tc.lightOff;
      const subTxt   = unavail ? 'N/A' : on ? (isLight && briPct < 100 && briPct > 0 ? briPct + '%' : 'On') : 'Off';
      const fillStyle= on ? 'width:' + briPct + '%;background:' + tc.lightFill : 'width:0;background:' + tc.lightFill;
      const barHTML  = isLight
        ? '<div class="lc-lt-bar-wrap"><div class="lc-lt-bar" id="lc-lt-bar-' + i + '" style="width:' + (on ? briPct : 0) + '%"></div></div>'
        : '';
      const lastChanged = hass && lt.entity && hass.states[lt.entity] ? hass.states[lt.entity].last_changed : null;
      const agoTxt   = unavail ? '' : lcAgoStr(lastChanged);
      return '<div class="' + cls + '" data-idx="' + i + '" data-entity="' + (lt.entity || '') + '" data-dimmable="' + (isLight ? '1' : '0') + '">' +
        '<div class="lc-lt-fill" id="lc-lt-fill-' + i + '" style="' + fillStyle + '"></div>' +
        '<div class="lc-lt-icon">' + lcRenderIcon(lt.icon || 'bulb', icolor, 18) + '</div>' +
        '<div class="lc-lt-info">' +
          '<div class="lc-lt-name">' + (lt.label || '—') + '</div>' +
          '<div class="lc-lt-sub" id="lc-lt-sub-' + i + '">' + subTxt + '</div>' +
          '<div class="lc-lt-ago" id="lc-lt-ago-' + i + '">' + agoTxt + '</div>' +
        '</div>' +
        barHTML +
      '</div>';
    }).join('');

    return (
      '<div class="lc-sec"><span class="lc-sec-dot" style="background:' + tc.lightsDot + ';box-shadow:0 0 5px ' + tc.lightsDot + '"></span>' + (cfg.label_lights || 'Lights') + '</div>' +
      '<div class="lc-lights-grid" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + tilesHTML + '</div>'
    );
  }

  _attachLightListeners() {
    const self = this;
    this.shadowRoot.querySelectorAll('.lc-light-tile[data-entity]').forEach(function(tile) {
      const entity  = tile.dataset.entity;
      const idx     = parseInt(tile.dataset.idx);
      const isDim   = tile.dataset.dimmable === '1';
      if (!entity) return;

      let startX = null, startBri = 0, dragging = false, holdTimer = null, longPressed = false;

      tile.addEventListener('pointerdown', function(e) {
        startX      = e.clientX;
        dragging    = false;
        longPressed = false;
        tile.setPointerCapture(e.pointerId);
        const rawBri = lcStateAttr(self._hass, entity, 'brightness') || 0;
        startBri = Math.round(rawBri / 2.55);
        // Long press (600ms) without dragging opens the HA more-info popup
        holdTimer = setTimeout(function() {
          if (!dragging) {
            longPressed = true;
            self._moreInfo(entity);
          }
        }, 600);
      });

      tile.addEventListener('pointermove', function(e) {
        if (startX === null || !isDim) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 8) {
          dragging = true;
          clearTimeout(holdTimer); // cancel long press if dragging
          const newBri = Math.max(1, Math.min(100, startBri + Math.round(dx * 0.7)));
          const fill = self.shadowRoot.getElementById('lc-lt-fill-' + idx);
          const bar  = self.shadowRoot.getElementById('lc-lt-bar-' + idx);
          const sub  = self.shadowRoot.getElementById('lc-lt-sub-' + idx);
          if (fill) fill.style.width = newBri + '%';
          if (bar)  bar.style.width  = newBri + '%';
          if (sub)  sub.textContent  = newBri + '%';
          tile._pendingBri = newBri;
        }
      });

      tile.addEventListener('pointerup', function() {
        clearTimeout(holdTimer);
        if (longPressed) {
          // already fired moreInfo — do nothing
        } else if (dragging && tile._pendingBri !== undefined) {
          if (self._hass) {
            self._hass.callService('light', 'turn_on', {
              entity_id: entity,
              brightness_pct: tile._pendingBri,
            });
          }
          tile._pendingBri = undefined;
        } else {
          // Simple tap — toggle
          self._toggle(entity);
        }
        startX      = null;
        dragging    = false;
        longPressed = false;
      });

      tile.addEventListener('pointercancel', function() {
        clearTimeout(holdTimer);
        startX   = null;
        dragging = false;
      });
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  _buildHTML() {
    const cfg       = this._config;
    const isFrosted = !!cfg.frosted_glass;
    const cardCls   = 'lc-card' + (isFrosted ? ' lc-frosted' : '');
    return '<style>' + lcGetCardCSS(cfg.theme).join('') + '</style>' +
      '<div class="' + cardCls + '"><div class="lc-inner">' +
        this._headerHTML() +
        this._lightsHTML() +
      '</div></div>';
  }

  _applyFrostedVars() {
    const cfg    = this._config;
    const isHolo = cfg.theme === 'holo';
    this.style.removeProperty('--lc-fg-bg');
    this.style.removeProperty('--lc-fg-blur');
    if (cfg.frosted_glass) {
      const opacity = Math.min(0.9, Math.max(0.1, parseFloat(cfg.frosted_opacity) || 0.52));
      const blur    = Math.min(40,  Math.max(4,   parseFloat(cfg.frosted_blur)    || 22));
      this.style.setProperty('--lc-fg-bg',  isHolo ? 'rgba(4,13,26,' + opacity + ')' : 'rgba(8,14,30,' + opacity + ')');
      this.style.setProperty('--lc-fg-blur', blur + 'px');
    }
  }

  _render() {
    this.shadowRoot.innerHTML = this._buildHTML();
    this._applyFrostedVars();
    this._attachLightListeners();
    this._startResizeObserver();
    this._built = true;
  }

  _startResizeObserver() {
    if (this._ro) this._ro.disconnect();
    const inner = this.shadowRoot.querySelector('.lc-inner');
    if (!inner) return;
    this._ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      inner.classList.remove('bp-sm', 'bp-xs');
      if (w < 380)      inner.classList.add('bp-xs');
      else if (w < 700) inner.classList.add('bp-sm');
    });
    this._ro.observe(inner);
  }

  // ── Lightweight update (no full re-render) ────────────────────────────────
  _update() {
    const cfg  = this._config;
    const hass = this._hass;
    const sr   = this.shadowRoot;

    // Patch grid columns live
    const lGrid = sr.querySelector('.lc-lights-grid');
    if (lGrid) {
      const lc = Math.max(1, Math.min(4, parseInt(cfg.lights_columns) || 2));
      lGrid.style.gridTemplateColumns = 'repeat(' + lc + ',minmax(0,1fr))';
    }

    // Status dot
    if (cfg.show_header && cfg.show_status_dot) {
      const dot = sr.querySelector('.lc-dot');
      if (dot) {
        const online = cfg.status_entity ? !lcIsUnavail(lcStateVal(hass, cfg.status_entity)) : true;
        dot.className = 'lc-dot ' + (online ? 'online' : 'offline');
      }
    }

    const tcU = lcThemeColors(cfg.theme);
    (cfg.lights || []).forEach(function(lt, i) {
      const tile = sr.querySelector('.lc-light-tile[data-idx="' + i + '"]');
      if (!tile) return;
      const state   = lcStateVal(hass, lt.entity), on = lcIsOn(state), unavail = lcIsUnavail(state);
      const domain  = (lt.entity || '').split('.')[0];
      const isLight = lt.dimmable || domain === 'light';
      const rawBri  = isLight ? (lcStateAttr(hass, lt.entity, 'brightness') || 0) : (on ? 255 : 0);
      const briPct  = Math.max(0, Math.min(100, Math.round(rawBri / 2.55)));
      tile.className = 'lc-light-tile ' + (unavail ? 'lt-unavail' : on ? 'lt-on' : 'lt-off');
      const fill = sr.getElementById('lc-lt-fill-' + i);
      const bar  = sr.getElementById('lc-lt-bar-' + i);
      const sub  = sr.getElementById('lc-lt-sub-' + i);
      if (fill) fill.style.width = (on ? briPct : 0) + '%';
      if (bar)  bar.style.width  = (on ? briPct : 0) + '%';
      if (sub)  sub.textContent  = unavail ? 'N/A' : on ? (isLight && briPct < 100 && briPct > 0 ? briPct + '%' : 'On') : 'Off';
      const ago = sr.getElementById('lc-lt-ago-' + i);
      if (ago) {
        const lc = hass.states[lt.entity] ? hass.states[lt.entity].last_changed : null;
        ago.textContent = (unavail || !lc) ? '' : lcAgoStr(lc);
      }
      const iconEl = tile.querySelector('.lc-lt-icon svg, .lc-lt-icon ha-icon');
      if (iconEl && iconEl.tagName === 'svg') {
        iconEl.setAttribute('stroke', on ? tcU.lightOn : tcU.lightOff);
      } else if (iconEl) {
        iconEl.style.color = on ? tcU.lightOn : tcU.lightOff;
      }
    });
  }

  getCardSize() { return 3; }
}

// ════════════════════════════════════════════════════════════════════════════
// Editor
// ════════════════════════════════════════════════════════════════════════════
class LightsCardEditor extends LitElement {
  static get properties() {
    return {
      hass:          {},
      _config:       { state: true },
      _openSections: { state: true },
      _pickersReady: { state: true },
    };
  }

  constructor() {
    super();
    this._openSections = { lights: true };
    this._pickersReady = false;
  }

  async firstUpdated() {
    const timeout = setTimeout(() => { this._pickersReady = true; this.requestUpdate(); }, 3000);
    try {
      if (!customElements.get('ha-entity-picker')) {
        const helpers = await window.loadCardHelpers();
        const c = await helpers.createCardElement({ type: 'entities', entities: [] });
        await c.constructor.getConfigElement();
      }
    } catch (_) {}
    this._pickersReady = true;
    clearTimeout(timeout);
    this.requestUpdate();
  }

  setConfig(config) {
    this._config = Object.assign({}, lcStubConfig(), config || {});
  }

  _fire() {
    const ev = new Event('config-changed', { bubbles: true, composed: true });
    ev.detail = { config: this._config };
    this.dispatchEvent(ev);
  }

  _set(key, val) {
    this._config = Object.assign({}, this._config, { [key]: val });
    this._fire();
  }
  _addItem(key, defaults) {
    this._set(key, (this._config[key] || []).concat([defaults]));
  }
  _removeItem(key, idx) {
    const arr = (this._config[key] || []).slice();
    arr.splice(idx, 1);
    this._set(key, arr);
  }
  _updateItem(key, idx, field, val) {
    const arr = (this._config[key] || []).slice();
    arr[idx] = Object.assign({}, arr[idx], { [field]: val });
    this._set(key, arr);
  }
  _toggleSec(id) {
    this._openSections = Object.assign({}, this._openSections, { [id]: !this._openSections[id] });
  }

  // ── Atomic editor widgets ─────────────────────────────────────────────────
  _txt(label, value, onChange, ph) {
    return html`<div class="ed-field">
      <label class="ed-label">${label}</label>
      <input class="ed-input" type="text" .value="${value || ''}" placeholder="${ph || ''}"
        @change="${(e) => onChange(e.target.value)}" />
    </div>`;
  }
  _toggle(label, checked, onChange) {
    return html`<div class="toggle-row">
      <span class="toggle-label">${label}</span>
      <label class="toggle-wrap">
        <input type="checkbox" .checked="${!!checked}" @change="${(e) => onChange(e.target.checked)}" />
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }
  _seg(label, value, options, onChange) {
    return html`<div class="ed-field">
      <label class="ed-label">${label}</label>
      <div class="segmented">
        ${options.map((o) => html`<div class="seg-opt ${value === o.val ? 'active' : ''}" @click="${() => onChange(o.val)}">${o.label}</div>`)}
      </div>
    </div>`;
  }
  _select(label, value, options, onChange) {
    return html`<div class="ed-field">
      <label class="ed-label">${label}</label>
      <select class="ed-select" .value="${value || ''}" @change="${(e) => onChange(e.target.value)}">
        ${options.map((o) => html`<option value="${o.val}" ?selected=${String(value) === String(o.val)}>${o.label}</option>`)}
      </select>
    </div>`;
  }
  _entityPicker(value, onChange, domains, label) {
    return html`<div class="ed-field">
      <label class="ed-label">${label || 'Entity'}</label>
      <ha-entity-picker
        .hass=${this.hass}
        .value=${value || ''}
        .includeDomains=${domains && domains.length ? domains : undefined}
        allow-custom-entity
        @value-changed=${(e) => { const v = e.detail.value || ''; if (v !== (value || '')) onChange(v); }}
      ></ha-entity-picker>
    </div>`;
  }
  _iconPicker(value, onChange, ph) {
    return html`<div class="ed-field">
      <label class="ed-label">Icon</label>
      <ha-icon-picker
        .hass=${this.hass}
        .value=${value || ''}
        .placeholder=${ph || 'mdi:...'}
        @value-changed=${(e) => { const v = e.detail.value || ''; if (v !== (value || '')) onChange(v); }}
      ></ha-icon-picker>
    </div>`;
  }
  _range(label, value, min, max, step, onChange, unit) {
    const val = parseFloat(value) || 0;
    const pct = Math.round(((val - min) / (max - min)) * 100);
    return html`<div class="ed-field">
      <div class="ed-range-header">
        <label class="ed-label" style="margin:0">${label}</label>
        <span class="ed-range-val">${val}${unit || ''}</span>
      </div>
      <input class="ed-range" type="range"
        min="${min}" max="${max}" step="${step}"
        .value="${String(val)}"
        style="--range-pct:${pct}%"
        @input="${(e) => onChange(parseFloat(e.target.value))}" />
    </div>`;
  }

  _section(id, title, count, content) {
    const open = !!this._openSections[id];
    return html`<div class="ed-section ${open ? 'open' : ''}">
      <div class="ed-section-header" @click="${() => this._toggleSec(id)}">
        <div class="ed-section-title">
          ${title}
          ${count !== undefined ? html`<span class="ed-section-count">${count}</span>` : ''}
        </div>
        <span class="ed-section-arrow">▾</span>
      </div>
      <div class="ed-section-body">${open ? content : ''}</div>
    </div>`;
  }

  // ── Section content ───────────────────────────────────────────────────────
  _appearanceContent() {
    const cfg = this._config;
    return html`
      ${this._seg('Theme', cfg.theme || 'classic',
        [{ val:'classic', label:'🎨 Classic' }, { val:'holo', label:'🔷 Holo Home' }],
        (v) => this._set('theme', v))}
      <p class="hint">${cfg.theme === 'holo'
        ? '🔷 Holo Home — deep navy grid, cyan scan-lines, monospace HUD typography.'
        : '🎨 Classic — the original dark blue gradient design.'}</p>
      ${this._toggle('Frosted Glass Mode', cfg.frosted_glass, (v) => this._set('frosted_glass', v))}
      ${cfg.frosted_glass ? html`
        <p class="hint">
          The card background and all tiles use a translucent blur effect.
          Works best when a dynamic wallpaper is visible behind Home Assistant.
        </p>
        ${this._range('Glass Opacity',
          cfg.frosted_opacity !== undefined ? cfg.frosted_opacity : 0.52,
          0.1, 0.9, 0.01, (v) => this._set('frosted_opacity', v), '')}
        ${this._range('Blur Strength',
          cfg.frosted_blur !== undefined ? cfg.frosted_blur : 22,
          4, 40, 1, (v) => this._set('frosted_blur', v), 'px')}
      ` : ''}
    `;
  }

  _headerContent() {
    const cfg = this._config;
    return html`
      ${this._toggle('Show Header', cfg.show_header, (v) => this._set('show_header', v))}
      ${cfg.show_header ? html`
        ${this._txt('Card Title', cfg.card_title, (v) => this._set('card_title', v), 'Lights')}
        ${this._seg('Title Position', cfg.title_position || 'left',
          [{ val:'left', label:'Left' }, { val:'center', label:'Center' }],
          (v) => this._set('title_position', v))}
        ${this._iconPicker(cfg.card_icon, (v) => this._set('card_icon', v), 'mdi:lightbulb-group')}
        ${this._toggle('Show Date & Time', cfg.show_datetime, (v) => this._set('show_datetime', v))}
        ${this._toggle('Show Status Dot', cfg.show_status_dot, (v) => this._set('show_status_dot', v))}
        ${cfg.show_status_dot ? this._entityPicker(cfg.status_entity, (v) => this._set('status_entity', v),
            ['binary_sensor','sensor','switch'], 'Status Entity') : ''}
      ` : ''}
    `;
  }

  _lightsContent() {
    const cfg  = this._config, self = this;
    const items = cfg.lights || [];
    const colOpts = [{ val:'1', label:'1' },{ val:'2', label:'2' },{ val:'3', label:'3' },{ val:'4', label:'4' }];
    return html`
      ${this._txt('Section Label', cfg.label_lights, (v) => this._set('label_lights', v), 'Lights')}
      ${this._select('Columns', String(cfg.lights_columns || 2), colOpts, (v) => this._set('lights_columns', parseInt(v)))}
      ${items.map((lt, i) => html`
        <div class="entity-item">
          <div class="entity-item-hd">
            <span class="entity-item-num">💡 Light ${i + 1}</span>
            <button class="btn-remove" @click="${() => self._removeItem('lights', i)}">Remove</button>
          </div>
          ${self._entityPicker(lt.entity, (v) => {
            self._updateItem('lights', i, 'entity', v);
            if (v && !lt.label) {
              const fn = lcStateAttr(self.hass, v, 'friendly_name');
              if (fn) self._updateItem('lights', i, 'label', fn);
            }
          }, ['light','switch','input_boolean'], 'Entity')}
          ${self._txt('Label', lt.label, (v) => self._updateItem('lights', i, 'label', v), 'Light name')}
          ${self._toggle('Dimmable (hold + drag to dim)', !!lt.dimmable, (v) => self._updateItem('lights', i, 'dimmable', v))}
          ${self._iconPicker(lt.icon, (v) => self._updateItem('lights', i, 'icon', v), 'mdi:lightbulb')}
        </div>
      `)}
      <button class="btn-add" @click="${() => self._addItem('lights', { entity:'', label:'', icon:'mdi:lightbulb', dimmable:false })}">+ Add Light</button>
    `;
  }

  render() {
    try {
      if (!this._config) return html``;
      const cfg = this._config;
      const counts = { lights: (cfg.lights || []).length };
      return html`
        <div class="ed-root">
          ${this._section('header',     '🏠 Header',      undefined,      this._headerContent())}
          ${this._section('appearance', '🎨 Appearance',  undefined,      this._appearanceContent())}
          ${this._section('lights',     '💡 Lights',      counts.lights,  this._lightsContent())}
        </div>
      `;
    } catch (err) {
      console.error('[LIGHTS-CARD editor error]', err);
      return html`<div style="padding:16px;color:#ef4444;font-size:12px;font-family:monospace;white-space:pre-wrap">Editor error — check browser console:\n${err && err.message ? err.message : String(err)}</div>`;
    }
  }

  static get styles() {
    return css`
      :host { display: block; font-family: 'Segoe UI', system-ui, sans-serif; }
      .ed-root { display: flex; flex-direction: column; padding: 8px 0; }

      .ed-label { display: block; font-size: 12px; font-weight: 500; color: var(--primary-text-color, rgba(255,255,255,.7)); margin-bottom: 6px; letter-spacing: .2px; }
      .ed-field { margin-bottom: 12px; }

      .ed-input, .ed-select {
        width: 100%; padding: 10px 12px; font-size: 14px; font-family: inherit;
        border: 1px solid var(--divider-color, rgba(255,255,255,.1));
        border-radius: 8px;
        background: var(--secondary-background-color, rgba(255,255,255,.04));
        color: var(--primary-text-color, #fff);
        transition: border-color .15s; box-sizing: border-box;
      }
      .ed-input:focus, .ed-select:focus { outline: none; border-color: var(--primary-color, #4fa3e0); }

      .hint { font-size: 12px; color: var(--secondary-text-color, rgba(255,255,255,.5)); margin: 0 0 10px; line-height: 1.5; }

      ha-entity-picker, ha-icon-picker { display: block; width: 100%; }

      .ed-section { background: var(--secondary-background-color, rgba(255,255,255,.025)); border: 1px solid var(--divider-color, rgba(255,255,255,.06)); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
      .ed-section-header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; transition: background .15s; }
      .ed-section-header:hover { background: rgba(255,255,255,.03); }
      .ed-section-title { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: var(--primary-text-color, #fff); }
      .ed-section-count { font-size: 11px; font-weight: 500; color: var(--secondary-text-color, rgba(255,255,255,.4)); background: rgba(255,255,255,.05); padding: 2px 8px; border-radius: 10px; }
      .ed-section-arrow { color: var(--secondary-text-color, rgba(255,255,255,.4)); font-size: 12px; transition: transform .2s; }
      .ed-section.open .ed-section-arrow { transform: rotate(180deg); }
      .ed-section-body { padding: 0 14px; }
      .ed-section.open .ed-section-body { padding: 4px 14px 14px; }

      .entity-item { background: rgba(0,0,0,.18); border: 1px solid var(--divider-color, rgba(255,255,255,.05)); border-radius: 9px; padding: 10px; margin-bottom: 10px; }
      .entity-item-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .entity-item-num { font-size: 11px; font-weight: 600; color: var(--primary-color, #e07c4f); letter-spacing: .05em; text-transform: uppercase; }

      .btn-add { width: 100%; padding: 10px; font-size: 13px; font-weight: 500; border: 1px dashed var(--primary-color, #e07c4f); border-radius: 8px; background: transparent; color: var(--primary-color, #e07c4f); cursor: pointer; transition: background .15s; }
      .btn-add:hover { background: rgba(224,124,79,.08); }
      .btn-remove { padding: 4px 10px; font-size: 11px; border: 1px solid #ef4444; border-radius: 6px; background: transparent; color: #ef4444; cursor: pointer; transition: background .15s; }
      .btn-remove:hover { background: rgba(239,68,68,.1); }

      .segmented { display: flex; border: 1px solid var(--divider-color, rgba(255,255,255,.1)); border-radius: 8px; overflow: hidden; }
      .seg-opt { flex: 1; padding: 8px 4px; font-size: 12px; text-align: center; cursor: pointer; color: var(--secondary-text-color, rgba(255,255,255,.5)); transition: background .15s, color .15s; }
      .seg-opt:hover { background: rgba(255,255,255,.04); }
      .seg-opt.active { background: var(--primary-color, #e07c4f); color: #fff; font-weight: 500; }

      .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; margin-bottom: 10px; }
      .toggle-label { font-size: 13px; color: var(--primary-text-color, rgba(255,255,255,.85)); }
      .toggle-wrap { position: relative; display: inline-block; width: 40px; height: 22px; }
      .toggle-wrap input { opacity: 0; width: 0; height: 0; }
      .toggle-slider { position: absolute; inset: 0; background: rgba(255,255,255,.15); border-radius: 11px; transition: background .2s; cursor: pointer; }
      .toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: transform .2s; }
      input:checked + .toggle-slider { background: var(--primary-color, #e07c4f); }
      input:checked + .toggle-slider::before { transform: translateX(18px); }

      .ed-range-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .ed-range-val { font-size: 12px; font-weight: 600; color: var(--primary-color, #e07c4f); font-family: monospace; min-width: 36px; text-align: right; }
      .ed-range {
        -webkit-appearance: none;
        width: 100%; height: 4px; border-radius: 2px; outline: none; cursor: pointer;
        background: linear-gradient(
          to right,
          var(--primary-color, #e07c4f) 0%,
          var(--primary-color, #e07c4f) var(--range-pct, 50%),
          rgba(255,255,255,.12) var(--range-pct, 50%),
          rgba(255,255,255,.12) 100%
        );
      }
      .ed-range::-webkit-slider-thumb {
        -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
        background: #fff; box-shadow: 0 0 0 3px rgba(224,124,79,.4); cursor: pointer;
      }
      .ed-range::-moz-range-thumb {
        width: 16px; height: 16px; border-radius: 50%; border: none;
        background: #fff; box-shadow: 0 0 0 3px rgba(224,124,79,.4); cursor: pointer;
      }
    `;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Register
// ════════════════════════════════════════════════════════════════════════════
customElements.define('lights-card', LightsCard);
customElements.define('lights-card-editor', LightsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'lights-card',
  name: 'Lights Card',
  description: 'Configurable lights card with toggle, dimming, themes and a visual editor.',
  preview: true,
  documentationURL: 'https://github.com/robman2026/lights-card',
});

console.info(
  '%c LIGHTS-CARD %c v' + LC_VERSION + ' ',
  'background:#1a1f35;color:#ffd26d;font-weight:700;border-radius:3px 0 0 3px;padding:2px 6px;',
  'background:#ffd26d;color:#1a1f35;font-weight:700;border-radius:0 3px 3px 0;padding:2px 6px;'
);
