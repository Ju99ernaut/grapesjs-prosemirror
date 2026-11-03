import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
  InputRule,
} from "prosemirror-inputrules";
import type { Attrs, MarkType, NodeType, Schema } from "prosemirror-model";

function markInputRule(
  regexp: RegExp,
  markType: MarkType,
  getAttrs?: Attrs | null | ((match: RegExpMatchArray) => Attrs | null),
) {
  return new InputRule(regexp, (state, match, startPos, end) => {
    const fullMatch = match[1] || match[3];
    const text = match[2] || match[4];
    if (!fullMatch || !text) return null;

    const attrs =
      typeof getAttrs === "function" ? getAttrs(match) : (getAttrs ?? null);
    const offset = match[0].indexOf(fullMatch);
    const start = startPos + offset;

    const $start = state.doc.resolve(start);
    const marks = $start.marks().filter((m) => m.type !== markType);
    marks.push(markType.create(attrs));

    return state.tr
      .replaceWith(start, end, state.schema.text(text, marks))
      .removeStoredMark(markType);
  });
}

/// Given a strong mark type, returns an input rule that turns `**text**`
/// into bold text.
export function boldRule(markType: MarkType) {
  return markInputRule(/(?:^|[^*])(\*\*([^*]+)\*\*)$/, markType);
}

/// Given an emphasis mark type, returns an input rule that turns `*text*`
/// or `_text_` into italic text.
export function italicRule(markType: MarkType) {
  return markInputRule(
    /(?:^|[^*])(\*([^*]+)\*)$|(?:^|[^_])(_([^_]+)_)$/,
    markType,
  );
}

/// Given an underline mark type, returns an input rule that turns `__text__`
/// into underlined text.
export function underlineRule(markType: MarkType) {
  return markInputRule(/(?:^|[^_])(__([^_]+)__)$/, markType);
}

/// Given a strike mark type, returns an input rule that turns `~~text~~`
/// into strikethrough text.
export function strikeRule(markType: MarkType) {
  return markInputRule(/(?:^|[^~])(~~([^~]+)~~)$/, markType);
}

/// Given a link mark type, returns an input rule that turns `[text](url)`
/// into a hyperlink.
export function linkRule(markType: MarkType) {
  return new InputRule(
    /(\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']+)["'])?\))$/,
    (state, match, startPos, end) => {
      const fullMatch = match[1];
      const text = match[2];
      const href = match[3];
      const title = match[4] || null;
      if (!fullMatch || !text || !href) return null;

      const offset = match[0].indexOf(fullMatch);
      const start = startPos + offset;

      const $start = state.doc.resolve(start);
      const marks = $start.marks().filter((m) => m.type !== markType);
      marks.push(markType.create({ href, title }));

      return state.tr
        .replaceWith(start, end, state.schema.text(text, marks))
        .removeStoredMark(markType);
    },
  );
}

/// Given a horizontal rule node type, returns an input rule that turns
/// `"---"`, `"___"`, or `"***"` at the start of a textblock into a
/// horizontal rule.
export function hrRule(nodeType: NodeType) {
  return new InputRule(
    /^(?:---|—-|___|\*\*\*)$/,
    (state, _match, start, end) => {
      return state.tr
        .delete(start, end)
        .replaceSelectionWith(nodeType.create());
    },
  );
}

/// Given a blockquote node type, returns an input rule that turns `"> "`
/// at the start of a textblock into a blockquote.
export function blockQuoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType);
}

/// Given a list node type, returns an input rule that turns a number
/// followed by a dot at the start of a textblock into an ordered list.
export function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    (match) => ({ order: +match[1]! }),
    (match, node) => node.childCount + node.attrs.order == +match[1]!,
  );
}

/// Given a list node type, returns an input rule that turns a bullet
/// (dash, plush, or asterisk) at the start of a textblock into a
/// bullet list.
export function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType);
}

/// Given a code block node type, returns an input rule that turns a
/// textblock starting with three backticks into a code block.
export function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType);
}

/// Given a node type and a maximum level, creates an input rule that
/// turns up to that number of `#` characters followed by a space at
/// the start of a textblock into a heading whose level corresponds to
/// the number of `#` signs.
export function headingRule(nodeType: NodeType, maxLevel: number) {
  return textblockTypeInputRule(
    new RegExp("^(#{1," + maxLevel + "})\\s$"),
    nodeType,
    (match) => ({ level: match[1]!.length }),
  );
}

/// A set of input rules for creating the basic block quotes, lists,
/// code blocks, heading, horizontal rules, markdown inline marks,
/// and dynamic page numbers (@current, @total).
export function buildInputRules(schema: Schema) {
  let rules = smartQuotes.concat(ellipsis),
    type,
    mark;
  if ((type = schema.nodes.horizontal_rule)) rules.push(hrRule(type));
  rules.push(emDash);
  if ((type = schema.nodes.blockquote)) rules.push(blockQuoteRule(type));
  if ((type = schema.nodes.ordered_list)) rules.push(orderedListRule(type));
  if ((type = schema.nodes.bullet_list)) rules.push(bulletListRule(type));
  if ((type = schema.nodes.code_block)) rules.push(codeBlockRule(type));
  if ((type = schema.nodes.heading)) rules.push(headingRule(type, 6));
  if ((mark = schema.marks.strong)) rules.push(boldRule(mark));
  if ((mark = schema.marks.em)) rules.push(italicRule(mark));
  if ((mark = schema.marks.underline)) rules.push(underlineRule(mark));
  if ((mark = schema.marks.strike)) rules.push(strikeRule(mark));
  if ((mark = schema.marks.link)) rules.push(linkRule(mark));
  return inputRules({ rules });
}
