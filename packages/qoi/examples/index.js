const fs = require("fs");
const path = require("path");
const { qoi } = require("../dist");

const imagePath = path.resolve(__dirname, `${process.argv[2]}.qoi`);

fs.writeFileSync(path.join(imagePath.replace(".qoi", ".json")), JSON.stringify(qoi(fs.readFileSync(imagePath)), null, 2));
