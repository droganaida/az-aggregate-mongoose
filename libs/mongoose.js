
const mongoose = require('mongoose');

mongoose.Promise = Promise;
mongoose.set('debug', true);

mongoose.connect('mongodb://localhost/fridge', {
    useMongoClient: true,
});

module.exports = mongoose;