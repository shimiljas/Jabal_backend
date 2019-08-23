var Ads = require("../models/ads");
var path = require("path");
var fs = require("fs");
var formidable = require("formidable");

var shortid = require("shortid");
//import shortid from "shortid";
//import AWS from "aws-sdk";
var AWS = require("aws-sdk");
AWS.config.update({
  accessKeyId: "AKIAIB7WQFTNOSPNOH4Q",
  secretAccessKey: "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",
  region: "us-west-2"
});

exports.create = function(req, res) {
  let _this = this,
    directory = path.join(__dirname + "/../public/media/adimges/");
  fs.exists(directory, function(exists) {
    if (exists) {
      console.log(exists, "exist");
      saveAdimages(req, res);
    } else {
      fs.mkdir(directory, function(err) {
        if (err) {
          _this.res.send(500, err);
        } else {
          console.log("not exist");
          saveAdimages(req, res);
        }
      });
    }
  });
};

var saveAdimages = function(req, res) {
  let form = new formidable.IncomingForm();
  var baby = [];
  form.keepExtensions = true; //keep file extension
  form.uploadDir = process.env.HOME_FOLDER + "/public/media/adimges/";
  form.multiples = true;
  form.parse(req, function(err, fields, files) {
    var arrfile = [];
    if (!Array.isArray(files.url)) {
      arrfile.push(files.image);
    } else {
      arrfile = files.image;
    }

    var successData = [];
    var i = 0;
    var length = arrfile.length;
    // console.log(arrfile, "arrfile");
    //  uploadRecursive(req, res, i, length, fields, files, successData);
    uploadRecursive(req, res, i, length, fields, files, successData);
  });
};

var uploadRecursive = function(
  req,
  res,
  i,
  length,
  fields,
  files,
  successData
) {
  //console.log("here");

  //let product = new Product();
  if (i == length || i > length) {
    console.log("uplaoding finished ", successData);
    var ad = new Ads({
      id: fields.id,
      url: successData[0]
    });

    ad.save(function(err) {
      if (err) {
        return console.log(err, "err");
      }
      res.send("Product Created successfully");
    });
  } else {
    var fileType = files.image.type;
    fileType = fileType.split("/");
    var fileName = "IMG_" + shortid.generate() + "." + fileType[1];
    var baseImageUrl = path.join(
      __dirname + "/../public/media/adimges/",
      fileName
    );
    fs.rename(files.image.path, baseImageUrl, function(err) {
      if (err) {
        throw err;
      } else {
        var s3obj = new AWS.S3({
          params: {
            Bucket: "zadi-product-123",
            Key: "adimage/" + fileName,
            ACL: "public-read",
            ContentType: files.image.type
          }
        });
        var body = fs.createReadStream(baseImageUrl);
        s3obj.upload(
          {
            Body: body
          },
          function(s3Err, s3Data) {
            if (s3Err) {
              res.status(400).json({
                message: "could not be uploaded"
              });
            } else {
              fs.unlink(baseImageUrl, function(err) {
                if (err) console.log(err);
                successData.push(s3Data.Location);
                successData.push(fileName);
                console.log(s3Data.Location, "s3Data.Location");
                i++;
                uploadRecursive(
                  req,
                  res,
                  i,
                  length,
                  fields,
                  files,
                  successData
                );
              });
            }
          }
        );
      }
    });
  }
};

exports.list = function(req, res) {
  Ads.find({}, function(err, productlist) {
    if (err) return console.log(err);
    res.send(productlist);
  });
};
