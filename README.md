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

Output file name format: (customizable via editing the code directly)

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

Notes for icon makers:

- If the icon is for the first form of the Pokemon (usually the normal form), leave out `-f` so that it becomes the default asset
- If it is for male pokemon or if it is genderless, leave out `-g` so that it becomes the default asset

## License

Apache 2.0
