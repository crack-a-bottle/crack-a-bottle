const fs = require("fs");
const path = require("path");
const { default: png } = require("../dist");

const imagePath = path.join(__dirname, `type${process.argv[2]}`);
const image = fs.readFileSync(path.join(imagePath, `${process.argv[2]}.png`));

fs.writeFileSync(path.join(imagePath, "sword.json"), JSON.stringify(png(image).toJSON(), null, 4));