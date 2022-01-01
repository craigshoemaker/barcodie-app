const storage = require("azure-storage");
if (!process.env.PRODUCTION) {
    require('dotenv').config();
}
const config = require("./config");

const dataService = storage.createTableService(
    config.CONNECTION_STRING
);
const entityGenerator = storage.TableUtilities.entityGenerator;

let TABLE_NAME = "inventory";

if (!process.env.PRODUCTION) {
    TABLE_NAME = `${TABLE_NAME}DEV`;
}

const getData = (query) => {
    try {
        return new Promise((resolve, reject) => {
            dataService.queryEntities(TABLE_NAME, query, null, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response.entries);
                }
            });
        });
    } catch (error) {
        console.log("\n\n");
        console.log(error);
        console.log(JSON.stringify(error));
        console.log("\n\n");
        throw error;
    }
};

const patterns = {
    dateTime: /[0-9]{4,4}\-[0-9]{2,2}\-[0-9]{2,2}T([0-9]{2,2}:){2,2}[0-9]{2,2}[Zz]/,
    int32: /^[0-9]*[^\.]$/,
    boolean: /true|false/,
};

const _module = {
    get: async (keyOrList, rowKey) => {
        const isCollectionQuery = !rowKey;
        if (isCollectionQuery) {
            return await _module.getCollection(keyOrList);
        } else {
            return await _module.getByKey(keyOrList, rowKey);
        }
    },

    getCollection: (selectList, where) => {
        return new Promise(async (resolve, reject) => {
            try {
                const query = new storage.TableQuery();

                if (selectList) {
                    query.select(selectList.replace(/ /g, "").split(","));
                }

                if (where) {
                    const matches = where.match(/([A-Za-z0-9]*) ?\= ?([A-Za-z0-9]*)/);
                    const [match, propName, value] = matches;
                    if (propName && value) {
                        const expression = `${propName} eq ?`;
                        query.where(expression, value);
                    }
                }

                const response = await getData(query);
                resolve(response);
            } catch (error) {
                reject(error);
            }
        });
    },

    getByKey: (pk, rk) => {
        return new Promise((resolve, reject) => {
            dataService.retrieveEntity(TABLE_NAME, pk, rk, (error, result) => {
                if (error) {
                    if (error.code === "ResourceNotFound") {
                        resolve({});
                    } else {
                        reject(error);
                    }
                } else {
                    const data = _module.unwrapDTO(result);
                    resolve(data);
                }
            });
        });
    },

    getDTOValue: (value, propName, dateValue) => {
        let generator, returnValue;

        if (dateValue) {
            value = dateValue.toISOString();
            generator = entityGenerator.DateTime;
        } else if (patterns.dateTime.test(value)) {
            generator = entityGenerator.DateTime;
        } else if (patterns.int32.test(value)) {
            value = value.toString();
            generator = entityGenerator.Int32;
        } else if (patterns.boolean.test(value)) {
            generator = entityGenerator.Boolean;
        } else {
            generator = entityGenerator.String;
        }

        returnValue = generator(value);

        if (!/PartitionKey|RowKey|Timestamp/.test(propName)) {
            delete returnValue.$;
        }

        return returnValue;
    },

    // DTO = Data Transfer Object
    createDTO: (entity) => {
        const dto = {};
        const { getDTOValue: getValue, createDTO: create } = _module;
        for (let prop in entity) {

            if (typeof entity[prop] === undefined || entity[prop] === null) {
                entity[prop] = '';
            }

            if (/\.metadata/.test(prop)) {
                dto[prop] = entity[prop]; // do not process
            } else if (Array.isArray(entity[prop])) {
                dto[prop] = getValue(JSON.stringify(entity[prop]), prop);
            } else if (entity[prop].getDate) {
                dto[prop] = getValue(null, null, entity[prop]);
            } else if (typeof entity[prop] === "object") {
                dto[prop] = create(entity[prop], prop);
            } else {
                dto[prop] = getValue(entity[prop], prop);
            }
        }
        return dto;
    },

    unwrapDTO: (dto) => {
        const data = {};
        for (const property in dto) {
            if (property === '.metadata') {
                data['.metadata'] = dto['.metadata'];
            } else {
                data[property] = dto[property]._;
            }
        }
        return data;
    },

    add: (resource) => {
        return new Promise((resolve, reject) => {
            const dto = _module.createDTO(resource);
            dataService.insertEntity(TABLE_NAME, dto, (error, result, response) => {
                if (error) {
                    reject(error);
                } else {
                    const data = _module.unwrapDTO(result);
                    resolve(data);
                }
            });
        });
    },

    update: (entity) => {
        return new Promise(async (resolve, reject) => {
            const { PartitionKey: pk, RowKey: rk } = entity;
            const { createDTO, getByKey } = _module;

            let current = await getByKey(pk, rk);
            let merged = { ...current, ...entity };
            const dto = createDTO(merged);

            dataService.replaceEntity(TABLE_NAME, dto, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ message: "success" });
                }
            });
        });
    },

    remove: (partitionKey, rowKey) => {
        return new Promise((resolve, reject) => {
            const resource = {
                PartitionKey: { _: partitionKey },
                RowKey: { _: rowKey },
            };

            dataService.deleteEntity(TABLE_NAME, resource, (error, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(response);
                }
            });
        });
    },
};

module.exports = _module;