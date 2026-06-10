import katex from "katex";
import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import type { MarkType, Schema } from "prosemirror-model";
import { liftListItem, sinkListItem } from "prosemirror-schema-list";
import { type Command, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

export const markIsActive = (schema: Schema, state: any, markName: string) => {
  const markType = schema.marks[markName];
  if (!markType) return false;

  const { from, $from, to, empty } = state.selection;
  if (empty) return !!markType.isInSet(state.storedMarks || $from.marks());

  return state.doc.rangeHasMark(from, to, markType);
};

export const toggleLinkCommand = (schema: Schema, href = ""): Command => {
  const link = schema.marks.link;
  if (!link) return () => false;

  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    if (markIsActive(schema, state, "link")) {
      if (!dispatch) return true;
      dispatch(state.tr.removeMark(from, to, link));
      return true;
    }

    if (!dispatch) return true;

    const tr = state.tr.addMark(from, to, link.create({ href }));

    if (empty)
      tr.setStoredMarks([
        ...(state.storedMarks || state.selection.$from.marks()),
        link.create({ href }),
      ]);

    dispatch(tr);
    return true;
  };
};

export const dispatchLinkCommand = (
  schema: Schema,
  view: EditorView,
  href = "",
) => {
  const command = toggleLinkCommand(schema, href);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

export const getActiveLinkHref = (view: EditorView) => {
  const { state } = view;
  const link = state.schema.marks.link;
  if (!link) return "";

  const { $from, from, to, empty } = state.selection;
  if (empty) {
    const m = link.isInSet(state.storedMarks || $from.marks());
    return m?.attrs?.href || "";
  }

  let href = "";
  state.doc.nodesBetween(from, to, (node) => {
    const m = link.isInSet(node.marks);
    if (m && !href) href = m.attrs?.href || "";
  });
  return href;
};

const applyTextStyle = (
  schema: Schema,
  attrs: Partial<{
    fontFamily: string | null;
    fontSize: number | null;
    color: string | null;
    backgroundColor: string | null;
  }>,
): Command => {
  const ts = schema.marks.textStyle;
  if (!ts) return () => false;

  return (state, dispatch) => {
    const { from, to, empty } = state.selection;

    const base =
      (ts.isInSet(state.storedMarks || state.selection.$from.marks())
        ?.attrs as any) || {};

    const nextAttrs = { ...base, ...attrs };

    const hasAny =
      nextAttrs.fontFamily ||
      nextAttrs.fontSize ||
      nextAttrs.color ||
      nextAttrs.backgroundColor;

    if (!dispatch) return true;

    let tr = state.tr;

    if (hasAny) {
      const mark = ts.create(nextAttrs);
      tr = tr.addMark(from, to, mark);
      if (empty) {
        const stored = state.storedMarks || state.selection.$from.marks();
        const without = stored.filter((m) => m.type !== ts);
        tr = tr.setStoredMarks([...without, mark]);
      }
    } else {
      tr = tr.removeMark(from, to, ts);
      if (empty) {
        const stored = state.storedMarks || state.selection.$from.marks();
        tr = tr.setStoredMarks(stored.filter((m) => m.type !== ts));
      }
    }

    dispatch(tr.scrollIntoView());
    return true;
  };
};

export const setFontFamily = (
  schema: Schema,
  view: EditorView,
  fontFamily: string,
) => {
  const { state, dispatch } = view;
  const command = applyTextStyle(schema, { fontFamily });
  command(state, dispatch, view);
};

export const setFontSize = (
  schema: Schema,
  view: EditorView,
  fontSizePx: number,
) => {
  const { state, dispatch } = view;
  const command = applyTextStyle(schema, { fontSize: fontSizePx });
  command(state, dispatch, view);
};

export const setTextColor = (
  schema: Schema,
  view: EditorView,
  color: string,
) => {
  const { state, dispatch } = view;
  const command = applyTextStyle(schema, { color });
  command(state, dispatch, view);
};

export const setHighlightColor = (
  schema: Schema,
  view: EditorView,
  backgroundColor: string,
) => {
  const { state, dispatch } = view;
  const command = applyTextStyle(schema, { backgroundColor });
  command(state, dispatch, view);
};

const getActiveMarkAttrs = (
  state: EditorState,
  markType: MarkType,
): Record<string, any> | null => {
  const { selection, storedMarks, doc } = state;
  const { empty, from, to, $from } = selection;

  if (empty) {
    const marks = storedMarks || $from.marks();
    const found = markType.isInSet(marks);
    return (found?.attrs as any) ?? null;
  }

  let attrs: Record<string, any> | null = null;

  doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    const found = markType.isInSet(node.marks);
    if (found) {
      attrs = (found.attrs as any) ?? null;
      return false;
    }
    return;
  });

  return attrs;
};

export const getActiveFontFamily = (state: EditorState) => {
  const ts = state.schema.marks.textStyle;
  const attrs = getActiveMarkAttrs(state, ts);

  return (attrs?.fontFamily as string) || "inherit";
};

const safeParsePx = (px: string | null | undefined) => {
  if (!px) return null;
  const n = parseFloat(px.replace("px", ""));
  return Number.isFinite(n) ? n : null;
};

const getComputedFontSizePx = (view: EditorView) => {
  const { state } = view;

  const anchorPos = state.selection.$anchor?.pos ?? state.selection.from;

  const domAt = view.domAtPos(anchorPos);
  const el =
    domAt.node.nodeType === Node.ELEMENT_NODE
      ? (domAt.node as HTMLElement)
      : (domAt.node.parentElement as HTMLElement | null);

  if (!el) return null;

  const computed = window.getComputedStyle(el);
  return safeParsePx(computed.fontSize);
};

export const getActiveFontSize = (view: EditorView) => {
  const { state } = view;
  const ts = state.schema.marks.textStyle;
  const attrs = getActiveMarkAttrs(state, ts);
  const n = attrs?.fontSize;

  if (typeof n === "number" && Number.isFinite(n)) return n;

  return getComputedFontSizePx(view) || 11;
};

export const getActiveFontColor = (state: EditorState) => {
  const ts = state.schema.marks.textStyle;
  const attrs = getActiveMarkAttrs(state, ts);
  return (attrs?.color as string) || "inherit";
};

export const getActiveFontHighlight = (state: EditorState) => {
  const ts = state.schema.marks.textStyle;
  const attrs = getActiveMarkAttrs(state, ts);
  return (attrs?.backgroundColor as string) || "inherit";
};

export const setTextAlign = (view: EditorView, align: string | null) => {
  const { state, dispatch } = view;

  const { $from, $to } = state.selection;
  const from = $from.before($from.depth);
  const to = $to.after($to.depth);

  if (!dispatch) return true;

  let tr = state.tr;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return;
    if (!node.type.spec.attrs?.textAlign) return;

    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      textAlign: align,
    });
  });

  dispatch(tr.scrollIntoView());
};

export const getActiveTextAlign = (state: EditorState) => {
  const block = getActiveBlockNode(state);
  const align = block?.attrs?.textAlign;

  if (
    align === "left" ||
    align === "center" ||
    align === "right" ||
    align === "justify"
  ) {
    return align;
  }
  return "left";
};

export const run = (view: EditorView, markType: MarkType) => {
  const command = toggleMark(markType);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

export const indent = (schema: Schema, view: EditorView) => {
  const command = liftListItem(schema.nodes.list_item);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

export const outdent = (schema: Schema, view: EditorView) => {
  const command = sinkListItem(schema.nodes.list_item);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

export const horizontalRule = (schema: Schema, view: EditorView) => {
  const { state, dispatch } = view;
  if (dispatch)
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.horizontal_rule.create())
        .scrollIntoView(),
    );
  return true;
};

export const blockquote = (schema: Schema, view: EditorView) => {
  const command = wrapIn(schema.nodes.blockquote);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

const getActiveBlockNode = (state: EditorState) => {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isTextblock) return node;
  }

  return $from.parent;
};

export const getActiveHeading = (state: EditorState) => {
  const schema = state.schema;
  const heading = schema.nodes.heading;

  const block = getActiveBlockNode(state);

  if (heading && block.type === heading) {
    const lvl = Number(block.attrs.level);
    if (lvl >= 1 && lvl <= 6) return `heading-${lvl}`;
    return `heading-1`;
  }

  return "paragraph";
};

export const setHeading = (schema: Schema, level: number): Command => {
  const h = schema.nodes.heading;
  return h ? setBlockType(h, { level }) : () => false;
};
export const setParagraph = (schema: Schema): Command => {
  const p = schema.nodes.paragraph;
  return p ? setBlockType(p) : () => false;
};

export const setHeadingOrParagraph = (
  schema: Schema,
  view: EditorView,
  value: string,
) => {
  if (value === "paragraph" || value === "normal") {
    const command = setParagraph(schema);
    const { state, dispatch } = view;
    command(state, dispatch, view);
    return;
  }
  const m = value.match(/^heading-(\d)$/);
  if (m) {
    const level = parseInt(m[1], 10);
    const command = setHeading(schema, level);
    const { state, dispatch } = view;
    command(state, dispatch, view);
  }
};

export const wrapBulletList = (schema: Schema, view: EditorView) => {
  const command = wrapIn(schema.nodes.bullet_list);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

export const wrapOrderedList = (schema: Schema, view: EditorView) => {
  const command = wrapIn(schema.nodes.ordered_list);
  const { state, dispatch } = view;
  command(state, dispatch, view);
};

export const mathFormula = (schema: Schema, view: EditorView) => {
  const { state, dispatch } = view;
  if (dispatch)
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.math.create({ latex: "" }))
        .scrollIntoView(),
    );
  return true;
};

export const renderMathPreview = (el: HTMLElement) => {
  const formulas = el.querySelectorAll("span[data-latex]");
  formulas.forEach((formula) => {
    formula.innerHTML = "";
    const latex = formula.getAttribute("data-latex") || "";

    try {
      formula.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      formula.innerHTML = latex;
    }
  });
};

export function insertVariableToken(
  from: number,
  to: number,
  schema: Schema,
  view: EditorView,
  resolverObject: { path?: string; defaultValue?: string },
) {
  const { state, dispatch } = view;
  const { tr } = state;

  const resolverString = JSON.stringify(resolverObject);
  const variableNode = schema.nodes.variable.create({
    resolver: resolverString,
    text: resolverObject.path || "",
  });

  dispatch(tr.replaceWith(from, to, variableNode).scrollIntoView());
  view.focus();
}
