# Pokemon Icon Postprocessor

Batch renaming + trimming [`pokemon_icons`](https://github.com/ZeChrales/PogoAssets/tree/master/pokemon_icons) for easier access.

## Usage

Install imagemagick (and optionally your favorite PNG compressor).

```sh
npm install
node main.js /path/to/pokemon_icons /path/to/output/dir
optipng -o7 -strip all /path/to/output/dir/*.png
```

## License

Apache 2.0
