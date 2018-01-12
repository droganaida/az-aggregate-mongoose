
const http = require('http');
const fs = require('fs');
const port = 6009;
const ejs = require('ejs');
const Item = require('./models/items').Items;
const {promisify} = require('util');

const requestHandler = (request, response) => {

    let params = {};
    params.copyright = '#BlondieCode © ' + (new Date()).getFullYear();

    const wordArray = ['Молоко', 'Бананы', 'Яблоко', 'Курица', 'Пиво', 'Огурцы', 'Апельсин'];

    if (request.url.indexOf('.') != -1) {

        const readFileAsync = promisify(fs.readFile);

        readFileAsync(__dirname + request.url, {encoding: 'utf8'})
            .then((file) => {
                response.end(file);
            })
            .catch((err) => {
                console.error(`Ошибка сервера ${err}`);
            });

    } else {

        //=========== async\await запускаем массив функций параллельно ============//

        async function parallelMongoQuery() {

            const reviewPromises = wordArray.map((word) => {
                Item.create({title: word})
                    .catch((err) => {
                        console.error(`Ошибка сервера ${err}`);
                    });
            });

            await Promise.all(reviewPromises);
            return await Item.find().sort({title: 1});
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

        const renderFile = promisify(ejs.renderFile).bind(ejs);

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
    }
};

const server = http.createServer(requestHandler);

server.listen(port, (err) => {

    if (err) {
        return console.error(`Ошибка сервера ${err}`);
    }

    console.log(`Вишу на порту ${port}`);
});