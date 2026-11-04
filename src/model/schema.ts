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

  const link: MarkSpec = {
    attrs: {
      href: {},
      title: { default: null },
      id: { default: null },
      class: { default: null },
      textAlign: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs(dom: HTMLElement) {
          const align =
            dom.getAttribute("data-align") ||
            (dom.style && dom.style.textAlign) ||
            null;

          return {
            href: dom.getAttribute("href"),
            title: dom.getAttribute("title"),
            id: dom.getAttribute("id") || null,
            class: dom.getAttribute("class") || null,
            textAlign: align || null,
          };
        },
      },
    ],
    toDOM(node) {
      const { href, title, id, class: className, textAlign } = node.attrs;
      const style = textAlign ? `text-align:${textAlign};` : null;

      const attrs: Record<string, unknown> = {
        href,
        title,
        ...(id ? { id } : {}),
        ...(className ? { class: className } : {}),
        ...(style ? { style } : {}),
        ...(textAlign ? { "data-align": textAlign } : {}),
      };

      return ["a", attrs, 0];
    },
  };

  const addNodeAttrs = (spec: any) => ({
    ...spec,
    attrs: {
      ...(spec.attrs || {}),
      id: { default: null },
      class: { default: null },
      textAlign: { default: null },
    },
    parseDOM: (spec.parseDOM || []).map((r: any) => ({
      ...r,
      getAttrs: (dom: HTMLElement) => {
        const base = r.getAttrs ? r.getAttrs(dom) : {};
        const id = dom.getAttribute("id") || null;
        const className = dom.getAttribute("class") || null;
        const align =
          dom.getAttribute("data-align") ||
          (dom.style && dom.style.textAlign) ||
          null;
        return {
          ...(r.attrs || {}),
          ...(base || {}),
          id,
          class: className,
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
        ...(node.attrs.id ? { id: node.attrs.id } : {}),
        ...(node.attrs.class ? { class: node.attrs.class } : {}),
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
    nodes = nodes.update("paragraph", addNodeAttrs(paragraph));
  }
  if (heading) {
    nodes = nodes.update("heading", addNodeAttrs(heading));
  }

  nodes = nodes.addToEnd("math", {
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    attrs: {
      id: { default: null },
      class: { default: null },
      latex: { default: "" },
    },
    toDOM(node: any) {
      const attrs: Record<string, string> = {
        "data-math-inline": "true",
        "data-latex": node.attrs.latex || "",
      };
      if (node.attrs.id) attrs.id = node.attrs.id;
      if (node.attrs.class) attrs.class = node.attrs.class;

      return ["span", attrs];
    },
    parseDOM: [
      {
        tag: 'span[data-math-inline="true"]',
        getAttrs: (dom: HTMLElement) => ({
          id: dom.getAttribute("id") || null,
          class: dom.getAttribute("class") || null,
          latex: dom.getAttribute("data-latex") || "",
        }),
      },
    ],
  });

  nodes = nodes.addToEnd("variable", {
    group: "inline",
    inline: true,
    atom: true,
    attrs: {
      id: { default: null },
      class: { default: null },
      resolver: { default: '{"path": ""}' },
      text: { default: "" },
    },
    parseDOM: [
      {
        tag: 'span[data-gjs-type="data-variable"]',
        getAttrs: (dom: HTMLElement) => {
          const resolver = dom.getAttribute("data-resolver");
          return {
            id: dom.getAttribute("id") || null,
            class: dom.getAttribute("class") || null,
            resolver,
            text: dom.textContent || "",
          };
        },
      },
    ],
    toDOM(node: any) {
      const resolver = node.attrs.resolver;
      let label = node.attrs.text;

      try {
        if (!label) {
          const parsed = JSON.parse(resolver);
          label = parsed.path || "Variable";
        }
      } catch {
        label = "Variable";
      }

      const attrs: Record<string, string> = {
        "data-gjs-type": "data-variable",
        "data-resolver": resolver,
        contenteditable: "false",
      };
      if (node.attrs.id) attrs.id = node.attrs.id;
      if (node.attrs.class) attrs.class = node.attrs.class;

      return ["span", attrs, label];
    },
  });

  const marks = basicSchema.spec.marks
    .update("link", link)
    .addToEnd("underline", underline)
    .addToEnd("strike", strike)
    .addToEnd("textStyle", textStyle);

  return new Schema({
    nodes,
    marks,
  });
};
