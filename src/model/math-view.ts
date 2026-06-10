import { Node as PMNode } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";

export class MathInlineView implements NodeView {
  dom: HTMLElement;
  private view: EditorView;
  private getPos: () => number | undefined;
  private node: PMNode;

  private input: HTMLTextAreaElement | null = null;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement("span");
    this.dom.setAttribute("data-math-inline", "true");
    this.dom.style.display = "block";
    this.dom.style.verticalAlign = "middle";

    this.renderEditor();

    this.dom.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  }

  selectNode() {
    this.renderEditor();
  }

  stopEvent(event: Event) {
    if (
      this.input &&
      (event.target === this.input || this.input.contains(event.target as Node))
    ) {
      return true;
    }
    return false;
  }

  ignoreMutation() {
    return true;
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (this.input && this.input.value !== (node.attrs.latex || "")) {
      this.input.value = node.attrs.latex || "";
    }
    return true;
  }

  private renderEditor() {
    this.dom.innerHTML = "";

    const input = document.createElement("textarea");
    input.value = (this.node.attrs.latex || "") as string;
    input.placeholder = "LaTeX…";
    input.classList.add("pm-math");

    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Escape") {
        input.blur();
        e.preventDefault();
      }
    });

    input.addEventListener("input", () => {
      const latex = input.value;

      const pos = this.getPos();
      const tr = this.view.state.tr.setNodeMarkup(pos || 0, undefined, {
        ...this.node.attrs,
        latex,
      });

      this.view.dispatch(tr);
    });

    this.dom.appendChild(input);
    this.input = input;

    queueMicrotask(() => {
      input.focus();
      input.select();
    });
  }
}
