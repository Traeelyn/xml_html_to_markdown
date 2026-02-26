import fs from "fs";
import path from "path";
import os from "os";

import { strong, em, li, ul, ol } from "./courseconverter";
import { xmlToMarkdown } from "./courseconverter.js";
import { XMLParser } from "fast-xml-parser";
import { htmlHandlers } from "./courseconverter.js";
import { treeToMarkdown } from "./courseconverter";

/*---------------------------------
 Converting HTML to Markdown with bold, italic and list formating
----------------------------------*/
describe("HTML to Markdown Handlers", () => {
  // === Bold ===
  test("converts bold text correctly", () => {
    const input = "This is bold";
    const output = strong.postprocess({ content: input });
    expect(output).toBe("**This is bold**");
  });

  // === Italic ===
  test("converts italic text correctly", () => {
    const input = "This is italic";
    const output = em.postprocess({ content: input });
    expect(output).toBe("*This is italic*");
  });

  // === List li ===
  test("converts list item correctly", () => {
    const input = "List item";
    const output = li.postprocess({ content: input });
    expect(output).toBe("- List item\n");
  });

  // === Checkbox ul ===
  test("converts unordered list correctly", () => {
    const input = "- Item 1\n- Item 2\n- Item 3";
    const output = ul.postprocess({ content: input });
    expect(output).toBe("- Item 1\n- Item 2\n- Item 3\n\n");
  });

  // === Checkbox ol ===
  test("converts ordered list correctly", () => {
    const input = "- Item 1\n- Item 2\n- Item 3";
    const output = ol.postprocess({ content: input });
    expect(output).toBe("1. Item 1\n2. Item 2\n3. Item 3\n\n");
  });
});

/*---------------------------------
parsing XML and rendering an MCQ (or other Quiz question) Problem to Liascript Markdown
----------------------------------*/

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
});

describe("Parsing XML and rendering an MCQ", () => {
  // === Parse XML ===
  test("Parses empty XML correctly", () => {
    const xml = `<problem></problem>`;
    const parsed = parser.parse(xml);
    const output = xmlToMarkdown({ ...parsed.problem, type: "problem" });
    expect(output.trim()).toBe("");
  });

  // === Checkbox MCQ ===
  test("Render to checkbox MCQ", () => {
    const xml = `
      <problem>
        <checkboxgroup>
          <choice correct="true">Correct Option</choice>
          <choice correct="false">Incorrect Option</choice>
        </checkboxgroup>
      </problem>`;
    const parsed = parser.parse(xml);
    const output = xmlToMarkdown({ ...parsed.problem, type: "problem" });

    expect(output.trim()).toBe(
      "- [[x]] Correct Option\n- [[ ]] Incorrect Option"
    );
  });

  // === Choice MCQ ===
  test("Render to choice MCQ", () => {
    const xml = `
      <problem>
        <choicegroup>
          <choice correct="true">Correct Option</choice>
          <choice correct="false">Incorrect Option</choice>
        </choicegroup>
      </problem>`;
    const parsed = parser.parse(xml);
    const output = xmlToMarkdown({ ...parsed.problem, type: "problem" });

    expect(output.trim()).toBe(
      "- [(x)] Correct Option\n- [( )] Incorrect Option"
    );
  });
});

/*---------------------------------
asserting if image paths are replaced correctly
----------------------------------*/
describe("Image paths converted correctly", () => {
  test("converts image correctly", () => {
    const mockNode = {
      getAttribute: (attr) => {
        const attrs = {
          src: "/static/uq_duck_meeting.jpg",
          alt: "UQ Ducks",
        };
        return attrs[attr] || null;
      },
    };

    const output = htmlHandlers.img.postprocess({ node: mockNode });
    expect(output.trim()).toBe("![UQ Ducks](../images/uq_duck_meeting.jpg)");
  });
});

/*---------------------------------
Render Markdown from tree
----------------------------------*/
describe("Render Markdown from course tree", () => {
  test("Extracted course folder renders correctly to Markdown", () => {
    const courseFolder = path.join(
      os.homedir(),
      "Downloads/assignment_comp2140/extractedinputcourses/extraction2/course"
    );

    function buildTree(folderPath) {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      const node = {
        type: "course",
        display_name: path.basename(folderPath),
        children: [],
      };

      entries.forEach((entry) => {
        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          node.children.push(buildTree(fullPath));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if ([".xml", ".html", ".htm"].includes(ext)) {
            node.children.push({
              type: "problem",
              display_name: entry.name,
              file: fullPath,
            });
          }
        }
      });

      return node;
    }

    const courseTree = buildTree(courseFolder);

    // Render Markdown from the tree
    const mdOutput = treeToMarkdown(courseTree);

    // Assert that some Markdown was generated
    expect(mdOutput.trim().length).toBeGreaterThan(0);
  });
});
