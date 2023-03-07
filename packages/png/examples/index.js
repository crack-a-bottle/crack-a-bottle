const fs = require("fs");
const path = require("path");
const { png } = require("../dist");

const imagePath = path.resolve(__dirname, `${process.argv[2]}.png`);

fs.writeFileSync(path.join(imagePath.replace(".png", ".json")), JSON.stringify(png(fs.readFileSync(imagePath)).toJSON(), null, 4));