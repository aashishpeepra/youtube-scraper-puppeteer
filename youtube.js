const puppeteer = require("puppeteer");
const fs = require("fs");
const youtube = require("./model/youtube");
const { base } = require("./airtable.config");

/**
 * Write now all this file does is to print the youtube comments
 */

const Queue = [];

async function get_comments(youtubeLink, youtubeId) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  console.log(youtubeId);
  const page = await browser.newPage();
  await page.goto(youtubeLink);
  var security = 0;
  // var interval = setInterval(() => {
  //   if(Queue.length == 0){
  //     security++;
  //     return;
  //   }
  //   if(security==3){
  //     clearInterval(interval)
  //   }
  //   let batches = [];
  //   for (let i = 0; i < 4; i++) {
  //     let temp = [];
  //     if (Queue.length == 0) {
  //       break;
  //     }
  //     for (let j = 0; j < 10; j++) {
  //       if (Queue.length == 0) {
  //         break;
  //       }
  //       temp.push({
  //         fields: {
  //           value: Queue.shift(),
  //           youtube: [youtubeId],
  //         },
  //       });
  //     }
  //     if(temp.length>0){
  //       batches.push(temp)
  //     }
  //   }
  //   batches.forEach(batch=>{

  //     base('Comment').create(batch,function(err,records){
  //       if(err){
  //         console.log(err)
  //         return
  //       }
  //     });
  //   })
  // }, 30000);
  try {
    // We know this page is loaded when the below selector renders on screen
    await page.waitForSelector("yt-visibility-monitor#visibility-monitor", {
      timeout: 60000,
    });
    await page.waitFor(1500); // time to breathe
    await console.log("video is in view!");

    // count the amount of youtube comments
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await page.waitFor(1000);
    }

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
    let previous_length = 0;
    let false_alarm = 0;
    while (comments) {
      let new_length = Object.keys(data).length;
      console.log(previous_length, new_length, false_alarm);
      if (new_length == previous_length && previous_length != 0) {
        false_alarm++;
      } else {
        previous_length = new_length;
        false_alarm = 0;
      }
      if (false_alarm > 250) {
        break;
      }
      comments = await page.$$("yt-formatted-string#content-text");

      comments.forEach(async (element) => {
        let comment = await element.getProperty("innerText");
        //   console.log(await comment.jsonValue());
        let val = await comment.jsonValue();

        if (!data[val]) {
          try {
            data[val] = 1;
            try {
              await youtube.findOneAndUpdate(
                {
                  id: youtubeId,
                },
                {
                  $push: {
                    comments: val,
                  },
                }
              );
            } catch (err) {
              console.log(err, "while trying to enter comment into the DB");
            }
            console.log(val);
          } catch {
            console.log(val, "is an error");
          }

          // console.log(val);
        } else {
          data[val] += 1;
          //   console.log(val,data[val])
        }
      });
      await page.evaluate(() => {
        window.scrollBy(0, 3000);
      });
    }
    // try {
    //   let temp = Object.keys(data).map((each) => {
    //     return {
    //       fields: {
    //         value: each,
    //         youtube: [youtubeId],
    //       },
    //     };
    //   });

    //   // we have data to send in temp now need to break in batches of 10 pieces * 5 request per second

    //   // await base("Comment").create(temp);
    // } catch (err) {
    //   console.error(err);
    //   base("youtube").update([
    //     {
    //       id: youtubeId,
    //       fields: {
    //         Status: "failed",
    //       },
    //     },
    //   ]);
    //   page.close();
    //   browser.close();
    //   return;
    // }
    // console.log(data);
    // let temp = Object.keys(data);
    // fs.appendFileSync(
    //   "comments3.txt",
    //   "total comments extracted : ",
    //   temp.length + "\n\n\n"
    // );
    // temp.forEach((value) => {
    //   fs.appendFileSync("comments3.txt", value + "\n\n\n", "utf-8");
    // });
  } catch (err) {
    // this is the time when some error is encountered
    console.error(err);
    try {
      await youtube.findOneAndUpdate(
        {
          id: youtubeId,
        },
        {
          status: "failed",
        }
      );
    } catch (err) {
      console.error(err);
    }

    // base("youtube").update([
    //   {
    //     id: youtubeId,
    //     fields: {
    //       Status: "failed",
    //     },
    //   },
    // ]);
    page.close();
    browser.close();
    return;
  }

  // all data is extracted and now changing the status

  // base("youtube").update([
  //   {
  //     id: youtubeId,
  //     fields: {
  //       Status: "done",
  //     },
  //   },
  // ]);
  try {
    await youtube.findOneAndUpdate(
      {
        id: youtubeId,
      },
      {
        status: "done",
      }
    );
  } catch (err) {
    console.error(err);
  }

  // now everything is done so can succesfully close all running tasks
  page.close();
  browser.close();
}

// get_comments(
//   "https://www.youtube.com/watch?v=q4Qg50USS4k"
// );

exports.get_comments = get_comments;
