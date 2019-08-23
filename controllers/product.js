var Product = require("../models/product");
var path = require("path");
var fs = require("fs");
var formidable = require("formidable");
var Product = require("../models/product.js");
var shortid = require("shortid");
//import shortid from "shortid";
//import AWS from "aws-sdk";
var AWS = require("aws-sdk");
AWS.config.update({
  accessKeyId: "AKIAIB7WQFTNOSPNOH4Q",
  secretAccessKey: "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",
  region: "us-west-2"
});

//Simple version, without validation or sanitation
exports.test = function(req, res) {
  res.send("Greetings from the Test controller!");
};

exports.product_with_image = function(req, res) {
  let _this = this,
    directory = path.join(__dirname + "/../public/media/productimges/");
  fs.exists(directory, function(exists) {
    if (exists) {
      console.log(exists, "exist");
      saveProductpic(req, res);
    } else {
      fs.mkdir(directory, function(err) {
        if (err) {
          _this.res.send(500, err);
        } else {
          console.log("not exist");
          saveProductpic(req, res);
        }
      });
    }
  });
};

var saveProductpic = function(req, res) {
  let form = new formidable.IncomingForm();
  var baby = [];
  form.keepExtensions = true; //keep file extension
  form.uploadDir = process.env.HOME_FOLDER + "/public/media/productimges/";
  form.multiples = true;
  form.parse(req, function(err, fields, files) {
    var arrfile = [];
    if (!Array.isArray(files.images)) {
      arrfile.push(files.images);
    } else {
      arrfile = files.images;
    }
    var successData = [];
    var i = 0;
    var length = arrfile.length;
    // console.log(arrfile, "arrfile");
    uploadRecursive(req, res, i, length, fields, files, successData);
    // uploadRecursive(req, res, i, length, fields, files, successData);
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
    console.log("uplaoding finished ");
    var fileName = successData[1];
    var location = successData[0];
    console.log(fields.name, fields.price, fields.offer, fields.saleprice);
    var product = new Product({
      name: fields.name,
      price: fields.price,
      saleprice: fields.saleprice,
      offer: fields.offer,
      rating: fields.rating,
      type: fields.type,
      producturl: location
    });

    product.save(function(err) {
      if (err) {
        return console.log(err, "err");
      }
      res.send("Product Created successfully");
    });
  } else {
    var fileType = files.images.type;
    fileType = fileType.split("/");
    var fileName = "IMG_" + shortid.generate() + "." + fileType[1];
    var baseImageUrl = path.join(
      __dirname + "/../public/media/productimges/",
      fileName
    );
    console.log(fileName, baseImageUrl);
    fs.rename(files.images.path, baseImageUrl, function(err) {
      if (err) {
        throw err;
      } else {
        var s3obj = new AWS.S3({
          params: {
            Bucket: "zadi-product-123",
            Key: "productimage/" + fileName,
            ACL: "public-read",
            ContentType: files.images.type
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

exports.product_create = function(req, res) {
  console.log(req.body, "resusd");
  var product = new Product({
    name: req.body.name,
    price: req.body.price,
    saleprice: req.body.saleprice,
    offer: req.body.offer,
    rating: req.body.rating
  });

  product.save(function(err) {
    if (err) {
      return console.log(err, "err");
    }
    res.send("Product Created successfully");
  });
};

exports.product_list = function(req, res) {
  Product.find({ type: req.params.id }, function(err, productlist) {
    if (err) return console.log(err);
    res.send(productlist);
  });
};

exports.product_details = function(req, res) {
  Product.findById(req.params.id, function(err, product) {
    if (err) return console.log(err);
    res.send(product);
  });
};

exports.product_update = function(req, res) {
  Product.findByIdAndUpdate(req.params.id, { $set: req.body }, function(
    err,
    product
  ) {
    if (err) return console.log(err);
    res.send("Product udpated.");
  });
};

exports.product_delete = function(req, res) {
  Product.findByIdAndRemove(req.params.id, function(err) {
    if (err) return console.log(err);
    res.send("Deleted successfully!");
  });
};
