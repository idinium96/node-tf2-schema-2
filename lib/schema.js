const request = require('request-retry-dayjs');
const vdf = require('vdf');

const webAPI = require('./webapi.js');
const SKU = require('tf2-sku-2');

const language = 'English';

class Schema {
    /**
     * Initializes the Schema class
     * @param {Object} data
     * @param {Object} [data.raw] Raw schema
     * @param {Number} [data.time] Time when the schema was made
     */
    constructor (data) {
        this.version = data.version || null;
        this.raw = data.raw || null;
        this.time = data.time || new Date().getTime();
    }

    /**
     * Gets sku
     * @param {string} name
     * @returns {string|null} SKU
     */
    getSkuFromName(name) {
        return SKU.fromObject(this.getItemObjectFromName(name));
    }
    /**
     * Gets sku item object
     * @param {string} name
     * @returns {object} SKU
     */
     getItemObjectFromName(name) {
        name = name.toLowerCase();
        const item = {
            defindex: null,
            quality: null,
            craftable: true
        };

        if (name.includes('strange')) {
            name = name.replace('strange', '').trim();
            item.quality = 11;
        }
        //Get all qualities
        const qualities = Object.keys(this.schema.raw.schema.qualities).reduce(
            (obj, q) => {
                obj[this.schema.raw.schema.qualityNames[q].toLowerCase()] = this.schema.raw.schema.qualities[q];
                return obj;
            },
            {}
        );
        //Try to find quality name in name
        for (const quality in qualities) {
            if (name.includes(quality)) {
                name = name.replace(quality, '').trim();
                item.quality2 = item.quality;
                item.quality = qualities[quality];
                break;
            }
        }
        

        const effects = this.schema.raw.schema.attribute_controlled_attached_particles.reduce(
            (obj, particle) => {
                obj[particle.name.toLowerCase()] = particle.id;
                return obj;
            },
            {}
        );
        //Check for effects
        for (const effect in effects) {
            if (name.includes(effect)) {
                name = name.replace(effect, '').trim();
                item.effect = effects[effect];
                //will set quality to unusual if undefined, or make it primary, it other quality exists
                if (item.quality != 5) {
                    item.quality2 = item.quality;
                    item.quality = 5;
                }
                break;
            }
        }
        name = name.replace('uncraftable', 'non-craftable');
        if (name.includes('non-craftable')) {
            item.craftable = false;
        }
        const wears = {
            '(factory new)': 1,
            '(minimal wear)': 2,
            '(field-tested)': 3,
            '(well-worn)': 4,
            '(battle scarred)': 5
        };
        for (const wear in wears) {
            if (name.includes(wear)) {
                name = name.replace(wear, '').trim();
                item.wear = wears[wear];
                break;
            }
        }
        const paintkits = Object.keys(this.schema.raw.schema.paintkits).reduce((obj, id) => {
            obj[this.schema.raw.schema.paintkits[id].toLowerCase()] = +id;
            return obj;
        }, {});
        for (const paintkit in paintkits) {
            if (name.includes(paintkit)) {
                name = name.replace(paintkit, '').trim();
                item.paintkit = paintkits[paintkit];
                if (!item.effect) {
                    item.quality = 15;
                }
                break;
            }
        }
        const killstreaks = {
            'professional killstreak': 3,
            'specialized killstreak': 2,
            killstreak: 1
        };
        for (const killstreak in killstreaks) {
            if (name.includes(killstreak)) {
                name = name.replace(killstreak, '').trim();
                item.killstreak = killstreaks[killstreak];
                break;
            }
        }
        if (name.includes('australium')) {
            name = name.replace('australium', '').trim();
            item.australium = true;
        }
        if (name.includes('festivized')) {
            name = name.replace('festivized', '').trim();
            item.festive = true;
        }
        if (item.paintkit && name.includes('war paint')) {
            name = `Paintkit ${item.paintkit}`;
            item.quality = 15;
            for (let i = 0; i < this.schema.raw.schema.items.length; i++) {
                if (this.schema.raw.schema.items[i].name == name) {
                    item.defindex = this.schema.raw.schema.items[i].defindex;
                }
            }
        } else {
            const schemaItem = this.schema.getItemByItemName(name);
            if(!schemaItem) return null;
            item.defindex = schemaItem.defindex;
            item.quality = item.quality || schemaItem.item_quality; //default quality
            if (schemaItem.item_class === 'supply_crate') {
                for(let i = 0; i < schemaItem.attributes?.length; i++) {
                    if (schemaItem.attributes[i].name === 'set supply crate series') {
                        item.crateseries = schemaItem.attributes[i].value;
                    }
                }
                if(!item.crateseries) {
                    const seriesAttribute = this.schema.raw.items_game.items[schemaItem.defindex]?.static_attrs['set supply crate series'];
                    item.crateseries = Number(seriesAttribute?.value || seriesAttribute);
                }
            }
        }
        return SKU.fromObject(item);
    }

    /**
     * Gets schema item by defindex
     * @param {Number} defindex
     * @return {Object}
     */
    getItemByDefindex (defindex) {
        const items = this.raw.schema.items;
        const itemsCount = items.length;

        let start = 0;
        let end = itemsCount - 1;
        let iterLim = Math.ceil(Math.log2(itemsCount)) + 2;
        while (start <= end) {
            if (iterLim <= 0) {
                break; // use fallback search
            }
            iterLim--;
            const mid = Math.floor((start + end) / 2);
            if (items[mid].defindex < defindex) {
                start = mid + 1;
            } else if (items[mid].defindex > defindex) {
                end = mid - 1;
            } else {
                return items[mid];
            }
        }
        for (let i = 0; i < itemsCount; i++) {
            const item = items[i];
            if (item.defindex === defindex) {
                return item;
            }
        }

        return null;
    }

    /**
     * Gets schema item by item name
     * @param {String} name
     * @return {Object}
     */
    getItemByItemName (name) {
        const items = this.raw.schema.items;
        const itemsCount = items.length;

        for (let i = 0; i < itemsCount; i++) {
            const item = items[i];
            if (name.toLowerCase() === item.item_name.toLowerCase()) {
                if (item.item_name === 'Name Tag' && item.defindex === 2093) {
                    // skip and let it find Name Tag with defindex 5020
                    continue;
                }

                if (item.quality === 0) {
                    // skip if Stock Quality
                    continue;
                }

                return item;
            }
        }

        return null;
    }

    /**
     * Gets schema item by sku
     * @param {String} sku
     * @return {Object}
     */
    getItemBySKU(sku) {
        return this.getItemByDefindex(SKU.fromString(sku).defindex);
    }

    /**
     * Gets schema attribute by defindex
     * @param {Number} defindex
     * @return {Object}
     */
    getAttributeByDefindex (defindex) {
        const attributes = this.raw.schema.attributes;
        const attributesCount = attributes.length;

        let start = 0;
        let end = attributesCount - 1;
        let iterLim = Math.ceil(Math.log2(attributesCount)) + 2;

        while (start <= end) {
            if (iterLim <= 0) {
                break; // use fallback search
            }
            iterLim--;
            const mid = Math.floor((start+end) / 2);
            if (attributes[mid].defindex < defindex) {
                start = mid + 1;
            } else if (attributes[mid].defindex > defindex) {
                end = mid - 1;
            } else {
                return attributes[mid];
            }
        }

        for (let i = 0; i < attributesCount; i++) {
            const attribute = attributes[i];
            if (attribute.defindex === defindex) {
                return attribute;
            }
        }

        return null;
    }

    /**
     * Gets quality name by id
     * @param {Number} id
     * @return {String}
     */
    getQualityById (id) {
        const qualities = this.raw.schema.qualities;

        for (const type in qualities) {
            if (!Object.prototype.hasOwnProperty.call(qualities, type)) {
                continue;
            }

            if (qualities[type] === id) {
                return this.raw.schema.qualityNames[type];
            }
        }

        return null;
    }

    /**
     * Gets quality id by name
     * @param {String} name
     * @return {Number}
     */
    getQualityIdByName (name) {
        const qualityNames = this.raw.schema.qualityNames;

        for (const type in qualityNames) {
            if (!Object.prototype.hasOwnProperty.call(qualityNames, type)) {
                continue;
            }

            if (name.toLowerCase() === qualityNames[type].toLowerCase()) {
                return this.raw.schema.qualities[type];
            }
        }

        return null;
    }

    /**
     * Gets effect name by id
     * @param {Number} id
     * @return {String}
     */
    getEffectById (id) {
        const particles = this.raw.schema.attribute_controlled_attached_particles;
        const particlesCount = particles.length;

        let start = 0;
        let end = particlesCount - 1;
        let iterLim = Math.ceil(Math.log2(particlesCount)) + 2;
        while (start <= end) {
            if (iterLim <= 0) {
                break; // use fallback search
            }
            iterLim--;
            const mid = Math.floor((start+end) / 2);
            if (particles[mid].id < id) {
                start = mid + 1;
            } else if (particles[mid].id > id) {
                end = mid - 1;
            } else {
                return particles[mid].name;
            }
        }

        for (let i = 0; i < particlesCount; i++) {
            const effect = particles[i];

            if (effect.id === id) {
                return effect.name;
            }
        }

        return null;
    }

    /**
     * Gets effect id by name
     * @param {String} name
     * @return {Number}
     */
    getEffectIdByName (name) {
        const particles = this.raw.schema.attribute_controlled_attached_particles;
        const particlesCount = particles.length;

        for (let i = 0; i < particlesCount; i++) {
            const effect = particles[i];

            if (name.toLowerCase() === effect.name.toLowerCase()) {
                return effect.id;
            }
        }

        return null;
    }

    /**
     * Gets skin name by id
     * @param {Number} id
     * @return {String}
     */
    getSkinById (id) {
        const paintkits = this.raw.schema.paintkits;

        if (!Object.prototype.hasOwnProperty.call(paintkits, id)) {
            return null;
        }

        return paintkits[id];
    }

    /**
     * Gets skin id by name
     * @param {String} name
     * @return {Number}
     */
    getSkinIdByName (name) {
        const paintkits = this.raw.schema.paintkits;

        for (const id in paintkits) {
            if (!Object.prototype.hasOwnProperty.call(paintkits, id)) {
                continue;
            }

            if (name.toLowerCase() === paintkits[id].toLowerCase()) {
                return parseInt(id);
            }
        }

        return null;
    }

    /**
     * Gets the name and the id of unusual effects
     * @return {Array} of objects containing name and the id properties
     */
    getUnusualEffects() {
        return this.raw.schema.attribute_controlled_attached_particles.map(v => {
            return { name: v.name, id: v.id };
        });
    }

    /**
     * Gets paint name by Decimal numeral system
     * @param {Number} decimal 
     * @return {String} paint name 
     */
    getPaintNameByDecimal (decimal) {
        const paintCans = this.raw.schema.items.filter(
            item => item.name.includes('Paint Can') && item.name !== 'Paint Can'
        );

        const paintCansCount = paintCans.length;

        for (let i = 0; i < paintCansCount; i++) {
            const paint = paintCans[i];
            if (paint.attributes === undefined) {
                continue;
            }

            if (paint.attributes.some(att => att.value === decimal)) {
                return paint.item_name;
            }
        }

        return null;
    }

    /**
     * Gets paint Decimal numeral system by name
     * @param {String} name
     * @return {Number} decimal
     */
    getPaintDecimalByName (name) {
        const paintCans = this.raw.schema.items.filter(
            item => item.name.includes('Paint Can') && item.name !== 'Paint Can'
        );

        const paintCansCount = paintCans.length;

        for (let i = 0; i < paintCansCount; i++) {
            const paint = paintCans[i];
            if (paint.attributes === undefined) {
                continue;
            }

            if (name.toLowerCase() === paint.item_name.toLowerCase()) {
                return paint.attributes[0].value;
            }
        }

        return null;
    }

    /**
     * Gets the name and partial sku for painted items
     * @return {Object} { [name]: "p#" }
     */
    getPaints() {
        const paintCans = this.raw.schema.items.filter(
            item => item.name.includes('Paint Can') && item.name !== 'Paint Can'
        );

        const toObject = {};
        const paintCansCount = paintCans.length;
    
        for (let i = 0; i < paintCansCount; i++) {
            if (paintCans[i].attributes === undefined) {
                continue;
            }
    
            toObject[paintCans[i].item_name] = `p${paintCans[i].attributes[0].value}`;
        }
    
        return toObject;
    }

    /**
     * Gets an array of paintable items' defindex
     * @return {Array} - paintable items defindex (Numbers)
     */
    getPaintableItemDefindexes() {
        return this.raw.schema.items
            .filter(item => {
                if (item.capabilities) {
                    if (item.capabilities.paintable === true) {
                        return item;
                    }
                }
            })
            .map(item => item.defindex);
    }

    /**
     * Gets the name and partial sku for strange parts items
     * @return {Object} { [name]: sp# }
     */
    getStrangeParts() {
        const toObject = {};
    
        // Filter out built-in parts and also filter repeated "Kills"
        const parts = this.raw.schema.kill_eater_score_types.filter(
            part =>
                ![
                    'Ubers',
                    'Kill Assists',
                    'Sentry Kills',
                    'Sodden Victims',
                    'Spies Shocked',
                    'Heads Taken',
                    'Humiliations',
                    'Gifts Given',
                    'Deaths Feigned',
                    'Buildings Sapped',
                    'Tickle Fights Won',
                    'Opponents Flattened',
                    'Food Items Eaten',
                    'Banners Deployed',
                    'Seconds Cloaked',
                    'Health Dispensed to Teammates',
                    'Teammates Teleported',
                    'KillEaterEvent_UniquePlayerKills',
                    'Points Scored',
                    'Double Donks',
                    'Teammates Whipped',
                    'Wrangled Sentry Kills',
                    'Carnival Kills',
                    'Carnival Underworld Kills',
                    'Carnival Games Won',
                    'Contracts Completed',
                    'Contract Points',
                    'Contract Bonus Points',
                    'Times Performed',
                    'Kills and Assists during Invasion Event',
                    'Kills and Assists on 2Fort Invasion',
                    'Kills and Assists on Probed',
                    'Kills and Assists on Byre',
                    'Kills and Assists on Watergate',
                    'Souls Collected',
                    'Merasmissions Completed',
                    'Halloween Transmutes Performed',
                    'Power Up Canteens Used',
                    'Contract Points Earned',
                    'Contract Points Contributed To Friends'
                ].includes(part.type_name) && ![0, 97].includes(part.type)
        );
    
        const partsCount = parts.length;

        for (let i = 0; i < partsCount; i++) {
            toObject[parts[i].type_name] = `sp${parts[i].type}`;
        }
    
        return toObject;
    }

    /**
     * Get an array of item objects for craftable weapons
     * @return {Array} Array\<SchemaItem\> for craftable weapons
     */
    getCraftableWeaponsSchema() {
        return this.raw.schema.items
            .filter(
                item =>
                    ![
                        // Exclude these weapons
                        266, // Horseless Headless Horsemann's Headtaker
                        452, // Three-Rune Blade
                        466, // Maul
                        474, // Conscientious Objector
                        572, // Unarmed Combat
                        574, // Wanga Prick
                        587, // Apoco-Fists
                        638, // Sharp Dresser
                        735, // Sapper
                        736, // Sapper
                        737, // Construction PDA
                        851, // AWPer Hand
                        880, // Freedom Staff
                        933, // Ap-Sap
                        939, // Bat Outta Hell
                        947, // Quäckenbirdt
                        1013, // Ham Shank
                        1152, // Grappling Hook
                        30474 // Nostromo Napalmer
                    ].includes(item.defindex) &&
                    item.item_quality === 6 &&
                    item.craft_class === 'weapon'
            );
    }

    /**
     * Get an array of SKU for craftable weapons by class used for crafting
     * @param {String} charClass Valid input: "Scout", "Soldier", "Pyro", "Demoman", "Heavy", "Engineer", "Medic", "Sniper", "Spy"
     * @return {Array} Array\<string\> (sku) for craftable weapons by class
     */
    getWeaponsForCraftingByClass(charClass) {
        if (!['Scout', 'Soldier', 'Pyro', 'Demoman', 'Heavy', 'Engineer', 'Medic', 'Sniper', 'Spy'].includes(charClass)) {
            throw new Error(
                `Entered class "${charClass}" is not a valid character class.` +
                `\nValid character classes (case sensitive): "Scout", "Soldier", "Pyro", "Demoman", "Heavy", "Engineer", "Medic", "Sniper", "Spy".`
            );
        }

        return this.getCraftableWeaponsSchema()
            .filter(item => item.used_by_classes.includes(charClass))
            .map(item => `${item.defindex};6`);
    }

    /**
     * Get an array of SKU for Craftable weapons used for trading
     * @return {Array} Array\<string\> (sku) for Craftable weapons, including weapons from Jungle Inferno update
     */
    getCraftableWeaponsForTrading() {
        return this.getCraftableWeaponsSchema()
            .map(item => `${item.defindex};6`)
            .concat(
                [1178, 1179, 1180, 1181, 1190].map(def => `${def};6`)
            );
    }

    /**
     * Get an array of SKU for Non-Craftable weapons used for trading
     * @return {Array} Array\<string\> (sku) for Non-Craftable weapons,
     * excluding Non-Craftable Sharpened Volcano Fragment and Non-Craftable Sun-on-a-Stick
     */
    getUncraftableWeaponsForTrading() {
        return this.getCraftableWeaponsSchema()
            .filter(item => ![348, 349].includes(item.defindex))
            .map(item => `${item.defindex};6;uncraftable`);
    }

    /**
     * Gets the name of an item with specific attributes
     * @param {Object} item
     * @param {Number} item.defindex
     * @param {Number} item.quality
     * @param {Boolean} [item.craftable]
     * @param {Boolean} [item.tradable]
     * @param {Number} [item.killstreak]
     * @param {Boolean} [item.australium]
     * @param {Number} [item.effect]
     * @param {Boolean} [item.festive]
     * @param {Boolean} [item.paintkit]
     * @param {Boolean} [item.wear]
     * @param {Boolean} [item.quality2]
     * @param {Number} [item.craftnumber]
     * @param {Number} [item.crateseries]
     * @param {Number} [item.target]
     * @param {Number} [item.output]
     * @param {Number} [item.outputQuality]
     * @param {Number} [item.paint]
     * @param {Boolean} [proper = true] Use proper name when true (adds "The" if proper_name in schema is true)
     * @return {String}
     */
    getName (item, proper = true) {
        const schemaItem = this.getItemByDefindex(item.defindex);
        if (schemaItem === null) {
            return null;
        }

        let name = '';

        if (item.tradable === false) {
            name = 'Non-Tradable ';
        }

        if (item.craftable === false) {
            name += 'Non-Craftable ';
        }

        if (item.quality2) {
            // Elevated quality
            name += this.getQualityById(item.quality2) + ' ';
        }

        if ((item.quality !== 6 && item.quality !== 15 && item.quality !== 5) || (item.quality === 5 && !item.effect) || schemaItem.item_quality == 5) {
            // If the quality is not Unique, Decorated, or Unusual, or if the quality is Unusual but it does not have an effect, or if the item can only be unusual, then add the quality
            name += this.getQualityById(item.quality) + ' ';
        }

        if (item.effect) {
            name += this.getEffectById(item.effect) + ' ';
        }

        if (item.festive === true) {
            name += 'Festivized ';
        }

        if (item.killstreak && item.killstreak > 0) {
            name += ['Killstreak', 'Specialized Killstreak', 'Professional Killstreak'][item.killstreak - 1] + ' ';
        }

        if (item.target) {
            name += this.getItemByDefindex(item.target).item_name + ' ';
        }

        if (item.outputQuality && item.outputQuality !== 6) {
            name = this.getQualityById(item.outputQuality) + ' ' + name;
        }

        if (item.output) {
            name += this.getItemByDefindex(item.output).item_name + ' ';
        }

        if (item.australium === true) {
            name += 'Australium ';
        }

        if (item.paintkit) {
            name += this.getSkinById(item.paintkit) + ' | ';
        }

        if (proper === true && name === '' && schemaItem.proper_name == true) {
            name = 'The ';
        }

        name += schemaItem.item_name;

        if (item.wear) {
            name += ' (' + ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle Scarred'][item.wear - 1] + ')';
        }

        if (item.crateseries) {
            name += ' #' + item.crateseries;
        }

        if (item.craftnumber) {
            name = '#' + item.craftnumber + ' ' + name;
        }

        if (item.paint) {
            name += ` (Paint: ${this.getPaintNameByDecimal(item.paint)})`
        }

        return name;
    }

    /**
     * Gets schema overview
     * @param {String} apiKey
     * @param {Function} callback
     */
    static getOverview (apiKey, callback) {
        webAPI('GET', 'GetSchemaOverview', 'v0001', {
            key: apiKey,
            language: language
        }, function (err, result) {
            if (err) {
                return callback(err);
            }

            return callback(null, result);
        });
    }

    /**
     * Gets schema items
     * @param {String} apiKey
     * @param {Function} callback
     */
    static getItems (apiKey, callback) {
        getAllSchemaItems(apiKey, callback);
    }

    /**
     * Gets skins / paintkits from TF2 protodefs
     * @param {Function} callback
     */
    static getPaintKits (callback) {
        request({
            method: 'GET',
            url: 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-TF2/master/tf/resource/tf_proto_obj_defs_english.txt',
            gzip: true
        }, function (err, response, body) {
            if (err) {
                return callback(err);
            }

            const parsed = vdf.parse(body);

            const protodefs = parsed['lang'].Tokens;

            const paintkits = [];

            for (const protodef in protodefs) {
                if (!Object.prototype.hasOwnProperty.call(protodefs, protodef)) {
                    continue;
                }

                const parts = protodef.slice(0, protodef.indexOf(' ')).split('_');
                if (parts.length !== 3) {
                    continue;
                }

                const type = parts[0];
                if (type !== '9') {
                    continue;
                }

                const def = parts[1];
                const name = protodefs[protodef];

                if (name.startsWith(def + ':')) {
                    continue;
                }

                paintkits.push({
                    id: def,
                    name: name
                });
            }

            paintkits.sort(function (a, b) {
                return a.id - b.id;
            });

            const paintkitObj = {};
            const paintkitsCount = paintkits.length;

            for (let i = 0; i < paintkitsCount; i++) {
                const paintkit = paintkits[i];
                paintkitObj[paintkit.id] = paintkit.name;
            }

            return callback(null, paintkitObj);
        });
    }

    static getItemsGame (callback) {
        request({
            method: 'GET',
            url: 'https://raw.githubusercontent.com/SteamDatabase/GameTracking-TF2/master/tf/scripts/items/items_game.txt',
            gzip: true
        }, function (err, response, body) {
            if (err) {
                return callback(err);
            }

            return callback(null, vdf.parse(body).items_game);
        });
    }

    /**
     * Creates data object used for initializing class
     * @return {Object}
     */
    toJSON () {
        return {
            version: this.version,
            time: this.time,
            raw: this.raw
        };
    }
}

/**
 * Recursive function that requests all schema items
 * @param {String} apiKey
 * @param {Number} next
 * @param {Array} items
 * @param {Function} callback
 */
function getAllSchemaItems (apiKey, next, items, callback) {
    if (callback === undefined) {
        callback = next;
        next = 0;
    }

    const input = {
        language: language,
        key: apiKey,
        start: next
    };

    webAPI('GET', 'GetSchemaItems', 'v0001', input, function (err, result) {
        if (err) {
            return callback(err);
        }

        items = (items || []).concat(result.items);

        if (result.next !== undefined) {
            getAllSchemaItems(apiKey, result.next, items, callback);
        } else {
            callback(null, items);
        }
    });
}

module.exports = Schema;
