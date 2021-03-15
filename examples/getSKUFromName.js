const Schema = require('../index');

const schemaManager = new Schema({ apiKey: 'F6FEF9CB45E9612D71F18D55566048EF' });

schemaManager.init(function (err) {
    if (err) {
        throw err;
    }
});

schemaManager.on('ready', function () {
    //console.log(JSON.stringify(schemaManager.schema.getPaints()));
    const name = schemaManager.schema.getSkuFromName('Professional Killstreak Third Degree Kit Fabricator');

    console.log(name); // -> Mann Co. Supply Crate Key
});
