const Path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : Path.dirname(process.execPath);
const {
  format,
} = require(Path.join(basePath, "/src/config.js"));
const GifEncoder = require("gifencoder");
const { writeFile } = require("fs");

class HashLipsGiffer {
  constructor(_fileName, _repeat, _quality, _delay) {
    this.width = format.width;
    this.height = format.height;
    this.fileName = _fileName;
    this.repeat = _repeat;
    this.quality = _quality;
    this.delay = _delay;
    this.initGifEncoder();
  }


  initGifEncoder = () => {
    this.gifEncoder = new GifEncoder(this.width, this.height);
    this.gifEncoder.setQuality(this.quality);
    this.gifEncoder.setRepeat(this.repeat);
    this.gifEncoder.setDelay(this.delay);
  };

  start = () => {
    this.gifEncoder.start();
  };

  add = (buf) => {
    this.gifEncoder.addFrame(buf);
  };

  stop = () => {
    this.gifEncoder.finish();
    const buffer = this.gifEncoder.out.getData();
    writeFile(this.fileName, buffer, (error) => { });
    console.log(`Created gif at ${this.fileName}`);
  };
}

module.exports = HashLipsGiffer;
