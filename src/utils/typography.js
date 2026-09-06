(() => {
  const TYPOGRAPHY_PROPERTIES = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
    "color",
    "textAlign",
    "textTransform",
    "textDecorationLine",
    "backgroundColor"
  ];

  const DISPLAY_LABELS = {
    fontFamily: "Font Family",
    fontSize: "Font Size",
    fontWeight: "Font Weight",
    fontStyle: "Font Style",
    lineHeight: "Line Height",
    letterSpacing: "Letter Spacing",
    color: "Text Color",
    textAlign: "Text Align",
    textTransform: "Text Transform",
    textDecorationLine: "Text Decoration",
    backgroundColor: "Background"
  };

  const CSS_PROPERTY_NAMES = {
    fontFamily: "font-family",
    fontSize: "font-size",
    fontWeight: "font-weight",
    fontStyle: "font-style",
    lineHeight: "line-height",
    letterSpacing: "letter-spacing",
    color: "color",
    textAlign: "text-align",
    textTransform: "text-transform",
    textDecorationLine: "text-decoration",
    backgroundColor: "background-color"
  };

  function getSelectedTextNodes(range) {
    const root = range.commonAncestorContainer;
    const ownerDocument = root.nodeType === Node.DOCUMENT_NODE ? root : root.ownerDocument;
    const walkerRoot = root.nodeType === Node.TEXT_NODE ? root.parentNode : root;
    const textNodes = [];

    if (!walkerRoot) {
      return textNodes;
    }

    if (root.nodeType === Node.TEXT_NODE && rangeIntersectsTextNode(range, root)) {
      textNodes.push(root);
      return textNodes;
    }

    const walker = ownerDocument.createTreeWalker(
      walkerRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          return rangeIntersectsTextNode(range, node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    return textNodes;
  }

  function rangeIntersectsTextNode(range, textNode) {
    try {
      return range.intersectsNode(textNode);
    } catch (error) {
      return false;
    }
  }

  function getElementForTextNode(textNode) {
    let element = textNode.parentElement;

    while (element && element.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(element);
      if (style.display !== "contents") {
        return element;
      }
      element = element.parentElement;
    }

    return textNode.parentElement;
  }

  function getComputedTypography(element) {
    const style = window.getComputedStyle(element);
    const values = {};

    TYPOGRAPHY_PROPERTIES.forEach((property) => {
      values[property] = normalizeCssValue(property, style[property]);
    });

    return values;
  }

  function normalizeCssValue(property, value) {
    if (!value) {
      return "normal";
    }

    if (property === "color" || property === "backgroundColor") {
      return normalizeColor(value);
    }

    if (property === "fontFamily") {
      return value
        .split(",")
        .map((family) => family.trim().replace(/^["']|["']$/g, ""))
        .join(", ");
    }

    if (property === "textDecorationLine" && value === "none") {
      return "None";
    }

    if (["fontStyle", "textAlign", "textTransform"].includes(property)) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    return value;
  }

  function normalizeColor(value) {
    const compactValue = value.replace(/\s+/g, "");
    const rgbaMatch = compactValue.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/i);

    if (!rgbaMatch) {
      return value;
    }

    const alpha = rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]);

    if (alpha === 0) {
      return "transparent";
    }

    const hex = [rgbaMatch[1], rgbaMatch[2], rgbaMatch[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    if (alpha < 1) {
      return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
    }

    return `#${hex}`;
  }

  function signatureForTypography(typography) {
    return TYPOGRAPHY_PROPERTIES.map((property) => `${property}:${typography[property]}`).join("|");
  }

  function getNodeSelectedText(range, textNode) {
    const nodeText = textNode.nodeValue || "";
    const start = getTextNodeSelectionOffset(range, textNode, "start");
    const end = getTextNodeSelectionOffset(range, textNode, "end");
    return nodeText.slice(start, end).replace(/\s+/g, " ").trim();
  }

  function getTextNodeSelectionOffset(range, textNode, boundary) {
    if (boundary === "start" && textNode === range.startContainer) {
      return range.startOffset;
    }

    if (boundary === "end" && textNode === range.endContainer) {
      return range.endOffset;
    }

    return boundary === "start" ? 0 : (textNode.nodeValue || "").length;
  }

  function inspectSelection() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return {
        ok: false,
        reason: "Select text on the page, then choose Font Inspector."
      };
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    const textNodes = getSelectedTextNodes(range);
    const groupsBySignature = new Map();

    textNodes.forEach((textNode) => {
      const element = getElementForTextNode(textNode);
      const selectedNodeText = getNodeSelectedText(range, textNode);

      if (!element || !selectedNodeText) {
        return;
      }

      const typography = getComputedTypography(element);
      const signature = signatureForTypography(typography);

      if (!groupsBySignature.has(signature)) {
        groupsBySignature.set(signature, {
          typography,
          elementName: element.tagName.toLowerCase(),
          sampleText: selectedNodeText
        });
        return;
      }

      const group = groupsBySignature.get(signature);
      group.sampleText = `${group.sampleText} ${selectedNodeText}`.trim();
    });

    if (groupsBySignature.size === 0) {
      const fallbackElement = getFallbackElement(range);

      if (fallbackElement) {
        const typography = getComputedTypography(fallbackElement);
        groupsBySignature.set(signatureForTypography(typography), {
          typography,
          elementName: fallbackElement.tagName.toLowerCase(),
          sampleText: selectedText
        });
      }
    }

    const styles = [...groupsBySignature.values()].map((group) => ({
      ...group,
      sampleText: group.sampleText.slice(0, 120)
    }));

    if (styles.length === 0) {
      return {
        ok: false,
        reason: "Font Inspector could not find an inspectable text element in this selection."
      };
    }

    return {
      ok: true,
      selectedText,
      multipleStyles: styles.length > 1,
      styles
    };
  }

  function getFallbackElement(range) {
    const container = range.commonAncestorContainer;

    if (container.nodeType === Node.ELEMENT_NODE) {
      return container;
    }

    return container.parentElement || null;
  }

  function typographyToCss(typography) {
    return [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "color",
      "textAlign",
      "textTransform",
      "textDecorationLine",
      "backgroundColor"
    ]
      .map((property) => `${CSS_PROPERTY_NAMES[property]}: ${typography[property]};`)
      .join("\n");
  }

  window.FontInspectorTypography = {
    DISPLAY_LABELS,
    TYPOGRAPHY_PROPERTIES,
    inspectSelection,
    typographyToCss
  };
})();
