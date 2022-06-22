const {Schema, model} = require('mongoose')

const schema = new Schema({
    buyDate: {
        type: Date,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    buyPrice: {
        type: Number,
        required: true,
    },
    isSelled: {
        type: Boolean,
        default: false,
    },
    sellPrice: {
        type: Number
    },
    sellDate: {
        type: Date
    },
    profitDollars: {
        type: Number
    },
    profitPercents: {
        type: Number
    }
})

module.exports = model('SchemaStocks', schema)