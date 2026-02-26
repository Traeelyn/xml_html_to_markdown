// courseconverter.js
import fs from "fs";
import path from "path";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { XMLParser } from "fast-xml-parser";

/*---------------------------------
Transformer Factory
----------------------------------*/
/**
 * Creates a transformer function that recursively processes nodes using provided handlers
 * @param {Object} handlers - Object mapping node types to handler functions
 * @param {Function} handlers._ - Default handler for unrecognized node types
 * @return {Function} Transform function that processes nodes recursively with (node, depth) parameters
 */
const makeTransformer = (handlers) =>
  function transform(node, depth = 0) {
    if (!node) return "";
    const fn = handlers[node.type] ?? handlers._;
    return fn(node, transform, depth);
  };

/*---------------------------------
Reusable Handlers <-- for testing purposes because i dont want to touch the offical code 
----------------------------------*/

/**
 * Handler configuration for strong/bold text elements
 * @type {Object}
 * @property {Function} postprocess - Wraps content with markdown bold syntax
 */
const strong = { postprocess: ({ content }) => `**${content.trim()}**` };

/**
 * Handler configuration for emphasis/italic text elements
 * @type {Object}
 * @property {Function} postprocess - Wraps content with markdown italic syntax
 */
const em = { postprocess: ({ content }) => `*${content.trim()}*` };

/**
 * Handler configuration for list item elements
 * @type {Object}
 * @property {Function} postprocess - Formats content as markdown list item
 */
const li = { postprocess: ({ content }) => `- ${content.trim()}\n` };

/**
 * Handler configuration for unordered list elements
 * @type {Object}
 * @property {Function} postprocess - Formats content as markdown unordered list
 */
const ul = { postprocess: ({ content }) => `${content.trim()}\n\n` };

/**
 * Handler configuration for ordered list elements
 * @type {Object}
 * @property {Function} postprocess - Converts list items to numbered format
 */
const ol = {
  postprocess: ({ content }) => {
    const lines = content.trim().split("\n");
    let counter = 1;
    const numberedLines = lines.map((line) => {
      if (line.trim().startsWith("-")) {
        const result = line.replace("-", `${counter}.`);
        counter++;
        return result;
      }
      return line;
    });
    return `${numberedLines.join("\n")}\n\n`;
  },
};

/*---------------------------------
HTML Handlers for NodeHtmlMarkdown
----------------------------------*/

/**
 * HTML handlers configuration for NodeHtmlMarkdown
 * Defines how HTML elements are converted to markdown
 * @type {Object}
 */
const htmlHandlers = {
  h1: { postprocess: ({ content }) => `**${content.trim()}\n\n` },
  h2: { postprocess: ({ content }) => `**${content.trim()}**\n\n` },
  h3: { postprocess: ({ content }) => `**${content.trim()}**\n\n` },
  p: { postprocess: ({ content }) => `${content.trim()}\n\n` },
  label: { postprocess: ({ content }) => `${content.trim()}\n\n` },
  description: { postprocess: ({ content }) => ` ${content.trim()}\n\n` },
  ul,
  ol,
  strong,
  em,
  li,
  img: {
    /**
     * Processes image elements and converts to markdown image syntax
     * @param {Object} params - Handler parameters
     * @param {HTMLElement} params.node - The image DOM node
     * @return {string} Markdown image syntax
     */
    postprocess: ({ node }) => {
      const src = node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "Image";

      if (!src) return "";

      // Handle absolute paths (remove leading slash)
      let cleanSrc = src.startsWith("/") ? src.substring(1) : src;

      // Extract just the filename for the images folder reference
      const imageName = path.basename(cleanSrc);

      return `![${alt}](../images/${imageName})\n\n`;
    },
  },
};

/**
 * NodeHtmlMarkdown instance configured with custom handlers
 * @type {NodeHtmlMarkdown}
 */
export const nhm = new NodeHtmlMarkdown({}, htmlHandlers);

/*---------------------------------
XML Parser Configuration
----------------------------------*/

/**
 * XML parser instance with configuration for processing course XML files
 * @type {XMLParser}
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
});

/*---------------------------------
XML Handlers (clean + consistent)
----------------------------------*/

/**
 * XML handlers for converting course content elements to markdown
 * Each handler processes a specific XML element type
 * @type {Object}
 */
export const xmlhandlers = {
  /**
   * Handler for XML problem root elements
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content
   */
  problem: (node, transform, depth) => {
    let content = "";

    Object.keys(node).forEach((key) => {
      if (
        key !== "#text" &&
        key !== "display_name" &&
        key !== "markdown" &&
        typeof node[key] === "object"
      ) {
        const childNode = { ...node[key], type: key, tagName: key };
        content += transform(childNode, depth);
      }
    });

    return content;
  },

  /**
   * Handler for multiple choice response XML nodes
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content
   */
  multiplechoiceresponse: (node, transform, depth) => {
    let content = "";

    Object.keys(node).forEach((key) => {
      if (
        key !== "#text" &&
        key !== "type" &&
        key !== "display_name" &&
        key !== "markdown"
      ) {
        const value = node[key];

        // Skip template paragraphs
        if (key === "p") {
          const text = value["#text"]?.trim() || "";
          if (text.includes("You can use this template") || text === "") return;
        }

        // Skip template paragraphs
        if (key === "p") {
          const text = value["#text"]?.trim() || "";
          if (text.includes("You can use this template") || text === "") return;
        }

        // Skip any text nodes that are just the tag name itself
        if (
          typeof value === "string" &&
          value.trim() === "multiplechoiceresponse"
        )
          return;

        if (Array.isArray(value)) {
          value.forEach((child) => {
            const childNode =
              typeof child === "object"
                ? { ...child, type: key, tagName: key }
                : { type: "_", "#text": child };
            content += transform(childNode, depth);
          });
        } else if (typeof value === "object" && value !== null) {
          const childNode = { ...value, type: key, tagName: key };
          content += transform(childNode, depth);
        } else if (typeof value === "string") {
          content += value;
        }
      }
    });

    return content;
  },

  /**
   * Handler for choice response XML nodes
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content
   */
  choiceresponse: (node, transform, depth) => {
    let content = "";

    Object.keys(node).forEach((key) => {
      if (
        key !== "#text" &&
        key !== "type" &&
        key !== "display_name" &&
        key !== "markdown"
      ) {
        const value = node[key];

        // Skip template paragraphs
        if (key === "p") {
          const text = value["#text"]?.trim() || "";
          if (text.includes("You can use this template") || text === "") return;
        }

        // Skip any text nodes that are just the tag name itself
        if (typeof value === "string" && value.trim() === "choiceresponse")
          return;

        if (Array.isArray(value)) {
          value.forEach((child) => {
            const childNode =
              typeof child === "object"
                ? { ...child, type: key, tagName: key }
                : { type: "_", "#text": child };
            content += transform(childNode, depth);
          });
        } else if (typeof value === "object" && value !== null) {
          const childNode = { ...value, type: key, tagName: key };
          content += transform(childNode, depth);
        } else if (typeof value === "string") {
          content += value;
        }
      }
    });

    return content;
  },

  /**
   * Handler for string response XML nodes - processes text input questions
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with answer placeholder in [[]] format
   */
  stringresponse: (node, transform, depth) => {
    let content = "";

    // Process all child keys except metadata
    Object.keys(node).forEach((key) => {
      if (
        key !== "#text" &&
        key !== "answer" &&
        key !== "type" &&
        key !== "additional_answer"
      ) {
        const value = node[key];

        if (typeof value === "string" && value.trim() === "stringresponse")
          return;

        // Skip template paragraphs
        if (key === "p") {
          const text = value["#text"]?.trim() || "";
          if (text.includes("You can use this template") || text === "") return;
        }

        if (Array.isArray(value)) {
          value.forEach((child) => {
            const childNode =
              typeof child === "object"
                ? { ...child, type: key, tagName: key }
                : { type: "_", "#text": child };
            content += transform(childNode, depth);
          });
        } else if (typeof value === "object" && value !== null) {
          const childNode = { ...value, type: key, tagName: key };
          content += transform(childNode, depth);
        } else if (typeof value === "string") {
          content += value;
        }
      }
    });

    // Collect only the main answer
    const mainAnswer = node.answer || "";

    return `${content.trim()}\n\n[[${mainAnswer}]]\n`;
  },

  /**
   * Handler for numerical response XML nodes - processes numeric input questions
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with numeric answer in [[]] format
   */
  numericalresponse: (node, transform, depth) => {
    let content = "";

    // Recursively process all child keys except #text and answer
    Object.keys(node).forEach((key) => {
      if (key !== "#text" && key !== "answer") {
        const value = node[key];

        if (typeof value === "string" && value.trim() === "numericalresponse")
          return;

        // Skip template paragraphs
        if (key === "p") {
          const text = value["#text"]?.trim() || "";
          if (text.includes("You can use this template") || text === "") return;
        }

        if (Array.isArray(value)) {
          value.forEach((child) => {
            const childNode =
              typeof child === "object"
                ? { ...child, type: key, tagName: key }
                : { type: "_", "#text": child };
            content += transform(childNode, depth);
          });
        } else if (typeof value === "object" && value !== null) {
          const childNode = { ...value, type: key, tagName: key };
          content += transform(childNode, depth);
        } else if (typeof value === "string") {
          content += value;
        }
      }
    });

    const answer = node.answer || "";

    return `${content.trim()}\n\n[[${answer}]]\n`;
  },

  /**
   * Handler for response parameter XML nodes - typically ignored
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Empty string (parameters are not displayed)
   */
  responseparam: (node, transform, depth) => "",

  /**
   * Handler for choice group XML nodes - processes multiple choice options
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with choice options using [(x)] for correct answers
   */
  choicegroup: (node, transform, depth) => {
    let content = "\n\n";
    const choices = node.choice
      ? Array.isArray(node.choice)
        ? node.choice
        : [node.choice]
      : [];

    choices.forEach((choice) => {
      let correct = false;
      if (choice.correct !== undefined) {
        if (typeof choice.correct === "boolean") {
          correct = choice.correct;
        } else if (typeof choice.correct === "string") {
          correct = choice.correct.toLowerCase() === "true";
        } else {
          correct = Boolean(choice.correct);
        }
      }

      const text = choice["#text"]?.trim() || "";
      const box = correct ? "[(x)]" : "[( )]";
      content += `- ${box} ${text}\n`;
    });

    return content;
  },

  /**
   * Handler for individual choice XML nodes - handled by choicegroup
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown choice option
   */
  choice: (node, transform, depth) => {
    // This is handled by choicegroup, but included for completeness
    let correct = false;
    if (node.correct !== undefined) {
      if (typeof node.correct === "boolean") {
        correct = node.correct;
      } else if (typeof node.correct === "string") {
        correct = node.correct.toLowerCase() === "true";
      } else {
        correct = Boolean(node.correct);
      }
    }

    const text = node["#text"]?.trim() || "";
    const box = correct ? "[(x)]" : "[( )]";
    return `- ${box} ${text}\n`;
  },

  /**
   * Handler for checkbox group XML nodes - processes multiple selection options
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with checkbox options using [[x]] for correct answers
   */
  checkboxgroup: (node, transform, depth) => {
    let content = "\n\n";
    const choices = node.choice
      ? Array.isArray(node.choice)
        ? node.choice
        : [node.choice]
      : [];

    choices.forEach((choice) => {
      let correct = false;
      if (choice.correct !== undefined) {
        if (typeof choice.correct === "boolean") {
          correct = choice.correct;
        } else if (typeof choice.correct === "string") {
          correct = choice.correct.toLowerCase() === "true";
        } else {
          correct = Boolean(choice.correct);
        }
      }

      const text = choice["#text"]?.trim() || "";
      const box = correct ? "[[x]]" : "[[ ]]";
      content += `- ${box} ${text}\n`;
    });

    return content; // no extra newline
  },

  /**
   * Handler for demand hint XML nodes - processes hint elements
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with hints using [[?]] format
   */
  demandhint: (node, transform, depth) => {
    const hints = node.hint
      ? Array.isArray(node.hint)
        ? node.hint
        : [node.hint]
      : [];

    if (hints.length === 0) return "";

    return hints
      .map((h, i) => {
        const hintText = transform(
          { ...h, type: "_", tagName: "hint" },
          depth
        ).trim();
        return i === 0 ? `- [[?]] ${hintText}` : `- [[?]] ${hintText}`;
      })
      .join("\n");
  },

  /**
   * Handler for choice hint XML nodes - typically ignored
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Empty string (choice hints are not displayed)
   */
  choicehint: (node, transform, depth) => "",

  /**
   * Handler for option response XML nodes - processes dropdown/select questions
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content
   */
  optionresponse: (node, transform, depth) => {
    let content = "";

    // Recursively process all child keys except #text
    Object.keys(node).forEach((key) => {
      if (key !== "#text") {
        const value = node[key];

        if (typeof value === "string" && value.trim() === "optionresponse")
          return;

        // Skip template paragraphs
        if (key === "p") {
          const text = value["#text"]?.trim() || "";
          if (text.includes("You can use this template") || text === "") return;
        }

        if (Array.isArray(value)) {
          value.forEach((child) => {
            const childNode =
              typeof child === "object"
                ? { ...child, type: key, tagName: key }
                : { type: "_", "#text": child };
            content += transform(childNode, depth);
          });
        } else if (typeof value === "object" && value !== null) {
          const childNode = { ...value, type: key, tagName: key };
          content += transform(childNode, depth);
        } else if (typeof value === "string") {
          content += value;
        }
      }
    });

    return content;
  },

  /**
   * Handler for option input XML nodes - processes dropdown/select input fields
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with dropdown options, correct answer in parentheses
   */
  optioninput: (node, transform, depth) => {
    const options = node.option
      ? Array.isArray(node.option)
        ? node.option
        : [node.option]
      : [];

    if (options.length === 0) return "";

    let md = "\n\n[["; // start on a new line
    md += options
      .map((opt) => {
        const text = opt["#text"]?.trim() || "";
        let correct = false;
        if (opt.correct !== undefined) {
          if (typeof opt.correct === "boolean") correct = opt.correct;
          else if (typeof opt.correct === "string")
            correct = opt.correct.toLowerCase() === "true";
          else correct = Boolean(opt.correct);
        }
        return correct ? `(${text})` : text;
      })
      .join("\n| ");
    md += "\n]]\n\n";

    return md;
  },

  /**
   * Handler for individual option XML nodes - handled by optioninput
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Empty string (options are handled by parent)
   */
  option: (node, transform, depth) => {
    // This is handled by optioninput, but included for completeness
    return "";
  },

  /**
   * Handler for textline XML nodes - unsupported component
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Empty string (textline components are omitted)
   */
  textline: (node, transform, depth) => "",

  /**
   * Handler for additional answer XML nodes - unsupported component
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Empty string (additional answer components are omitted)
   */
  additional_answer: (node, transform, depth) => "",

  /**
   * Handler for compound hint XML nodes - unsupported component
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Empty string (compound hint components are omitted)
   */
  compoundhint: (node, transform, depth) => "",

  /**
   * Default handler for unrecognized XML node types
   * @param {Object} node - The XML node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Processed content or unsupported content message
   */
  _: (node, transform, depth) => {
    if (typeof node === "string") return node;
    if (node && node["#text"]) return node["#text"];

    // Process any child elements
    let content = "";
    if (typeof node === "object" && node !== null) {
      Object.keys(node).forEach((childKey) => {
        if (
          childKey === "#text" ||
          childKey === "tagName" ||
          childKey === "type"
        )
          return;

        const value = node[childKey];

        if (Array.isArray(value)) {
          value.forEach((child) => {
            const childNode =
              typeof child === "object"
                ? { ...child, type: childKey, tagName: childKey }
                : { type: "_", "#text": child };
            content += transform(childNode, depth);
          });
        } else if (typeof value === "object" && value !== null) {
          const childNode = { ...value, type: childKey, tagName: childKey };
          content += transform(childNode, depth);
        } else if (typeof value === "string") {
          content += value;
        }
      });
    }

    const tagName = node?.tagName || node?.type || "unknown";

    // If we have content from child processing, return it
    if (content?.trim()) {
      return content;
    }

    // Otherwise, indicate unsupported content
    return `> **Unsupported content: ${tagName} component omitted**\n\n`;
  },
};

/*---------------------------------
XML to Markdown Transformer - FIXED
----------------------------------*/

/**
 * XML to Markdown transformer function using the xmlhandlers
 * @type {Function}
 */
export const xmlToMarkdown = makeTransformer(xmlhandlers);

/*---------------------------------
Read XML File
----------------------------------*/

/**
 * Reads and parses an XML file
 * @param {string} filePath - Path to the XML file to read
 * @return {Object|null} Parsed XML object or null if error occurs
 */
function readXmlFile(filePath) {
  try {
    const xmlContent = fs.readFileSync(filePath, "utf8");
    const parsed = xmlParser.parse(xmlContent);
    return parsed;
  } catch (error) {
    console.error(`Error reading XML file ${filePath}:`, error);
    return null;
  }
}

/*---------------------------------
Read File Content Helper
----------------------------------*/

/**
 * Reads file content and converts it to markdown based on file type
 * @param {string} filePath - Path to the file to read
 * @param {string} [type="auto"] - Type of file processing ("xml", "html", or "auto")
 * @return {string} Converted markdown content or error message
 */
function readFileContent(filePath, type = "auto") {
  try {
    if (!fs.existsSync(filePath)) {
      return `> **File not found: ${filePath}**\n\n`;
    }

    const ext = path.extname(filePath).toLowerCase();

    if (type === "xml" || ext === ".xml") {
      const xmlData = readXmlFile(filePath);
      if (xmlData) {
        // Create a root node with the parsed data and proper type
        const rootNode = {
          ...xmlData,
          type: Object.keys(xmlData)[0],
          tagName: Object.keys(xmlData)[0],
        };
        return xmlToMarkdown(rootNode);
      }
      return `> **Error parsing XML file: ${filePath}**\n\n`;
    }

    if (type === "html" || ext === ".html" || ext === ".htm") {
      const htmlContent = fs.readFileSync(filePath, "utf8");
      return nhm.translate(htmlContent);
    }

    // For other file types, read as plain text
    const content = fs.readFileSync(filePath, "utf8");
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return `> **Error reading file: ${filePath}**\n\n`;
  }
}

/*---------------------------------
Markdown Handlers for Course Tree
----------------------------------*/

/**
 * Markdown handlers for converting course tree structure to markdown
 * Each handler processes a specific course element type
 * @type {Object}
 */
const markdownHandlers = {
  /**
   * Handler for about course elements
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth for heading levels
   * @return {string} Transformed markdown with heading and child content
   */
  about: (node, transform, depth) => {
    const headingLevel = Math.min(depth + 1, 6);
    let md = `${"#".repeat(headingLevel)} ${node.display_name}\n\n`;

    if (node.children) {
      md += node.children.map((child) => transform(child, depth + 1)).join("");
    }

    return md;
  },

  /**
   * Handler for course root elements
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth for heading levels
   * @return {string} Transformed markdown with course heading and child content
   */
  course: (node, transform, depth) => {
    const headingLevel = Math.min(depth + 1, 6);
    let md = `${"#".repeat(headingLevel)} ${
      node.display_name || path.basename(node.file)
    }\n\n`;
    if (node.children)
      md += node.children.map((child) => transform(child, depth + 1)).join("");
    return md;
  },

  /**
   * Handler for chapter elements
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth for heading levels
   * @return {string} Transformed markdown with chapter heading and child content
   */
  chapter: (node, transform, depth) => {
    const headingLevel = Math.min(depth + 1, 6);
    let md = `${"#".repeat(headingLevel)} ${
      node.display_name || path.basename(node.file)
    }\n\n`;
    if (node.children)
      md += node.children.map((child) => transform(child, depth + 1)).join("");
    return md;
  },

  /**
   * Handler for sequential (lesson) elements
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth for heading levels
   * @return {string} Transformed markdown with sequential heading and child content
   */
  sequential: (node, transform, depth) => {
    const headingLevel = Math.min(depth + 1, 6);
    let md = `${"#".repeat(headingLevel)} ${
      node.display_name || path.basename(node.file)
    }\n\n`;
    if (node.verticals)
      md += node.verticals.map((v) => transform(v, depth + 1)).join("");
    if (node.problems)
      md += node.problems.map((p) => transform(p, depth + 1)).join("");
    if (node.children)
      md += node.children.map((child) => transform(child, depth + 1)).join("");
    return md;
  },

  /**
   * Handler for vertical (unit) elements - processes children without adding heading
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content from child elements
   */
  vertical: (node, transform, depth) =>
    node.children
      ? node.children.map((child) => transform(child, depth)).join("")
      : "",

  /**
   * Handler for problem elements - reads problem file content
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown with problem content and separator
   */
  problem: (node, transform, depth) => {
    let md = "";
    if (node.file && fs.existsSync(node.file)) {
      const ext = path.extname(node.file).toLowerCase();
      const type = ext === ".xml" ? "xml" : "problem";
      md += readFileContent(node.file, type) + "\n";
    }
    if (node.children)
      md += node.children.map((child) => transform(child, depth)).join("");
    md += `\n\n---\n\n`;

    return md;
  },

  /**
   * Handler for HTML elements - processes children without adding content
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content from child elements
   */
  html: (node, transform, depth) =>
    node.children
      ? node.children.map((child) => transform(child, depth)).join("")
      : "",

  /**
   * Handler for HTML content elements - reads and converts HTML file content
   * @param {Object} node - The course tree node to process
   * @return {string} Converted HTML content as markdown
   */
  htmlContent: (node) => {
    if (node.file && fs.existsSync(node.file)) {
      return readFileContent(node.file, "html") + "\n\n";
    }
    return "";
  },

  /**
   * Handler for image elements - converts to markdown image syntax
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Markdown image syntax or empty string if file doesn't exist
   */
  image: (node, transform, depth) => {
    if (!node.file || !fs.existsSync(node.file)) return "";
    const altText =
      node.display_name || path.basename(node.file, path.extname(node.file));
    const imageName = path.basename(node.file);
    return `![${altText}](../images/${imageName})\n\n`;
  },

  /**
   * Handler for video elements - converts to markdown video syntax
   * @param {Object} node - The course tree node to process
   * @return {string} Markdown video syntax for YouTube videos or empty string
   */
  video: (node) => {
    if (!node.videoData) return "";
    const video = node.videoData;
    const displayName = video.display_name || "Video";
    const youtubeId = video.youtube_id_1_0 || video.youtube;
    if (youtubeId)
      return `!?[${displayName}](https://www.youtube.com/watch?v=${youtubeId})\n\n`;
    return "";
  },

  /**
   * Default handler for unrecognized course tree node types
   * @param {Object} node - The course tree node to process
   * @param {Function} transform - Transform function for recursive processing
   * @param {number} depth - Current nesting depth
   * @return {string} Transformed markdown content from child elements
   */
  _: (node, transform, depth) =>
    node.children
      ? node.children.map((child) => transform(child, depth + 1)).join("")
      : "",
};

/*---------------------------------
Markdown Transformer
----------------------------------*/

/**
 * Course tree to Markdown transformer function using the markdownHandlers
 * @type {Function}
 */
const treeToMarkdown = makeTransformer(markdownHandlers);

/*---------------------------------
Exports
----------------------------------*/

export { treeToMarkdown, htmlHandlers, strong, em, li, ul, ol };
