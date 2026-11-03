import { describe, it, expect, vi } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { buildDefaultSchema } from "../model/schema";
import {
  markIsActive,
  toggleLinkCommand,
  getActiveLinkHref,
  setFontFamily,
  setFontSize,
  setTextColor,
  setHighlightColor,
  getActiveFontFamily,
  getActiveFontSize,
  getActiveFontColor,
  getActiveFontHighlight,
  setTextAlign,
  getActiveTextAlign,
  run,
  horizontalRule,
  blockquote,
  setHeading,
  setParagraph,
  setHeadingOrParagraph,
  getActiveHeading,
  wrapBulletList,
  wrapOrderedList,
  mathFormula,
  renderMathPreview,
  insertVariableToken,
} from "../utils";

describe("grapesjs-prosemirror utils", () => {
  const schema = buildDefaultSchema();

  const createTestHarness = (initialText = "Hello World") => {
    let state = EditorState.create({
      schema,
      doc: schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text(initialText)]),
      ]),
    });

    // Select the whole text by default (pos 1 to 1 + length)
    state = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, 1, 1 + initialText.length),
      ),
    );

    const view: any = {
      get state() {
        return state;
      },
      set state(newState) {
        state = newState;
      },
      dispatch: (tr: any) => {
        state = state.apply(tr);
      },
      focus: vi.fn(),
      domAtPos: () => ({ node: { nodeType: 1 } }),
    };

    return {
      get state() {
        return state;
      },
      view,
    };
  };

  describe("markIsActive and run", () => {
    it("detects active marks and toggles them via run", () => {
      const { view } = createTestHarness("Sample text");
      const strong = schema.marks.strong!;

      expect(markIsActive(schema, view.state, "strong")).toBe(false);

      // Toggle strong on
      run(view, strong);
      expect(markIsActive(schema, view.state, "strong")).toBe(true);

      // Toggle strong off
      run(view, strong);
      expect(markIsActive(schema, view.state, "strong")).toBe(false);
    });

    it("returns false for non-existent mark name", () => {
      const { view } = createTestHarness("Sample text");
      expect(markIsActive(schema, view.state, "non_existent_mark")).toBe(false);
    });
  });

  describe("link commands", () => {
    it("adds link mark with href and removes it when toggled again", () => {
      const { view } = createTestHarness("Link text");
      const command = toggleLinkCommand(schema, "https://example.com");

      // Apply link
      command(view.state, view.dispatch);
      expect(markIsActive(schema, view.state, "link")).toBe(true);
      expect(getActiveLinkHref(view)).toBe("https://example.com");

      // Toggle off
      command(view.state, view.dispatch);
      expect(markIsActive(schema, view.state, "link")).toBe(false);
      expect(getActiveLinkHref(view)).toBe("");
    });
  });

  describe("text styling (font family, font size, colors)", () => {
    it("applies and retrieves font family", () => {
      const { view } = createTestHarness("Styled text");
      expect(getActiveFontFamily(view.state)).toBe("inherit");

      setFontFamily(schema, view, "Helvetica");
      expect(getActiveFontFamily(view.state)).toBe("Helvetica");
    });

    it("applies and retrieves text color", () => {
      const { view } = createTestHarness("Colored text");
      expect(getActiveFontColor(view.state)).toBe("inherit");

      setTextColor(schema, view, "#e11d48");
      expect(getActiveFontColor(view.state)).toBe("#e11d48");
    });

    it("applies and retrieves background highlight color", () => {
      const { view } = createTestHarness("Highlighted text");
      expect(getActiveFontHighlight(view.state)).toBe("inherit");

      setHighlightColor(schema, view, "#fef08a");
      expect(getActiveFontHighlight(view.state)).toBe("#fef08a");
    });

    it("applies and retrieves font size", () => {
      const { view } = createTestHarness("Sized text");
      setFontSize(schema, view, 24);
      expect(getActiveFontSize(view)).toBe(24);
    });
  });

  describe("text alignment", () => {
    it("sets text align to center, right, justify, and left", () => {
      const { view } = createTestHarness("Align text");
      expect(getActiveTextAlign(view.state)).toBe("left");

      setTextAlign(view, "center");
      expect(getActiveTextAlign(view.state)).toBe("center");

      setTextAlign(view, "right");
      expect(getActiveTextAlign(view.state)).toBe("right");

      setTextAlign(view, "justify");
      expect(getActiveTextAlign(view.state)).toBe("justify");

      setTextAlign(view, "left");
      expect(getActiveTextAlign(view.state)).toBe("left");
    });
  });

  describe("headings and paragraphs", () => {
    it("sets heading levels 1-6 and switches back to paragraph", () => {
      const { view } = createTestHarness("Heading test");
      expect(getActiveHeading(view.state)).toBe("paragraph");

      setHeadingOrParagraph(schema, view, "heading-1");
      expect(getActiveHeading(view.state)).toBe("heading-1");

      setHeadingOrParagraph(schema, view, "heading-3");
      expect(getActiveHeading(view.state)).toBe("heading-3");

      setHeadingOrParagraph(schema, view, "paragraph");
      expect(getActiveHeading(view.state)).toBe("paragraph");
    });

    it("setHeading and setParagraph return false if node not in schema", () => {
      const mockSchema = { nodes: {} } as any;
      expect(setHeading(mockSchema, 1)({} as any, undefined)).toBe(false);
      expect(setParagraph(mockSchema)({} as any, undefined)).toBe(false);
    });
  });

  describe("lists, blockquote, and horizontal rule", () => {
    it("wraps selection in blockquote", () => {
      const { view } = createTestHarness("Quoted text");
      blockquote(schema, view);
      expect(view.state.doc.firstChild?.type.name).toBe("blockquote");
    });

    it("wraps selection in bullet list and ordered list", () => {
      const { view } = createTestHarness("Item 1");
      wrapBulletList(schema, view);
      expect(view.state.doc.firstChild?.type.name).toBe("bullet_list");

      const harness2 = createTestHarness("Item 2");
      wrapOrderedList(schema, harness2.view);
      expect(harness2.view.state.doc.firstChild?.type.name).toBe("ordered_list");
    });

    it("inserts horizontal rule", () => {
      const { view } = createTestHarness("Text");
      horizontalRule(schema, view);
      const hasHr = view.state.doc.content.toJSON().some(
        (node: any) => node.type === "horizontal_rule",
      );
      expect(hasHr).toBe(true);
    });
  });

  describe("variable tokens and math formulas", () => {
    it("inserts variable token into document", () => {
      const { view } = createTestHarness("Hello ");
      insertVariableToken(1, 1, schema, view, {
        path: "customer.email",
        text: "customer@example.com",
      });

      const variableNode = view.state.doc.nodeAt(1);
      expect(variableNode).toBeDefined();
      expect(variableNode?.type.name).toBe("variable");
      expect(variableNode?.attrs.text).toBe("customer@example.com");
      expect(variableNode?.attrs.resolver).toContain("customer.email");
      expect(view.focus).toHaveBeenCalled();
    });

    it("inserts math formula node into document", () => {
      const { view } = createTestHarness("Math test");
      mathFormula(schema, view);

      let foundMath = false;
      view.state.doc.descendants((node: any) => {
        if (node.type.name === "math") foundMath = true;
      });
      expect(foundMath).toBe(true);
    });

    it("renderMathPreview renders KaTeX output into formula preview elements", () => {
      const mockFormulaEl = {
        getAttribute: (attr: string) => (attr === "data-latex" ? "c = \\sqrt{a^2 + b^2}" : ""),
        innerHTML: "",
      };

      const mockContainer = {
        querySelectorAll: () => [mockFormulaEl],
      } as any;

      renderMathPreview(mockContainer);
      expect(mockFormulaEl.innerHTML).toContain("katex");
    });

    it("renderMathPreview falls back to raw latex string on KaTeX render error", () => {
      const invalidLatex = "\\invalidCommandWhichFails";
      const mockFormulaEl = {
        getAttribute: () => invalidLatex,
        innerHTML: "",
      };

      const mockContainer = {
        querySelectorAll: () => [mockFormulaEl],
      } as any;

      renderMathPreview(mockContainer);
      expect(mockFormulaEl.innerHTML.length).toBeGreaterThan(0);
    });
  });
});
