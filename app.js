const express = require("express");
const { get_comments } = require("./youtube");
const dotenv = require("dotenv");
const { base } = require("./airtable.config");
const httpError = require("./model/http-error");
const mongoose = require("mongoose");
const youtube = require("./model/youtube");

const server = express();
dotenv.config();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

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
    email:req.body.email
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
  get_comments(youtube_link, req.body.id);

  res.status(200).json({
    data: youtube_exists,
    success: true,
    message: "Started scraping data",
  });
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

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("CONNECTED TO MONGODB");
    server.listen(PORT, () => {
      console.log(`STARTED LISTENING ON PORT ${PORT} @ ${new Date()} `);
    });
  })
  .catch((err) => {
    console.error(err, "WHILE CONNECTING TO MONGODB");
  });
