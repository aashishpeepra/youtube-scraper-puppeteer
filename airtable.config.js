let Airtable = require("airtable");
const dotenv = require("dotenv");
dotenv.config();

let airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY,endpointUrl: 'https://api.airtable.com' });
var base = Airtable.base('appTUv3xCiO8oVJCb');


exports.base = base;
exports.airtable = airtable
