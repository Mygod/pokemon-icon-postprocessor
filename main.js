const child_process = require("child_process");
const fs = require('fs');
const path = require('path');

const POGOProtos = require('pogo-protos');
const gameMaster = require('pokemongo-game-master');

function createFormTargets(formLookup, suffix) {
    let formTargets = formLookup[suffix];
    if (formTargets && formTargets.fallback) {
        console.warn('Found', suffix, 'in the gamemaster. Fallback rule will be deactivated.')
        formTargets = undefined;
    }
    if (formTargets === undefined) {
        return formLookup[suffix] = {
            targets: [],
            female: true
        };
    } else {
        console.warn('Multiple targets found for asset', suffix);
        return formTargets;
    }
}

function extractFormTargets(formLookup, template, pokemonId, computeSuffix, separator = '_') {
    const pokemonIdString = String(pokemonId).padStart(3, '0');
    const formSettings = template.data[Object.keys(template.data)[1]];
    let forms = formSettings[Object.keys(formSettings)[1]];
    if (forms === undefined) {
        let pokemon = template.templateId.split('_POKEMON_', 2)[1];
        forms = [{
            "form": pokemon + "_NORMAL"
        }];
    }
    for (const formData of forms) {
        const keys = Object.keys(formData);
        const form = formData[keys[0]];
        if (form.endsWith("_SHADOW") || form.endsWith("_PURIFIED")) {
            continue;
        }
        const formId = computeSuffix(form);
        if (!formId) {
            console.warn('Unrecognized form/temp evolution', form);
            continue;
        }
        const target = pokemonIdString + separator + formId;
        let assetBundleSuffix = formData[keys[1]] || 0;
        if (Number.isInteger(assetBundleSuffix)) {  // is actually assetBundleValue
            if (assetBundleSuffix === 0) {
                createFormTargets(formLookup, pokemonIdString + '_01').targets.push(target + '_female');
            }
            assetBundleSuffix = pokemonIdString + '_' + String(assetBundleSuffix).padStart(2, '0');
        } else if (assetBundleSuffix.indexOf('_00_') >= 0) {
            createFormTargets(formLookup, assetBundleSuffix.replace('_00_', '_01_')).targets.push(target + '_female');
        }
        let formTargets = createFormTargets(formLookup, assetBundleSuffix);
        formTargets.targets.push(target);
        formTargets.female = false;
    }
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
    if (!inDir || !outDir) {
        console.error('Usage: node main.js <input dir> <output dir>');
        process.exit(1);
    }
    inDir = path.resolve(inDir);
    outDir = path.resolve(outDir);

    console.log('Reading game master...');
    const formLookup = {
        '000': {    // substitute is not in gameMaster
            targets: ['000']
        },
        '018_51': {
            targets: ['018_v' + POGOProtos.Enums.PokemonEvolution.EVOLUTION_MEGA],
            fallback: true
        },
        '077_31': {
            targets: ['077_' + POGOProtos.Enums.Form.PONYTA_GALARIAN],
            fallback: true
        },
        '078_31': {
            targets: ['077_' + POGOProtos.Enums.Form.RAPIDASH_GALARIAN],
            fallback: true
        },
        '079_31': {
            targets: ['077_' + POGOProtos.Enums.Form.SLOWBRO_GALARIAN],
            fallback: true
        },
    };
    const gameMasterContent = await gameMaster.getVersion('latest', 'json');
    for (const template of gameMasterContent.template) {
        if (template.templateId.startsWith('FORMS_V')) {
            const pokemonId = parseInt(template.templateId.substr(7, 4));
            if (!pokemonId) {
                console.warn('Unrecognized templateId', template.templateId);
            } else {
                extractFormTargets(formLookup, template, pokemonId, (form) => POGOProtos.Enums.Form[form]);
            }
        } else if (template.templateId.startsWith('TEMPORARY_EVOLUTION_V')) {
            const pokemonId = parseInt(template.templateId.substr(21, 4));
            if (!pokemonId) {
                console.warn('Unrecognized templateId', template.templateId);
            } else {
                extractFormTargets(formLookup, template, pokemonId, (evolution) => {
                    // <RANDOMIZED_NAME>_TEMP_EVOLUTION_<NAME> => EVOLUTION_<NAME>
                    return POGOProtos.Enums.PokemonEvolution[evolution.split('_TEMP_', 2)[1]];
                }, '_v');
            }
        }
    }
    for (const suffix1 of Object.keys(formLookup)) {
        for (const suffix2 of Object.keys(formLookup)) {
            if (suffix1 !== suffix2 && suffix1.startsWith(suffix2)) {
                console.error('Illegal combinations found', suffix1, suffix2);
                process.exit(1);
            }
        }
    }

    await fs.promises.mkdir(outDir, { recursive: true });
    for (const filename of await fs.promises.readdir(inDir)) {
        if (!filename.startsWith('pokemon_icon_')) {
            continue;
        }
        const name = filename.substr(13);
        let suffix;
        let formTargets = null;
        for (const [prefix, data] of Object.entries(formLookup)) {
            if (name.startsWith(prefix)) {
                suffix = name.substr(prefix.length);
                formTargets = data;
                break;  // we can break since we have done the check
            }
        }
        if (formTargets === null) {
            if (/^\d{3,}_00(_shiny)?\./.test(name)) {
                console.log('Found unreferenced default asset', filename);
                convert(inDir, filename, path.join(outDir, filename));
            } else {
                console.warn('Unrecognized/unused asset', filename);
            }
            continue;
        }
        formTargets.hit = true;
        let output = null;
        for (const target of formTargets.targets) {
            const targetPath = path.join(outDir, 'pokemon_icon_' + target + suffix);
            if (output !== null) {
                await fs.promises.copyFile(output, targetPath);
            } else if (convert(inDir, filename, targetPath)) {
                output = targetPath;
            }
        }
    }

    for (const [suffix, data] of Object.entries(formLookup)) {
        if (!data.hit && !data.female) {
            console.warn('Found form/temporary evolution with no matching assets', suffix, data);
        }
    }
})();
