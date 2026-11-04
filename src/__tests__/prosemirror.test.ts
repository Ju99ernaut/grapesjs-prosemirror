import { describe, it, expect, vi } from "vitest";
import grapesjs, { Editor } from "grapesjs";
import { EditorState } from "prosemirror-state";
import { prosemirror } from "../index";
import { buildDefaultSchema } from "../model/schema";
import { defaultPmPlugins } from "../model/plugins";
import { buildKeymap } from "../model/keymaps";
import {
  buildInputRules,
  boldRule,
  italicRule,
  underlineRule,
  strikeRule,
  linkRule,
  hrRule,
} from "../model/input-rules";
import { variableSlashPlugin } from "../model/variable-slash";
import { VariableNodeView } from "../model/variable-view";
import type { PMRteInstance, ProseMirrorRTEOptions } from "../types";

if (typeof globalThis.document === "undefined") {
  class MockElement {
    tagName: string;
    attributes: Record<string, string> = {};
    textContent: string = "";
    innerHTML: string = "";
    style: Record<string, string> = {};

    constructor(tagName: string) {
      this.tagName = tagName;
    }

    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    }

    getAttribute(name: string) {
      return this.attributes[name] || null;
    }

    addEventListener() {}
    removeEventListener() {}
  }

  globalThis.document = {
    createElement(tagName: string) {
      return new MockElement(tagName);
    },
  } as any;
}

describe("grapesjs-prosemirror plugin", () => {
  const initEditor = (opts?: ProseMirrorRTEOptions): Editor => {
    return grapesjs.init({
      headless: true,
      plugins: [(editor) => prosemirror(editor, opts || {})],
    });
  };

  describe("plugin initialization and GrapesJS custom RTE registration", () => {
    it("registers custom RTE on editor", () => {
      const editor = initEditor();
      const customRte = (editor.RichTextEditor as any).customRte;

      expect(customRte).toBeDefined();
      expect(typeof customRte.enable).toBe("function");
      expect(typeof customRte.disable).toBe("function");
      expect(typeof customRte.getContent).toBe("function");
      expect(customRte.parseContent).toBe(true);

      editor.destroy();
    });

    it("respects custom options such as parseContent: false", () => {
      const editor = initEditor({ parseContent: false });
      const customRte = (editor.RichTextEditor as any).customRte;

      expect(customRte.parseContent).toBe(false);

      editor.destroy();
    });

    it("getContent returns rte.getHTML() if rte instance exists, else el.innerHTML", () => {
      const editor = initEditor();
      const customRte = (editor.RichTextEditor as any).customRte;

      const mockEl = { innerHTML: "<p>Fallback content</p>" } as any;
      expect(customRte.getContent(mockEl)).toBe("<p>Fallback content</p>");

      const mockRte: Partial<PMRteInstance> = {
        getHTML: () => "<p>RTE generated HTML</p>",
      };
      expect(customRte.getContent(mockEl, mockRte as PMRteInstance)).toBe(
        "<p>RTE generated HTML</p>",
      );

      editor.destroy();
    });

    it("disable calls rte.destroy() and returns { forceSync: true }", () => {
      const editor = initEditor();
      const customRte = (editor.RichTextEditor as any).customRte;

      const mockDestroy = vi.fn();
      const mockRte: Partial<PMRteInstance> = {
        destroy: mockDestroy,
      };

      const result = customRte.disable({} as any, mockRte as PMRteInstance);
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ forceSync: true });

      editor.destroy();
    });
  });

  describe("schema definition and node/mark serialization", () => {
    const schema = buildDefaultSchema();

    it("builds a schema with all expected marks", () => {
      expect(schema.marks.underline).toBeDefined();
      expect(schema.marks.strike).toBeDefined();
      expect(schema.marks.textStyle).toBeDefined();
      expect(schema.marks.link).toBeDefined();
      expect(schema.marks.strong).toBeDefined();
      expect(schema.marks.em).toBeDefined();
      expect(schema.marks.code).toBeDefined();
    });

    it("builds a schema with all expected nodes", () => {
      expect(schema.nodes.doc).toBeDefined();
      expect(schema.nodes.paragraph).toBeDefined();
      expect(schema.nodes.heading).toBeDefined();
      expect(schema.nodes.text).toBeDefined();
      expect(schema.nodes.math).toBeDefined();
      expect(schema.nodes.variable).toBeDefined();
      expect(schema.nodes.bullet_list).toBeDefined();
      expect(schema.nodes.ordered_list).toBeDefined();
      expect(schema.nodes.list_item).toBeDefined();
      expect(schema.nodes.blockquote).toBeDefined();
      expect(schema.nodes.horizontal_rule).toBeDefined();
    });

    it("serializes underline, strike, and textStyle marks to DOM", () => {
      const underlineSpec = schema.marks.underline.spec;
      expect(
        underlineSpec.toDOM?.(schema.marks.underline.create(), true),
      ).toEqual(["u", 0]);

      const strikeSpec = schema.marks.strike.spec;
      expect(strikeSpec.toDOM?.(schema.marks.strike.create(), true)).toEqual([
        "s",
        0,
      ]);

      const textStyleSpec = schema.marks.textStyle.spec;
      const textStyleMark = schema.marks.textStyle.create({
        fontFamily: "Arial",
        fontSize: 16,
        color: "#ff0000",
        backgroundColor: "#ffff00",
      });
      const textStyleDOM = textStyleSpec.toDOM?.(textStyleMark, true) as any;
      expect(textStyleDOM[0]).toBe("span");
      expect(textStyleDOM[1]["data-font-family"]).toBe("Arial");
      expect(textStyleDOM[1]["data-font-size"]).toBe("16");
      expect(textStyleDOM[1]["data-color"]).toBe("#ff0000");
      expect(textStyleDOM[1]["data-bg-color"]).toBe("#ffff00");
      expect(textStyleDOM[1].style).toContain("font-family:Arial");
      expect(textStyleDOM[1].style).toContain("font-size:16px");
    });

    it("serializes custom inline nodes to DOM (math, variable, formula, filter, page)", () => {
      // math
      const mathNode = schema.nodes.math.create({ latex: "E = mc^2" });
      const mathDOM = schema.nodes.math.spec.toDOM?.(mathNode) as any;
      expect(mathDOM).toEqual([
        "span",
        {
          "data-math-inline": "true",
          "data-latex": "E = mc^2",
        },
      ]);

      // variable
      const variableNode = schema.nodes.variable.create({
        resolver: '{"path":"user.name"}',
        text: "John Doe",
      });
      const variableDOM = schema.nodes.variable.spec.toDOM?.(
        variableNode,
      ) as any;
      expect(variableDOM[0]).toBe("span");
      expect(variableDOM[1]["data-gjs-type"]).toBe("data-variable");
      expect(variableDOM[1]["data-resolver"]).toBe('{"path":"user.name"}');
      expect(variableDOM[2]).toBe("John Doe");
    });
  });

  describe("custom node views", () => {
    const schema = buildDefaultSchema();

    it("instantiates VariableNodeView and provides DOM representation", () => {
      const node = schema.nodes.variable.create({
        resolver: '{"path":"order.id"}',
        text: "#12345",
      });
      const view = new VariableNodeView(node);

      expect(view.dom).toBeDefined();
      expect(view.dom.tagName.toLowerCase()).toBe("span");
      expect(view.dom.getAttribute("data-gjs-type")).toBe("data-variable");
      expect(view.dom.getAttribute("data-resolver")).toBe(
        '{"path":"order.id"}',
      );
      expect(view.stopEvent()).toBe(true);

      // update node
      const updatedNode = schema.nodes.variable.create({
        resolver: '{"path":"order.total"}',
        text: "$99",
      });
      expect(view.update(updatedNode)).toBe(true);
      expect(view.dom.getAttribute("data-resolver")).toBe(
        '{"path":"order.total"}',
      );
    });
  });

  describe("plugins, keymaps, and input rules", () => {
    const schema = buildDefaultSchema();

    it("builds keymap with expected bindings", () => {
      const keymapPlugin = buildKeymap(schema);
      expect(keymapPlugin).toBeDefined();
    });

    it("builds input rules for headings, lists, blockquotes, codeblocks", () => {
      const inputRulesPlugin = buildInputRules(schema);
      expect(inputRulesPlugin).toBeDefined();
    });

    it("applies markdown input rules for bold, italic, underline, strike, link, and hr", () => {
      const inputRulesPlugin = buildInputRules(schema);
      const handleTextInput = inputRulesPlugin.spec.props?.handleTextInput;
      expect(handleTextInput).toBeDefined();

      const typeString = (input: string) => {
        let state = EditorState.create({
          schema,
          plugins: [inputRulesPlugin],
        });

        const view: any = {
          composing: false,
          get state() {
            return state;
          },
          dispatch(tr: any) {
            state = state.apply(tr);
          },
        };

        for (const ch of input) {
          const { from, to } = state.selection;
          const handled = handleTextInput!.call(
            inputRulesPlugin,
            view,
            from,
            to,
            ch,
            () => state.tr,
          );
          if (!handled) {
            state = state.apply(state.tr.insertText(ch, from, to));
          }
        }
        return state;
      };

      // Bold (**text**)
      expect(boldRule(schema.marks.strong!)).toBeDefined();
      const boldState = typeString("**bold**");
      const boldNode = boldState.doc.firstChild?.firstChild;
      expect(boldNode?.text).toBe("bold");
      expect(schema.marks.strong!.isInSet(boldNode?.marks || [])).toBeTruthy();

      // Italic (*text* and _text_)
      expect(italicRule(schema.marks.em!)).toBeDefined();
      const italicStarState = typeString("*italic*");
      const italicStarNode = italicStarState.doc.firstChild?.firstChild;
      expect(italicStarNode?.text).toBe("italic");
      expect(
        schema.marks.em!.isInSet(italicStarNode?.marks || []),
      ).toBeTruthy();

      const italicUnderscoreState = typeString("_italic_");
      const italicUnderscoreNode =
        italicUnderscoreState.doc.firstChild?.firstChild;
      expect(italicUnderscoreNode?.text).toBe("italic");
      expect(
        schema.marks.em!.isInSet(italicUnderscoreNode?.marks || []),
      ).toBeTruthy();

      // Underline (__text__)
      expect(underlineRule(schema.marks.underline!)).toBeDefined();
      const underlineState = typeString("__underlined__");
      const underlineNode = underlineState.doc.firstChild?.firstChild;
      expect(underlineNode?.text).toBe("underlined");
      expect(
        schema.marks.underline!.isInSet(underlineNode?.marks || []),
      ).toBeTruthy();

      // Strike (~~text~~)
      expect(strikeRule(schema.marks.strike!)).toBeDefined();
      const strikeState = typeString("~~struck~~");
      const strikeNode = strikeState.doc.firstChild?.firstChild;
      expect(strikeNode?.text).toBe("struck");
      expect(
        schema.marks.strike!.isInSet(strikeNode?.marks || []),
      ).toBeTruthy();

      // Link ([text](url))
      expect(linkRule(schema.marks.link!)).toBeDefined();
      const linkState = typeString("[OpenAI](https://example.com)");
      const linkNode = linkState.doc.firstChild?.firstChild;
      expect(linkNode?.text).toBe("OpenAI");
      const linkMark = schema.marks.link!.isInSet(linkNode?.marks || []);
      expect(linkMark).toBeTruthy();
      expect(linkMark?.attrs.href).toBe("https://example.com");

      // Horizontal Rule (---)
      expect(hrRule(schema.nodes.horizontal_rule!)).toBeDefined();
      const hrState = typeString("---");
      expect(hrState.doc.firstChild?.type.name).toBe("horizontal_rule");
    });

    it("creates default ProseMirror plugins array", () => {
      const plugins = defaultPmPlugins(schema);
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThanOrEqual(4);

      // with slash trigger plugin
      const onSlash = vi.fn();
      const pluginsWithSlash = defaultPmPlugins(schema, {
        onSlashTrigger: onSlash,
      });
      expect(pluginsWithSlash.length).toBe(plugins.length + 1);
    });

    it("variableSlashPlugin creates a valid ProseMirror Plugin", () => {
      const onSlash = vi.fn();
      const plugin = variableSlashPlugin(onSlash);
      expect(plugin).toBeDefined();
      expect(plugin.spec.props?.handleTextInput).toBeDefined();
    });
  });
});
