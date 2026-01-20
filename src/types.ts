import type { Editor } from "grapesjs";
import type { Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { Plugin as PMPlugin } from "prosemirror-state";

export type PMRteInstance = {
  view: EditorView;
  el: HTMLElement;
  destroy: () => void;
  focus: () => void;
  getHTML: () => string;
  ui?: UIInstance;
};

export type UIContext = {
  editor: Editor;
  el: HTMLElement; // element being edited
  rte: PMRteInstance;
  toolbarEl: HTMLElement;
};

export type UIInstance = {
  update?: () => void;
  destroy: () => void;
};

export type UIAdapter = {
  mount: (ctx: UIContext) => UIInstance;
};

export type ProseMirrorRTEOptions = {
  schema?: Schema;
  // Customize ProseMirror plugins.
  pmPlugins?: (schema: Schema) => PMPlugin[];
  ui?: UIAdapter;
  parseContent?: boolean;
  onCreate?: (rte: PMRteInstance) => void;
};
