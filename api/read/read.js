const ds = require('../dataService');
const config = require('../config');

module.exports = async function(id) {
    const row = await ds.get(config.PARTITION_KEY, `i${id}`);
    if(row.RowKey) {
        row.RowKey = row.RowKey.replace('i', '');
    }
    return row;
};