const write = require('./write/write');
const read = require('./read/read');

(async () => {

    const response = await write('1002', 'test');
    //const response = await read('1001');
    console.log(response);

})();