# Pokemon Icon Postprocessor

Batch renaming + trimming [`pokemon_icons`](https://github.com/ZeChrales/PogoAssets/tree/master/pokemon_icons) for easier access.

## I am too lazy to run it myself

Compiled icons available at: https://mygod.github.io/pokicons/v2

Source: https://github.com/Mygod/pokicons

## Usage

Install imagemagick (and optionally your favorite PNG compressor).

```sh
npm install
node main.js /path/to/pokemon_icons /path/to/output/dir
find /path/to/output/dir -iname '*.png' -print0 | xargs -0 -n 1 -P `nproc` optipng -o7 -strip all
```

Another useful script is included for migrating PMSF icons.
You can invoke it by running `node migrate.js pmsf /path/to/input/dir /path/to/output/dir`.

## Using the icons

Output file name format follows the "Intermapping Cooperative Object Naming Standard" (ICONS). (customizable via editing the code directly)

```
<pokemon id>[-e<temp evolution id>][-f<form id>][-c<costume id>][-g<gender id>][-shiny].png
```

Additionally, you will find a `index.json` file containing an JSON array of all the filenames (minus extensions) for you to do fallbacks locally.

You should use the following fallback algorithm to determine the best pokemon icon:

1. Try `p-e-f-c-g-shiny` (11111)
2. Try `p-e-f-c-g` (11110)
3. Try `p-e-f-c-shiny` (11101)  
...
31. Try `p-shiny` (00001)
32. Try `p.png` (00000)
33. Use `0.png` as substitute pokemon

Reference implementation in node.js:

```javascript
const axios = require('axios')
const { Sema } = require('async-sema')

const sema = new Sema(1)
let availablePokemon = {}

function resolvePokemonIcon(availablePokemon, pokemonId, form = 0, evolution = 0, gender = 0, costume = 0,
                            shiny = false) {
    const evolutionSuffixes = evolution ? ['-e' + evolution, ''] : ['']
    const formSuffixes = form ? ['-f' + form, ''] : ['']
    const costumeSuffixes = costume ? ['-c' + costume, ''] : ['']
    const genderSuffixes = gender ? ['-g' + gender, ''] : ['']
    const shinySuffixes = shiny ? ['-shiny', ''] : ['']
    for (const evolutionSuffix of evolutionSuffixes) {
    for (const formSuffix of formSuffixes) {
    for (const costumeSuffix of costumeSuffixes) {
    for (const genderSuffix of genderSuffixes) {
    for (const shinySuffix of shinySuffixes) {
        const result = `${pokemonId}${evolutionSuffix}${formSuffix}${costumeSuffix}${genderSuffix}${shinySuffix}`
        if (availablePokemon.has(result)) return result
    }
    }
    }
    }
    }
    return '0'  // substitute
}

async function pokicon(baseUrl, pokemonId, form = 0, evolution = 0, female = false, costume = 0,
                       shiny = false) {
    await sema.acquire()
    try {
        if (availablePokemon[baseUrl] === undefined) {
            const response = await axios.get(`${baseUrl}/index.json`)
            availablePokemon[baseUrl] = new Set(response.data)
        }
    } finally {
        sema.release()
    }
    return `${baseUrl}/${resolvePokemonIcon(availablePokemon[baseUrl], pokemonId, form, evolution, female, costume, shiny)}.png`
}

module.exports = pokicon;
```

## Notes for icon makers

- If the icon is for the first form of the Pokemon (usually the normal form), leave out `-f` so that it becomes the default asset
- If it is for male pokemon or if it is genderless, leave out `-g` so that it becomes the default asset
- Handy batch/bash script for making `index.json` files: `python -c "import os, json; print(json.dumps([os.path.splitext(file)[0] for file in os.listdir('.') if file.endswith('.png')], separators=(',', ':')))" > index.json`

## License

Apache 2.0
