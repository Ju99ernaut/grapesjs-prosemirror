# GrapesJS ProseMirror

A GrapesJS plugin that replaces the built-in Rich Text Editor with **ProseMirror**.

This plugin is intentionally designed as a **model layer**: it provides the ProseMirror instance lifecycle, content serialization, keymaps/plugins wiring, and GrapesJS `setCustomRte()` integration — while keeping the **UI fully swappable**.

You can use the built-in UI adapter, or build your own toolbar/menus with **React, Vue, Svelte, vanilla DOM**, etc, by implementing a small `UIAdapter` interface.

---

## Summary

- Plugin name: `grapesjs-prosemirror`
- Purpose: ProseMirror-backed RTE for GrapesJS with a pluggable UI layer
- UI: optional via `ui` adapter (bring your own framework)

### HTML

```html
<link
  href="https://unpkg.com/grapesjs/dist/css/grapes.min.css"
  rel="stylesheet"
/>
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-prosemirror"></script>

<div id="gjs"></div>
```

### JS

```js
const editor = grapesjs.init({
  container: "#gjs",
  height: "100%",
  fromElement: true,
  storageManager: false,
  plugins: ["grapesjs-prosemirror"],
});
```

### CSS

```css
body,
html {
  margin: 0;
  height: 100%;
}
```

## Options

| Option               | Description                                                | Default                    |
| -------------------- | ---------------------------------------------------------- | -------------------------- |
| `schema`             | ProseMirror schema to use (marks/nodes/attrs)              | `Internal defaults`        |
| `prosemirrorPlugins` | Extend ProseMirror plugins/keymaps/history                 | `Internal defaults`        |
| `ui`                 | Custom UI adapter (framework-agnostic)                     | `Built-in/default adapter` |
| `parseContent`       | Let GrapesJS parse returned HTML into components           | `true (recommended)`       |
| `onCreate`           | Hook after instance creation (attach plugins, debug, etc.) | `undefined`                |

## Building a custom UI

The plugin exposes a simple UIAdapter interface. The adapter is responsible only for rendering UI and calling ProseMirror commands — it doesn’t need to manage editor lifecycle.

UI Adapter concept
• GrapesJS provides a toolbar container via editor.RichTextEditor.getToolbarEl().
• When a text component is edited, the plugin creates a ProseMirror instance and then calls your adapter:
• ui.mount({ editor, el, rte, toolbarEl })
• On every transaction, the plugin calls uiInstance.update?.() so you can update active states (bold/link/etc.)
• On blur/disable, the plugin calls uiInstance.destroy().

Types

```ts
export type UIContext = {
  editor: grapesjs.Editor;
  el: HTMLElement; // the component DOM being edited
  rte: PMRteInstance; // ProseMirror instance wrapper
  toolbarEl: HTMLElement; // mount UI here (recommended)
};

export type UIInstance = {
  update?: () => void; // called on each transaction (selection/doc changes)
  destroy: () => void; // cleanup (unmount, remove listeners)
};

export type UIAdapter = {
  mount: (ctx: UIContext) => UIInstance;
};
```

Example

```ts
import type { UIAdapter } from "grapesjs-prosemirror";
import { toggleMark } from "prosemirror-commands";

export const vanillaUI: UIAdapter = {
  mount({ toolbarEl, rte }) {
    toolbarEl.innerHTML = "";

    const btn = document.createElement("button");
    btn.textContent = "Bold";
    btn.onmousedown = (e) => {
      e.preventDefault();
      const { schema } = rte.view.state;
      const cmd = toggleMark(schema.marks.strong);
      cmd(rte.view.state, rte.view.dispatch, rte.view);
      rte.view.focus();
    };

    toolbarEl.appendChild(btn);

    return {
      update() {
        // optionally set active state based on selection
      },
      destroy() {
        btn.remove();
      },
    };
  },
};
```

## Download

- CDN
  - `https://unpkg.com/grapesjs-prosemirror`
- NPM
  - `npm i grapesjs-prosemirror`
- GIT
  - `git clone https://github.com/Ju99ernaut/grapesjs-prosemirror.git`

## Usage

Directly in the browser

```html
<link
  href="https://unpkg.com/grapesjs/dist/css/grapes.min.css"
  rel="stylesheet"
/>
<script src="https://unpkg.com/grapesjs"></script>
<script src="path/to/grapesjs-prosemirror.min.js"></script>

<div id="gjs"></div>

<script type="text/javascript">
  var editor = grapesjs.init({
    container: "#gjs",
    // ...
    plugins: ["grapesjs-prosemirror"],
    pluginsOpts: {
      "grapesjs-prosemirror": {
        /* options */
      },
    },
  });
</script>
```

Modern javascript

```js
import grapesjs from 'grapesjs';
import plugin from 'grapesjs-prosemirror';
import 'grapesjs/dist/css/grapes.min.css';

const editor = grapesjs.init({
  container : '#gjs',
  // ...
  plugins: [plugin],
  pluginsOpts: {
    [plugin]: { /* options */ }
  }
  // or
  plugins: [
    editor => plugin(editor, { /* options */ }),
  ],
});
```

## Development

Clone the repository

```sh
$ git clone https://github.com/Ju99ernaut/grapesjs-prosemirror.git
$ cd grapesjs-prosemirror
```

Install dependencies

```sh
$ npm i
```

Start the dev server

```sh
$ npm start
```

Build the source

```sh
$ npm run build
```

## License

MIT
