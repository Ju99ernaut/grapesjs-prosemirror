import type { Plugin } from "grapesjs";
import {
  Schema,
  DOMParser as PMDOMParser,
  DOMSerializer,
} from "prosemirror-model";
import { EditorState, Plugin as PMPlugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import {
  baseKeymap,
  toggleMark,
  setBlockType,
  wrapIn,
} from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { createDefaultVanillaUI } from "./default-ui";
import type { PMRteInstance, ProseMirrorRTEOptions } from "./types";
import { toggleLinkCommand } from "./utils";

export * from "./types";
export * from "./utils";

const buildDefaultSchema = () => {
  const underline = {
    parseDOM: [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs: (v: any) => (String(v).includes("underline") ? {} : false),
      },
    ],
    toDOM() {
      return ["u", 0];
    },
  };

  const strike = {
    parseDOM: [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      {
        style: "text-decoration",
        getAttrs: (v: any) => (String(v).includes("line-through") ? {} : false),
      },
    ],
    toDOM() {
      return ["s", 0];
    },
  };

  const marks = basicSchema.spec.marks
    .addToEnd("underline", underline as any)
    .addToEnd("strike", strike as any);

  return new Schema({
    nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
    marks,
  });
};

const createEditorState = (
  schema: Schema,
  docEl: HTMLElement,
  plugins: PMPlugin[],
) => {
  return EditorState.create({
    doc: PMDOMParser.fromSchema(schema).parse(docEl),
    plugins,
  });
};

const defaultPmPlugins = (schema: Schema): PMPlugin[] => {
  const bold = toggleMark(schema.marks.strong);
  const italic = toggleMark(schema.marks.em);
  const underline = toggleMark(schema.marks.underline);
  const strike = toggleMark(schema.marks.strike);
  const link = toggleLinkCommand(schema);
  const code = toggleMark(schema.marks.code);
  const paragraph = setBlockType(schema.nodes.paragraph);
  const heading = (level: number) =>
    setBlockType(schema.nodes.heading, { level });

  const bulletList = schema.nodes.bullet_list
    ? wrapIn(schema.nodes.bullet_list)
    : null;
  const orderedList = schema.nodes.ordered_list
    ? wrapIn(schema.nodes.ordered_list)
    : null;

  return [
    history(),
    keymap({
      "Mod-b": bold,
      "Mod-i": italic,
      "Mod-u": underline,
      "Mod-Shift-x": strike,
      "Mod-k": link,
      "Mod-`": code,
      "Mod-z": undo,
      "Mod-y": redo,
      "Mod-Shift-z": redo,
      "Shift-Alt-0": paragraph,
      "Shift-Alt-1": heading(1),
      "Shift-Alt-2": heading(2),
      "Shift-Alt-3": heading(3),
      ...(bulletList ? { "Shift-Ctrl-8": bulletList } : {}),
      ...(orderedList ? { "Shift-Ctrl-9": orderedList } : {}),
    }),
    keymap(baseKeymap),
  ];
};

const serializeToHTML = (schema: Schema, view: EditorView) => {
  const serializer = DOMSerializer.fromSchema(schema);
  const frag = serializer.serializeFragment(view.state.doc.content);

  const wrap = document.createElement("div");
  wrap.appendChild(frag);
  return wrap.innerHTML;
};

export const plugin: Plugin<ProseMirrorRTEOptions> = (editor, opts = {}) => {
  const options = {
    parseContent: true,
    ...opts,
  };

  const schema = options.schema ?? buildDefaultSchema();
  const pmPlugins = options.pmPlugins?.(schema) ?? defaultPmPlugins(schema);
  const ui = options.ui ?? createDefaultVanillaUI();

  const focus = (_el: HTMLElement, rte?: PMRteInstance) => {
    if (!rte) return;
    rte.focus();
  };

  const enable = (el: HTMLElement, rte?: PMRteInstance): PMRteInstance => {
    rte?.destroy();

    const html = el.innerHTML;
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    el.innerHTML = "";

    const state = createEditorState(schema, tmp, pmPlugins);
    const view = new EditorView(el, {
      state,
      dispatchTransaction(tr) {
        const nextState = view.state.apply(tr);
        view.updateState(nextState);
        instance.ui?.update?.();
      },
    });

    const getHTML = () => serializeToHTML(schema, view);

    const instance: PMRteInstance = {
      view,
      el,
      focus: () => view.focus(),
      getHTML,
      destroy: () => {
        try {
          instance.ui?.destroy?.();
        } finally {
          view.destroy();
        }
      },
    };

    const toolbarEl = editor.RichTextEditor.getToolbarEl();
    instance.ui = ui.mount({ editor, el, rte: instance, toolbarEl });

    options.onCreate?.(instance);

    focus(el, instance);
    return instance;
  };

  const disable = (_el: HTMLElement, rte?: PMRteInstance) => {
    rte?.destroy();
  };

  editor.setCustomRte({
    enable,
    disable,
    getContent(el: HTMLElement, rte?: PMRteInstance) {
      const html = rte?.getHTML() ?? el.innerHTML;
      return html;
    },
    parseContent: options.parseContent ?? false,
  });
};

export default plugin;
