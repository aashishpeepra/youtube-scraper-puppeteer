const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const youtube = new Schema({
    id:{
        type:String,
        required:true
    },
    comments:[String],
    status:String,
    title:String,
    description:String,
    transcript:String

},{timestamps:true})

module.exports = mongoose.model('youtube',youtube)
