import { Plugin, PluginKey } from "prosemirror-state";

export const variableSlashPlugin = (
  onTriggerInlineMenu: (
    from: number,
    to: number,
    coords: { top: number; left: number },
  ) => void,
) => {
  return new Plugin({
    key: new PluginKey("slash"),
    props: {
      handleTextInput(view, from, to, text) {
        if (text === "/") {
          const currentSelection = view.state.selection;
          const coords = view.coordsAtPos(currentSelection.from);
          const viewportOffsetTop = coords.bottom + window.scrollY + 5;
          const viewportOffsetLeft = coords.left + window.scrollX;
          onTriggerInlineMenu(from, to + 1, {
            top: viewportOffsetTop,
            left: viewportOffsetLeft,
          });
          return false;
        }
        return false;
      },
    },
  });
};
