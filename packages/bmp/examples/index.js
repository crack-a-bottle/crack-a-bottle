const fs = require("fs");
const path = require("path");
const { bmp } = require("../dist");
const folder = path.join(__dirname, process.argv[2]);

function stringify(obj) {
    const { data } = obj;
    let stringData = "[\n    ";
    for (let i = 0; i < data.length; i++) {
        stringData += JSON.stringify(data[i], null, 0.1).replaceAll("\n", " ") + (i < data.length - 1 ? ",\n    " : "\n  ]");
    }
    return JSON.stringify({ ...obj, data: [] }, null, 2).replace("\"data\": []", "\"data\": " + stringData);
}

if (folder.endsWith(".bmp")) {
    fs.writeFileSync(folder.slice(0, folder.lastIndexOf(".")) + ".json", stringify(bmp(fs.readFileSync(folder))));
} else {
    for (const file of fs.readdirSync(folder).filter(x => x.endsWith(".bmp")).map(x => path.join(folder, x.slice(0, x.lastIndexOf("."))))) {
        console.log(file.split(path.sep).pop());
        fs.writeFileSync(path.join(file + ".json"), stringify(bmp(fs.readFileSync(path.join(file + ".bmp")))));
    }
}
