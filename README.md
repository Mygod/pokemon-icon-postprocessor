# Pokemon Icon Postprocessor

Batch renaming + trimming [`pokemon_icons`](https://github.com/ZeChrales/PogoAssets/tree/master/pokemon_icons) for easier access.

## Usage

Install imagemagick (and optionally your favorite PNG compressor).

```sh
npm install
node main.js /path/to/pokemon_icons /path/to/output/dir
find /path/to/output/dir -iname '*.png' -print0 | xargs -0 -n 1 -P `nproc` optipng -o7 -strip all
```

Output file name format: (customizable via editing the code directly)

```
pokemon_icon_<xxx pokemon id>(_<form id>|_v<temp evolution id>)[_female][_<xx costume id>][_shiny].png
```

For Pokemon that does not have a default form (Unown, Spinda, Castform, ...), you will find its default asset (if there is one available) at:

```
pokemon_icon_<xxx pokemon id>_00[_shiny].png
```

## License

Apache 2.0
