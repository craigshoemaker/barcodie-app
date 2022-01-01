const write = require('./write');

module.exports = async function (context, req) {

    const { id, description } = req.body;
    const response = async = write(id, description);

    context.res = {
        body: response
    };
}