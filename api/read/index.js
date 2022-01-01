const read = require('./read');

module.exports = async function (context, req) {
    const id = (req.query.id || (req.body && req.body.id));
    const response = await read(id);
    context.res = {
        body: response
    };
}