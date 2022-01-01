const ds = require('../dataService');
const config = require('../config');

module.exports = async function(id, description) {
    const rk = `i${id}`;
    const input = { PartitionKey: config.PARTITION_KEY, RowKey: rk, description };
    const row = await ds.getByKey(config.PARTITION_KEY, rk);
    let command = row.RowKey ? 'update' : 'add';
    const response = await ds[command](input);;
    return response;
};