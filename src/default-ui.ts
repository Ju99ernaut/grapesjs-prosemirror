import type { UIAdapter, UIContext, UIInstance } from "./types";
import { toggleMark } from "prosemirror-commands";
import { markIsActive, toggleLinkCommand } from "./utils";

export const createDefaultVanillaUI = (): UIAdapter => {
  return {
    mount(ctx: UIContext): UIInstance {
      const { toolbarEl, rte } = ctx;

      toolbarEl.innerHTML = "";

      const root = document.createElement("div");
      root.style.display = "flex";
      root.style.gap = "6px";
      root.style.alignItems = "center";
      toolbarEl.appendChild(root);

      const btn = (label: string, onClick: () => void) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.padding = "6px 8px";
        b.style.border = "none";
        b.style.borderRadius = "3px";
        b.style.background = "transparent";
        b.style.color = "white";
        b.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
          rte.focus();
        };
        root.appendChild(b);
        return b;
      };

      const styleBtn = (b: HTMLButtonElement, active: boolean) => {
        b.style.background = active
          ? "rgba(255, 255, 255, 0.2)"
          : "transparent";
      };

      const run = (command: any) => {
        const { state, dispatch } = rte.view;
        command(state, dispatch, rte.view);
      };

      const { schema } = rte.view.state;

      const btnBold = btn("B", () => run(toggleMark(schema.marks.strong)));
      const btnItalic = btn("/", () => run(toggleMark(schema.marks.em)));
      const btnUnderline = btn("U", () =>
        run(toggleMark(schema.marks.underline)),
      );
      const btnStrike = btn("S", () => run(toggleMark(schema.marks.strike)));
      const btnLink = btn("</>", () => run(toggleLinkCommand(schema)));

      // You can add more commands here, or swap UI adapter entirely.

      return {
        update() {
          const { state } = rte.view;
          const schema = state.schema;

          styleBtn(
            btnBold,
            !!schema.marks.strong && markIsActive(schema, state, "strong"),
          );
          styleBtn(
            btnItalic,
            !!schema.marks.em && markIsActive(schema, state, "em"),
          );
          styleBtn(
            btnUnderline,
            !!schema.marks.underline &&
              markIsActive(schema, state, "underline"),
          );
          styleBtn(
            btnStrike,
            !!schema.marks.strike && markIsActive(schema, state, "strike"),
          );
          styleBtn(
            btnLink,
            !!schema.marks.link && markIsActive(schema, state, "link"),
          );
        },
        destroy() {
          root.remove();
        },
      };
    },
  };
};
