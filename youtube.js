const puppeteer = require("puppeteer");
const fs = require("fs")
/**
 * Write now all this file does is to print the youtube comments
 */

async function get_comments(youtubeLink) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(youtubeLink);

  // We know this page is loaded when the below selector renders on screen
  await page.waitForSelector("yt-visibility-monitor#visibility-monitor", {
    timeout: 60000,
  });
  await page.waitFor(1500); // time to breathe
  await console.log("video is in view!");

  // count the amount of youtube comments
  await page.evaluate(() => {
    window.scrollBy(0, 3500);
  });
  await page.waitForSelector("yt-formatted-string.count-text", {
    timeout: 60000,
  });

  const commentNumHandle = await page.$("yt-formatted-string.count-text");
  let commentNumber = await page.evaluate(
    (num) => num.innerText,
    commentNumHandle
  );
  console.log(commentNumber);

  await page.waitFor(1500);
  var comments = true;
  let data = {};
  let iters = 0;
  while (comments) {
      if(iters>600){
          break;
      }
    comments = await page.$$("yt-formatted-string#content-text");
    let shouldBreak = false;
    comments.forEach(async (element) => {
      let comment = await element.getProperty("innerText");
    //   console.log(await comment.jsonValue());
      let val = await comment.jsonValue();
      if( data[val]>2){
        //can't find any new comments  
        shouldBreak = true
      }
      if (!data[val]) {
          try{
            
        data[val]= 1;
          } catch{
              console.log(val, "is an error")
          }
        
        // console.log(val);
      }else{
          data[val]+=1
        //   console.log(val,data[val])
        }
    });
    await page.evaluate(() => {
      window.scrollBy(0, 3000);
    });
    if(shouldBreak){
        comments = false;
        break;
    }
    iters+=1;
  }
  console.log(data);
  let temp = Object.keys(data)
  fs.appendFileSync('comments3.txt','total comments extracted : ',temp.length + "\n\n\n")
  temp.forEach(value=>{
    fs.appendFileSync('comments3.txt', value+"\n\n\n",'utf-8');
  })
}

get_comments(
  "https://www.youtube.com/watch?v=q4Qg50USS4k"
);
