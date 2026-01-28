import type { Plugin } from "grapesjs";
import { DOMParser, DOMSerializer } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createDefaultVanillaUI } from "./default-ui";
import type { PMRteInstance, ProseMirrorRTEOptions } from "./types";
import { buildDefaultSchema } from "./model/schema";
import { defaultPmPlugins } from "./model/plugins";

export * from "./types";
export * from "./utils";

export const plugin: Plugin<ProseMirrorRTEOptions> = (editor, opts = {}) => {
  const options = {
    parseContent: true,
    ...opts,
  };

  const schema = options.schema ?? buildDefaultSchema();
  const pmPlugins =
    options.prosemirrorPlugins?.(schema) ?? defaultPmPlugins(schema);
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

    const state = EditorState.create({
      doc: DOMParser.fromSchema(schema).parse(tmp),
      plugins: pmPlugins,
    });
    const view = new EditorView(el, {
      state,
      dispatchTransaction(tr) {
        const nextState = view.state.apply(tr);
        view.updateState(nextState);
        instance.ui?.update?.();
      },
    });

    const getHTML = () => {
      const { schema, doc } = view.state;
      const wrap = document.createElement("div");
      const frap = DOMSerializer.fromSchema(schema).serializeFragment(
        doc.content,
      );
      wrap.appendChild(frap);
      return wrap.innerHTML;
    };

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
    return { forceSync: true };
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
