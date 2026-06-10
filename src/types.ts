import type { Editor } from "grapesjs";
import type { Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import type { Plugin } from "prosemirror-state";

export type PMRteInstance = {
  view: EditorView;
  el: HTMLElement;
  destroy: () => void;
  focus: () => void;
  getHTML: () => string;
  ui?: UIInstance;
  registerSlashActionTrigger: (
    callback: (
      from: number,
      to: number,
      coords: { top: number; left: number },
    ) => void,
  ) => void;
};

export type UIContext = {
  editor: Editor;
  el: HTMLElement;
  rte: PMRteInstance;
  toolbarEl: HTMLElement;
  triggerVariableModal?: () => void;
};

export type UIInstance = {
  update?: () => void;
  destroy: () => void;
};

export type UIAdapter = {
  mount: (ctx: UIContext) => UIInstance;
};

export type SlashPluginConfig = {
  onSlashTrigger: (
    from: number,
    to: number,
    coords: { top: number; left: number },
  ) => void;
};

export type ProseMirrorRTEOptions = {
  schema?: Schema;
  prosemirrorPlugins?: (schema: Schema) => Plugin[];
  ui?: UIAdapter;
  parseContent?: boolean;
  onCreate?: (rte: PMRteInstance) => void;
};
