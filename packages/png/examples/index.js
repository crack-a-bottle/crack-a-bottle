const fs = require("fs");
const path = require("path");
const { png } = require("../dist");
const folder = path.join(__dirname, process.argv[2]);

for (const file of fs.readdirSync(folder).filter(x => x.endsWith(".png")).map(x => x.slice(0, x.lastIndexOf(".")))) {
    console.log(file);
    const img = png(fs.readFileSync(path.join(folder, file + ".png")));
    const data = img.data;
    img.data = [];
    let stringData = "[\n    ";
    for (let i = 0; i < data.length; i++) {
        stringData += JSON.stringify(data[i], null, 0.1).replaceAll("\n", " ") + (i < data.length - 1 ? ",\n    " : "\n  ]");
    }
    fs.writeFileSync(path.join(folder, file + ".json"), JSON.stringify(img, null, 2).replace("\"data\": []", "\"data\": " + stringData));
}
