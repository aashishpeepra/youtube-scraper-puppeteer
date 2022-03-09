// get the meta info related to a youtube video
const axios = require("axios")

module.exports = async (youtubeId)=>{
    if(!youtubeId){
        console.error(youtubeId,"is not a valid youtube id")
        return {}
    }
    endpoint = `https://infotify-meta.herokuapp.com/${youtubeId}`
    try{
        let data = await axios.get(endpoint)
        return data.data;
    }catch(err){
        console.error(err);
        return {}
    }
    
}