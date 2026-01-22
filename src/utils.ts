import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";

export const markIsActive = (schema: Schema, state: any, markName: string) => {
  const markType = schema.marks[markName];
  if (!markType) return false;

  const { from, $from, to, empty } = state.selection;
  if (empty) return !!markType.isInSet(state.storedMarks || $from.marks());

  return state.doc.rangeHasMark(from, to, markType);
};

export const toggleLinkCommand = (schema: Schema): Command => {
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

    const tr = state.tr.addMark(from, to, link.create({ href: "" }));

    if (empty)
      tr.setStoredMarks([
        ...(state.storedMarks || state.selection.$from.marks()),
        link.create({ href: "" }),
      ]);

    dispatch(tr);
    return true;
  };
};

function applyTextStyle(
  schema: Schema,
  attrs: Partial<{
    fontFamily: string | null;
    fontSize: number | null;
    color: string | null;
    backgroundColor: string | null;
  }>,
): Command {
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
}

export const setFontFamily = (schema: Schema, fontFamily: string | null) =>
  applyTextStyle(schema, { fontFamily });

export const setFontSize = (schema: Schema, fontSizePx: number | null) =>
  applyTextStyle(schema, { fontSize: fontSizePx });

export const setTextColor = (schema: Schema, color: string | null) =>
  applyTextStyle(schema, { color });

export const setHighlightColor = (
  schema: Schema,
  backgroundColor: string | null,
) => applyTextStyle(schema, { backgroundColor });

export function setTextAlign(
  _schema: Schema,
  align: "left" | "center" | "right" | "justify" | null,
): Command {
  return (state, dispatch) => {
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
    return true;
  };
}
