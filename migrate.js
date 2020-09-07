const fs = require('fs');
const path = require('path');

const POGOProtos = require('pogo-protos');
const gameMaster = require('pokemongo-game-master');

function pokeFilename(pokemonId, evolution = 0, form = 0, costume = 0, gender = 0, shiny = false) {
    let result = String(pokemonId);
    if (evolution) {
        result += '-e' + evolution;
    }
    if (form) {
        result += '-f' + form;
    }
    if (costume) {
        result += '-c' + costume;
    }
    if (gender) {
        result += '-g' + gender;
    }
    if (shiny) {
        result += '-shiny';
    }
    return result;
}

function extractForms(pokemon, template, pokemonId, computeSuffix, field = 'forms') {
    const formSettings = template.data[Object.keys(template.data)[1]];
    let forms = formSettings[Object.keys(formSettings)[1]];
    if (forms === undefined) {
        const pokemonName = template.templateId.split('_POKEMON_', 2)[1];
        forms = [{
            "form": pokemonName + '_NORMAL'
        }, {
            "form": pokemonName + '_SHADOW'
        }, {
            "form": pokemonName + '_PURIFIED'
        }];
    }
    const result = [];
    for (const formData of forms) {
        const form = formData[Object.keys(formData)[0]];
        const formId = computeSuffix(form);
        if (formId) {
            result.push(formId);
        } else {
            console.warn('Unrecognized form/temp evolution', form);
        }
    }
    if (pokemon[pokemonId] === undefined) {
        pokemon[pokemonId] = {};
    }
    pokemon[pokemonId][field] = result;
}

const converters = {
    pmsf: async function (inDir, outDir, pokemon) {
        const outputs = {};
        const maxCostume = Math.max.apply(null, Object.values(POGOProtos.Enums.Costume));
        for (const filename of await fs.promises.readdir(inDir)) {
            let match = /^pokemon_icon_(\d{3,})(?:_00)?(?:_([1-9]\d*))?(?:_([1-9]\d*))?(_shiny)?\.png$/.exec(filename);
            if (match === null) {
                if (filename.startsWith('pokemon_icon_') && filename.endsWith('.png')) {
                    console.warn('Unrecognized file', filename);
                }
                continue;
            }
            let pokemonId = parseInt(match[1]);
            const field1 = parseInt(match[2]);
            const field2 = parseInt(match[3]);
            let pokemonEntry = pokemon[pokemonId];
            let output;
            let overrideActive = '';
            if (pokemonEntry) {
                let evolution = 0;
                let form = 0;
                let costume = 0;
                if (!isNaN(field1)) {
                    if ((pokemonEntry.forms || []).indexOf(field1) >= 0) {
                        form = field1;
                        if (!isNaN(field2)) {
                            if ((pokemonEntry.evolutions || []).indexOf(field2) >= 0) {
                                evolution = field2;
                            } else if (field2 <= maxCostume) {
                                costume = field2;
                            } else {
                                console.warn('Unrecognized field', field2, 'in', filename);
                                continue;
                            }
                        }
                    } else if ((pokemonEntry.evolutions || []).indexOf(field1) >= 0) {
                        evolution = field1;
                        if (!isNaN(field2)) {
                            if (field2 <= maxCostume) {
                                costume = field2;
                            } else {
                                console.warn('Unrecognized field', field2, 'in', filename);
                                continue;
                            }
                        }
                    } else if (field1 <= maxCostume) {
                        costume = field1;
                    } else {
                        console.warn('Unrecognized field', field1, 'in', filename);
                        continue;
                    }
                }
                if (form !== 0 && form === pokemonEntry.forms[0]) {
                    form = 0;
                    overrideActive = 'pokemon_icon_' + match[1] + '_00';
                    if (match[3]) {
                        overrideActive += '_' + match[3];
                    }
                    if (match[4]) {
                        overrideActive += match[4];
                    }
                    overrideActive += '.png';
                }
                output = pokeFilename(pokemonId, evolution, form, costume, 0, match[4] !== undefined);
            } else if (isNaN(field1) && isNaN(field2)) {
                output = pokeFilename(pokemonId);
            } else {
                console.warn('Unrecognized pokemon', filename);
                continue;
            }
            if (outputs[output] && outputs[output] !== overrideActive) {
                console.warn('Duplicate found for', output, ':', outputs[output], '!=', filename, overrideActive);
            } else {
                outputs[output] = filename;
            }
            await fs.promises.copyFile(path.join(inDir, filename), path.join(outDir, output + '.png'));
        }
    },
    rdm: async function (inDir, outDir, pokemon) {
        console.error('Not supported yet lol');
        process.exit(1);
    },
};

(async () => {
    let format = converters[process.argv[2]];
    let inDir = process.argv[3];
    let outDir = process.argv[4];
    if (!format || !inDir || !outDir) {
        console.error('Usage: node migrate.js <pmsf|rdm> <input dir> <output dir>');
        process.exit(1);
    }
    inDir = path.resolve(inDir);
    outDir = path.resolve(outDir);

    console.log('Reading game master...');
    const pokemon = {};
    const gameMasterContent = await gameMaster.getVersion('latest', 'json');
    for (const template of gameMasterContent.template) {
        if (template.templateId.startsWith('FORMS_V')) {
            const pokemonId = parseInt(template.templateId.substr(7, 4));
            if (!pokemonId) {
                console.warn('Unrecognized templateId', template.templateId);
            } else {
                extractForms(pokemon, template, pokemonId, (form) => POGOProtos.Enums.Form[form]);
            }
        } else if (template.templateId.startsWith('TEMPORARY_EVOLUTION_V')) {
            const pokemonId = parseInt(template.templateId.substr(21, 4));
            if (!pokemonId) {
                console.warn('Unrecognized templateId', template.templateId);
            } else {
                extractForms(pokemon, template, pokemonId, (evolution) => {
                    // <RANDOMIZED_NAME>_TEMP_EVOLUTION_<NAME> => EVOLUTION_<NAME>
                    return POGOProtos.Enums.PokemonEvolution[evolution.split('_TEMP_', 2)[1]];
                }, 'evolutions');
            }
        }
    }
    if (pokemon[18].evolutions) {
        console.warn('Pidgeotto mega fixed')
    } else {
        pokemon[18].evolutions = [POGOProtos.Enums.PokemonEvolution.EVOLUTION_MEGA];
    }
    pokemon[POGOProtos.Enums.PokemonId.PONYTA].forms.push(POGOProtos.Enums.Form.PONYTA_GALARIAN);
    pokemon[POGOProtos.Enums.PokemonId.RAPIDASH].forms.push(POGOProtos.Enums.Form.RAPIDASH_GALARIAN);
    pokemon[POGOProtos.Enums.PokemonId.SLOWPOKE].forms.push(POGOProtos.Enums.Form.SLOWPOKE_GALARIAN);
    pokemon[POGOProtos.Enums.PokemonId.SLOWBRO].forms.push(POGOProtos.Enums.Form.SLOWBRO_GALARIAN);
    pokemon[POGOProtos.Enums.PokemonId.MR_MIME].forms.push(POGOProtos.Enums.Form.MR_MIME_GALARIAN);
    pokemon[POGOProtos.Enums.PokemonId.CORSOLA].forms.push(POGOProtos.Enums.Form.CORSOLA_GALARIAN);
    pokemon[POGOProtos.Enums.PokemonId.YAMASK].forms.push(POGOProtos.Enums.Form.YAMASK_GALARIAN);

    await fs.promises.mkdir(outDir, { recursive: true });
    await format(inDir, outDir, pokemon);
})();
