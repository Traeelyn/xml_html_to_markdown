Files & What they do:

1. **extractfiles.js** --> file to extract the .tar.gz files from the inputcourses folder & place them in the extractinputcoursesfolder
2. **convertotreestructure.js** --> Builds a object-based tree based on the folder
3. **courseconverter.js** --> File to convert the object-based tree into markdown format (includes converting xml & html elements, videos, images)
4. **main.js** --> code is run from the main.js (run using "node main.js")

Things to download:

1. fast-xml-parser
2. node-html-markdown
3. tar

Things to note:
**inputcourses** and **extractedinputcourses** are located within this folder just for submission purposes (so that it can run without error)
**outputcourses** located in the downloads directory of any computer

Testcases:

- The file to run testcases is **test.js** <-- run the test using the command **npm test**

AI assistance used:

- chat.gpt and claude.ai used to assist me in convertreestructure.js, courseconverter.js, extractfiles.js, main.js
