import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import { buildInputRules } from "./input-rules";
import { buildKeymap } from "./keymaps";

export const defaultPmPlugins = (schema: Schema): Plugin[] => {
  return [
    buildInputRules(schema),
    history(),
    keymap(buildKeymap(schema)),
    keymap(baseKeymap),
  ];
};
