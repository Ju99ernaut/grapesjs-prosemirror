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
