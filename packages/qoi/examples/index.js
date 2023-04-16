const fs = require("fs");
const path = require("path");
const { qoi } = require("../dist");

function stringify(obj) {
    const { data } = obj;
    let stringData = "[\n    ";
    for (let i = 0; i < data.length; i++) {
        stringData += JSON.stringify(data[i], null, 0.1).replaceAll("\n", " ") + (i < data.length - 1 ? ",\n    " : "\n  ]");
    }
    return JSON.stringify({ ...obj, data: [] }, null, 2).replace("\"data\": []", "\"data\": " + stringData);
}

if (process.argv.length > 2 && process.argv[2].endsWith(".qoi")) {
    const file = path.join(__dirname, process.argv[2].slice(0, process.argv[2].lastIndexOf(".")));
    fs.writeFileSync(file + ".json", stringify(qoi(fs.readFileSync(file + ".qoi"))));
} else {
    for (const file of fs.readdirSync(__dirname).filter(x => x.endsWith(".qoi")).map(x => path.join(__dirname, x.slice(0, x.lastIndexOf("."))))) {
        console.log(file.split(path.sep).pop());
        fs.writeFileSync(file + ".json", stringify(qoi(fs.readFileSync(file + ".qoi"))));
    }
}
