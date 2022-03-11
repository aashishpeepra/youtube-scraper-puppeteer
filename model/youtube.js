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
    transcript:String,
    email:String,
    date:String,
    channel_name:String,
    transcript:String,
    views:Number,
    meta_processing:{
        type:String,
        default:"pending"
    },
    total_comments:Number

},{timestamps:true})

module.exports = mongoose.model('youtube',youtube)
