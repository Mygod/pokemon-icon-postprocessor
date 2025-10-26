# Pokemon Icon Postprocessor

Batch renaming + trimming [`pokemon_icon`s](https://github.com/PokeMiners/pogo_assets/tree/master/Images/Pokemon%20-%20256x256) for easier access.

## I am too lazy to run it myself

Compiled icons available at: https://mygod.github.io/pokicons/v2

Or to use specific commit: https://raw.githubusercontent.com/Mygod/pokicons/4c6d31e2fabfb603dad70c3d38d814e85b9b9d13/v2

Source: https://github.com/Mygod/pokicons

## Usage

Install imagemagick (and optionally your favorite PNG compressor).

```sh
npm install
node main.js [-u|--uicons] [--masterfile /path/to/master-latest-uicons.json] /path/to/pokemon_icons /path/to/output/dir
find /path/to/output/dir -iname '*.png' -print0 | xargs -0 -n 1 -P `nproc` optipng -o7 -strip all
```

Another useful script is included for migrating PMSF icons.
You can invoke it by running `node migrate.js pmsf /path/to/input/dir /path/to/output/dir`.

## Using the icons

Output file name format follows the "Intermapping Cooperative Object Naming Standard" (ICONS). (customizable via editing the code directly)

```
<pokemon id>[-b<bread mode id>][-e<temp evolution id>][-f<form id>][-c<costume id>][-g<gender id>][-shiny].png
```

Additionally, you will find a `index.json` file containing an JSON array of all the filenames (minus extensions) for you to do fallbacks locally.

You should use the following fallback algorithm to determine the best pokemon icon:

1. Try `b-p-e-f-c-g-shiny` (111111)
2. Try `b-p-e-f-c-g` (111110)
3. Try `b-p-e-f-c-shiny` (111101)  
...
31. Try `p-shiny` (000001)
32. Try `p.png` (000000)
33. Use `0.png` as substitute pokemon

Reference implementation in node.js:

```javascript
const axios = require('axios')
const { Sema } = require('async-sema')

const sema = new Sema(1)
const availablePokemon = {}

function resolvePokemonIcon(availablePokemon, pokemonId, form = 0, evolution = 0, breadMode = 0, gender = 0,
                            costume = 0, shiny = false) {
    const breadModeSuffixes = breadMode ? ['-b' + breadMode, ''] : ['']
    const evolutionSuffixes = evolution ? ['-e' + evolution, ''] : ['']
    const formSuffixes = form ? ['-f' + form, ''] : ['']
    const costumeSuffixes = costume ? ['-c' + costume, ''] : ['']
    const genderSuffixes = gender ? ['-g' + gender, ''] : ['']
    const shinySuffixes = shiny ? ['-shiny', ''] : ['']
    for (const breadModeSuffix of breadModeSuffixes) {
    for (const evolutionSuffix of evolutionSuffixes) {
    for (const formSuffix of formSuffixes) {
    for (const costumeSuffix of costumeSuffixes) {
    for (const genderSuffix of genderSuffixes) {
    for (const shinySuffix of shinySuffixes) {
        const result = `${pokemonId}${breadModeSuffix}${evolutionSuffix}${formSuffix}${costumeSuffix}${genderSuffix}${shinySuffix}`
        if (availablePokemon.has(result)) return result
    }
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

module.exports = pokicon
```

## Notes for icon makers

- If the icon is for the first form of the Pokemon (usually the normal form), leave out `-f` so that it becomes the default asset
- If it is for male pokemon or if it is genderless, leave out `-g` so that it becomes the default asset
- Currently in-game assets for temporary evolutions are tied to Pokemon rather than Pokemon + form, so please leave out `-f` for mega assets until the game gets updated (if that ever happens)
- Handy batch/bash script for making `index.json` files: `python -c "import os, json; print(json.dumps([os.path.splitext(file)[0] for file in os.listdir('.') if file.endswith('.png')], separators=(',', ':')))" > index.json`

## License

Apache 2.0
