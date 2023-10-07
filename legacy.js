// This file processes legacy assets pushed on Jul 3, 2021, which is when it was last updated
// pogo_assets commit 64e9cc52baf55afc45484a4f39cdbd05d06d4453

const fs = require('fs');
const path = require('path');
const util = require('util');

const axios = require('axios');
const POGOProtos = require('@na-ji/pogo-protos');

class PartialPokemonDisplay {
    // costume and shiny will not appear in gamemaster
    constructor(pokemonId, gender = 0, form = 0, evolution = 0) {
        this.pokemonId = pokemonId;
        this.gender = gender;
        this.form = form;
        this.evolution = evolution;
    }

    filename(costume = 0, shiny = false) {
        let result = String(this.pokemonId);
        if (this.evolution) {
            result += '-e' + this.evolution;
        }
        if (this.form) {
            result += '-f' + this.form;
            if (this.evolution) console.warn(
                'Found entry with both evolution and form set. This would not be compatible with addressable assets.');
        }
        if (costume) {
            result += '-c' + costume;
        }
        if (this.gender) {
            result += '-g' + this.gender;
        }
        if (shiny) {
            result += '-shiny';
        }
        return result;
    }

    [util.inspect.custom](depth, opts) {
        return this.filename();
    }
}

function changeGender(other, gender = POGOProtos.Rpc.PokemonDisplayProto.Gender.FEMALE) {
    return new PartialPokemonDisplay(other.pokemonId, gender, other.form, other.evolution);
}

function createFormTargets(formLookup, suffix) {
    let formTargets = formLookup[suffix];
    if (formTargets && formTargets.fallback) {
        console.warn('Found', suffix, 'in the gamemaster. Fallback rule will be deactivated.')
        formTargets = undefined;
    }
    return formTargets === undefined ? (formLookup[suffix] = {
        targets: [],
        female: true
    }) : formTargets;
}

function extractFormTargets(formLookup, template, pokemonId, computeSuffix, field = 'form') {
    const pokemonIdString = String(pokemonId).padStart(3, '0');
    const formSettings = template.data[Object.keys(template.data)[1]];
    const forms = formSettings[Object.keys(formSettings)[1]];
    if (forms === undefined) {
        createFormTargets(formLookup, pokemonIdString + '_01').targets.push(
            new PartialPokemonDisplay(pokemonId, POGOProtos.Rpc.PokemonDisplayProto.Gender.FEMALE));
        const formTargets = createFormTargets(formLookup, pokemonIdString + '_00');
        formTargets.targets.push(new PartialPokemonDisplay(pokemonId));
        formTargets.female = false;
        return;
    }
    let defaultAssetBundleSuffix = undefined;
    for (const formData of forms) {
        const keys = Object.keys(formData);
        if (keys.length === 0) continue;
        const form = formData[keys[0]];
        const formId = computeSuffix(form);
        if (!formId) {
            console.warn('Unrecognized', field, form);
            continue;
        }
        let assetBundleSuffix = formData.assetBundleSuffix || formData.assetBundleValue || 0;
        if (defaultAssetBundleSuffix === assetBundleSuffix && field === 'form') {
            continue;   // we expect the client to fallback automatically
        }
        const target = new PartialPokemonDisplay(pokemonId);
        if (defaultAssetBundleSuffix === undefined && field === 'form') {
            // the game uses the first form for Pokedex images
            defaultAssetBundleSuffix = assetBundleSuffix;
        }
        target[field] = formId;
        if (Number.isInteger(assetBundleSuffix)) {  // is actually assetBundleValue
            if (assetBundleSuffix === 0 && ![592, 593, 668, 678, 710, 711, 720].includes(pokemonId)) {
                createFormTargets(formLookup, pokemonIdString + '_01').targets.push(changeGender(target));
            }
            assetBundleSuffix = pokemonIdString + '_' + String(assetBundleSuffix).padStart(2, '0');
        } else if (assetBundleSuffix.indexOf('_00_') >= 0) {
            createFormTargets(formLookup, assetBundleSuffix.replace('_00_', '_01_')).targets.push(changeGender(target));
        }
        const formTargets = createFormTargets(formLookup, assetBundleSuffix);
        formTargets.targets.push(target);
        formTargets.female = false;
    }
}

(async () => {
    console.log('Reading game master...');
    const formLookup = {
        '065_51': {
            targets: [new PartialPokemonDisplay(65, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '115_51': {
            targets: [new PartialPokemonDisplay(115, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '127_51': {
            targets: [new PartialPokemonDisplay(127, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '142_51': {
            targets: [new PartialPokemonDisplay(142, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '150_51': {
            targets: [new PartialPokemonDisplay(150, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA_X)],
            fallback: true
        },
        '150_52': {
            targets: [new PartialPokemonDisplay(150, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA_Y)],
            fallback: true
        },
        '302_51': {
            targets: [new PartialPokemonDisplay(302, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '303_51': {
            targets: [new PartialPokemonDisplay(303, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '319_51': {
            targets: [new PartialPokemonDisplay(319, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '351_00': {
            targets: [new PartialPokemonDisplay(351)],
            fallback: true
        },
        '354_51': {
            targets: [new PartialPokemonDisplay(354, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '384_51': {
            targets: [new PartialPokemonDisplay(384, 0, 0, POGOProtos.Rpc.HoloTemporaryEvolutionId.TEMP_EVOLUTION_MEGA)],
            fallback: true
        },
        '493_00': { // 493_11 is missing
            targets: [new PartialPokemonDisplay(493)],
            fallback: true
        },
    };
    const gameMaster = (await axios.get('https://raw.githubusercontent.com/PokeMiners/game_masters/b7d1c6f90e47471599e21d95daf2449172d5cafc/latest/latest.json')).data;
    for (const template of gameMaster) {
        if (template.templateId.startsWith('FORMS_V')) {
            const pokemonId = parseInt(template.templateId.substr(7, 4));
            if (!pokemonId) {
                console.warn('Unrecognized templateId', template.templateId);
            } else {
                extractFormTargets(formLookup, template, pokemonId, (form) => POGOProtos.Rpc.PokemonDisplayProto.Form[form]);
            }
        } else if (template.templateId.startsWith('TEMPORARY_EVOLUTION_V')) {
            const pokemonId = parseInt(template.templateId.substr(21, 4));
            if (!pokemonId) {
                console.warn('Unrecognized templateId', template.templateId);
            } else {
                extractFormTargets(formLookup, template, pokemonId, (evolution) => {
                    return POGOProtos.Rpc.HoloTemporaryEvolutionId[evolution];
                }, 'evolution');
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

    // remove unnecessary assets from the output
    for (const key of ['201']) delete formLookup[key];

    await fs.promises.writeFile('legacy.json', JSON.stringify(formLookup));

    const legacyDir = path.resolve(path.join(__dirname, 'legacy'));
    for (const filename of await fs.promises.readdir(legacyDir)) {
        if (!filename.endsWith('.png')) continue;
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
        let match;
        if (formTargets === null || (match = /^(?:_(\d+))?(_shiny)?(_old[12]?)?\.png$/.exec(suffix)) === null) {
            console.warn('Unrecognized/unused asset', filename);
            continue;
        }
        let targets = formTargets.targets;
        if (targets.length > 1) console.warn('Multiple targets found for asset', filename, targets);
        formTargets.hit = true;
        if (match[3] !== undefined && targets[0].pokemonId !== 716) {
            console.warn('Unrecognized old asset', filename);
        }
    }
    let arceusFixed = true;
    for (const [suffix, data] of Object.entries(formLookup)) {
        if (!data.hit && !data.female) {
            if (suffix === '493_11') {
                arceusFixed = false;
            } else {
                console.warn('Found form/temporary evolution with no matching assets', suffix, data);
            }
        }
    }
    if (arceusFixed) {
        console.warn('Asset for Arceus normal form has been added');
    }
})();
