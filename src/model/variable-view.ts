import { Node } from "prosemirror-model";
import { NodeView } from "prosemirror-view";

export class VariableNodeView implements NodeView {
  dom: HTMLElement;

  constructor(node: Node) {
    this.dom = document.createElement("span");
    this.dom.setAttribute("data-gjs-type", "data-variable");
    this.dom.setAttribute("data-gjs-data-resolver", node.attrs.resolver);
    this.dom.setAttribute("data-resolver", node.attrs.resolver);
    this.dom.setAttribute("contenteditable", "false");

    try {
      const parsed = JSON.parse(node.attrs.resolver);
      this.dom.textContent = node.attrs.text || parsed.path || "Variable";
    } catch {
      this.dom.textContent = node.attrs.text || "Variable";
    }
  }

  update(node: Node) {
    if (node.type.name !== "variable") return false;
    this.dom.setAttribute("data-gjs-data-resolver", node.attrs.resolver);
    this.dom.setAttribute("data-resolver", node.attrs.resolver);
    return true;
  }

  stopEvent() {
    return true;
  }
}
