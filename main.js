const child_process = require("child_process");
const fs = require('fs');
const path = require('path');

const axios = require('axios');
const POGOProtos = require('@na-ji/pogo-protos');

let uicons = false;
let prefix = '-';

const defaultMasterfilePath = path.resolve(__dirname, '..', 'Masterfile-Generator', 'master-latest-uicons.json');
const remoteMasterfileUrl = 'https://raw.githubusercontent.com/WatWowMap/Masterfile-Generator/refs/heads/master/master-latest-uicons.json';

function parseArgs(argv) {
    const positional = [];
    let masterfilePath;
    let useUicons = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-u' || arg === '--uicons') {
            useUicons = true;
            continue;
        }
        if (arg === '-m' || arg === '--master' || arg === '--masterfile') {
            if (i + 1 >= argv.length) {
                throw new Error('Missing value for --masterfile');
            }
            masterfilePath = argv[++i];
            continue;
        }
        positional.push(arg);
    }
    return { positional, masterfilePath, useUicons };
}

async function readMasterfile(masterfilePath, allowRemoteFallback) {
    if (masterfilePath) {
        const resolvedPath = path.resolve(masterfilePath);
        console.log('Reading masterfile from', resolvedPath);
        try {
            return await fs.promises.readFile(resolvedPath, 'utf8');
        } catch (error) {
            throw new Error(`Unable to read masterfile at ${resolvedPath}: ${error.message}`);
        }
    }

    const resolvedDefaultPath = defaultMasterfilePath;
    try {
        console.log('Reading masterfile from', resolvedDefaultPath);
        return await fs.promises.readFile(resolvedDefaultPath, 'utf8');
    } catch (error) {
        if (!allowRemoteFallback) {
            throw new Error(`Unable to read masterfile at ${resolvedDefaultPath}: ${error.message}`);
        }
        console.warn(`Unable to read masterfile at ${resolvedDefaultPath}: ${error.message}`);
    }

    const url = remoteMasterfileUrl;
    console.log('Fetching masterfile from', url);
    const response = await axios.get(url, { responseType: 'text' });
    return response.data;
}

function extractDefaultForms(masterfile) {
    const defaultForms = {};
    if (masterfile && typeof masterfile === 'object') {
        if (masterfile.defaultForms && typeof masterfile.defaultForms === 'object') {
            for (const [pokemonId, formId] of Object.entries(masterfile.defaultForms)) {
                const numericId = Number(pokemonId);
                const numericForm = Number(formId);
                if (!Number.isNaN(numericId) && !Number.isNaN(numericForm)) {
                    defaultForms[numericId] = numericForm;
                }
            }
        }
        if ((!masterfile.defaultForms || Object.keys(defaultForms).length === 0) && masterfile.pokemon && typeof masterfile.pokemon === 'object') {
            for (const [pokemonId, data] of Object.entries(masterfile.pokemon)) {
                const numericId = Number(pokemonId);
                if (Number.isNaN(numericId) || !data || typeof data !== 'object') continue;
                const candidate = data.defaultFormId ?? data.default_form_id ?? data.default_form;
                if (candidate === undefined || candidate === null) continue;
                const numericForm = Number(candidate);
                if (!Number.isNaN(numericForm)) {
                    defaultForms[numericId] = numericForm;
                }
            }
        }
    }
    return defaultForms;
}

async function loadDefaultForms(masterfilePath) {
    const raw = await readMasterfile(masterfilePath, !masterfilePath);
    let masterfile;
    try {
        masterfile = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to parse masterfile: ${error.message}`);
    }
    let defaultForms = extractDefaultForms(masterfile);
    if (Object.keys(defaultForms).length === 0) {
        console.warn('Masterfile is missing default form data, attempting remote masterfile...');
        try {
            const response = await axios.get(remoteMasterfileUrl, { responseType: 'text' });
            const fallbackData = JSON.parse(response.data);
            defaultForms = extractDefaultForms(fallbackData);
        } catch (error) {
            console.warn(`Failed to fetch remote masterfile from ${remoteMasterfileUrl}: ${error.message}`);
        }
    }
    if (Object.keys(defaultForms).length === 0) {
        throw new Error('Masterfile does not contain default form data.');
    }
    return defaultForms;
}

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
    let parsedArgs;
    try {
        parsedArgs = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        console.error('Usage: node main.js [options] <input dir> [<output dir>]');
        console.error('Options: -u/--uicons, -m/--masterfile <path>');
        process.exit(1);
    }
    let inDir = parsedArgs.positional[0];
    let outDir = parsedArgs.positional[1];
    uicons = parsedArgs.useUicons;
    prefix = uicons ? '_' : '-';
    if (!inDir) {
        console.error('Usage: node main.js [options] <input dir> [<output dir>]');
        console.error('Options: -u/--uicons, -m/--masterfile <path>');
        process.exit(1);
    }
    inDir = path.resolve(inDir);
    outDir = outDir && path.resolve(outDir);

    const masterfilePath = parsedArgs.masterfilePath
        ? path.resolve(process.cwd(), parsedArgs.masterfilePath)
        : null;
    let defaultForms;
    try {
        defaultForms = await loadDefaultForms(masterfilePath);
    } catch (error) {
        console.error(error.message);
        console.error('Run the Masterfile-Generator uicons template before executing this script or provide a custom path via --masterfile.');
        process.exit(1);
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
        "716_00":{"targets":[{"pokemonId":POGOProtos.Rpc.HoloPokemonId.XERNEAS,"form":POGOProtos.Rpc.PokemonDisplayProto.Form.XERNEAS_ACTIVE}]},
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
