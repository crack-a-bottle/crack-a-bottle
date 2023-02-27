#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const arg = require("arg");
const crackABottle = require("..");

class CLIError extends Error {};

try {
    (function (argv) {
        const args = arg({
            "--binary": Boolean,
            "--crc": Boolean,
            "--hex": Boolean,
            "--input": String,
            "--output": String,
            "--png": Boolean,
            "--keep-scale": Boolean,
            "--bin": "--binary",
            "-b": "--binary",
            "-c": "--crc",
            "-h": "--hex",
            "-p": "--png",
            "--in": "--input",
            "-i": "--input",
            "--out": "--output",
            "-o": "--output",
            "-k": "--keep-scale",
        }, { argv });

        if (args["--input"] || args._[0]) {
            const zeroFlags = !args["--binary"] && !args["--hex"] && !args["--png"];
            const twoFlags = (args["--binary"] && args["--hex"]) || (args["--binary"] && args["--png"]) || (args["--hex"] && args["--png"]);
            const threeFlags = args["--binary"] && args["--hex"] && args["--png"];
            if (zeroFlags) throw new CLIError("Expected one flag, got zero.");
            if (twoFlags) {
                if (threeFlags) throw new CLIError("Expected one flag, got three.");
                else throw new CLIError("Expected one flag, got two.");
            }

            let inputPath = path.resolve(process.cwd(), args["--input"] || args._[0]);
            let outputPath = args["--output"] ? path.resolve(process.cwd(), args["--output"]) : inputPath + (
                args["--binary"] ? ".bin" : (args["--hex"] ? ".hex" : (args["--png"] ? ".json" : "")));
            let inputData = fs.readFileSync(inputPath);

            if (args["--binary"]) fs.writeFileSync(outputPath, crackABottle.binary(inputData));
            if (args["--hex"]) fs.writeFileSync(outputPath, crackABottle.hex(inputData));
            if (args["--png"]) {
                let outputData = crackABottle.png(inputData, { checkCRC: args["--crc"], keepScale: args["--keep-scale"] });
                fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 4));
            }
        } else console.log("Insert help message here");
    })(process.argv.slice(2));
} catch (error) {
    if (error instanceof Error) {
        import("chalk").then(({ default: chalk }) =>
            console.error(`${chalk.red.bold(`${error.name}:`)} ${error.message}${
                !(error instanceof CLIError) ? `\n${chalk.gray(error.stack.split("\n").slice(1).join("\n"))}` : ""
            }`));
    } else console.error(error);
}