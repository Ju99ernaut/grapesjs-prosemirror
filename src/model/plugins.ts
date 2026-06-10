import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import { buildInputRules } from "./input-rules";
import { buildKeymap } from "./keymaps";
import type { SlashPluginConfig } from "../types";
import { variableSlashPlugin } from "./variable-slash";

export const defaultPmPlugins = (
  schema: Schema,
  slashPluginConfig?: SlashPluginConfig,
): Plugin[] => {
  const plugins = [
    buildInputRules(schema),
    history(),
    keymap(buildKeymap(schema)),
    keymap(baseKeymap),
  ];

  if (slashPluginConfig?.onSlashTrigger) {
    plugins.push(variableSlashPlugin(slashPluginConfig.onSlashTrigger));
  }

  return plugins;
};
