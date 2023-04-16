const fs = require("fs");
const path = require("path");
const { qoi } = require("../dist");

for (const file of fs.readdirSync(__dirname).filter(x => x.endsWith(".qoi")).map(x => x.slice(0, x.lastIndexOf(".")))) {
    console.log(file);
    const img = qoi(fs.readFileSync(path.join(__dirname, file + ".qoi")));
    const data = img.data;
    img.data = [];
    let stringData = "[\n    ";
    for (let i = 0; i < data.length; i++) {
        stringData += JSON.stringify(data[i], null, 0.1).replaceAll("\n", " ") + (i < data.length - 1 ? ",\n    " : "\n  ]");
    }
    fs.writeFileSync(path.join(__dirname, file + ".json"), JSON.stringify(img, null, 2).replace("\"data\": []", "\"data\": " + stringData));
}
