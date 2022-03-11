/**
 * This entire file is dedicated for the development and use of a local queue
 * FLAWS -> I/O calls for the queue file requires time
 */
const path = require("path");
const fs = require("fs");
const FILE_PATH = "../localQueue.json";
const { get_comments } = require("../youtube");
const puppeteer = require("puppeteer");

async function read_queue(filepath) {
  let data = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(data);
}

async function write_queue(data, filepath) {
  fs.writeFileSync(filepath, JSON.stringify(data));
}
async function wasBrowserKilled(browser) {
  const procInfo = await browser.process();
  return !!procInfo.signalCode; // null if browser is still running
}
class Queue {
  constructor(filepath, browser) {
    // storing the current Queue path
    this.filepath = path.resolve('helpers',filepath);
    this.browser = browser;
    this.is_resources_blocked = false;
    this.queue = [];
  }
  async start_initialization() {
    let data = await read_queue(this.filepath);
    this.queue = data["data"]["queue"];
    this.validate_process()
  }
  heartbeat() {
    // just to check if the queue is connected and not lost
    return this.queue.length >= 0;
  }
   get_next() {
    // get the next element in the queue
    let current = this.queue.shift();
    if (current) {
      // means an element is removed and will have to change the queue
      write_queue(
        {
          data: {
            queue: this.queue,
          },
        },
        this.filepath
      );
    }
    console.log("REMOVED FROM QUEUE ---> ", current);
    return current;
  }
add_next(element) {
    this.queue.push(element);
    write_queue(
      {
        data: {
          queue: this.queue,
        },
      },
      this.filepath
    );

    console.log("ADDED TO QUEUE --> ", element);
    this.validate_process()
  }
  async start_process() {
    let current = this.get_next();
    if (!current) return;
    if (!this.browser) {
      // in this case the browser is not alive anymore
      try{
          this.browser = await puppeteer.launch({
        defaultViewport: null,
        slowMo: 10,
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      }catch(err){
          console.error(err);
          this.finish_processing()
      }
      
    }
    console.log("STARTED PROCESSING FOR ---> ", current);
    let exotic_finish_processing = this.finish_processing.bind(this);
    get_comments(
      this.browser,
      `https://www.youtube.com/watch?v=${current.id}`,
      current.id,
      exotic_finish_processing
    );
    this.is_resources_blocked = true;
  }
  validate_process() {
    if (this.is_resources_blocked) {
      // wait
    } else {
      this.start_process();
    }
  }
  finish_processing() {
    console.log("FINISHED PROCESSING. RELEASING RESOURCES");
    // this is to unclock the resources once the process is finished
    this.is_resources_blocked = false;
    this.validate_process();
  }
}

module.exports = Queue;
