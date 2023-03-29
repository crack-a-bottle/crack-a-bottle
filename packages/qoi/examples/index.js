const fs = require("fs");
const path = require("path");
const { qoi } = require("../dist");

for (const file of fs.readdirSync(__dirname).filter(x => x.endsWith(".qoi")).map(x => x.slice(0, x.lastIndexOf("."))))
    fs.writeFileSync(path.join(__dirname, file + ".json"), JSON.stringify(qoi(fs.readFileSync(path.join(__dirname, file + ".qoi")))));
