# Custom UI, Utilities, Input Rules, and Keymaps

`grapesjs-prosemirror` separates its Rich Text Editor (RTE) model and lifecycle from the toolbar UI. You can build a custom toolbar in any framework (such as React, Vue, Svelte, or vanilla JS) using the `UIAdapter` interface and the built-in state query and command utilities exported by the package.

---

## Building a Custom UI (React Example)

When a text component is edited in GrapesJS, the plugin mounts your `UIAdapter` into the GrapesJS RTE toolbar container (`ctx.toolbarEl`) and calls `update()` on every ProseMirror transaction so your UI can reflect the latest selection and active formatting state.

Below is a concise React example demonstrating how to wire up a `UIAdapter` with a pub/sub re-render bus and a few core controls (Heading selector, Bold toggle, Text Color input, and the Slash/Variable menu trigger):

```tsx
import { useEffect, useReducer, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type UIAdapter,
  type UIContext,
  type UIInstance,
  getActiveFontColor,
  getActiveHeading,
  insertVariableToken,
  markIsActive,
  run,
  setHeadingOrParagraph,
  setTextColor,
} from "grapesjs-prosemirror";

// Simple event bus to trigger React re-renders on ProseMirror transactions
function createRerenderBus() {
  const listeners = new Set<() => void>();
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit() {
      for (const fn of listeners) fn();
    },
  };
}

function useRerender(bus: ReturnType<typeof createRerenderBus>) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const unsubscribe = bus.subscribe(force);
    return () => {
      unsubscribe();
    };
  }, [bus]);
}

function RTEToolbar({
  ctx,
  bus,
}: {
  ctx: UIContext;
  bus: ReturnType<typeof createRerenderBus>;
}) {
  useRerender(bus);

  const { view } = ctx.rte;
  const { schema } = view.state;

  // Optional: listen for the slash/variable trigger character (default "/")
  const [slashRange, setSlashRange] = useState<{
    from: number;
    to: number;
    coords: { top: number; left: number };
  } | null>(null);

  useEffect(() => {
    ctx.rte.registerSlashActionTrigger((from, to, coords) => {
      setSlashRange({ from, to, coords });
    });
  }, [ctx.rte]);

  // Query active states from the current editor state
  const isBold = markIsActive(schema, view.state, "strong");
  const heading = getActiveHeading(view.state);
  const textColor = getActiveFontColor(view.state);

  return (
    <div
      style={{ display: "flex", gap: "6px", alignItems: "center" }}
      onMouseDown={(e) => {
        // Prevent losing editor focus when clicking toolbar controls
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Block Type / Heading Select */}
      <select
        value={heading}
        onChange={(e) => {
          setHeadingOrParagraph(schema, view, e.target.value);
          view.focus();
        }}
      >
        <option value="paragraph">Paragraph</option>
        <option value="heading-1">Heading 1</option>
        <option value="heading-2">Heading 2</option>
        <option value="heading-3">Heading 3</option>
      </select>

      {/* Inline Mark Toggle (Bold) */}
      <button
        type="button"
        style={{ fontWeight: isBold ? "bold" : "normal" }}
        onClick={() => {
          run(view, schema.marks.strong!);
          view.focus();
        }}
      >
        B
      </button>

      {/* Text Color Input */}
      <input
        type="color"
        value={textColor === "inherit" ? "#000000" : textColor}
        onChange={(e) => {
          setTextColor(schema, view, e.target.value);
          view.focus();
        }}
      />

      {/* Example Variable Insertion when slash menu is triggered */}
      {slashRange && (
        <button
          type="button"
          onClick={() => {
            insertVariableToken(slashRange.from, slashRange.to, schema, view, {
              path: "user.firstName",
              defaultValue: "Guest",
              text: "First Name",
            });
            setSlashRange(null);
          }}
        >
          Insert {{ user.firstName }}
        </button>
      )}
    </div>
  );
}

export function createReactUIAdapter(): UIAdapter {
  return {
    mount(ctx: UIContext): UIInstance {
      const { toolbarEl } = ctx;
      toolbarEl.innerHTML = "";

      const host = document.createElement("div");
      toolbarEl.appendChild(host);

      const bus = createRerenderBus();
      let root: Root | null = createRoot(host);

      root.render(<RTEToolbar ctx={ctx} bus={bus} />);

      return {
        update() {
          bus.emit();
        },
        destroy() {
          root?.unmount();
          root = null;
          host.remove();
        },
      };
    },
  };
}
```

Pass the adapter to the plugin options when initializing GrapesJS:

```ts
import grapesjs from "grapesjs";
import prosemirror from "grapesjs-prosemirror";
import { createReactUIAdapter } from "./rte-toolbar";

const editor = grapesjs.init({
  container: "#gjs",
  plugins: [(ed) => prosemirror(ed, { ui: createReactUIAdapter() })],
});
```

---

## Exported Utilities Reference

All helper utilities are exported directly from `grapesjs-prosemirror`. They are grouped below by responsibility.

### 1. Inline Marks & Formatting

#### `markIsActive(schema, state, markName)`

Checks whether a given mark is currently active in the selection or stored marks (when the cursor is collapsed).

- **Signature:** `(schema: Schema, state: EditorState, markName: string) => boolean`
- **Example:**
  ```ts
  const isBold = markIsActive(schema, view.state, "strong");
  const isItalic = markIsActive(schema, view.state, "em");
  const isUnderline = markIsActive(schema, view.state, "underline");
  const isStrike = markIsActive(schema, view.state, "strike");
  const hasLink = markIsActive(schema, view.state, "link");
  ```

#### `run(view, markType)`

Executes ProseMirror's `toggleMark` command for the provided `MarkType` on the active `EditorView`.

- **Signature:** `(view: EditorView, markType: MarkType) => void`
- **Example:**
  ```ts
  run(view, schema.marks.strong!);
  run(view, schema.marks.em!);
  run(view, schema.marks.underline!);
  run(view, schema.marks.strike!);
  ```

---

### 2. Links

#### `toggleLinkCommand(schema, href?)`

Creates a ProseMirror `Command` that removes the `link` mark if it is already active on the selection, or adds the `link` mark with the given `href` if it is not active (including adding to `storedMarks` when the selection is empty).

- **Signature:** `(schema: Schema, href?: string) => Command`

#### `dispatchLinkCommand(schema, view, href?)`

Immediately dispatches `toggleLinkCommand` against the provided `EditorView`.

- **Signature:** `(schema: Schema, view: EditorView, href?: string) => void`
- **Example:**
  ```ts
  dispatchLinkCommand(schema, view, "https://example.com");
  ```

#### `getActiveLinkHref(view)`

Returns the `href` attribute of the active `link` mark at the cursor or within the current selection, or `""` if no link is present.

- **Signature:** `(view: EditorView) => string`

---

### 3. Typography & Colors (`textStyle` Mark)

The default schema includes a `textStyle` mark on `<span>` elements supporting `fontFamily`, `fontSize`, `color`, and `backgroundColor`. Applying a new property preserves any other `textStyle` attributes already present on the text range.

#### `setFontFamily(schema, view, fontFamily)`

Sets the font family on the current selection or stored marks.

- **Signature:** `(schema: Schema, view: EditorView, fontFamily: string) => void`
- **Example:** `setFontFamily(schema, view, "Inter, sans-serif");`

#### `getActiveFontFamily(state)`

Gets the active `fontFamily` from the `textStyle` mark, defaulting to `"inherit"`.

- **Signature:** `(state: EditorState) => string`

#### `setFontSize(schema, view, fontSizePx)`

Sets the font size (in pixels) on the current selection or stored marks.

- **Signature:** `(schema: Schema, view: EditorView, fontSizePx: number) => void`
- **Example:** `setFontSize(schema, view, 16);`

#### `getActiveFontSize(view)`

Gets the active `fontSize` (in pixels) from the `textStyle` mark. If no explicit mark attribute is set, it falls back to reading `window.getComputedStyle(el).fontSize` from the DOM node at the selection anchor, or `11` as a final fallback.

- **Signature:** `(view: EditorView) => number`

#### `setTextColor(schema, view, color)`

Sets the foreground text color (`color`) on the current selection or stored marks.

- **Signature:** `(schema: Schema, view: EditorView, color: string) => void`
- **Example:** `setTextColor(schema, view, "#ff0000");`

#### `getActiveFontColor(state)`

Gets the active text `color` from the `textStyle` mark, defaulting to `"inherit"`.

- **Signature:** `(state: EditorState) => string`

#### `setHighlightColor(schema, view, backgroundColor)`

Sets the highlight/background color (`backgroundColor`) on the current selection or stored marks.

- **Signature:** `(schema: Schema, view: EditorView, backgroundColor: string) => void`
- **Example:** `setHighlightColor(schema, view, "#ffff00");`

#### `getActiveFontHighlight(state)`

Gets the active `backgroundColor` from the `textStyle` mark, defaulting to `"inherit"`.

- **Signature:** `(state: EditorState) => string`

---

### 4. Headings, Paragraphs & Text Alignment

#### `getActiveHeading(state)`

Inspects the current active textblock and returns `"heading-1"` through `"heading-6"` if it is a heading node, or `"paragraph"` otherwise.

- **Signature:** `(state: EditorState) => string`

#### `setHeadingOrParagraph(schema, view, value)`

Converts the selected block to a paragraph or a heading based on a string value:

- `"paragraph"` or `"normal"` converts the block to a `<p>` node.
- `"heading-1"` through `"heading-6"` converts the block to the corresponding `<h1>`–`<h6>` node.
- **Signature:** `(schema: Schema, view: EditorView, value: string) => void`

#### `setHeading(schema, level)`

Returns a ProseMirror `Command` that sets the current textblock to a `heading` node of the specified `level` (1–6).

- **Signature:** `(schema: Schema, level: number) => Command`

#### `setParagraph(schema)`

Returns a ProseMirror `Command` that sets the current textblock to a `paragraph` node.

- **Signature:** `(schema: Schema) => Command`

#### `setTextAlign(view, align)`

Updates the `textAlign` attribute (`"left"`, `"center"`, `"right"`, `"justify"`, or `null`) on all textblocks in the current selection that support `textAlign` (such as `paragraph` and `heading`).

- **Signature:** `(view: EditorView, align: string | null) => true | undefined`

#### `getActiveTextAlign(state)`

Returns the active textblock's alignment (`"left"`, `"center"`, `"right"`, or `"justify"`), defaulting to `"left"`.

- **Signature:** `(state: EditorState) => "left" | "center" | "right" | "justify"`

---

### 5. Lists, Blocks & Dividers

#### `wrapBulletList(schema, view)`

Wraps the current selection in an unordered bullet list (`<ul>`).

- **Signature:** `(schema: Schema, view: EditorView) => void`

#### `wrapOrderedList(schema, view)`

Wraps the current selection in an ordered list (`<ol>`).

- **Signature:** `(schema: Schema, view: EditorView) => void`

#### `indent(schema, view)`

Lifts the current list item out of its enclosing list (`liftListItem` on `schema.nodes.list_item`).

- **Signature:** `(schema: Schema, view: EditorView) => void`

#### `outdent(schema, view)`

Sinks the current list item into a nested sublist (`sinkListItem` on `schema.nodes.list_item`).

- **Signature:** `(schema: Schema, view: EditorView) => void`

#### `blockquote(schema, view)`

Wraps the current selection in a `<blockquote>` node.

- **Signature:** `(schema: Schema, view: EditorView) => void`

#### `horizontalRule(schema, view)`

Replaces the current selection with a horizontal rule (`<hr>`) node and scrolls it into view.

- **Signature:** `(schema: Schema, view: EditorView) => boolean`

---

### 6. Math Formulas (KaTeX) & Dynamic Variables

#### `mathFormula(schema, view)`

Inserts an inline `math` node (`<span data-math-inline="true" data-latex="">`) at the current selection. When selected in the editor, the `MathInlineView` node view renders an inline `<textarea class="pm-math">` for editing the raw LaTeX expression (pressing `Escape` blurs the input).

- **Signature:** `(schema: Schema, view: EditorView) => boolean`

#### `renderMathPreview(el)`

Finds all `span[data-latex]` elements inside `el` and renders their `data-latex` attribute into HTML using **KaTeX** (`katex.renderToString`). This is automatically invoked by `rte.getHTML()` when serializing content back to GrapesJS, and can also be called manually if you need to render previews outside the editor.

- **Signature:** `(el: HTMLElement) => void`

#### `insertVariableToken(from, to, schema, view, resolverObject)`

Replaces the document range `[from, to]` (typically captured from `ctx.rte.registerSlashActionTrigger`) with an atomic inline `variable` node (`<span data-gjs-type="data-variable" data-resolver="..." contenteditable="false">`) and restores focus to the editor.

- **Signature:**
  ```ts
  function insertVariableToken(
    from: number,
    to: number,
    schema: Schema,
    view: EditorView,
    resolverObject: { path?: string; defaultValue?: string; text?: string },
  ): void;
  ```
- **Details:**
  - `text` is used as the visible label inside the variable pill (falling back to `path` or `"Variable"`).
  - The remaining properties (`path`, `defaultValue`, etc.) are JSON-stringified into the `data-resolver` attribute.

#### `ctx.rte.registerSlashActionTrigger(callback)`

Registers a callback on the RTE instance that fires whenever the user types the variable trigger character (defaults to `"/"`, configurable via `openVariablesCharacter` in `ProseMirrorRTEOptions`).

- **Signature:**
  ```ts
  registerSlashActionTrigger: (
    callback: (
      from: number,
      to: number,
      coords: { top: number; left: number },
    ) => void,
  ) => void;
  ```
- **Details:** `from` and `to` represent the document positions covering the typed trigger character so that `insertVariableToken(from, to, ...)` cleanly replaces it with the variable node. `coords` provides viewport-adjusted `{ top, left }` coordinates below the cursor for positioning a floating menu or portal.

---

## Input Rules (Markdown Shortcuts)

By default, `grapesjs-prosemirror` configures `prosemirror-inputrules` with Markdown-style auto-formatting and typography rules as you type. Pressing `Backspace` immediately after an input rule triggers will undo the transformation (`undoInputRule`).

### Block-Level Input Rules

Triggered at the **start of a textblock**:

| Shortcut                     | Result                                                            | Node Type         |
| :--------------------------- | :---------------------------------------------------------------- | :---------------- |
| `# ` through `###### `       | Heading 1–6 (`<h1>`–`<h6>`) based on the number of `#` characters | `heading`         |
| `> `                         | Blockquote (`<blockquote>`)                                       | `blockquote`      |
| `- `, `+ `, or `* `          | Bullet / Unordered List (`<ul>`)                                  | `bullet_list`     |
| `1. ` (any number + `. `)    | Ordered List (`<ol>`) starting at that number                     | `ordered_list`    |
| ` ``` `                      | Code Block (`<pre><code>`)                                        | `code_block`      |
| `---`, `—-`, `___`, or `***` | Horizontal Rule (`<hr>`)                                          | `horizontal_rule` |

### Inline Mark Input Rules

Triggered anywhere in text when closing the pattern:

| Shortcut                               | Result                                             | Mark Type   |
| :------------------------------------- | :------------------------------------------------- | :---------- |
| `**text**`                             | **Bold** (`<strong>`)                              | `strong`    |
| `*text*` or `_text_`                   | _Italic_ (`<em>`)                                  | `em`        |
| `__text__`                             | <u>Underline</u> (`<u>`)                           | `underline` |
| `~~text~~`                             | ~~Strikethrough~~ (`<s>`)                          | `strike`    |
| `[text](url)` or `[text](url "title")` | Hyperlink (`<a href="url" title="title">text</a>`) | `link`      |

### Typography Input Rules

Included from `prosemirror-inputrules`:

- **Smart Quotes:** Converts straight double (`"`) and single (`'`) quotes into opening and closing curly quotes (`“ ”`, `‘ ’`).
- **Em Dash:** Converts `--` into an em dash (`—`).
- **Ellipsis:** Converts `...` into an ellipsis character (`…`).

---

## Keymaps (Keyboard Shortcuts)

The default plugin stack registers both a schema-aware rich-text keymap and ProseMirror's `baseKeymap`.

> **Note:** `Mod` corresponds to `Cmd` (`⌘`) on macOS/iOS and `Ctrl` on Windows/Linux.

### History & General Editing

| Shortcut                       | Action                                                                                     |
| :----------------------------- | :----------------------------------------------------------------------------------------- |
| `Mod-z`                        | Undo last change                                                                           |
| `Shift-Mod-z`                  | Redo last undone change                                                                    |
| `Mod-y` _(Windows/Linux only)_ | Redo last undone change                                                                    |
| `Backspace`                    | Undo last triggered input rule (or delete backward via `baseKeymap`)                       |
| `Escape`                       | Select parent node (`selectParentNode`)                                                    |
| `Alt-ArrowUp`                  | Join current block with the block above (`joinUp`)                                         |
| `Alt-ArrowDown`                | Join current block with the block below (`joinDown`)                                       |
| `Mod-BracketLeft` (`Mod-[`)    | Lift selected block out of its parent container (`lift`, when not overridden by list item) |

### Inline Formatting Marks

| Shortcut          | Action                                 | Mark Type   |
| :---------------- | :------------------------------------- | :---------- |
| `Mod-b` / `Mod-B` | Toggle **Bold**                        | `strong`    |
| `Mod-i` / `Mod-I` | Toggle _Italic_                        | `em`        |
| `Mod-u` / `Mod-U` | Toggle <u>Underline</u>                | `underline` |
| `Mod-s` / `Mod-S` | Toggle ~~Strikethrough~~               | `strike`    |
| `Mod-k` / `Mod-K` | Toggle Hyperlink (`toggleLinkCommand`) | `link`      |
| `` Mod-` ``       | Toggle Inline Code (`<code>`)          | `code`      |

### Block Formatting & Lists

| Shortcut                                             | Action                                                              | Node Type         |
| :--------------------------------------------------- | :------------------------------------------------------------------ | :---------------- |
| `Shift-Ctrl-0`                                       | Convert block to Paragraph (`<p>`)                                  | `paragraph`       |
| `Shift-Ctrl-1` … `Shift-Ctrl-6`                      | Convert block to Heading 1–6 (`<h1>`–`<h6>`)                        | `heading`         |
| `Shift-Ctrl-8`                                       | Wrap selection in Bullet List (`<ul>`)                              | `bullet_list`     |
| `Shift-Ctrl-9`                                       | Wrap selection in Ordered List (`<ol>`)                             | `ordered_list`    |
| `Ctrl->`                                             | Wrap selection in Blockquote (`<blockquote>`)                       | `blockquote`      |
| `Shift-Ctrl-\`                                       | Convert block to Code Block (`<pre><code>`)                         | `code_block`      |
| `Mod-_`                                              | Insert Horizontal Rule (`<hr>`)                                     | `horizontal_rule` |
| `Enter`                                              | Split list item (`splitListItem`) or split paragraph (`baseKeymap`) | `list_item`       |
| `Mod-[`                                              | Outdent / lift list item (`liftListItem`)                           | `list_item`       |
| `Mod-]`                                              | Indent / sink list item (`sinkListItem`)                            | `list_item`       |
| `Mod-Enter` / `Shift-Enter` / `Ctrl-Enter` _(macOS)_ | Exit code block or insert a Hard Break (`<br>`)                     | `hard_break`      |
