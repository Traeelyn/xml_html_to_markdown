import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

// XMLParser setup
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

// Reads the XML file and parses it into a JS object
export function parseXmlFile(filePath) {
  try {
    const xmlContent = fs.readFileSync(filePath, "utf-8");
    return parser.parse(xmlContent);
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

// Helper function to ensure XML files are always in an array
export function ensureArray(item) {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// Collect assets that share the same base name as the XML file
export function collectAssets(filePath) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".xml");

  let assets = [];

  try {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const fileBaseName = path.basename(file, path.extname(file));

      if (file.endsWith(".xml")) return;

      if (fileBaseName === baseName) {
        const ext = path.extname(file);
        let type = "asset";

        if (ext === ".html") type = "htmlContent";
        else if ([".jpg", ".png"].includes(ext)) type = "image";

        assets.push({
          type: type,
          file: fullPath,
          display_name: file,
        });
      }
    });
  } catch (error) {
    console.warn(`Error reading directory ${dir}:`, error.message);
  }

  return assets;
}

// Build the object-based tree
export function buildTree(filePath, type) {
  if (!fs.existsSync(filePath) || !filePath.endsWith(".xml")) {
    console.warn(`File does not exist: ${filePath}`);
    return null;
  }

  const obj = parseXmlFile(filePath);
  if (!obj) return null;

  const dir = path.dirname(filePath);
  const parentDir = path.dirname(dir);

  // About node (disconnected folder handling)
  if (type === "about" && obj.about) {
    const overviewHtmlPath = path.join(dir, "course", "overview.html");
    let children = [];

    if (fs.existsSync(overviewHtmlPath)) {
      children.push({
        type: "htmlContent",
        file: overviewHtmlPath,
        display_name: "Course Overview",
      });
    }

    return {
      type: "about",
      display_name: obj.about.display_name || "About",
      file: filePath,
      children: children,
    };
  }

  // Course node
  if (obj.course) {
    const chapters = ensureArray(obj.course.chapter);
    let children = [];

    const courseRootDir = path.dirname(dir); // Go up one level to /extraction2/course
    const overviewPath = path.join(courseRootDir, "about", "overview.html");

    if (fs.existsSync(overviewPath)) {
      const aboutTree = {
        type: "about",
        display_name: "About",
        children: [
          {
            type: "htmlContent",
            file: overviewPath,
            display_name: "Course Overview",
          },
        ],
      };
      children.unshift(aboutTree); // Add About first
    }

    // Add chapters
    children.push(
      ...chapters
        .map((ch) => {
          const chapterPath = path.join(
            parentDir,
            "chapter",
            ch.url_name + ".xml"
          );
          return buildTree(chapterPath, "chapter");
        })
        .filter(Boolean)
    );

    return {
      type: "course",
      display_name: obj.course.display_name,
      file: filePath,
      children: children,
    };
  }

  // Chapter node
  if (obj.chapter) {
    const sequentials = ensureArray(obj.chapter.sequential);
    return {
      type: "chapter",
      display_name: obj.chapter.display_name || null,
      file: filePath,
      children: sequentials
        .map((seq) => {
          const sequentialPath = path.join(
            parentDir,
            "sequential",
            seq.url_name + ".xml"
          );
          return buildTree(sequentialPath, "sequential");
        })
        .filter(Boolean),
    };
  }

  // Sequential node
  if (obj.sequential) {
    const verticals = ensureArray(obj.sequential.vertical);

    const verticalContainers = verticals
      .map((vert) => {
        const verticalPath = path.join(
          parentDir,
          "vertical",
          vert.url_name + ".xml"
        );
        const verticalNode = buildTree(verticalPath, "vertical");

        if (verticalNode && verticalNode.children) {
          return {
            type: "vertical-container",
            display_name: verticalNode.display_name,
            url_name: vert.url_name,
            children: verticalNode.children,
          };
        }
        return null;
      })
      .filter(Boolean);

    return {
      type: "sequential",
      display_name: obj.sequential.display_name || null,
      file: filePath,
      children: verticalContainers,
    };
  }

  // Vertical node
  if (obj.vertical) {
    const problems = ensureArray(obj.vertical.problem);
    const htmls = ensureArray(obj.vertical.html);
    const videos = ensureArray(obj.vertical.video);

    return {
      type: "vertical",
      display_name: obj.vertical.display_name || null,
      file: filePath,
      children: [
        ...problems
          .map((prob) => {
            const problemPath = path.join(
              parentDir,
              "problem",
              prob.url_name + ".xml"
            );
            return fs.existsSync(problemPath)
              ? buildTree(problemPath, "problem")
              : null;
          })
          .filter(Boolean),

        ...htmls
          .map((html) => {
            const htmlPath = path.join(
              parentDir,
              "html",
              html.url_name + ".xml"
            );
            return fs.existsSync(htmlPath) ? buildTree(htmlPath, "html") : null;
          })
          .filter(Boolean),

        ...videos
          .map((video) => {
            const videoPath = path.join(
              parentDir,
              "video",
              video.url_name + ".xml"
            );
            return fs.existsSync(videoPath)
              ? buildTree(videoPath, "video")
              : null;
          })
          .filter(Boolean),
      ],
    };
  }

  // Problem node
  if (obj.problem) {
    return {
      type: "problem",
      display_name: obj.problem.display_name || null,
      file: filePath,
      problemData: obj.problem,
      children: [],
    };
  }

  // HTML node
  if (obj.html) {
    const baseName = obj.html.filename || path.basename(filePath, ".xml");
    const htmlFilePath = path.join(dir, baseName + ".html");

    let children = [];

    if (fs.existsSync(htmlFilePath)) {
      children.push({
        type: "htmlContent",
        file: htmlFilePath,
        display_name: obj.html.display_name || baseName,
      });
    }

    return {
      type: "html",
      display_name: obj.html.display_name || null,
      file: filePath,
      children,
    };
  }

  // Video node
  if (obj.video) {
    return {
      type: "video",
      display_name: obj.video.display_name || null,
      file: filePath,
      videoData: obj.video,
      children: [],
    };
  }

  return null;
}

export default { buildTree };
