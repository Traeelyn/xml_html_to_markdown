import * as tar from "tar";
import path from "path";
import fs from "fs";
import os from "os";

const extractTarFiles = async () => {
  const downloadsPath = path.join(os.homedir(), "Downloads");

  //defines path to place the extracted folders in
  const extractFolderPath = path.join(
    downloadsPath,
    "s4932506_RaeLynn_Tan_FunctionalJS",
    "extractedinputcourses"
  );

  const tarFilePath1 = path.join(
    downloadsPath,
    "inputcourses",
    "course.yc8scupm.tar"
  );
  const tarFilePath2 = path.join(
    downloadsPath,
    "inputcourses",
    "course.0nu25zgw.tar"
  )

  const extractDir1 = path.join(extractFolderPath, "extraction1");
  const extractDir2 = path.join(extractFolderPath, "extraction2");

  // Ensure directories exist
  [extractFolderPath, extractDir1, extractDir2].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  try {
    await Promise.all([
      tar.extract({ file: tarFilePath1, cwd: extractDir1 }),
      tar.extract({ file: tarFilePath2, cwd: extractDir2 }),
    ]);
    console.log("✅ Both extractions complete!");
    return { extractDir1, extractDir2 };
  } catch (err) {
    console.error("❌ Extraction failed:", err);
    throw err;
  }
};

export { extractTarFiles };
