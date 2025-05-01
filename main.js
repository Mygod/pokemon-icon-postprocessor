const child_process = require("child_process");
const fs = require('fs');
const path = require('path');

const axios = require('axios');
const POGOProtos = require('@na-ji/pogo-protos');

const uicons = process.argv.includes('-u');
const prefix = uicons ? '_' : '-'

function getFilename(display, defaultForms, costume = 0, shiny = false) {
    let result = String(display.pokemonId);
    if (display.breadMode) {
        result += prefix + 'b' + display.breadMode;
    }
    if (display.evolution) {
        result += prefix + 'e' + display.evolution;
    }
    if (display.form && defaultForms[display.pokemonId] !== display.form) {
        result += prefix + 'f' + display.form;
    }
    if (costume) {
        result += prefix + 'c' + costume;
    }
    if (display.gender) {
        result += prefix + 'g' + display.gender;
    }
    if (shiny) {
        result += uicons ? '_s' : '-shiny';
    }
    return result;
}

function convert(inDir, filename, targetPath) {
    const sourcePath = path.join(inDir, filename);
    const child = child_process.spawnSync('convert', ['-trim', '-fuzz', '1%', sourcePath, targetPath], {
        stdio: 'inherit'
    });
    if (child.error || child.status) {
        console.error('Failed to convert', sourcePath, 'exited with', child.status, child.error);
        return false;
    }
    return true;
}

(async () => {
    let inDir = process.argv[2];
    let outDir = process.argv[3];
    if (!inDir) {
        console.error('Usage: node main.js <input dir> [<output dir>]');
        process.exit(1);
    }
    inDir = path.resolve(inDir);
    outDir = outDir && path.resolve(outDir);

    console.log('Reading game master...');
    const gameMaster = (await axios.get('https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json')).data;
    const defaultForms = {};
    for (const template of gameMaster) {
        if (!template.templateId.startsWith('FORMS_V')) continue;
        const pokemonId = parseInt(template.templateId.substr(7, 4));
        if (!pokemonId) {
            console.warn('Unrecognized templateId', template.templateId);
            continue;
        }
        const formSettings = template.data[Object.keys(template.data)[1]];
        let forms = formSettings[Object.keys(formSettings)[1]];
        if (forms === undefined || forms.length === 0) continue;
        const formData = forms[0];
        const keys = Object.keys(formData);
        if (keys.length === 0) continue;
        const form = formData[keys[0]];
        const formId = POGOProtos.Rpc.PokemonDisplayProto.Form[form];
        if (!formId) {
            console.warn('Unrecognized form', form);
            continue;
        }
        defaultForms[pokemonId] = formId;
    }

    const availablePokemon = {};

    if (outDir) {
        await fs.promises.mkdir(outDir, { recursive: true });
    }

    const addressableAssetsRegex = /^pm(\d+)(?:\.f([^.]*))?(?:\.c([^.]+))?(?:\.g(\d+))?(\.s)?\.icon\.png$/;
    for (const filename of await fs.promises.readdir(inDir)) {
        if (!filename.startsWith('pm') || !filename.endsWith('.icon.png')) continue;
        const match = addressableAssetsRegex.exec(filename);
        if (match === null) {
            console.warn('Unrecognized addressable asset', filename);
            continue;
        }
        const display = { pokemonId: parseInt(match[1]) };
        if (match[2] !== undefined && ((f) => {
            if (f === '') return !(display.form = POGOProtos.Rpc.PokemonDisplayProto.Form[
                POGOProtos.Rpc.HoloPokemonId[display.pokemonId] + '_NORMAL']);
            if (f === 'GIGANTAMAX') {
                display.breadMode = 2;
                return false;
            }
            let test;
            if ((test = POGOProtos.Rpc.BreadModeEnum.Modifier[f])) {
                display.breadMode = test;
                return false;
            }
            if ((test = POGOProtos.Rpc.HoloTemporaryEvolutionId['TEMP_EVOLUTION_' + f])) {
                display.evolution = test;
                return false;
            }
            if ((test = POGOProtos.Rpc.PokemonDisplayProto.Form[
            POGOProtos.Rpc.HoloPokemonId[display.pokemonId] + '_' + f])) {
                display.form = test;
                return false;
            }
            if ((test = POGOProtos.Rpc.PokemonDisplayProto.Form[f])) {
                display.form = test;
                return false;
            }
            console.warn('Unrecognized form/evolution', filename);
            return true;
        })(match[2])) continue;
        let costume = 0;
        if (match[3] !== undefined) {
            const c = match[3].toUpperCase();
            let test = POGOProtos.Rpc.PokemonDisplayProto.Costume[c];
            if (test) costume = test; else if ((test = POGOProtos.Rpc.PokemonDisplayProto.Costume[c + '_NOEVOLVE'])) {
                console.warn('Unrecognized costume', filename, 'but found the noevolve costume');
                costume = test;
            } else {
                console.warn('Unrecognized costume', filename);
                continue;
            }
        }
        if (match[4] !== undefined) display.gender = parseInt(match[4]);
        const outputFilename = getFilename(display, defaultForms, costume, match[5] !== undefined);
        if (availablePokemon[outputFilename]) {
            let useOld = filename.length <= availablePokemon[outputFilename].length;
            console.info('duplicate', availablePokemon[outputFilename], useOld ? '>' : '<', filename);
            if (useOld) continue;
        }
        availablePokemon[outputFilename] = filename;
        if (outDir) convert(inDir, filename, path.join(outDir, outputFilename + '.png'));
    }

    const legacyDir = path.join(__dirname, 'legacy');
    const legacyFormLookup = {
        "716_00":{"targets":[{"pokemonId":716,"form":POGOProtos.Rpc.PokemonDisplayProto.Form.XERNEAS_ACTIVE}]},
    };
    for (const filename of await fs.promises.readdir(legacyDir)) {
        if (!filename.endsWith('.png')) continue;
        const name = filename.substr(13);
        let suffix;
        let formTargets = null;
        for (const [prefix, data] of Object.entries(legacyFormLookup)) {
            if (name.startsWith(prefix)) {
                suffix = name.substr(prefix.length);
                formTargets = data;
                break;  // we can break since we have done the check
            }
        }
        let match;
        if (formTargets === null || (match = /^(?:_(\d+))?(_shiny)?\.png$/.exec(suffix)) === null) {
            continue;
        }
        let targets = formTargets.targets;
        const costume = parseInt(match[1]) || 0;
        const shiny = match[2] !== undefined;
        let output = null;
        for (const target of targets) {
            const outputFilename = getFilename(target, defaultForms, costume, shiny);
            if (availablePokemon[outputFilename]) {
                console.warn(`${outputFilename} is now available as ${availablePokemon[outputFilename]} and can now be removed from legacy`);
                continue;
            }
            availablePokemon[outputFilename] = filename;
            if (!outDir) continue;
            const targetPath = path.join(outDir, outputFilename + '.png');
            if (output !== null) {
                await fs.promises.copyFile(output, targetPath);
            } else if (convert(legacyDir, filename, targetPath)) {
                output = targetPath;
            }
        }
    }

    if (outDir) {
        await fs.promises.writeFile(path.join(outDir, 'index.json'), JSON.stringify(Object.keys(availablePokemon)));
    } else console.log(JSON.stringify(Object.keys(availablePokemon)));
})();
