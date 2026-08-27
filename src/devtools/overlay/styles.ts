/**
 * Стили панели строкой, а не `<style>` в SFC: блок стилей сделал бы модуль
 * побочным, а пакет заявляет `sideEffects: false`. К тому же CSS уезжает в
 * Shadow DOM, и потребителю не нужно ничего импортировать отдельно.
 */
export const OVERLAY_STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }

.root {
  position: fixed;
  z-index: 2147483000;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #d5d9e0;
}
.root.bottom-right { right: 16px; bottom: 16px; }
.root.bottom-left { left: 16px; bottom: 16px; }
.root.top-right { right: 16px; top: 16px; }
.root.top-left { left: 16px; top: 16px; }

.badge {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 11px; border-radius: 999px; cursor: pointer;
  background: #171a21; border: 1px solid #2b3040; color: #d5d9e0;
  box-shadow: 0 6px 20px rgb(0 0 0 / 35%);
}
.badge:hover { border-color: #4b536b; }
.badge b { color: #8ab4ff; font-weight: 600; }

.panel {
  display: flex; flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  height: min(460px, calc(100vh - 32px));
  background: #0f1116; border: 1px solid #2b3040; border-radius: 10px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 45%); overflow: hidden;
}

.head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; background: #171a21; border-bottom: 1px solid #2b3040;
}
.head .title { color: #8ab4ff; font-weight: 600; }
.head .meta { color: #6b7280; }
.head .spacer { flex: 1; }

.chip {
  padding: 1px 7px; border-radius: 999px;
  background: #1f2430; border: 1px solid #2b3040; color: #9aa4b8;
}
.chip.warn { background: #3a2410; border-color: #6b4415; color: #f0b45f; }
.chip.bad { background: #3a1414; border-color: #6b1f1f; color: #f08a8a; }
.chip.good { background: #10281a; border-color: #1f5c38; color: #6ee7a0; }

button {
  font: inherit; cursor: pointer; color: #9aa4b8;
  background: #1f2430; border: 1px solid #2b3040; border-radius: 6px; padding: 3px 8px;
}
button:hover { color: #fff; border-color: #4b536b; }
button.on { color: #0f1116; background: #8ab4ff; border-color: #8ab4ff; }

.tabs { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid #2b3040; overflow-x: auto; }
.tabs button { white-space: nowrap; }
.tabs sup { margin-left: 4px; color: #6b7280; }

.body { flex: 1; overflow: auto; padding: 8px 10px; }
.empty { padding: 24px 0; text-align: center; color: #4b5361; font-style: italic; }

table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; color: #6b7280; padding: 3px 6px; position: sticky; top: -8px; background: #0f1116; }
td { padding: 3px 6px; border-top: 1px solid #1c2029; vertical-align: top; }
td.key { color: #a6e3a1; word-break: break-all; }
td.dim { color: #6b7280; }

dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 0; }
dt { color: #6b7280; }
dd { margin: 0; word-break: break-all; }

input[type="search"] {
  width: 100%; font: inherit; padding: 4px 8px; margin-bottom: 6px;
  color: #d5d9e0; background: #171a21; border: 1px solid #2b3040; border-radius: 6px;
}
input[type="search"]:focus { outline: none; border-color: #4b536b; }

.event { display: flex; gap: 8px; padding: 3px 0; border-top: 1px solid #1c2029; }
.event .at { color: #4b5361; }
.event .type { min-width: 108px; color: #8ab4ff; }
.event.bad .type { color: #f08a8a; }
.event.warn .type { color: #f0b45f; }
.event .payload { flex: 1; color: #9aa4b8; word-break: break-all; }

.modes { display: flex; gap: 3px; }
.modes button { padding: 2px 6px; }

.actions { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }

td input.edit {
  width: 100%; font: inherit; padding: 1px 4px;
  color: #d5d9e0; background: transparent; border: 1px solid transparent; border-radius: 4px;
}
td input.edit:hover { border-color: #2b3040; }
td input.edit:focus { outline: none; background: #171a21; border-color: #4b536b; }

td.locale-cell { min-width: 120px; }

.cost {
  margin: 0 0 8px; padding: 5px 8px; border-radius: 6px;
  background: #3a2410; border: 1px solid #6b4415; color: #f0b45f;
}
.cost code { color: inherit; }
`
