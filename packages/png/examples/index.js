const fs = require("fs");
const path = require("path");
const { default: png } = require("../dist");

const swordPath = path.join(__dirname, `type${process.argv[2]}`);
const sword = fs.readFileSync(path.join(swordPath, "sword.png"));

fs.writeFileSync(path.join(swordPath, "sword.json"), JSON.stringify(png(sword, { keepFilter: false }).toJSON(), null, 4));
fs.writeFileSync(path.join(swordPath, "sword-filtered.json"), JSON.stringify(png(sword, { keepFilter: true }).toJSON(), null, 4));