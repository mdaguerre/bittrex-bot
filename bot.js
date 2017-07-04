#!/usr/bin/env node
var bittrex = require('node.bittrex.api');
var colors = require('colors');
var _ = require('lodash');
var moment = require('moment-timezone');
var columnify = require('columnify');
const winston = require('winston')

winston.configure({
   transports: [
     new (winston.transports.File)({ filename: 'pumps.log' })
   ]
 });

moment.tz.setDefault('America/Montevideo'); //for logging purpose

const {API_KEY, API_SECRET} = require('constants');
console.log(' ---- Bittrex Bot ----'.green);

bittrex.options({
  'apikey' : '',
  'apisecret' : '',
  'verbose' : true,
  'cleartext' : false
});

var marketsWhiteList = ['BTC-ETH', 'BTC-PTOY', 'BTC-SLS'];
//var marketsHighlight = ['BTC-ETH', 'BTC-PTOY', 'BTC-SLS'];
var marketsHighlight = [];

var lastTickValue = [];
var maxDiff = [];

var sellUrl = 'https://bittrex.com/api/v1.1/market/sellmarket?market=SLS-BTC&quantity=0.1';
var balanceUrl = 'https://bittrex.com/api/v1.1/account/getbalances?currency=BTC';

// bittrex.sendCustomRequest( sellUrl, function( data ) {
//   console.log( data );
// }, true );

analyseMarket({
  'logConsole' : true
});

function analyseMarket(options){

  var logConsole = (options.logConsole !== undefined) ?  options.logConsole : true;

  var summaryStateWS = bittrex.websockets.listen( function( data ) {

    if (data.M === 'updateSummaryState') {
      data.A.forEach(function(data_for) {
        var tickData = [];
        data_for.Deltas.forEach(function(marketsDelta) {
          var marketName = marketsDelta.MarketName;
          var last = marketsDelta.Last;
          var prevDay = marketsDelta.PrevDay;
          var time = moment(marketsDelta.TimeStamp).format('YYYY-MM-DD  H:mm:ss a');

          var yesterdayDiff = getChangePercentaje(last, prevDay);
          var yesterdayDiffColor = getDiffInColor(yesterdayDiff);

          var lastValue = lastTickValue[marketName]? lastTickValue[marketName] : last;
          var lastDiff = getChangePercentaje(last, lastValue);
          var lastDiffColor = getDiffInColor(lastDiff);

          if(maxDiff[marketName] === undefined){
            maxDiff[marketName] = 0;
          }

          if(maxDiff[marketName] < yesterdayDiff){
            maxDiff[marketName] = yesterdayDiff;
          }

          lastTickValue[marketName] = last;

          if(lastDiff === 0){
            return;
          }

          if(false && _.indexOf(marketsWhiteList, marketName) === -1){
            return;
          }

          if(yesterdayDiff > 100 ){
            marketsHighlight.push(marketName);

            winston.log('info',{
              'time' : time,
              'market' : marketName,
              'change' : yesterdayDiff,
              'lastDiff' : lastDiff
            });
          }

          tickData.push({
            time : colors.yellow(time),
            market : highlightMarket(marketName),
            change : yesterdayDiffColor,
            maxDiff : getDiffInColor(maxDiff[marketName]),
            lastChange : lastDiffColor,
            changeValue : yesterdayDiff,
            lastChangeValue : lastValue
          });

          updateStats(marketName, last, marketsDelta.TimeStamp);

        });

        if(_.size(tickData) === 0){
          return;
        }

        if(logConsole){
          tickData = _.orderBy(tickData, ['changeValue'], ['desc']);
          console.log(columnify(tickData, {columnSplitter: ' | ', columns: ['time', 'market', 'change', 'lastChange', 'maxDiff']}));
        }

      });
    }
  });
}

function getChangePercentaje(last, prevDay){
  var diff = last - prevDay;
  return _.ceil((diff * 100) / prevDay, 2);
}

/**
 * Returns the diff in red or green if its lower or greater than 0
 */
function getDiffInColor(diff){
  var diffStr = diff + '%';
  return (diff > 0) ? diffStr.green : diffStr.red;
}

function updateStats(marketName, value, time){
  //@Todo
}

function highlightMarket(marketName){
  return _.indexOf(marketsHighlight, marketName) !== -1 ? marketName.bold.magenta : marketName;
}
