import { type MarkSpec, Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";

export const buildDefaultSchema = (): Schema => {
  const underline: MarkSpec = {
    parseDOM: [
      { tag: "u" },
      {
        style: "text-decoration",
        getAttrs: (v) => (String(v).includes("underline") ? {} : false),
      },
    ],
    toDOM() {
      return ["u", 0];
    },
  };

  const strike: MarkSpec = {
    parseDOM: [
      { tag: "s" },
      { tag: "del" },
      { tag: "strike" },
      {
        style: "text-decoration",
        getAttrs: (v) => (String(v).includes("line-through") ? {} : false),
      },
    ],
    toDOM() {
      return ["s", 0];
    },
  };

  const textStyle: MarkSpec = {
    attrs: {
      fontFamily: { default: null },
      fontSize: { default: null },
      color: { default: null },
      backgroundColor: { default: null },
    },
    parseDOM: [
      {
        tag: "span",
        getAttrs: (dom: HTMLElement) => {
          const style = dom.style || ({} as CSSStyleDeclaration);
          const fontFamily =
            dom.getAttribute("data-font-family") || style.fontFamily;
          const fontSizeRaw =
            dom.getAttribute("data-font-size") || style.fontSize;
          const color = dom.getAttribute("data-color") || style.color;
          const backgroundColor =
            dom.getAttribute("data-bg-color") || style.backgroundColor;
          const fontSize = fontSizeRaw
            ? parseInt(String(fontSizeRaw).replace("px", ""), 10)
            : null;

          if (!fontFamily && !fontSize && !color && !backgroundColor)
            return false;

          return {
            fontFamily: fontFamily || null,
            fontSize: Number.isFinite(fontSize) ? fontSize : null,
            color: color || null,
            backgroundColor: backgroundColor || null,
          };
        },
      },
    ],
    toDOM(mark) {
      const { fontFamily, fontSize, color, backgroundColor } = mark.attrs;
      const styleParts: string[] = [];
      if (fontFamily) styleParts.push(`font-family:${fontFamily}`);
      if (fontSize) styleParts.push(`font-size:${fontSize}px`);
      if (color) styleParts.push(`color:${color}`);
      if (backgroundColor)
        styleParts.push(`background-color:${backgroundColor}`);

      const attrs: Record<string, unknown> = {};
      if (styleParts.length) attrs.style = styleParts.join(";");
      if (fontFamily) attrs["data-font-family"] = fontFamily;
      if (fontSize) attrs["data-font-size"] = String(fontSize);
      if (color) attrs["data-color"] = color;
      if (backgroundColor) attrs["data-bg-color"] = backgroundColor;

      return ["span", attrs, 0];
    },
  };

  const addAlignAttrs = (spec: any) => ({
    ...spec,
    attrs: { ...(spec.attrs || {}), textAlign: { default: null } },
    parseDOM: (spec.parseDOM || []).map((r: any) => ({
      ...r,
      getAttrs: (dom: HTMLElement) => {
        const base = r.getAttrs ? r.getAttrs(dom) : {};
        const align =
          dom.getAttribute("data-align") ||
          (dom.style && dom.style.textAlign) ||
          null;
        return {
          ...(r.attrs || {}),
          ...(base || {}),
          textAlign: align || null,
        };
      },
    })),
    toDOM(node: any) {
      const dom = spec.toDOM ? spec.toDOM(node) : ["p", 0];
      const tag = dom[0];
      const hasAttrs = typeof dom[1] === "object" && !Array.isArray(dom[1]);
      const attrs = hasAttrs ? dom[1] : {};
      const contentIndex = hasAttrs ? 2 : 1;

      const style = node.attrs.textAlign
        ? `text-align:${node.attrs.textAlign};`
        : null;
      const nextAttrs = {
        ...attrs,
        ...(style
          ? { style: [attrs.style, style].filter(Boolean).join(" ") }
          : {}),
        ...(node.attrs.textAlign ? { "data-align": node.attrs.textAlign } : {}),
      };

      const out: any[] = [tag, nextAttrs];
      for (let i = contentIndex; i < dom.length; i++) out.push(dom[i]);
      return out;
    },
  });

  let nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block");
  const paragraph = nodes.get("paragraph");
  const heading = nodes.get("heading");
  if (paragraph) {
    nodes = nodes.update("paragraph", addAlignAttrs(paragraph));
  }
  if (heading) {
    nodes = nodes.update("heading", addAlignAttrs(heading));
  }

  const marks = basicSchema.spec.marks
    .addToEnd("underline", underline)
    .addToEnd("strike", strike)
    .addToEnd("textStyle", textStyle);

  return new Schema({
    nodes,
    marks,
  });
};
