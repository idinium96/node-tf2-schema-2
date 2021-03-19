const request = require('request-retry-dayjs');
const vdf = require('vdf');

const webAPI = require('./webapi.js');
const SKU = require('tf2-sku-2');

const language = 'English';

const munitionCrate = new Map();
munitionCrate
    .set(82, 5734)
    .set(83, 5735)
    .set(84, 5742)
    .set(85, 5752)
    .set(90, 5781)
    .set(91, 5802)
    .set(92, 5803)
    .set(103, 5859);

class Schema {
    /**
     * Initializes the Schema class
     * @param {Object} data
     * @param {Object} [data.raw] Raw schema
     * @param {Number} [data.time] Time when the schema was made
     */
    constructor(data) {
        this.version = data.version || null;
        this.raw = data.raw || null;
        this.time = data.time || new Date().getTime();
    }

    getItemByItemNameWithThe(name) {
        const items = this.raw.schema.items;
        const itemsCount = items.length;

        for (let i = 0; i < itemsCount; i++) {
            const item = items[i];
            if (name.toLowerCase().replace('the ', '') === item.item_name.toLowerCase().replace('the ', '')) {
                if (item.item_name === 'Name Tag' && item.defindex === 2093) {
                    // skip and let it find Name Tag with defindex 5020
                    continue;
                }

                if (item.item_quality === 0) {
                    // skip if Stock Quality
                    continue;
                }

                return item;
            }
        }

        return null;
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

        if (
            name.includes('strange part') ||
            name.includes('strange cosmetic part') ||
            name.includes('strange filter') ||
            name.includes('strange count transfer tool') ||
            name.includes('strange bacon grease')
        ) {
            const schemaItem = this.getItemByItemName(name);
            if (!schemaItem) {
                console.log('returned L91', {
                    name: name,
                    item: item
                });
                return item;
            }
            item.defindex = schemaItem.defindex;
            item.quality = item.quality || schemaItem.item_quality; //default quality
            console.log('returned L99', {
                name: name,
                item: item
            });
            return item;
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
                console.log('Wear - before', {
                    name: name,
                    item: item
                });
                name = name.replace(wear, '').trim();
                item.wear = wears[wear];
                console.log('Wear - after', {
                    name: name,
                    item: item
                });
                break;
            }
        }

        if (name.includes('strange')) {
            console.log('"Strange" - before', {
                name: name,
                item: item
            });
            if (item.wear) {
                item.quality2 = 11;
            } else {
                item.quality = 11;
            }
            name = name.replace('strange', '').trim();
            console.log('"Strange" - after', {
                name: name,
                item: item
            });
        }

        name = name.replace('uncraftable', 'non-craftable');
        if (name.includes('non-craftable')) {
            console.log('"Non-Craftable" - before', {
                name: name,
                item: item
            });
            name = name.replace('non-craftable', '').trim();
            item.craftable = false;
            console.log('"Non-Craftable" - after', {
                name: name,
                item: item
            });
        }

        name = name
            .replace('untradable', 'non-tradable')
            .replace('untradeable', 'non-tradable')
            .replace('non-tradeable', 'non-tradable');
        if (name.includes('non-tradable')) {
            console.log('"Non-Tradable" - before', {
                name: name,
                item: item
            });
            name = name.replace('non-tradable', '').trim();
            item.tradable = false;
            console.log('"Non-Tradable" - after', {
                name: name,
                item: item
            });
        }

        const killstreaks = {
            'professional killstreak': 3,
            'specialized killstreak': 2,
            killstreak: 1
        };

        for (const killstreak in killstreaks) {
            if (name.includes(killstreak)) {
                console.log('"Killstreak" - before', {
                    name: name,
                    item: item
                });
                name = name.replace(killstreak + ' ', '').trim();
                item.killstreak = killstreaks[killstreak];
                console.log('"Killstreak" - after', {
                    name: name,
                    item: item
                });
                break;
            }
        }

        if (name.includes('australium') && !name.includes('australium gold')) {
            console.log('"Australium" - before', {
                name: name,
                item: item
            });
            name = name.replace('australium', '').trim();
            item.australium = true;
            console.log('"Australium" - after', {
                name: name,
                item: item
            });
        }

        if (name.includes('festivized')) {
            console.log('"Festivized" - before', {
                name: name,
                item: item
            });
            name = name.replace('festivized', '').trim();
            item.festive = true;
            console.log('"Festivized" - after', {
                name: name,
                item: item
            });
        }

        //Try to find quality name in name
        const exception = [
            'haunted ghosts',
            'haunted phantasm jr',
            'haunted phantasm',
            'haunted metal scrap',
            'haunted hat',
            'unusual cap',
            'vintage tyrolean',
            'vintage merryweather'
        ];

        let qualitySearch = name;
        for (const ex of exception) {
            if (name.includes(ex)) {
                qualitySearch = name.replace(ex, '').trim();
                break;
            }
        }
        //Get all qualities
        const qualities = Object.keys(this.raw.schema.qualities).reduce((obj, q) => {
            obj[this.raw.schema.qualityNames[q].toLowerCase()] = this.raw.schema.qualities[q];
            return obj;
        }, {});

        for (const quality in qualities) {
            if (qualitySearch.startsWith(quality)) {
                console.log('"Quality" - before', {
                    name: name,
                    item: item
                });
                name = name.replace(quality, '').trim();
                item.quality2 = item.quality;
                item.quality = qualities[quality];
                console.log('"Quality" - after', {
                    name: name,
                    item: item
                });
                break;
            }
        }

        //Check for effects
        const effects = this.raw.schema.attribute_controlled_attached_particles.reduce((obj, particle) => {
            obj[particle.name.toLowerCase()] = particle.id;
            return obj;
        }, {});

        const excludeAtomic = ['bonk! atomic punch', 'atomic accolade'].some(ex => name.includes(ex));

        for (const effect in effects) {
            if (effect === 'haunted ghosts' && name.includes('haunted ghosts') && item.wear) {
                // if item name includes Haunted Ghosts and wear is defined, skip cosmetic effect and find warpaint for weapon
                continue;
            }

            if (effect === 'atomic' && (name.includes('subatomic') || excludeAtomic)) {
                continue;
            }

            if (effect === 'spellbound' && (name.includes('taunt:') || name.includes('shred alert'))) {
                // skip "Spellbound" for cosmetic is item is a Taunt (to get the correct "Spellbound Aspect")
                continue;
            }

            if (effect === 'hot' && !item.wear) {
                continue;
            }

            if (effect === 'hot' && !name.includes('hot ') && name.includes('shotgun')) {
                continue;
            }

            if (effect === 'cool' && !item.wear) {
                continue;
            }

            if (name.includes(effect)) {
                console.log('"Effect" - before', {
                    name: name,
                    item: item
                });
                name = name.replace(effect, '').trim();
                item.effect = effects[effect];
                // will set quality to unusual if undefined, or make it primary, it other quality exists
                if (item.quality !== 5 && item.effect !== 4) {
                    item.quality2 = item.quality2 || item.quality;
                    item.quality = 5;
                }
                console.log('"Effect" - after', {
                    name: name,
                    item: item
                });

                break;
            }
        }

        if (item.wear) {
            const paintkits = Object.keys(this.raw.schema.paintkits).reduce((obj, id) => {
                obj[this.raw.schema.paintkits[id].toLowerCase()] = +id;
                return obj;
            }, {});

            for (const paintkit in paintkits) {
                if (name.includes('mk.ii') && !paintkit.includes('mk.ii')) {
                    continue;
                }

                if (name.includes(paintkit)) {
                    console.log('"Paintkit" - before', {
                        name: name,
                        item: item
                    });
                    name = name.replace(paintkit, '').replace(' | ', '').trim();
                    item.paintkit = paintkits[paintkit];

                    // Standardize https://github.com/TF2Autobot/tf2autobot/pull/394
                    if (!item.effect) {
                        if (item.quality2 === 11) {
                            item.quality = 11;
                            item.quality2 = null;
                        } else {
                            item.quality = 15;
                        }
                    } else {
                        if (item.quality2 === 11) {
                            item.quality = 11;
                            item.quality2 = null;
                        }
                    }

                    console.log('"Paintkit" - after', {
                        name: name,
                        item: item
                    });

                    break;
                }
            }

            if (!name.includes('War Paint')) {
                /** 
                 * concealedkiller_pistol_redrockroscoe - 15013 - 0 (Red Rock Roscoe)
                 * concealedkiller_rocketlauncher_sandcannon - 15014 - 1 (Sand Cannon)
                 * concealedkiller_medigun_wrappedreviver - 15010 - 2 (Wrapped Reviver)
                 * concealedkiller_revolver_psychedelicslugger - 15011 - 3 (Psychedelic Slugger)
                 * concealedkiller_stickybomblauncher_carpetbomber - 15012 - 4 (Carpet Bomber)
                 * concealedkiller_medigun_maskedmender - 15008 - 5 (Masked Mender)
                 * concealedkiller_rocketlauncher_woodlandwarrior - 15006 - 6 (Woodland Warrior)
                 * concealedkiller_sniperrifle_purplerange - 15007 - 7 (Purple Range)
                 * concealedkiller_stickybomblauncher_suddenflurry - 15009 - 8 (Sudden Flurry)
                 * concealedkiller_flamethrower_forestfire - 15005 - 9 (Forest Fire)
                 * concealedkiller_minigun_kingofthejungle - 15004 - 10 (King of the Jungle)
                 * concealedkiller_scattergun_nightterror - 15002 - 11 (Night Terror)
                 * concealedkiller_shotgun_backwoodsboomstick - 15003 - 12 (Backwoods Boomstick)
                 * concealedkiller_smg_woodsywidowmaker - 15001 - 13 (Woodsy Widowmaker)
                 * concealedkiller_sniperrifle_nightowl - 15000 - 14 (Night Owl)
                 * craftsmann_scattergun_tartantorpedo - 15015 - 15 (Tartan Torpedo)
                 * craftsmann_shotgun_rusticruiner - 15016 - 16 (Rustic Ruiner)
                 * craftsmann_flamethrower_barnburner - 15017 - 17 (Barn Burner)
                 * craftsmann_pistol_homemadeheater - 15018 - 18 (Homemade Heater)
                 * craftsmann_sniperrifle_lumberfromdownunder - 15019 - 19 (Lumber From Down Under)
                 * craftsmann_minigun_ironwood - 15020 - 20 (Iron Wood)
                 * craftsmann_scattergun_countrycrusher - 15021 - 21 (Country Crusher)
                 * craftsmann_smg_plaidpotshotter - 15022 - 22 (Plaid Potshotter)
                 * craftsmann_sniperrifle_shotinthedark - 15023 - 23 (Shot in the Dark)
                 * craftsmann_stickybomblauncher_blastedbombardier - 15024 - 24 (Blasted Bombardier)
                 * craftsmann_medigun_reclaimedreanimator - 15025 - 25 (Reclaimed Reanimator)
                 * craftsmann_minigun_antiqueannihilator - 15026 - 26 (Antique Annihilator)
                 * craftsmann_revolver_oldcountry - 15027 - 27 (Old Country)
                 * craftsmann_rocketlauncher_americanpastoral - 15028 - 28 (American Pastoral)
                 * craftsmann_scattergun_backcountryblaster - 15029 - 29 (Backcountry Blaster)
                 * teufort_flamethrower_bovineblazemaker - 15030 - 30 (Bovine Blazemaker)
                 * teufort_minigun_warroom - 15031 - 31 (War Room)
                 * teufort_smg_treadplatetormenter - 15032 - 32 (Treadplate Tormenter)
                 * teufort_sniperrifle_bogtrotter - 15033 - 33 (Bogtrotter)
                 * teufort_flamethrower_earthskyandfire - 15034 - 34 (Earth, Sky and Fire)
                 * teufort_pistol_hickoryholepuncher - 15035 - 35 (Hickory Hole-Puncher)
                 * teufort_scattergun_sprucedeuce - 15036 - 36 (Spruce Deuce)
                 * teufort_smg_teamsprayer - 15037 - 37 (Team Sprayer)
                 * teufort_stickybomblauncher_rooftopwrangler - 15038 - 38 (Rooftop Wrangler)
                 * teufort_medigun_civilservant - 15039 - 39 (Civil Servant)
                 * teufort_minigun_citizenpain - 15040 - 40 (Citizen Pain)
                 * teufort_pistol_localhero - 15041 - 41 (Local Hero)
                 * teufort_revolver_mayor - 15042 - 42 (Mayor)
                 * teufort_rocketlauncher_smalltownbringdown - 15043 - 43 (Smalltown Bringdown)
                 * teufort_shotgun_civicduty - 15044 - 44 (Civic Duty)
                 * powerhouse_stickybomblauncher_liquidasset - 15045 - 45 (Liquid Asset)
                 * powerhouse_pistol_blackdahlia - 15046 - 46 (Black Dahlia)
                 * powerhouse_shotgun_lightningrod - 15047 - 47 (Lightning Rod)
                 * powerhouse_stickybomblauncher_pinkelephant - 15048 - 48 (Pink Elephant)
                 * powerhouse_flamethrower_flashfryer - 15049 - 49 (Flash Fryer)
                 * powerhouse_medigun_sparkoflife - 15050 - 50 (Spark of Life)
                 * powerhouse_revolver_deadreckoner - 15051 - 51 (Dead Reckoner)
                 * powerhouse_rocketlauncher_shellshocker - 15052 - 52 (Shell Shocker)
                 * powerhouse_scattergun_currentevent - 15053 - 53 (Current Event)
                 * powerhouse_flamethrower_turbinetorcher - 15054 - 54 (Turbine Torcher)
                 * powerhouse_minigun_brickhouse - 15055 - 55 (Brick House)
                 * powerhouse_pistol_sandstonespecial - 15056 - 56 (Sandstone Special)
                 * powerhouse_rocketlauncher_aquamarine - 15057 - 57 (Aqua Marine)
                 * powerhouse_smg_lowprofile - 15058 - 58 (Low Profile)
                 * powerhouse_sniperrifle_thunderbolt - 15059 - 59 (Thunderbolt)
                 * 
                 * harvest_flamethrower_autumn - 15066 - 60 (Autumn)
                 * harvest_wrench_autumn - 15074
                 * harvest_grenadelauncher_autumn - 15077
                 * harvest_rocketlauncher_autumn - 15081
                 * harvest_stickybomblauncher_autumn - 15082
                 * harvest_shotgun_autumn - 15085
                 * 
                 * harvest_pistol_nutcracker - 15061 - 61 (Nutcracker)
                 * harvest_flamethrower_nutcracker - 15068
                 * harvest_scattergun_nutcracker - 15069
                 * harvest_wrench_nutcracker - 15073
                 * harvest_minigun_nutcracker - 15088
                 * 
                 * harvest_sniperrifle_pumpkinpatch - 15070 - 62 (Pumpkin Patch)
                 * harvest_flamethrower_pumpkinpatch - 15067
                 * harvest_stickybomblauncher_pumpkinpatch - 15083
                 * harvest_minigun_pumpkinpatch - 15087
                 * 
                 * harvest_pistol_macabreweb - 15060 - 63 (Macabre Web)
                 * harvest_revolver_macabreweb - 15064
                 * harvest_scattergun_macabreweb - 15065
                 * harvest_grenadelauncher_macabreweb - 15079
                 * harvest_stickybomblauncher_macabreweb - 15084
                 * harvest_minigun_macabreweb - 15086
                 * 
                 * harvest_sniperrifle_boneyard - 15071 - 64 (Boneyard)
                 * harvest_revolver_boneyard - 15062
                 * harvest_wrench_boneyard - 15075
                 * harvest_knife_boneyard - 15080
                 * 
                 * harvest_sniperrifle_wildwood - 15072 - 65 (Wildwood)
                 * harvest_revolver_wildwood - 15063
                 * harvest_smg_wildwood - 15076
                 * harvest_medigun_wildwood - 15078
                 * 
                 * pyroland_flamethrower_balloonicorn - 15089 - 66 (Balloonicorn)
                 * pyroland_sniperrifle_balloonicorn - 15111
                 * 
                 * pyroland_flamethrower_rainbow - 15090 - 91 (Rainbow)
                 * pyroland_grenadelauncher_rainbow - 15091
                 * pyroland_sniperrifle_rainbow - 15112
                 * 
                 * pyroland_grenadelauncher_sweetdreams - 15092 - 68 (Sweet Dreams)
                 * pyroland_stickybomblauncher_sweetdreams - 15113
                 * 
                 * pyroland_knife_bluemew - 15094 - 69 (Blue Mew)
                 * pyroland_pistol_bluemew - 15100
                 * pyroland_rocketlauncher_bluemew - 15104
                 * pyroland_scattergun_bluemew - 15106
                 * pyroland_smg_bluemew - 15110
                 * 
                 * pyroland_knife_braincandy - 15095 - 70 (Brain Candy)
                 * pyroland_minigun_braincandy - 15098
                 * pyroland_pistol_braincandy - 15101
                 * pyroland_rocketlauncher_braincandy - 15105
                 * 
                 * pyroland_knife_stabbedtohell - 15096 - 71 (Stabbed to Hell)
                 * 
                 * pyroland_medigun_flowerpower - 15097 - 72 (Flower Power)
                 * pyroland_revolver_flowerpower - 15103
                 * pyroland_scattergun_flowerpower - 15107
                 * pyroland_shotgun_flowerpower - 15109
                 * 
                 * pyroland_minigun_mistercuddles - 15099 - 73 (Mister Cuddles)
                 * 
                 * pyroland_pistol_shottohell - 15102 - 74 (Shot to Hell)
                 * pyroland_scattergun_shottohell - 15108
                 * 
                 * pyroland_wrench_torquedtohell - 15114 - 75 (Torqued to Hell)
                 * 
                 * gentlemanne_flamethrower_coffinnail - 15115 - 93 (Coffin Nail)
                 * gentlemanne_grenadelauncher_coffinnail - 15116
                 * gentlemanne_medigun_coffinnail - 15120
                 * gentlemanne_minigun_coffinnail - 15123
                 * gentlemanne_revolver_coffinnail - 15127
                 * gentlemanne_rocketlauncher_coffinnail - 15129
                 * gentlemanne_scattergun_coffinnail - 15131
                 * gentlemanne_shotgun_coffinnail - 15132
                 * gentlemanne_sniperrifle_coffinnail - 15135
                 * gentlemanne_stickybomblauncher_coffinnail - 15137
                 * 
                 * gentlemanne_grenadelauncher_topshelf - 15117 - 77 (Top Shelf)
                 * gentlemanne_knife_topshelf - 15119
                 * gentlemanne_minigun_topshelf - 15125
                 * gentlemanne_revolver_topshelf - 15128
                 * gentlemanne_wrench_topshelf - 15140
                 * 
                 * gentlemanne_knife_dressedtokill - 15118 - 78 (Dressed to Kill)
                 * gentlemanne_medigun_dressedtokill - 15121
                 * gentlemanne_minigun_dressedtokill - 15124
                 * gentlemanne_pistol_dressedtokill - 15126
                 * gentlemanne_shotgun_dressedtokill - 15133
                 * gentlemanne_sniperrifle_dressedtokill - 15136
                 * gentlemanne_stickybomblauncher_dressedtokill - 15138
                 * gentlemanne_wrench_dressedtokill - 15139
                 * 
                 * gentlemanne_medigun_highrollers - 15122 - 79 (High Roller's)
                 * gentlemanne_rocketlauncher_highrollers - 15130
                 * gentlemanne_smg_highrollers - 15134
                 * 
                 * warbird_flamethrower_warhawk - 15141 - 80 (Warhawk)
                 * warbird_grenadelauncher_warhawk - 15142
                 * warbird_rocketlauncher_warhawk - 15150
                 * 
                 * warbird_knife_blitzkrieg - 15143 - 81 (Blitzkrieg)
                 * warbird_medigun_blitzkrieg - 15145
                 * warbird_pistol_blitzkrieg - 15148
                 * warbird_revolver_blitzkrieg - 15149
                 * warbird_smg_blitzkrieg - 15153
                 * warbird_stickybomblauncher_blitzkrieg - 15155
                 * 
                 * warbird_knife_airwolf - 15144 - 82 (Airwolf)
                 * warbird_sniperrifle_airwolf - 15154
                 * warbird_wrench_airwolf - 15156
                 * 
                 * warbird_medigun_corsair - 15146 - 83 (Corsair)
                 * warbird_scattergun_corsair - 15157
                 * 
                 * warbird_minigun_butcherbird - 15147 - 84 (Butcher Bird)
                 * warbird_grenadelauncher_butcherbird - 15158
                 * 
                 * warbird_scattergun_killerbee - 15151 - 92 (Killer Bee)
                 * warbird_shotgun_redbear - 15152 - 86 (Red Bear)
                 * 
                */
            }
        }

        if (name.includes('kit fabricator') && item.killstreak > 1) {
            console.log('"Kit Fabricator" - before', {
                name: name,
                item: item
            });
            name = name.replace('kit fabricator', '').trim();
            item.defindex = item.killstreak > 2 ? 20003 : 20002;
            const schemaItem = this.getItemByItemName(name);
            item.target = schemaItem.defindex;
            item.output = item.killstreak > 2 ? 6526 : 6523;
            item.outputQuality = 6;
            item.quality = item.quality ?? schemaItem.item_quality; //default quality
            console.log('"Kit Fabricator" - after', {
                name: name,
                item: item
            });
        }

        if (name.includes('(paint: ')) {
            console.log('"Painted" - before loop', {
                name: name,
                item: item
            });

            name = name.replace('(paint: ', '').replace(')', '').trim();

            const paints = {
                'indubitably green': 7511618,
                "z'epheniah's greed": 4345659,
                "noble hatter's violet": 5322826,
                'color no. 216-190-216': 14204632,
                'a deep commitment to purple': 8208497,
                'mann co. orange': 13595446,
                muskelmannbraun: 10843461,
                'peculiarly drab tincture': 12955537,
                'radigan conagher brown': 6901050,
                'ye olde rustic colour': 8154199,
                'australium gold': 15185211,
                'aged moustache grey': 8289918,
                'an extraordinary abundance of tinge': 15132390,
                'a distinctive lack of hue': 1315860,
                'team spirit': 12073019,
                'pink as hell': 16738740,
                'a color similar to slate': 3100495,
                'drably olive': 8421376,
                'the bitter taste of defeat and lime': 3329330,
                "the color of a gentlemann's business pants": 15787660,
                'dark salmon injustice': 15308410,
                "operator's overalls": 4732984,
                'waterlogged lab coat': 11049612,
                'balaclavas are forever': 3874595,
                'an air of debonair': 6637376,
                'the value of teamwork': 8400928,
                'cream spirit': 12807213,
                "a mann's mint": 12377523,
                'after eight': 2960676
            };

            for (const paint in paints) {
                if (name.includes(paint)) {
                    console.log('"Painted" - in loop, before', {
                        name: name,
                        item: item
                    });
                    name = name.replace(paint, '').trim();
                    item.paint = paints[paint];
                    console.log('"Painted" - after', {
                        name: name,
                        item: item
                    });
                    break;
                }
            }
        }

        if (name.includes('strangifier')) {
            console.log('"Strangifier" - before', {
                name: name,
                item: item
            });
            name = name.replace('strangifier', '').trim();
            const items = this.raw.schema.items;
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (it.name.toLowerCase().startsWith(name) && it.name.endsWith(' Strangifier')) {
                    item.defindex = it.defindex;
                }
            }
            item.defindex = item.defindex || 6522;
            const schemaItem = this.getItemByItemName(name);
            item.target = schemaItem.defindex;
            item.quality = item.quality ?? schemaItem.item_quality; //default quality
            console.log('"Strangifier" - after', {
                name: name,
                item: item
            });
        }
        if (name.includes('kit') && item.killstreak) {
            console.log('"Kit" - before', {
                name: name,
                item: item
            });

            name = name.replace('kit', '').trim();
            if (item.killstreak == 1) {
                const items = this.raw.schema.items;
                for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.name.toLowerCase().startsWith(name) && it.name.endsWith(' Killstreakifier Basic')) {
                        item.defindex = it.defindex;
                    }
                }
                item.defindex = item.defindex || 6527;
            } else if (item.killstreak == 2) {
                item.defindex = 6523;
            } else if (item.killstreak == 3) {
                item.defindex = 6526;
            }

            // If Generic Kit, ignore this
            if (name !== '') {
                const schemaItem = this.getItemByItemName(name);
                item.target = schemaItem.defindex;
                item.quality = item.quality ?? schemaItem.item_quality; //default quality
            }

            if (!item.quality) {
                item.quality = 6;
            }

            console.log('"Kit" - after', {
                name: name,
                item: item
            });
        }

        if (item.defindex) {
            console.log('returned L502', {
                name: name,
                item: item
            });
            return item;
        }

        if (item.paintkit && name.includes('war paint')) {
            console.log('"War Paint" - before', {
                name: name,
                item: item
            });

            name = `Paintkit ${item.paintkit}`;
            if (!item.quality) {
                item.quality = 15;
            }
            for (let i = 0; i < this.raw.schema.items.length; i++) {
                if (this.raw.schema.items[i].name == name) {
                    item.defindex = this.raw.schema.items[i].defindex;
                }
            }

            console.log('"War Paint" - after', {
                name: name,
                item: item
            });
        } else {
            if (name.includes('mann co. supply crate #')) {
                console.log('"Mann Co. Supply Crate"', {
                    name: name,
                    item: item
                });
                const crateseries = +name.substring(23);

                if ([1, 3, 7, 12, 13, 18, 19, 23, 26, 31, 34, 39, 43, 47, 54, 57, 75].includes(crateseries)) {
                    item.defindex = 5022;
                } else if ([2, 4, 8, 11, 14, 17, 20, 24, 27, 32, 37, 42, 44, 49, 56, 71, 76].includes(crateseries)) {
                    item.defindex = 5041;
                } else if ([5, 9, 10, 15, 16, 21, 25, 28, 29, 33, 38, 41, 45, 55, 59, 77].includes(crateseries)) {
                    item.defindex = 5045;
                }

                item.crateseries = crateseries;
                item.quality = 6;
                console.log('returned L547', {
                    name: name,
                    item: item
                });
                return item;
            } else if (name.includes('mann co. supply munition #')) {
                console.log('"Mann Co. Supply Munition"', {
                    name: name,
                    item: item
                });
                const crateseries = +name.substring(26);
                item.defindex = munitionCrate.get(crateseries);
                item.crateseries = crateseries;
                item.quality = 6;
                console.log('returned L561', {
                    name: name,
                    item: item
                });
                return item;
            } else if (name.includes('salvaged mann co. supply crate #')) {
                console.log('"Salvaged Mann Co. Supply Crate"', {
                    name: name,
                    item: item
                });
                item.crateseries = +name.substring(32);
                item.defindex = 5068;
                item.quality = 6;
                console.log('returned L574', {
                    name: name,
                    item: item
                });
                return item;
            }

            let number = null;

            if (name.includes('#')) {
                console.log('with # - before', {
                    name: name,
                    item: item
                });
                const withoutNumber = name.replace(/#\d+/, '');
                number = name.substring(withoutNumber.length + 1).trim();
                name = name.replace(/#\d+/, '').trim();
                console.log('with # - after', {
                    name: name,
                    item: item
                });
            }

            const schemaItem = this.getItemByItemNameWithThe(name);
            if (!schemaItem) {
                console.log('returned L599', {
                    name: name,
                    item: item
                });
                return item;
            }

            item.defindex = schemaItem.defindex;
            item.quality = item.quality ?? schemaItem.item_quality; //default quality

            if (schemaItem.item_class === 'supply_crate') {
                console.log('with "supply_crate" - before', {
                    name: name,
                    item: item
                });

                for (let i = 0; i < schemaItem.attributes?.length; i++) {
                    if (schemaItem.attributes[i].name === 'set supply crate series') {
                        item.crateseries = schemaItem.attributes[i].value;
                    }
                }
                if (!item.crateseries) {
                    const seriesAttribute = this.raw.items_game.items[schemaItem.defindex]?.static_attrs[
                        'set supply crate series'
                    ];
                    item.crateseries = Number(seriesAttribute?.value || seriesAttribute);
                }

                console.log('with "supply_crate" - after', {
                    name: name,
                    item: item
                });
            } else if (schemaItem.item_class !== 'supply_crate' && number !== null) {
                console.log('not "supply_crate" and number !== null - before', {
                    name: name,
                    item: item
                });
                item.craftnumber = number;
                console.log('not "supply_crate" and number !== null - after', {
                    name: name,
                    item: item
                });
            }
        }

        console.log('returned L644', {
            name: name,
            item: item
        });
        return item;
    }

    /**
     * Gets schema item by defindex
     * @param {Number} defindex
     * @return {Object}
     */
    getItemByDefindex(defindex) {
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
    getItemByItemName(name) {
        const items = this.raw.schema.items;
        const itemsCount = items.length;

        for (let i = 0; i < itemsCount; i++) {
            const item = items[i];
            if (name.toLowerCase() === item.item_name.toLowerCase()) {
                if (item.item_name === 'Name Tag' && item.defindex === 2093) {
                    // skip and let it find Name Tag with defindex 5020
                    continue;
                }

                if (item.item_quality === 0) {
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
    getAttributeByDefindex(defindex) {
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
            const mid = Math.floor((start + end) / 2);
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
    getQualityById(id) {
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
    getQualityIdByName(name) {
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
    getEffectById(id) {
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
            const mid = Math.floor((start + end) / 2);
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
    getEffectIdByName(name) {
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
    getSkinById(id) {
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
    getSkinIdByName(name) {
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
    getPaintNameByDecimal(decimal) {
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
    getPaintDecimalByName(name) {
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
        return this.raw.schema.items.filter(
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
        if (
            !['Scout', 'Soldier', 'Pyro', 'Demoman', 'Heavy', 'Engineer', 'Medic', 'Sniper', 'Spy'].includes(charClass)
        ) {
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
            .concat([1178, 1179, 1180, 1181, 1190].map(def => `${def};6`));
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
    getName(item, proper = true) {
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

        if (
            (item.quality !== 6 && item.quality !== 15 && item.quality !== 5) ||
            (item.quality === 5 && !item.effect) ||
            schemaItem.item_quality == 5
        ) {
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
            name +=
                ' (' +
                ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle Scarred'][item.wear - 1] +
                ')';
        }

        if (item.crateseries) {
            name += ' #' + item.crateseries;
        }

        if (item.craftnumber) {
            name = '#' + item.craftnumber + ' ' + name;
        }

        if (item.paint) {
            name += ` (Paint: ${this.getPaintNameByDecimal(item.paint)})`;
        }

        return name;
    }

    /**
     * Gets schema overview
     * @param {String} apiKey
     * @param {Function} callback
     */
    static getOverview(apiKey, callback) {
        webAPI(
            'GET',
            'GetSchemaOverview',
            'v0001',
            {
                key: apiKey,
                language: language
            },
            function (err, result) {
                if (err) {
                    return callback(err);
                }

                return callback(null, result);
            }
        );
    }

    /**
     * Gets schema items
     * @param {String} apiKey
     * @param {Function} callback
     */
    static getItems(apiKey, callback) {
        getAllSchemaItems(apiKey, callback);
    }

    /**
     * Gets skins / paintkits from TF2 protodefs
     * @param {Function} callback
     */
    static getPaintKits(callback) {
        request(
            {
                method: 'GET',
                url:
                    'https://raw.githubusercontent.com/SteamDatabase/GameTracking-TF2/master/tf/resource/tf_proto_obj_defs_english.txt',
                gzip: true
            },
            function (err, response, body) {
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
            }
        );
    }

    static getItemsGame(callback) {
        request(
            {
                method: 'GET',
                url:
                    'https://raw.githubusercontent.com/SteamDatabase/GameTracking-TF2/master/tf/scripts/items/items_game.txt',
                gzip: true
            },
            function (err, response, body) {
                if (err) {
                    return callback(err);
                }

                return callback(null, vdf.parse(body).items_game);
            }
        );
    }

    /**
     * Creates data object used for initializing class
     * @return {Object}
     */
    toJSON() {
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
function getAllSchemaItems(apiKey, next, items, callback) {
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
