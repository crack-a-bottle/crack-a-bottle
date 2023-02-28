const fs = require("fs");
const path = require("path");
const { default: PNG } = require("../dist");

const sword = fs.readFileSync(path.join(__dirname, "sword.png"));

fs.writeFileSync(path.join(__dirname, "sword.png.json"), JSON.stringify(new PNG(sword).toJSON()));