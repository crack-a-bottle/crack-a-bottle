const fs = require("fs");
const path = require("path");
const { png } = require("../dist");
const folder = path.join(__dirname, process.argv[2]);

for (const file of fs.readdirSync(folder).filter(x => x.endsWith(".png")).map(x => x.slice(0, x.lastIndexOf(".")))) {
    console.log(file);
    fs.writeFileSync(path.join(folder, file + ".json"), JSON.stringify(png(fs.readFileSync(path.join(folder, file + ".png"))), null, 2));
}
