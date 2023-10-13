const child_process = require("child_process");
const fs = require('fs');
const path = require('path');

const axios = require('axios');
const POGOProtos = require('@na-ji/pogo-protos');

const uicons = process.argv.includes('-u');
const prefix = uicons ? '_' : '-'

function getFilename(display, defaultForms, costume = 0, shiny = false) {
    let result = String(display.pokemonId);
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

    const legacyFormLookup = require('./legacy.json');
    const availablePokemon = [];

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
            let test;
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
        availablePokemon.push(outputFilename);
        if (outDir) convert(inDir, filename, path.join(outDir, outputFilename + '.png'));
    }

    const aaFiles = new Set(availablePokemon);
    const missingAa = [];
    const legacyDir = path.join(__dirname, 'legacy');
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
        if (formTargets === null || (match = /^(?:_(\d+))?(_shiny)?(_old[12]?)?\.png$/.exec(suffix)) === null) {
            // skip warning since already handled in legacy.js: console.warn('Unrecognized/unused asset', filename);
            continue;
        }
        let targets = formTargets.targets;
        if (targets.length > 1) console.warn('Multiple targets found for asset', filename, targets);
        formTargets.hit = true;
        if (match[3] !== undefined) {
            if (targets[0].pokemonId !== 716) {
                console.warn('Unrecognized old asset', filename);
                continue;
            }
            if (match[3].endsWith('2')) continue;   // the weird colorless active mode shiny
            targets = [{ pokemonId: 716, form: POGOProtos.Rpc.PokemonDisplayProto.Form.XERNEAS_ACTIVE }];
        }
        const costume = parseInt(match[1]) || 0;
        const shiny = match[2] !== undefined;
        let output = null;
        for (const target of targets) {
            const outputFilename = getFilename(target, defaultForms, costume, shiny);
            if (aaFiles.has(outputFilename)) continue;
            missingAa.push(outputFilename);
            availablePokemon.push(outputFilename);
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
        await fs.promises.writeFile(path.join(outDir, 'index.json'), JSON.stringify(availablePokemon));
    }

    if (missingAa.length) {
        console.info(missingAa.length, 'assets have not migrated to addressable asset:', JSON.stringify(missingAa));
    }
    if (!outDir) console.log(JSON.stringify(availablePokemon));
})();
