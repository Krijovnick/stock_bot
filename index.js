const stocks = require('./stocks');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
const axios = require('axios').default;
import express from 'express';
const SchemaStocks = require('./schema_stocks');
require('dotenv').config();

const DAYLY = 'Time Series (Daily)';
const META_DATA = 'Meta Data';
const SYMBOL = '2. Symbol';
const OPEN = '1. open';
const CLOSE = '4. close';

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true
  })
);

const processNeedBuy = async function(url) {
    let index = 0;
    let positiveDays = 0;
    const response = await axios.get(url);
    const obj = response.data[DAYLY];
    let prevOpen;
    for(let el in obj) {
        const open = obj[el][OPEN];
        const dif = obj[el][CLOSE] - obj[el][OPEN];
        if(dif > 0 && (!prevOpen || prevOpen < open)) {
            prevOpen = open;
            positiveDays++;
        }
        index++;
        if(index === 3) {
            break;
        }
    }
    console.log(response.data[META_DATA][SYMBOL] + ' passed')
    if(positiveDays === 3) {
        return response;
    }
    return null;
}

const processNeedSell = async function(url) {
    let index = 0;
    let negativeDays = 0;
    const response = await axios.get(url);
    const obj = response.data[DAYLY];
    let prevOpen;
    for(let el in obj) {
        const open = obj[el][OPEN];
        const dif = obj[el][CLOSE] - open;
        if(dif < 0 && (!prevOpen || prevOpen > open)) {
            prevOpen = open;
            negativeDays++;
        }
        index++;
        if(index === 3) {
            break;
        }
    }
    if(negativeDays === 3) {
        const keys = Object.keys(obj);
        const sellPrice = getNumber(obj[keys[0]][OPEN]) + (getNumber(obj[keys[0]][CLOSE]) - getNumber(obj[keys[0]][OPEN])) / 2;

        return {
            update: true,
            price: sellPrice
        }
    }
    return { update: false }
}

const getNumber = function(string) {
    return parseInt(string, 10);
}

const processData = async function() {
    await mongoose.connect(process.env.MONGO);
    stocks.forEach(function(name, i) {
        setTimeout(async function() {
            const stockInBase = await SchemaStocks.findOne({ name: name, isSelled: false });
            const url = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=' + name + '&apikey=' + process.env.API_KEY;
            if(!stockInBase) {
                const buying = await processNeedBuy(url);
                if(buying) {
                    const obj = buying.data[DAYLY];
                    const keys = Object.keys(obj);
                    const name = buying.data[META_DATA][SYMBOL];
                    const buyPrice = getNumber(obj[keys[0]][OPEN]) + (getNumber(obj[keys[0]][CLOSE]) - getNumber(obj[keys[0]][OPEN])) / 2;

                    const stock = new SchemaStocks({
                        buyDate: new Date(),
                        name,
                        buyPrice,
                    })
                    await stock.save();

                    bot.telegram.sendMessage(MY_ID, 'Buy: ' + name);
                }
            } else {
                const selling = await processNeedSell(url);
                if(selling.update) {
                    stockInBase.sellDate = new Date();
                    stockInBase.sellPrice = selling.price;
                    stockInBase.isSelled = true;
                    stockInBase.profitDollars = stockInBase.sellDate - stockInBase.buyDate;
                    stockInBase.profitPercents = (stockInBase.sellDate * 100 / stockInBase.buyDate) - 100;
                    await stock.save();

                    bot.telegram.sendMessage(MY_ID, 'Sell: ' + name);
                }
            }
        }, i * 15000);
    });
}

bot.start((ctx) =>  {
    ctx.reply('Welcome');
});
bot.launch({
    webhook: {
      domain: 'https://stockdailybot.herokuapp.com/new-message',
      port: 3000
    }
  })
app.post('/new-message', async (req, res) => {
    bot.telegram.sendMessage(MY_ID, 'Message Received');
    res.send('Done');
});

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));