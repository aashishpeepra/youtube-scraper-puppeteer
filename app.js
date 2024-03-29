const express = require("express");
const { get_comments } = require("./youtube");
const dotenv = require("dotenv");
const cors = require("cors");
const httpError = require("./model/http-error");
const mongoose = require("mongoose");
const youtube = require("./model/youtube");
const get_meta_info = require("./functions/get-metadata");
const puppeteer = require("puppeteer");
const Queue = require("./helpers/Queue");

var browser; // This is the global reference for the Chromium puppeteer browser
var localQueue;

const server = express();
dotenv.config();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cors());
const PORT = process.env.PORT || 5000;

server.get("/retrieve-comments", async (req, res, next) => {
  if (!req.query.id) {
    return next(
      new httpError("Provide a valid query id with youtube id in it", 400)
    );
  }
  let youtube_exists = false;
  try {
    youtube_exists = await youtube.findOne({ id: req.query.id });
  } catch (err) {
    console.error(err);
    return next(new httpError("Something happened.Try again", 500));
  }
  if (!youtube_exists) {
    return next(new httpError("Can't find the youtube id provided"));
  } else {
    res.status(200).json({
      data: youtube_exists,
      message: "Here's the data for the youtube id " + req.query.id,
    });
  }
});

server.get("/restart-browser", async (req, res, next) => {
  if (req.query.password === "123") {
    // just a temp password so simple get request doesn't kill the browser
    try {
      browser = await puppeteer.launch({
        defaultViewport: null,
        slowMo: 10,
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } catch (err) {
      console.error(err, "WHILE RESTARTING THE BROWSER");
    }
    if (!browser) {
      res.status(500).json({
        message: "failed in restarting the browser. check logs",
        status: false,
      });
    } else {
      res.status(200).json({
        message: "restarted the brwoser",
        status: true,
      });
    }
  } else {
    res.status(403).json({
      message: "Incorrest request. Send the password",
      status: false,
    });
  }
});

server.post("/get-comments", async (req, res, next) => {
  if (!req.body.id) {
    return next(new httpError("Provide a valid id", 400));
  }
  // let's check if same youtube is still getting extracted
  let youtube_exists = false;
  try {
    youtube_exists = await youtube.findOne({ id: req.body.id });
  } catch (err) {
    console.log(err, "WHILE EXTRACTING ONE YOUTUBE", req.body.id);
    return next(new httpError("SOMETHING WENT WRONG.TRY AGAIN", 500));
  }

  if (
    youtube_exists &&
    (youtube_exists.status === "done" || youtube_exists.status == "processing")
  ) {
    // this means that youtube for this already exists
    res.status(200).json({
      data: youtube_exists,
      success: true,
      message: "Already exists.",
    });
    return;
  }

  // if reached here means we need to create a new youtube instance
  youtube_exists = youtube({
    id: req.body.id,
    status: "processing",
    comments: [],
    email: req.body.email,
  });

  try {
    await youtube_exists.save();
  } catch (err) {
    console.log(err, "while trying to save the youtube instance in DB");
    return next(
      new httpError(
        "WHILE TRYING TO SAVE THE NEW YOUTUBE INSTANCE TO DB. TRY AGAIN",
        500
      )
    );
  }

  // if reached here a new youtube instance is created
  // now can run the get-comments script
  let youtube_link = `https://www.youtube.com/watch?v=${req.body.id}`;

  res.status(200).json({
    data: youtube_exists,
    success: true,
    message: "Started scraping data",
  });

  // this is the place where I push a new page into the browser , instead I'll now push it into the queue
  // get_comments(browser,youtube_link, req.body.id);

  // adding the request into the queue
  localQueue.add_next({
    id: req.body.id,
    time: new Date().getTime().toString(),
  });
  let meta_data = false;
  try {
    meta_data = await get_meta_info(req.body.id);
  } catch (err) {
    console.error("Error while extracting meta data for", req.body.id, err);
  }
  if (!meta_data) {
    // maybe update the info in the DB that while processing meta data some error occured
    youtube_exists.meta_processing = "failed";
  } else {
    // reached here means we have meta data inside meta_data variable
    youtube_exists.title = meta_data.meta_data.title;
    youtube_exists.views = parseInt(meta_data.meta_data.views);
    youtube_exists.description = meta_data.meta_data.description;
    youtube_exists.date = meta_data.meta_data.date;
    youtube_exists.channel_name = meta_data.meta_data.channel_name;
    youtube_exists.transcript = meta_data.transcript;
    youtube_exists.meta_processing = "done";
  }

  try {
    await youtube_exists.save();
  } catch (err) {
    console.error("ERROR WHILE TRYING TO SAVE THE YOUTUBE META DATA", err);
    return;
  }
});

// server.use("/get-comments", async (req, res, next) => {
//   // this endpoint should be a post endpoint but for now will keep it at get
//   console.log(req.query);
//   if (!req.query.id) {
//     // in case when id is not given

//     return next(new httpError("Provide a valid id", 400));
//   }
//   //if the id is there then call the get_comment function
//   // don't forget to passs a callback in case of failure

//   // check if exists in airtable
//   let find_in_airtable = false;
//   let did_found_record = false;
//   try {
//     find_in_airtable = await base("youtube").select({
//       filterByFormula: `{id}='${req.query.id}'`,
//     });
//     await find_in_airtable.eachPage((records, fetchNextPage) => {
//       records.forEach((record) => {
//         find_in_airtable = record;
//         did_found_record = true;
//       });
//       fetchNextPage();
//     });
//   } catch (err) {
//     if (!err.statusCode) {
//       console.error(err, "`While finding record for query :", req.query.id);
//       return next(new httpError("Error while finding record in airtable", 500));
//     }
//   }
//   if (did_found_record) {
//     // record exists
//     // now going to return that go for comment
//     console.log(find_in_airtable);
//     res.json({
//       data: find_in_airtable.fields,
//     });
//     return;
//   } else {
//     // does not exists and have to create a new record
//     let newRecordId = false;
//     try {
//       let res = await base("youtube").create([
//         {
//           fields: {
//             id: req.query.id,
//             Status: "processing",
//           },
//         },
//       ]);
//       res.forEach((record) => {
//         newRecordId = record.getId();
//       });
//     } catch (err) {
//       console.error(err, req.query.id);
//       return next(
//         new httpError("Error while trying to save a new youtube record", 500)
//       );
//     }

//     // check if the new record id is false
//     if (!newRecordId) {
//       return next(
//         new httpError(
//           "Something went wrong while trying to get the new record id",
//           500
//         )
//       );
//     }
//     //now a new youtube record is added
//     // have to start the process for extracting the youtube comments
//     get_comments(
//       `https://www.youtube.com/watch?v=${req.query.id}`,
//       newRecordId
//     );
//   }

//   // asynchronous task for generating comments
//   // get_comments(`https://www.youtube.com/watch?v=${req.query.id}`);
//   res.json({
//     started: true,
//     id: req.query.id,
//   });
// });
async function wasBrowserKilled(browser) {
  const procInfo = await browser.process();
  return !!procInfo.signalCode; // null if browser is still running
}
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    // initializing the browser as soon as the server is live
    if (!browser || wasBrowserKilled(browser)) {
      try {
        browser = await puppeteer.launch({
          defaultViewport: null,
          slowMo: 10,
          headless: false,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      } catch (err) {
        console.error(err, "WHILE TRYING TO START THE BROWSER");
      }
    }

    localQueue = new Queue("localQueue.json", browser);
    await localQueue.start_initialization();
    console.log("CONNECTED TO MONGODB");
    server.listen(PORT, () => {
      console.log(`STARTED LISTENING ON PORT ${PORT} @ ${new Date()} `);
    });
  })
  .catch((err) => {
    console.error(err, "WHILE CONNECTING TO MONGODB");
  });
