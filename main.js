import fs from "fs";
import path from "path";
import os from "os";
import { buildTree } from "./convertotreestructure.js";
import { treeToMarkdown } from "./courseconverter.js";
import { extractTarFiles } from "./extractfiles.js";

extractTarFiles();
async function main() {
  try {
    // For running the code outside my computer <-- i have placed the extractedinputcourses inside this folder
    const baseDir1 = path.join(
      os.homedir(),
      "Downloads",
      "s4932506_RaeLynn_Tan_FunctionalJS",
      "extractedinputcourses",
      "extraction1"
    );
    const baseDir2 = path.join(
      os.homedir(),
      "Downloads",
      "s4932506_RaeLynn_Tan_FunctionalJS",
      "extractedinputcourses",
      "extraction2"
    );

    const courseFiles = [
      path.join(baseDir1, "course/course/2025_S2.xml"),
      path.join(baseDir2, "course/course/S2_2025.xml"),
    ];

    //This is where outputcourses is created and put into the downloads folder of any computer
    const outputRoot = path.join(os.homedir(), "Downloads/outputcourses");
    if (!fs.existsSync(outputRoot))
      fs.mkdirSync(outputRoot, { recursive: true });

    const imagesDir = path.join(outputRoot, "images");
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    // Copy images from static folders
    copyStaticImages(path.join(baseDir1, "course/static"), imagesDir);
    copyStaticImages(path.join(baseDir2, "course/static"), imagesDir);

    for (const coursePath of courseFiles) {
      if (!fs.existsSync(coursePath)) {
        console.error(`❌ File does not exist: ${coursePath}`);
        continue;
      }

      // Build the main course tree
      const tree = buildTree(coursePath, "course");

      console.log(`✅ Tree built for ${coursePath}`);
      console.log(JSON.stringify(tree, null, 2));

      const markdown = treeToMarkdown(tree);
      console.log(`✅ Markdown generated for ${coursePath}`);

      const subfolder = path.join(outputRoot, path.parse(coursePath).name);
      if (!fs.existsSync(subfolder))
        fs.mkdirSync(subfolder, { recursive: true });

      const outputPath = path.join(subfolder, "course.md");
      fs.writeFileSync(outputPath, markdown, "utf-8");
      console.log(`✅ Saved course.md to ${outputPath}`);
    }
  } catch (err) {
    console.error("❌ Failed:", err.message);
  }
}

// Function to copy images recursively from a source to destination folder
function copyStaticImages(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;

  const files = fs.readdirSync(srcDir);

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      const destPath = path.join(destDir, file);
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath);
      copyStaticImages(srcPath, destPath);
    } else {
      const cleanFileName = file.replace(/\s+/g, "_").replace(/,/g, "_");
      const destPath = path.join(destDir, cleanFileName);
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${srcPath} → ${destPath}`);
    }
  }
}

main();
