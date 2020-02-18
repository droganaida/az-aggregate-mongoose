const http = require('http');
const fs = require('fs');
const port = 6009;
const ejs = require('ejs');
const Item = require('./models/items').Items;
const {promisify} = require('util');
const shopCard = require('./libs/shopCard');

const requestHandler = (request, response) => {

    let params = {};
    params.copyright = '#BlondieCode © ' + (new Date()).getFullYear();

    const wordArray = shopCard.itemsRu;

    const renderFile = promisify(ejs.renderFile).bind(ejs);

    if (request.url.indexOf('.') != -1) {

        const readFileAsync = promisify(fs.readFile);

        readFileAsync(__dirname + request.url, {encoding: 'utf8'})
            .then((file) => {
                response.end(file);
            })
            .catch((err) => {
                console.error(`Ошибка сервера ${err}`);
            });

    } else if (request.url == '/insert') {

        params.page = 'insert';

        //=========== async\await запускаем массив функций параллельно ============//

        async function parallelMongoQuery() {

            const reviewPromises = wordArray.map((word) => {
                return Item.create({title: word})
                    .catch((err) => {
                        console.error(`Ошибка сервера ${err}`);
                    });
            });

            await Promise.all(reviewPromises);

            //=========== aggregate для сортировки записей без учета регистра (ASCII) ============//

            return await Item.aggregate([
                {$project:
                    {
                        _id: 0,
                        title: 1,
                        sortTitle: {"$toLower": "$title"}
                    }
                },
                {$sort: { "sortTitle": 1 } }
            ]);
        }

        //=========== асинхронный цикл for ============//

        async function mongoQuery() {

            for (let word of wordArray) {

                //=========== альтернатива для try...catch, одобренная минздрав ============//

                // await Item.create({ title: word })
                //     .catch((err) => {
                //         console.error(`Ошибка сервера ${err}`);
                //     });

                try {
                    await Item.create({ title: word });
                } catch (err) {
                    console.error(`Ошибка сервера ${err}`);
                }
            }

            return await Item.find().sort({title: 1});
        }

        async function renderTemplate() {

            params.items = await parallelMongoQuery();
            return await renderFile(__dirname + '/templates/template.ejs', params);
        }

        renderTemplate()
            .then((html) => {
                response.end(html);
            })
            .catch((err) => {
                console.error(err.stack);
                response.end('=(');
            });
    } else {

        params.page = 'aggregate';

        async function azAggregate() {

            //=========== aggregate для группировки записей по первой букве ============//

            const itemList = await Item.aggregate([
                { $match: {}},
                {$project:
                    {
                        _id: 0,
                        title: 1,
                        letter: {
                            $let: {
                                vars: {
                                    numArray: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
                                    lowerFirstLetter: {$substrCP: [{ $toLower: "$title" }, 0, 1]}
                                },
                                in: {
                                    $cond: {
                                        if: { $in: [ "$$lowerFirstLetter", "$$numArray" ] },
                                        then: '0-9',
                                        else: "$$lowerFirstLetter"
                                    }
                                }
                            }
                        }
                    }
                },
                {$group:
                    {
                        _id: "$letter",
                        items: {
                            $push: {
                                title: "$title"
                            }
                        },
                        count: {$sum: 1}
                    }
                },
                {$sort: { "_id": 1 } }
            ]);

            //=========== Постобработка результатов выборки для группировки UTF-8 ============//

            let resItems = [];
            let indexLetter = [];

            for (let iItem of itemList) {

                try {

                    let position = indexLetter.indexOf(iItem._id.toLowerCase());

                    if (position == -1) {
                        indexLetter.push(iItem._id.toLowerCase());
                        resItems.push(iItem);
                    } else {
                        resItems[position].items = resItems[position].items.concat(iItem.items);
                        resItems[position].count += iItem.count;
                    }

                } catch (err) {
                    console.error(`Ошибка сервера ${err}`);
                }
            }

            return [resItems, indexLetter];
        }

        async function renderAggregated() {

            const [resItems, indexLetter] = await azAggregate();
            params.letters = indexLetter;
            params.azItems = resItems;
            return await renderFile(__dirname + '/templates/template.ejs', params);
        }

        renderAggregated()
            .then((html) => {
                response.end(html);
            })
            .catch((err) => {
                console.error(err.stack);
                response.end('=(');
            });
    }
};

const server = http.createServer(requestHandler);

server.listen(port, (err) => {

    if (err) {
        return console.error(`Ошибка сервера ${err}`);
    }

    console.log(`Вишу на порту ${port}`);
});