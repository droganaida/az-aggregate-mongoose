
const mongoose = require('../libs/mongoose');

Schema = mongoose.Schema;

const schema = new Schema({

    title: {
        type: String,
        required: true
    }
});

schema.index(
    {title: 1}, {unique: true, dropDups: true}
);

exports.Items = mongoose.model('Items', schema);