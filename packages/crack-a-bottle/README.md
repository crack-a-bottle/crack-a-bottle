# crack-a-bottle
High-quality image cracking/parsing tools.

## Installation
```bash
npm install crack-a-bottle
```

## Importing
This package can be imported using CJS or ESM.
```js
const crackabottle = require("crack-a-bottle");
```
```js
import * as crackabottle from "crack-a-bottle";
```

## Usage
```js
const fs = require("fs");
const { png } = require("crack-a-bottle");

fs.readFile("image.png", (err, data) => {
    if (err) throw err;
    const image = png(data);
    console.log(image);
});
```
```js
const fs = require("fs");
const { qoi } = require("crack-a-bottle");

fs.readFile("image.qoi", (err, data) => {
    if (err) throw err;
    const image = qoi(data);
    console.log(image);
});
```

## Documentation
The documentation can be found [here](https://crackabottle.js.org/crack-a-bottle).

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
