import babyObj from "./models/baby.js";
import connectBabyObj from "./models/connectBaby.js";
import babyPlanObj from "./models/babyPlan.js";
import communityObj from "./../community/models/community.js";
import constantObj from "./../../constants.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import shortid from "shortid";
import formidable from "formidable";
import async from "async";
import Users from "./../accounts/models/register.js";
import deeplink from "node-deeplink";
import userNotification from "./../../common/userNotification.js";
var MobileDetect = require("mobile-detect");
const request = require("request");
var os = require("os");
var cron = require("node-cron");
AWS.config.update({
  accessKeyId: "AKIAJURRBFYZQS2LCBJA",
  secretAccessKey: "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",
  region: "us-west-2"
});

var moment = require("moment");
// cron.schedule('*/1 * * * *', function(){
//   Users.find({"status" : false},function(err,resp){
//   })
// });

var TinyURL = require("tinyurl");
/***************************************************************
Add baby directory check
***************************************************************/

exports.addbaby = function(req, res) {
  let _this = this,
    directory = path.join(__dirname + "/../../public/media/babyImages/");
  fs.exists(directory, function(exists) {
    if (exists) {
      saveBabypic(req, res);
    } else {
      fs.mkdir(directory, function(err) {
        if (err) {
          _this.res.send(500, err);
        } else {
          saveBabypic(req, res);
        }
      });
    }
  });
};

/**************************************************************
formdata parse and call recursive funtion to add baby details 
***************************************************************/
var saveBabypic = function(req, res) {
  let form = new formidable.IncomingForm();
  var baby = [];

  var file_path = [];
  form.keepExtensions = true; //keep file extension
  form.uploadDir = process.env.PWD + "/public/media/babyImages";
  form.multiples = true;
  form.maxFileSize = 1024 * 1024 * 1024 * 1024;
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
    uploadRecursive(req, res, i, length, fields, files, successData);
  });
};

/**************************************************************
Recurssive function to add baby details 
***************************************************************/
var uploadRecursive = function(
  req,
  res,
  i,
  length,
  fields,
  files,
  successData
) {
  let users = new Users();
  let lang = "";
  if (req.headers.lang) {
    lang = req.headers.lang;
  } else {
    lang = "en";
  }
  let outputJSON = "";
  if (i == length || i > length) {
    //uploading finished
    var fileName = successData[1];
    var location = successData[0];
    fields.fileName = fileName;
    fields.location = location;
    var momentDate = moment().add(30, "days");
    var expiryDate = new Date(momentDate);
    fields.planExpiryDate = expiryDate;
    var localFath = null;
    if (fields.filepath) {
      localFath = JSON.parse(fields.filepath);
    }
    fields.file_path = [{ location: location, localPath: localFath }];
    if (fields.babyId != null || fields.babyId != undefined) {
      babyObj.findOneAndUpdate(
        {
          _id: mongoose.Types.ObjectId(fields.babyId)
        },
        {
          $set: {
            name: fields.name,
            place: fields.place,
            gender: fields.gender,
            relation: fields.relation,
            dob: fields.dob,
            location: fields.location,
            fileName: fields.fileName,
            file_path: fields.file_path
          }
        },
        {
          upsert: true,
          new: true
        },
        function(err, resp) {
          if (resp) {
            outputJSON = {
              status: constantObj.httpStatus.success,
              message: constantObj.messages.babyAddSuccess[lang],
              data: resp
            };
            res.status(constantObj.httpStatus.success).send(outputJSON);
          } else {
            outputJSON = {
              status: constantObj.httpStatus.badRequest,
              message: constantObj.messages.babyAddFailure[lang]
            };
            res.status(constantObj.httpStatus.badRequest).send(outputJSON);
          }
        }
      );
    } else {
      Users.findOne({ _id: mongoose.Types.ObjectId(fields.userId) }, function(
        getuserErr,
        getuserSuccess
      ) {
        if (getuserErr) {
          outputJSON = {
            status: constantObj.httpStatus.badRequest,
            message: constantObj.messages.babyAddFailure[lang]
          };
          res.status(constantObj.httpStatus.badRequest).send(outputJSON);
        } else {
          fields.plan_id = getuserSuccess.plan_id;
          fields.usedStorage = getuserSuccess.usedStorage;
          fields.planActiveDate = getuserSuccess.planActiveDate;
          fields.planExpiryDate = getuserSuccess.planExpiryDate;
          fields.totalStorage = getuserSuccess.totalStorage;
          babyObj(fields).save(fields, function(err, data) {
            if (err) {
              outputJSON = {
                status: constantObj.httpStatus.badRequest,
                message: constantObj.messages.babyAddFailure[lang]
              };
              res.status(constantObj.httpStatus.badRequest).send(outputJSON);
            } else {
              Users.update(
                {
                  _id: mongoose.Types.ObjectId(fields.userId)
                },
                {
                  $set: {
                    hasBaby: true
                  }
                },
                function(err, resUpdate) {
                  if (resUpdate) {
                    outputJSON = {
                      status: constantObj.httpStatus.success,
                      message: constantObj.messages.babyAddSuccess[lang],
                      babyId: data._id,
                      babydata: data
                    };
                    res.status(constantObj.httpStatus.success).send(outputJSON);
                  } else {
                    outputJSON = {
                      status: constantObj.httpStatus.badRequest,
                      message: constantObj.messages.babyAddFailure[lang]
                    };
                    res
                      .status(constantObj.httpStatus.badRequest)
                      .send(outputJSON);
                  }
                }
              );
            }
          });
        }
      });
    }
  } else {
    var fileType = files.images.type;
    fileType = fileType.split("/");
    var fileName = "IMG_" + shortid.generate() + "." + fileType[1];
    var baseImageUrl = path.join(
      __dirname + "/../../public/media/babyImages/",
      fileName
    );
    fs.rename(files.images.path, baseImageUrl, function(err) {
      if (err) {
        throw err;
      } else {
        var s3obj = new AWS.S3({
          params: {
            Bucket: "baby2familyoregon1",
            Key: "profileImages/" + fileName,
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

/**************************************************************
check directory for update baby information
***************************************************************/
exports.updatebaby = function(req, res) {
  let _this = this,
    directory = path.join(__dirname + "/../../public/media/babyImages/");
  fs.exists(directory, function(exists) {
    if (exists) {
      updateBabypic(req, res);
    } else {
      fs.mkdir(directory, function(err) {
        if (err) {
          _this.res.send(500, err);
        } else {
          updateBabypic(req, res);
        }
      });
    }
  });
};

/**************************************************************
formdata parse and call recursive funtion to update baby details 
***************************************************************/
var updateBabypic = function(req, res) {
  let form = new formidable.IncomingForm();
  let outputJSON;
  let baby = [];
  let lang = "";
  if (req.headers.lang) {
    lang = req.headers.lang;
  } else {
    lang = "en";
  }
  form.keepExtensions = true; //keep file extension
  form.uploadDir = process.env.PWD + "/public/media/babyImages";
  form.multiples = true;
  form.parse(req, function(err, fields, files) {
    if (Object.keys(files).length == 0) {
      babyObj.findOneAndUpdate(
        {
          _id: fields.babyId
        },
        {
          $set: {
            name: fields.name,
            place: fields.place,
            gender: fields.gender,
            relation: fields.relation,
            dob: fields.dob
          }
        },
        {
          upsert: true,
          new: true
        },
        function(err, resp) {
          if (resp) {
            let obj = {
              name: fields.name,
              place: fields.place,
              gender: fields.gender,
              relation: fields.relation,
              dob: fields.dob,
              location: resp.location
            };
            outputJSON = {
              status: constantObj.httpStatus.success,
              message: constantObj.messages.babyUpdated[lang],
              data: obj
            };
            res.status(constantObj.httpStatus.success).send(outputJSON);
          } else {
            outputJSON = {
              status: constantObj.httpStatus.badRequest,
              message: constantObj.messages.babynotUpdated[lang]
            };
            res.status(constantObj.httpStatus.badRequest).send(outputJSON);
          }
        }
      );
    } else {
      var arrfile = [];
      if (!Array.isArray(files.images)) {
        arrfile.push(files.images);
      } else {
        arrfile = files.images;
      }
      var successData = [];
      var i = 0;
      var length = arrfile.length;
      uploadRecursive(req, res, i, length, fields, files, successData);
    }
  });
};

/**************************************************************
get all babies for admin frontend
***************************************************************/
exports.getBabies1 = function(req, res) {
  let outputJSON = "";
  let obj = [];
  var coordinate = [];
  coordinate[0] = req.params.long;
  coordinate[1] = req.params.lat;
  Users.find(
    {
      _id: req.params.userId
    },
    {
      defaultBaby: 1
    }
  ).exec(function(userErr, userData) {
    if (userErr) {
      outputJSON = {
        status: constantObj.httpStatus.success,
        message: userErr
      };
      res.status(200).send(outputJSON);
    } else {
      communityObj.find(
        {
          is_deleted: false
        },
        {
          name: 1
        },
        function(communityErr, communityData) {
          if (communityErr) {
            outputJSON = {
              status: constantObj.httpStatus.success,
              message: communityErr
            };
            res.jsonp(outputJSON);
          } else {
            babyObj
              .find({
                userId: req.params.userId,
                is_deleted: false
              })
              .exec(function(err1, response1) {
                if (response1.length > 0) {
                  babyObj.find(
                    {
                      connectedUsers: {
                        $in: [req.params.userId]
                      }
                    },
                    function(err2, response2) {
                      if (response2.length > 0) {
                        obj = response1;
                        obj.push(response2[0]);
                        outputJSON = {
                          status: constantObj.httpStatus.success,
                          message: constantObj.messages.successRetreivingData,
                          data: {
                            defaultBaby: userData[0].defaultBaby,
                            data: obj,
                            tab: communityData
                          }
                        };
                        res.status(200).send(outputJSON);
                      } else {
                        outputJSON = {
                          status: constantObj.httpStatus.success,
                          message: constantObj.messages.successRetreivingData,
                          data: {
                            defaultBaby: userData[0].defaultBaby,
                            data: response1,
                            tab: communityData
                          }
                        };
                        res.status(200).send(outputJSON);
                      }
                    }
                  );
                } else {
                  babyObj.find(
                    {
                      connectedUsers: {
                        $in: [req.params.userId]
                      },
                      is_deleted: false
                    },
                    function(err3, response3) {
                      if (response3.length > 0) {
                        outputJSON = {
                          status: constantObj.httpStatus.success,
                          message: constantObj.messages.successRetreivingData,
                          data: {
                            defaultBaby: userData[0].defaultBaby,
                            data: response3,
                            tab: communityData
                          }
                        };
                        res.status(200).send(outputJSON);
                      } else {
                        outputJSON = {
                          status: constantObj.httpStatus.noContent,
                          message: constantObj.messages.successRetreivingData
                        };
                        res.status(200).send(outputJSON);
                      }
                    }
                  );
                }
              });
          }
        }
      );
    }
  });
};

/**************************************************************
                 add baby growth details
***************************************************************/
exports.addGrowth = function(req, res) {
  let babyobj = req.body;
  let outputJSON = "";
  var lang = req.body.lang;
  babyObj.findOne(
    {
      _id: req.body.babyId
    },
    function(req1, response) {
      if (response) {
        var newage = getage(response.dob, req.body.date);
        req.body.age = newage;
        if (req.body.unittype == "SI unit") {
          var percentage = babyGrowthPercentage(
            Math.round(parseInt(req.body.weight) * 2.20462),
            Math.round(parseInt(req.body.height) * 0.393701),
            newage,
            req.body.unittype,
            response.gender
          );

          var inputGrowthData = req.body;
          inputGrowthData.weight = {
            SI: req.body.weight,
            US: Math.round(parseInt(req.body.weight) * 2.20462)
          };
          if (Math.round(parseInt(req.body.height) * 0.393701) <= 10) {
            var height = 10;
          } else {
            var height = Math.round(parseInt(req.body.height) * 0.393701);
          }
          inputGrowthData.height = {
            SI: req.body.height,
            US: height
          };

          if (Math.round(parseInt(req.body.headCirc) * 0.393701) <= 10) {
            var headCirc = 10;
          } else {
            var headCirc = Math.round(parseInt(req.body.headCirc) * 0.393701);
          }

          inputGrowthData.headCirc = {
            SI: req.body.headCirc,
            US: headCirc
          };
          inputGrowthData.weightUnit = {
            SI: "kg",
            US: "lbs"
          };
          inputGrowthData.heightUnit = {
            SI: "cm",
            US: "inch"
          };

          inputGrowthData.headCircUnit = {
            SI: "cm",
            US: "inch"
          };

          inputGrowthData.heightPercent = {
            SI: req.body.heightPercent,
            US: Math.round(percentage.heightPercentage)
          };

          inputGrowthData.weightPercent = {
            SI: req.body.weightPercent,
            US: Math.round(percentage.weightPercentage)
          };
        } else if (req.body.unittype == "US unit") {
          var percentage = babyGrowthPercentage(
            Math.round(parseInt(req.body.weight) * 0.453592),
            Math.round(parseInt(req.body.height) * 2.54),
            newage,
            req.body.unittype,
            response.gender
          );

          var inputGrowthData = req.body;
          inputGrowthData.weight = {
            US: req.body.weight,
            SI: Math.round(parseInt(req.body.weight) * 0.453592)
          };
          inputGrowthData.height = {
            US: req.body.height,
            SI: Math.round(parseInt(req.body.height) * 2.54)
          };
          inputGrowthData.headCirc = {
            US: req.body.headCirc,
            SI: Math.round(parseInt(req.body.headCirc) * 2.54)
          };
          inputGrowthData.weightUnit = {
            US: "lbs",
            SI: "kg"
          };
          inputGrowthData.heightUnit = {
            US: "inch",
            SI: "cm"
          };

          inputGrowthData.headCircUnit = {
            US: "inch",
            SI: "cm"
          };

          inputGrowthData.heightPercent = {
            US: req.body.heightPercent,
            SI: Math.round(percentage.heightPercentage)
          };

          inputGrowthData.weightPercent = {
            US: req.body.weightPercent,
            SI: Math.round(percentage.weightPercentage)
          };
        }
        babyObj.findOneAndUpdate(
          {
            _id: req.body.babyId
          },
          {
            $push: {
              babyGrowth: inputGrowthData
            }
          },
          {
            upsert: true,
            new: true
          },
          function(err, data) {
            if (err) {
              outputJSON = {
                status: constantObj.httpStatus.noContent,
                message: constantObj.messages.errorRetreivingData
              };
            } else {
              outputJSON = {
                status: constantObj.httpStatus.success,
                message: constantObj.messages.growthUpdateSuccess[lang],
                data: req.body
              };
            }
            res.status(200).send(outputJSON);
          }
        );
      }
    }
  );
};

/**
 * Add Vaccination in baby object(s) (Bulk update)
 * Input: Add Vaccination in baby object(s)
 * Output: Success message
 * This function is used to for bulk updation for category object(s)
 */
exports.addVaccination = function(req, res) {
  var errorMessage = "";
  var outputJSON = "";
  var inputData = {};
  inputData.date = req.body.date;
  inputData.time = req.body.time;
  inputData.vaccine_id = req.body.vaccine_id;
  var lang = req.body.lang;
  babyObj.update(
    {
      _id: req.body._id,
      "vaccination.vaccine_id": {
        $ne: inputData.vaccine_id
      }
    },
    {
      $push: {
        vaccination: inputData
      }
    },
    function(err, data) {
      if (err) {
        switch (err.name) {
          case "ValidationError":
            for (field in err.errors) {
              if (errorMessage == "") {
                errorMessage = err.errors[field].message;
              } else {
                errorMessage += ", " + err.errors[field].message;
              }
            } //for
            break;
        } //switch
        outputJSON = {
          status: "failure",
          messageId: 401,
          message: errorMessage
        };
        res.jsonp(outputJSON);
      } else {
        //if
        if (data.nModified == 1) {
          outputJSON = {
            status: "success",
            messageId: 200,
            message: constantObj.messages.vaccineAdd[lang],
            data: data
          };
          res.jsonp(outputJSON);
        }
        if (data.nModified == 0) {
          //var productMessage = "Vaccination already exist in this baby."
          babyObj.update(
            {
              _id: req.body._id,
              "vaccination.vaccine_id": inputData.vaccine_id
            },
            {
              $set: {
                "vaccination.$.date": inputData.date
              }
            },
            function(err, data) {
              if (err) {
                switch (err.name) {
                  case "ValidationError":
                    for (field in err.errors) {
                      if (errorMessage == "") {
                        errorMessage = err.errors[field].message;
                      } else {
                        errorMessage += ", " + err.errors[field].message;
                      }
                    } //for
                    break;
                } //switch
                outputJSON = {
                  status: "failure",
                  messageId: 401,
                  message: errorMessage
                };
                res.jsonp(outputJSON);
              } else {
                //if
                if (data.nModified == 1) {
                  //var productMessage = "Vaccination has been updated successfully."
                  outputJSON = {
                    status: "success",
                    messageId: 200,
                    message: constantObj.messages.VaccineUpdate[lang],
                    data: data
                  };
                  res.jsonp(outputJSON);
                } else {
                  //var productMessage = "Vaccination has been already updated."
                  outputJSON = {
                    status: "success",
                    messageId: 200,
                    message: constantObj.messages.vaccineAlreadyUpdate[lang],
                    data: data
                  };
                  res.jsonp(outputJSON);
                }
              }
            }
          );
        }
      }
    }
  );
};

/*************************************************************************
API to get invitation code for connecting baby For without deep linking
**************************************************************************/
exports.connectBabycodeOld = async function(req, res) {
  let outputJSON = "";
  var connectData = [];
  let obj = {};
  var connectCode = inviteCode(req, res);
  var inputData = {
    userId: req.headers.id,
    babyId: req.body.babyId,
    connectBabycode: connectCode
  };
  var url = "https://spearheadcontent.com/access/platform?" + connectCode;
  await TinyURL.shorten(url, function(shortUrl) {
    connectBabyObj(inputData).save(inputData, function(err, data) {
      if (err) {
        outputJSON = {
          status: constantObj.httpStatus.noContent,
          msg: constantObj.messages.errorRetreivingData
        };
      } else {
        obj.url = shortUrl;
        obj.babyId = data.babyId;
        obj.connectBabycode = data.connectBabycode;
        obj.usedStatus = data.usedStatus;
        obj.userId = data.userId;
        obj._id = data._id;
        data = obj;
        outputJSON = {
          status: constantObj.httpStatus.success,
          msg: constantObj.messages.babyCodesuccess,
          data: data
        };
      }
      res.status(200).send(outputJSON);
    });
  });
};

/*************************************************************************
API to get invitation code for connecting baby according to deep linking
**************************************************************************/
exports.connectBabycode = function(req, res) {
  let outputJSON = "";
  var connectData = [];
  let obj = {};
  var connectCode = inviteCode(req, res);
  var headers = {
    "Content-Type": "application/json"
  };
  var postData = {
    branch_key: "key_live_phC0NiuPTetA53NL1nznqmgcCyaf2FOY"
  };
  var options = {
    url: "https://api.branch.io/v1/url",
    method: "POST",
    headers: headers,
    form: JSON.stringify(postData)
  };
  request(options, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var obj1 = JSON.parse(body);
      var link = obj1.url;
      var inputData = {
        userId: req.headers.id,
        babyId: req.body.babyId,
        connectBabycode: connectCode
      };
      connectBabyObj(inputData).save(inputData, function(err, data) {
        if (err) {
          outputJSON = {
            status: constantObj.httpStatus.badRequest,
            msg: constantObj.messages.badErr["en"]
          };
          res.status(outputJSON.status).send(outputJSON);
        } else {
          obj.url = link;
          obj.babyId = data.babyId;
          obj.connectBabycode = data.connectBabycode;
          obj.usedStatus = data.usedStatus;
          obj.userId = data.userId;
          obj._id = data._id;
          data = obj;
          outputJSON = {
            status: constantObj.httpStatus.success,
            msg: constantObj.messages.babyCodesuccess,
            data: data
          };
        }
        res.status(200).send(outputJSON);
      });
    } else {
      outputJSON = {
        status: constantObj.httpStatus.badRequest,
        msg: constantObj.messages.badErr["en"]
      };
      res.status(outputJSON.status).send(outputJSON);
    }
  });
};

/**************************************************************
Deeplinking according to device platform
***************************************************************/
exports.getPlatform = function(req, res) {
  let outputJSON = "";
  if (req.body.obj == "iPhone") {
    res.json({
      status: 200,
      data: req.body.obj
    });
  } else {
    res.json({
      status: 200,
      data: req.body.obj
    });
  }
};

/**************************************************************
  connect baby by accepting invitation code
***************************************************************/
exports.connectBaby = function(req, res) {
  let outputJSON = "";
  let obj = {};
  let lang;
  if (req.body.lang) {
    lang = req.body.lang;
  } else {
    lang = "en";
  }
  let connectData = {};
  connectBabyObj.find(
    {
      connectBabycode: req.body.connectBabycode
    },
    function(err, resp) {
      if (err) {
        outputJSON = {
          status: constantObj.httpStatus.noContent,
          msg: constantObj.messages.errorRetreivingData[lang]
        };
        res.status(200).send(outputJSON);
      } else {
        if (resp.length > 0) {
          if (resp[0].userId == mongoose.Types.ObjectId(req.headers.id)) {
            outputJSON = {
              status: constantObj.httpStatus.badRequest,
              msg: constantObj.messages.codeerrormessgeUser[lang]
            };
            res.status(200).send(outputJSON);
          } else {
            if (resp[0].usedStatus == true) {
              outputJSON = {
                status: constantObj.httpStatus.noContent,
                msg: constantObj.messages.connectBabycodeUsed[lang]
              };
              res.status(200).send(outputJSON);
            } else {
              connectBabyObj.find(
                {
                  babyId: resp[0].babyId,
                  connectTo: req.headers.id,
                  is_deleted: false
                },
                function(errors, responses) {
                  if (responses.length > 0) {
                    outputJSON = {
                      status: constantObj.httpStatus.notAcceptable,
                      msg: constantObj.messages.babyalreadyyours[lang]
                    };
                    res.status(200).send(outputJSON);
                  } else {
                    connectBabyObj.update(
                      {
                        connectBabycode: req.body.connectBabycode
                      },
                      {
                        $set: {
                          connectTo: req.headers.id,
                          usedStatus: true,
                          relation: req.body.relation
                        }
                      },
                      function(errdata, respdata) {
                        if (errdata) {
                          outputJSON = {
                            status: constantObj.httpStatus.noContent,
                            msg: constantObj.messages.errorRetreivingData[lang]
                          };
                          res.status(200).send(outputJSON);
                        } else {
                          Users.update(
                            {
                              _id: req.headers.id
                            },
                            {
                              $push: {
                                babiesConnected: resp.babyId
                              },
                              $set: {
                                hasBaby: true
                              }
                            },
                            {
                              upsert: true,
                              new: true
                            }
                          ).exec(function(errr, data1) {
                            if (errr) {
                              outputJSON = {
                                status: constantObj.httpStatus.noContent,
                                msg:
                                  constantObj.messages.errorRetreivingData[lang]
                              };
                              res.status(200).send(outputJSON);
                            } else {
                              Users.update(
                                {
                                  $or: [
                                    {
                                      _id: req.headers.id
                                    },
                                    {
                                      _id: resp[0].userId
                                    }
                                  ],
                                  isDeleted: false
                                },
                                {
                                  $inc: {
                                    coins: 1
                                  }
                                },
                                {
                                  multi: true
                                },
                                function(errors1, responses1) {
                                  if (errors1) {
                                    outputJSON = {
                                      status: constantObj.httpStatus.badRequest,
                                      msg:
                                        constantObj.messages
                                          .errorRetreivingData[lang]
                                    };
                                    res.status(200).send(outputJSON);
                                  } else {
                                    babyObj.findOne(
                                      {
                                        _id: resp[0].babyId
                                      },
                                      function(err1, response) {
                                        if (err1) {
                                          outputJSON = {
                                            status:
                                              constantObj.httpStatus.noContent,
                                            msg:
                                              constantObj.messages
                                                .errorRetreivingData[lang]
                                          };
                                          res.status(200).send(outputJSON);
                                        } else {
                                          babyObj
                                            .update(
                                              {
                                                _id: resp[0].babyId
                                              },
                                              {
                                                $push: {
                                                  connectedUsers: req.headers.id
                                                }
                                              },
                                              {
                                                upsert: true,
                                                new: true
                                              }
                                            )
                                            .exec(function(err3, data) {
                                              if (err3) {
                                                outputJSON = {
                                                  status:
                                                    constantObj.httpStatus
                                                      .noContent,
                                                  msg:
                                                    constantObj.messages
                                                      .errorRetreivingData[lang]
                                                };
                                                res
                                                  .status(200)
                                                  .send(outputJSON);
                                              } else {
                                                response.connectedUsers.push(
                                                  response.userId
                                                );
                                                var msg = {
                                                  en:
                                                    "New family member added in " +
                                                    response.name +
                                                    "'s family." +
                                                    moment().format(),
                                                  ch:
                                                    "新家庭成员加入" +
                                                    response.name +
                                                    "的家庭." +
                                                    moment().format(),
                                                  es:
                                                    "Nuevo miembro familia agregado en la familia de " +
                                                    response.name +
                                                    "." +
                                                    moment().format()
                                                };
                                                userNotification.notifyNewFamilyMember(
                                                  msg,
                                                  "No Need this data",
                                                  "New Member",
                                                  response.connectedUsers
                                                );
                                                babyObj.find(
                                                  {
                                                    userId: req.headers.id
                                                  },
                                                  function(err4, responses) {
                                                    if (err4) {
                                                      outputJSON = {
                                                        status:
                                                          constantObj.httpStatus
                                                            .noContent,
                                                        msg:
                                                          constantObj.messages
                                                            .errorRetreivingData[
                                                            lang
                                                          ]
                                                      };
                                                      res
                                                        .status(200)
                                                        .send(outputJSON);
                                                    } else {
                                                      Users.findOne(
                                                        {
                                                          _id: req.headers.id
                                                        },
                                                        function(err5, resp1) {
                                                          if (err5) {
                                                            outputJSON = {
                                                              status:
                                                                constantObj
                                                                  .httpStatus
                                                                  .noContent,
                                                              msg:
                                                                constantObj
                                                                  .messages
                                                                  .errorRetreivingData[
                                                                  lang
                                                                ]
                                                            };
                                                            res
                                                              .status(200)
                                                              .send(outputJSON);
                                                          } else {
                                                            outputJSON = {
                                                              status:
                                                                constantObj
                                                                  .httpStatus
                                                                  .success,
                                                              token:
                                                                resp1.token,
                                                              email:
                                                                resp1.email,
                                                              _id: resp1._id,
                                                              name: resp1.name,
                                                              type: resp1.type,
                                                              dob: resp1.dob,
                                                              profileImage_path:
                                                                resp1.profileImage_path,
                                                              baby: responses,
                                                              msg:
                                                                constantObj
                                                                  .messages
                                                                  .hasBaby[lang]
                                                            };
                                                            res
                                                              .status(200)
                                                              .send(outputJSON);
                                                          }
                                                        }
                                                      );
                                                    }
                                                  }
                                                );
                                              }
                                            });
                                        }
                                      }
                                    );
                                  }
                                }
                              );
                            }
                          });
                        }
                      }
                    );
                  }
                }
              );
            }
          }
        } else {
          outputJSON = {
            status: constantObj.httpStatus.noContent,
            msg: constantObj.messages.invalidCode[lang]
          };
          res.status(200).send(outputJSON);
        }
      }
    }
  );
};

exports.connectBabyList = function(req, res) {
  let users = new Users();
  let outputJSON = "";
  Users.find(
    {
      _id: req.params.userId
    },
    function(err, response) {
      if (response) {
        outputJSON = {
          status: constantObj.httpStatus.success,
          msg: constantObj.messages.successRetreivingData,
          data: response[0].babiesConnected
        };
        res.status(200).send(outputJSON);
      } else {
        outputJSON = {
          status: constantObj.httpStatus.noContent,
          msg: constantObj.messages.errorRetreivingData
        };
        res.status(200).send(outputJSON);
      }
    }
  );
};

exports.connectBabyData = function(req, res) {
  let users = new Users();
  let _this = this;
  let outputJSON = "";
  Users.findOne({
    babiesConnected: {
      $elemMatch: {
        babyId: req.params.babyId
      }
    }
  }).exec(function(err, data) {
    if (data) {
      for (var i = 0; i < data.babiesConnected.length; i++) {
        if (data.babiesConnected[i].babyId == req.params.babyId) {
          let relationship = data.babiesConnected[i].babyRelation;
          babyObj.findOne(
            {
              _id: req.params.babyId
            },
            function(err, response) {
              if (err) {
                outputJSON = {
                  status: constantObj.httpStatus.noContent,
                  msg: constantObj.messages.errorRetreivingData
                };
              } else {
                outputJSON = {
                  status: constantObj.httpStatus.success,
                  msg: constantObj.messages.successRetreivingData,
                  data: response,
                  userRelationship: relationship
                };
              }
              res.status(200).send(outputJSON);
            }
          );
        }
      }
    }
  });
};

function calculateage(date, growthdate) {
  var today = new Date(
    growthdate.substring(0, 4),
    growthdate.substring(5, 7) - 1,
    growthdate.substring(8, 10)
  );
  var yearNow = today.getYear();
  var monthNow = today.getMonth();
  var dateNow = today.getDate();

  var dob = new Date(
    date.substring(0, 4),
    date.substring(5, 7) - 1,
    date.substring(8, 10)
  );

  var yearDob = dob.getYear();
  var monthDob = dob.getMonth();
  var dateDob = dob.getDate();
  var age = {};
  var ageString = "";
  var yearString = "";
  var monthString = "";
  var dayString = "";

  var yearage = yearNow - yearDob;
  if (monthNow >= monthDob) {
    var monthage = monthNow - monthDob;
  } else {
    yearage--;
    var monthage = 12 + monthNow - monthDob;
  }

  if (dateNow >= dateDob) var dateage = dateNow - dateDob;
  else {
    monthage--;
    var dateage = 31 + dateNow - dateDob;

    if (monthage < 0) {
      monthage = 11;
      yearage--;
    }
  }

  age = {
    years: yearage,
    months: monthage,
    days: dateage
  };

  if (age.years > 1) yearString = " years";
  else yearString = " year";
  if (age.months > 1) monthString = " months";
  else monthString = " month";
  if (age.days > 1) dayString = " days";
  else dayString = " day";

  if (age.years > 0 && age.months > 0 && age.days > 0)
    ageString =
      age.years +
      yearString +
      " " +
      age.months +
      monthString +
      " " +
      age.days +
      dayString +
      " ";
  else if (age.years == 0 && age.months == 0 && age.days > 0)
    ageString = " " + age.days + dayString + " ";
  else if (age.years > 0 && age.months == 0 && age.days == 0)
    ageString = age.years + yearString + "  Happy Birthday!!";
  else if (age.years > 0 && age.months > 0 && age.days == 0)
    ageString = age.years + yearString + " " + age.months + monthString;
  else if (age.years == 0 && age.months > 0 && age.days > 0)
    ageString = age.months + monthString + " " + age.days + dayString + " ";
  else if (age.years > 0 && age.months == 0 && age.days > 0)
    ageString = age.years + yearString + " " + age.days + dayString + " ";
  else if (age.years == 0 && age.months > 0 && age.days == 0)
    ageString = age.months + monthString + " ";
  else ageString = "Oops! Could not calculate age!";

  return ageString;
}

/**************************************************************
get age for baby growth
***************************************************************/
function getage(date, growthdate) {
  var today = new Date(
    growthdate.substring(0, 4),
    growthdate.substring(5, 7) - 1,
    growthdate.substring(8, 10)
  );
  var birthDate = new Date(
    date.substring(0, 4),
    date.substring(5, 7) - 1,
    date.substring(8, 10)
  );
  var yearNow = today.getFullYear();
  var monthNow = today.getMonth();
  var yearDob = birthDate.getFullYear();
  var monthDob = birthDate.getMonth();
  var age = yearNow - yearDob;
  var m = monthNow - monthDob;
  if (age == 0 && m == 0) {
    age = 1;
    return age;
  } else {
    var age = age * 12 + m;
    return age;
  }
}

function calcuteage(date) {
  var now = new Date();
  var today = new Date(now.getYear(), now.getMonth(), now.getDate());

  var yearNow = now.getYear();
  var monthNow = now.getMonth();
  var dateNow = now.getDate();

  var dob = new Date(
    date.substring(0, 4),
    date.substring(5, 7) - 1,
    date.substring(8, 10)
  );

  var yearDob = dob.getYear();
  var monthDob = dob.getMonth();
  var dateDob = dob.getDate();
  var age = {};
  var ageString = "";
  var yearString = "";
  var monthString = "";
  var dayString = "";

  var yearage = yearNow - yearDob;
  if (monthNow >= monthDob) {
    var monthage = monthNow - monthDob;
  } else {
    yearage--;
    var monthage = 12 + monthNow - monthDob;
  }

  if (dateNow >= dateDob) var dateage = dateNow - dateDob;
  else {
    monthage--;
    var dateage = 31 + dateNow - dateDob;

    if (monthage < 0) {
      monthage = 11;
      yearage--;
    }
  }

  age = {
    years: yearage,
    months: monthage,
    days: dateage
  };

  if (age.years > 1) yearString = " years";
  else yearString = " year";
  if (age.months > 1) monthString = " months";
  else monthString = " month";
  if (age.days > 1) dayString = " days";
  else dayString = " day";

  if (age.years > 0 && age.months > 0 && age.days > 0)
    ageString =
      age.years +
      yearString +
      " " +
      age.months +
      monthString +
      " " +
      age.days +
      dayString +
      " ";
  else if (age.years == 0 && age.months == 0 && age.days > 0)
    ageString = " " + age.days + dayString + " ";
  else if (age.years > 0 && age.months == 0 && age.days == 0)
    ageString = age.years + yearString + "  Happy Birthday!!";
  else if (age.years > 0 && age.months > 0 && age.days == 0)
    ageString = age.years + yearString + " " + age.months + monthString;
  else if (age.years == 0 && age.months > 0 && age.days > 0)
    ageString = age.months + monthString + " " + age.days + dayString + " ";
  else if (age.years > 0 && age.months == 0 && age.days > 0)
    ageString = age.years + yearString + " " + age.days + dayString + " ";
  else if (age.years == 0 && age.months > 0 && age.days == 0)
    ageString = age.months + monthString + " ";
  else ageString = "Oops! Could not calculate age!";

  return ageString;
}

/**************************************************************
function to generate random invitation code
***************************************************************/
var inviteCode = function(req, res) {
  var stringLength = 7;
  // list containing characters for the random string
  var stringArray = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "m",
    "n",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "J",
    "K",
    "L",
    "M",
    "N",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z"
  ];
  var rndString = "";
  // build a string with random characters
  for (var i = 1; i < stringLength; i++) {
    var rndNum = Math.ceil(Math.random() * stringArray.length) - 1;
    rndString = rndString + stringArray[rndNum];
  }
  return rndString;
};

/**************************************************************
set default baby
***************************************************************/
exports.updateDefaultBaby = function(req, res) {
  var outputJSON = {};
  Users.update(
    {
      _id: req.body.userId
    },
    {
      $set: {
        defaultBaby: req.body.babyId
      }
    },
    {
      upsert: true
    }
  ).exec(function(babyErr, babyData) {
    if (babyErr) {
      outputJSON = {
        status: 400,
        message: "error"
      };
      res.jsonp(outputJSON);
    } else {
      outputJSON = {
        status: 200,
        message: "success"
      };
      res.jsonp(outputJSON);
    }
  });
};

/* -------------------------------*
 * Get All babies function        *
 * Created on 20th December       *
 *--------------------------------*/
exports.getBabies = function(req, res) {
  var lang = req.params.lang;
  var unit = req.params.unittype;
  let outputJSON = "";
  let obj = [];
  var coordinate = [];
  if (req.headers.long || req.headers.lat) {
    coordinate = [req.headers.long, req.headers.lat];
    Users.findOne(
      {
        isDeleted: false,
        _id: req.params.userId
      },
      {
        defaultBaby: 1,
        plan_id: 1,
        location: 1,
        fcmtoken: 1
      }
    ).exec(function(userErr, userData) {
      if (userErr) {
        outputJSON = {
          status: constantObj.httpStatus.badRequest,
          message: constantObj.messages.badErr[lang]
        };
        return res.status(outputJSON.status).send(outputJSON);
      } else if (userData.location) {
        noCoordinates(req, res, outputJSON, obj, lang, unit, userData);
      } else {
        Users.findOneAndUpdate(
          {
            isDeleted: false,
            _id: req.params.userId
          },
          {
            $set: {
              location: coordinate
            }
          },
          {
            defaultBaby: 1,
            plan_id: 1,
            fcmtoken: 1
          }
        ).exec(function(userUpdtErr, userupdtData) {
          if (userUpdtErr) {
            outputJSON = {
              status: constantObj.httpStatus.badRequest,
              message: constantObj.messages.badErr[lang]
            };
            return res.status(outputJSON.status).send(outputJSON);
          } else {
            noCoordinates(req, res, outputJSON, obj, lang, unit, userupdtData);
          }
        });
      }
    });
  } else {
    Users.findOne(
      {
        isDeleted: false,
        _id: req.params.userId
      },
      {
        defaultBaby: 1,
        plan_id: 1,
        fcmtoken: 1
      }
    ).exec(function(userErr, userData) {
      if (userErr) {
        outputJSON = {
          status: constantObj.httpStatus.badRequest,
          message: constantObj.messages.badErr[lang]
        };
        return res.status(outputJSON.status).send(outputJSON);
      } else {
        noCoordinates(req, res, outputJSON, obj, lang, unit, userData);
      }
    });
  }
};

/* --------------------------------------*
 * Function when lat and long is getting *
 * Created on 20th December              *
 *---------------------------------------*/
// function isCoordinates(req, res, outputJSON, coordinate, obj, lang, unit) {
//  Users.findOneAndUpdate({
//    _id: req.params.userId
//  }, {
//    $set: {
//      location: coordinate
//    }
//  }, {
//    defaultBaby: 1,
//    plan_id: 1,
//  }).exec(function(userErr, userData) {
//    if (userErr) {
//      outputJSON = {
//        'status': constantObj.httpStatus.unauthorized,
//        'message': userErr.message,
//      };
//      res.status(401).send(outputJSON);
//    } else {
//      communityObj.find({
//        is_deleted: false,
//        connectedPosts: {
//          $exists: true
//        },
//        $where: 'this.connectedPosts.length>0',
//      }, {
//        name: 1,
//        //connectedPosts: 1,
//      }, function(communityErr, communityData) {
//        if (communityErr) {
//          outputJSON = {
//            'status': constantObj.httpStatus.success,
//            'message': communityErr,
//            'data': {
//              'defaultBaby': userData.defaultBaby,
//              'subscription_id': userData.plan_id,
//            }
//          };
//          res.jsonp(outputJSON);
//        } else {
//          var myarray = [];
//          communityData.map(function(ele) {
//            if (ele.name != null && ele.name.hasOwnProperty(lang)) {
//              //console.log("fff");
//              ele.name = ele.name[lang];
//              myarray.push(ele);
//            }
//          });
//          babyObj.find({
//            "userId": req.params.userId,
//            "is_deleted": false,
//          }).exec(function(err1, response1) {
//            console.log("my own baby err1, response1", err1, response1);
//            if (response1.length > 0) {
//              babyObj.find({
//                connectedUsers: {
//                  $in: [req.params.userId]
//                }
//              }, function(err2, response2) {
//                console.log("my connected baby baby err1, response1", err2, response2);
//                if (response2.length > 0) {
//                  obj = response1;
//                  obj.push(response2[0]);
//                  console.log("my all baby", obj);
//                  obj.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'data': obj,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }

//                  };
//                  res.status(200).send(outputJSON);

//                } else {
//                  //console.log("response1", response1);
//                  response1.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'data': response1,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }
//                  };
//                  res.status(200).send(outputJSON);
//                }
//              })

//            } else {
//              babyObj.find({
//                connectedUsers: {
//                  $in: [req.params.userId]
//                },
//                "is_deleted": false
//              }, function(err3, response3) {
//                //console.log("response3", response3);
//                if (response3.length > 0) {
//                  response3.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'data': response3,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }
//                  };
//                  res.status(200).send(outputJSON);
//                } else {
//                  outputJSON = {
//                    'status': constantObj.httpStatus.noContent,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }
//                  };
//                  res.status(200).send(outputJSON);
//                }
//              })

//            }

//          })

//        }
//      })
//    }
//  })
// }
// function isCoordinates(req, res, outputJSON, coordinate, obj, lang, unit) {
//  Users.findOneAndUpdate({
//    _id: req.params.userId
//  }, {
//    $set: {
//      location: coordinate
//    }
//  }, {
//    defaultBaby: 1,
//    plan_id: 1,
//  }).exec(function(userErr, userData) {
//    if (userErr) {
//      outputJSON = {
//        'status': constantObj.httpStatus.unauthorized,
//        'message': userErr.message,
//      };
//      res.status(401).send(outputJSON);
//    } else {
//      communityObj.find({
//        is_deleted: false,
//        connectedPosts: {
//          $exists: true
//        },
//        $where: 'this.connectedPosts.length>0',
//      }, {
//        name: 1,
//        //connectedPosts: 1,
//      }, function(communityErr, communityData) {
//        if (communityErr) {
//          outputJSON = {
//            'status': constantObj.httpStatus.success,
//            'message': communityErr,
//            'data': {
//              'defaultBaby': userData.defaultBaby,
//              'subscription_id': userData.plan_id,
//            }
//          };
//          res.jsonp(outputJSON);
//        } else {
//          var myarray = [];
//          communityData.map(function(ele) {
//            if (ele.name != null && ele.name.hasOwnProperty(lang)) {
//              //console.log("fff");
//              ele.name = ele.name[lang];
//              myarray.push(ele);
//            }
//          });
//          babyObj.find({
//            "userId": req.params.userId,
//            "is_deleted": false,
//          }).exec(function(err1, response1) {
//            console.log("my own baby err1, response1",err1, response1);
//            if (response1.length > 0) {
//              babyObj.find({
//                connectedUsers: {
//                  $in: [req.params.userId]
//                }
//              }, function(err2, response2) {
//                console.log("my connected baby baby err1, response1",err2, response2);
//                if (response2.length > 0) {
//                  obj = response1;
//                  obj.push(response2[0]);
//                  console.log("my all baby", obj);
//                  obj.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'data': obj,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }

//                  };
//                  res.status(200).send(outputJSON);

//                } else {
//                  //console.log("response1", response1);
//                  response1.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'data': response1,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }
//                  };
//                  res.status(200).send(outputJSON);
//                }
//              })

//            } else {
//              babyObj.find({
//                connectedUsers: {
//                  $in: [req.params.userId]
//                },
//                "is_deleted": false
//              }, function(err3, response3) {
//                //console.log("response3", response3);
//                if (response3.length > 0) {
//                  response3.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'data': response3,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }
//                  };
//                  res.status(200).send(outputJSON);
//                } else {
//                  outputJSON = {
//                    'status': constantObj.httpStatus.noContent,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData.defaultBaby,
//                      'tab': myarray,
//                      'subscription_id': userData.plan_id,
//                    }
//                  };
//                  res.status(200).send(outputJSON);
//                }
//              })

//            }

//          })

//        }
//      })
//    }
//  })
// }

/* ----------------------------------------*
 * Function when lat and long is not getting *
 * Created on 20th December                 *
 *------------------------------------------*/
function noCoordinates(req, res, outputJSON, obj, lang, unit, userData) {
  communityObj.find(
    {
      is_deleted: false,
      connectedPosts: {
        $exists: true
      },
      $where: "this.connectedPosts.length>0"
    },
    {
      name: 1
    },
    function(communityErr, communityData) {
      if (communityErr) {
        outputJSON = {
          status: constantObj.httpStatus.success,
          message: communityErr,
          data: {
            defaultBaby: userData.defaultBaby,
            subscription_id: userData.plan_id
          }
        };
        return res.jsonp(outputJSON);
      } else {
        var myarray = [];
        communityData.map(function(ele) {
          if (ele.name != null && ele.name.hasOwnProperty(lang)) {
            ele.name = ele.name[lang];
            myarray.push(ele);
          }
        });
        babyObj
          .find({
            userId: mongoose.Types.ObjectId(req.params.userId),
            is_deleted: false
          })
          .exec(function(err1, response1) {
            if (response1.length > 0) {
              babyObj.find(
                {
                  connectedUsers: {
                    $in: [req.params.userId]
                  }
                },
                function(err2, response2) {
                  if (response2.length > 0) {
                    obj = response1;
                    response2.map(function(ele) {
                      obj.push(ele);
                    });
                    obj.map(function(ele1) {
                      ele1.babyGrowth.map(function(ele) {
                        if (
                          ele.weight != null &&
                          ele.weight.hasOwnProperty(unit) &&
                          ele.height != null &&
                          ele.height.hasOwnProperty(unit) &&
                          ele.headCirc != null &&
                          ele.headCirc.hasOwnProperty(unit) &&
                          ele.weightUnit != null &&
                          ele.weightUnit.hasOwnProperty(unit) &&
                          ele.heightUnit != null &&
                          ele.heightUnit.hasOwnProperty(unit) &&
                          ele.headCircUnit != null &&
                          ele.headCircUnit.hasOwnProperty(unit) &&
                          ele.heightPercent != null &&
                          ele.heightPercent.hasOwnProperty(unit) &&
                          ele.weightPercent != null &&
                          ele.weightPercent.hasOwnProperty(unit)
                        ) {
                          ele.weight = ele.weight[unit];
                          ele.height = ele.height[unit];
                          ele.headCirc = ele.headCirc[unit];
                          ele.weightUnit = ele.weightUnit[unit];
                          ele.heightUnit = ele.heightUnit[unit];
                          ele.headCircUnit = ele.headCircUnit[unit];
                          ele.heightPercent = ele.heightPercent[unit];
                          ele.weightPercent = ele.weightPercent[unit];
                        }
                      });
                    });

                    outputJSON = {
                      status: constantObj.httpStatus.success,
                      message: constantObj.messages.successRetreivingData,
                      data: {
                        defaultBaby: userData.defaultBaby,
                        data: obj,
                        tab: myarray,
                        subscription_id: userData.plan_id,
                        fcmtoken: userData.fcmtoken
                      }
                    };
                    return res.jsonp(outputJSON);
                  } else {
                    response1.map(function(ele1) {
                      ele1.babyGrowth.map(function(ele) {
                        if (
                          ele.weight != null &&
                          ele.weight.hasOwnProperty(unit) &&
                          ele.height != null &&
                          ele.height.hasOwnProperty(unit) &&
                          ele.headCirc != null &&
                          ele.headCirc.hasOwnProperty(unit) &&
                          ele.weightUnit != null &&
                          ele.weightUnit.hasOwnProperty(unit) &&
                          ele.heightUnit != null &&
                          ele.heightUnit.hasOwnProperty(unit) &&
                          ele.headCircUnit != null &&
                          ele.headCircUnit.hasOwnProperty(unit) &&
                          ele.heightPercent != null &&
                          ele.heightPercent.hasOwnProperty(unit) &&
                          ele.weightPercent != null &&
                          ele.weightPercent.hasOwnProperty(unit)
                        ) {
                          ele.weight = ele.weight[unit];
                          ele.height = ele.height[unit];
                          ele.headCirc = ele.headCirc[unit];
                          ele.weightUnit = ele.weightUnit[unit];
                          ele.heightUnit = ele.heightUnit[unit];
                          ele.headCircUnit = ele.headCircUnit[unit];
                          ele.heightPercent = ele.heightPercent[unit];
                          ele.weightPercent = ele.weightPercent[unit];
                        }
                      });
                    });

                    outputJSON = {
                      status: constantObj.httpStatus.success,
                      message: constantObj.messages.successRetreivingData,
                      data: {
                        defaultBaby: userData.defaultBaby,
                        data: response1,
                        tab: myarray,
                        subscription_id: userData.plan_id,
                        fcmtoken: userData.fcmtoken
                      }
                    };
                    return res.jsonp(outputJSON);
                  }
                }
              );
            } else {
              babyObj.find(
                {
                  connectedUsers: {
                    $in: [req.params.userId]
                  },
                  is_deleted: false
                },
                function(err3, response3) {
                  if (response3.length > 0) {
                    response3.map(function(ele1) {
                      ele1.babyGrowth.map(function(ele) {
                        if (
                          ele.weight != null &&
                          ele.weight.hasOwnProperty(unit) &&
                          ele.height != null &&
                          ele.height.hasOwnProperty(unit) &&
                          ele.headCirc != null &&
                          ele.headCirc.hasOwnProperty(unit) &&
                          ele.weightUnit != null &&
                          ele.weightUnit.hasOwnProperty(unit) &&
                          ele.heightUnit != null &&
                          ele.heightUnit.hasOwnProperty(unit) &&
                          ele.headCircUnit != null &&
                          ele.headCircUnit.hasOwnProperty(unit) &&
                          ele.heightPercent != null &&
                          ele.heightPercent.hasOwnProperty(unit) &&
                          ele.weightPercent != null &&
                          ele.weightPercent.hasOwnProperty(unit)
                        ) {
                          ele.weight = ele.weight[unit];
                          ele.height = ele.height[unit];
                          ele.headCirc = ele.headCirc[unit];
                          ele.weightUnit = ele.weightUnit[unit];
                          ele.heightUnit = ele.heightUnit[unit];
                          ele.headCircUnit = ele.headCircUnit[unit];
                          ele.heightPercent = ele.heightPercent[unit];
                          ele.weightPercent = ele.weightPercent[unit];
                        }
                      });
                    });
                    outputJSON = {
                      status: constantObj.httpStatus.success,
                      message: constantObj.messages.successRetreivingData,
                      data: {
                        defaultBaby: userData.defaultBaby,
                        data: response3,
                        tab: myarray,
                        subscription_id: userData.plan_id,
                        fcmtoken: userData.fcmtoken
                      }
                    };
                    return res.jsonp(outputJSON);
                  } else {
                    outputJSON = {
                      status: constantObj.httpStatus.noContent,
                      message: constantObj.messages.successRetreivingData,
                      data: {
                        defaultBaby: userData.defaultBaby,
                        tab: myarray,
                        subscription_id: userData.plan_id,
                        fcmtoken: userData.fcmtoken
                      }
                    };
                    return res.jsonp(outputJSON);
                  }
                }
              );
            }
          });
      }
    }
  );
}
// function noCoordinates(req, res, outputJSON, obj, lang, unit,userData) {
//  Users.find({
//    _id: req.params.userId
//  }, {
//    defaultBaby: 1,
//    plan_id: 1
//  }).exec(function(userErr, userData) {
//    if (userErr) {
//      outputJSON = {
//        'status': constantObj.httpStatus.success,
//        'message': userErr,
//      };
//      res.jsonp(outputJSON);
//    }
//     else {
//      communityObj.find({
//        is_deleted: false,
//        connectedPosts: {
//          $exists: true
//        },
//        $where: 'this.connectedPosts.length>0'
//      }, {
//        name: 1,
//        //connectedPosts: 1,
//      }, function(communityErr, communityData) {
//        if (communityErr) {
//          outputJSON = {
//            'status': constantObj.httpStatus.success,
//            'message': communityErr,
//            'data': {
//              'defaultBaby': userData[0].defaultBaby,
//              'subscription_id': userData[0].plan_id,
//            }
//          };
//          res.jsonp(outputJSON);
//        } else {
//          var myarray = [];
//          communityData.map(function(ele) {
//            if (ele.name != null && ele.name.hasOwnProperty(lang)) {
//              ele.name = ele.name[lang];
//              myarray.push(ele);
//            }
//          });
//          babyObj.find({
//            "userId": req.params.userId,
//            "is_deleted": false,
//          }).exec(function(err1, response1) {
//            if (response1.length > 0) {
//              babyObj.find({
//                connectedUsers: {
//                  $in: [req.params.userId]
//                }
//              }, function(err2, response2) {
//                if (response2.length > 0) {
//                  obj = response1;
//                  obj.push(response2[0]);
//                  obj.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })

//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData[0].defaultBaby,
//                      'data': obj,
//                      'tab': myarray,
//                      'subscription_id': userData[0].plan_id,
//                    }
//                  };
//                  res.jsonp(outputJSON);

//                } else {
//                  //console.log("obj response1", response1);
//                  response1.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })

//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData[0].defaultBaby,
//                      'data': response1,
//                      'tab': myarray,
//                      'subscription_id': userData[0].plan_id,
//                    }

//                  };
//                  res.jsonp(outputJSON);;

//                }
//              })
//            } else {
//              babyObj.find({
//                connectedUsers: {
//                  $in: [req.params.userId]
//                },
//                "is_deleted": false,
//              }, function(err3, response3) {
//                if (response3.length > 0) {
//                  response3.map(function(ele1) {
//                    ele1.babyGrowth.map(function(ele) {
//                      //console.log("ele", ele);
//                      if (ele.weight != null && ele.weight.hasOwnProperty(unit) &&
//                        ele.height != null && ele.height.hasOwnProperty(unit) &&
//                        ele.headCirc != null && ele.headCirc.hasOwnProperty(unit) &&
//                        ele.weightUnit != null && ele.weightUnit.hasOwnProperty(unit) &&
//                        ele.heightUnit != null && ele.heightUnit.hasOwnProperty(unit) &&
//                        ele.headCircUnit != null && ele.headCircUnit.hasOwnProperty(unit) &&
//                        ele.heightPercent != null && ele.heightPercent.hasOwnProperty(unit) &&
//                        ele.weightPercent != null && ele.weightPercent.hasOwnProperty(unit)) {
//                        ele.weight = ele.weight[unit];
//                        ele.height = ele.height[unit];
//                        ele.headCirc = ele.headCirc[unit];
//                        ele.weightUnit = ele.weightUnit[unit];
//                        ele.heightUnit = ele.heightUnit[unit];
//                        ele.headCircUnit = ele.headCircUnit[unit];
//                        ele.heightPercent = ele.heightPercent[unit];
//                        ele.weightPercent = ele.weightPercent[unit];
//                      }
//                    });
//                  })
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData[0].defaultBaby,
//                      'data': response3,
//                      'tab': myarray,
//                      'subscription_id': userData[0].plan_id,
//                    }
//                  };
//                  res.jsonp(outputJSON);

//                } else {
//                  outputJSON = {
//                    'status': constantObj.httpStatus.success,
//                    'message': constantObj.messages.successRetreivingData,
//                    'data': {
//                      'defaultBaby': userData[0].defaultBaby,
//                      'tab': myarray,
//                      'subscription_id': userData[0].plan_id,
//                    }
//                  };
//                  res.jsonp(outputJSON);
//                }
//              })

//            }

//          })

//        }
//      })
//    }
//  })
// }

exports.updatebabyGrowth = function(req, res) {
  let outputJSON = "";
  var age = req.body.age;
  var percentage = babyGrowthPercentage(
    parseInt(req.body.weight),
    parseInt(req.body.height),
    age,
    req.body.unittype,
    req.body.gender
  );
  if (req.body.unittype == "SI unit") {
    if (Math.floor(parseInt(req.body.height) * 0.393701) <= 10) {
      var height = 10;
    } else {
      var height = Math.floor(parseInt(req.body.height) * 0.393701);
    }
    if (Math.floor(parseInt(req.body.headCirc) * 0.393701) <= 10) {
      var headCirc = 10;
    } else {
      var headCirc = Math.floor(parseInt(req.body.headCirc) * 0.393701);
    }
    var inputGrowthData = {
      "babyGrowth.$.weight": {
        SI: req.body.weight,
        US: Math.floor(parseInt(req.body.weight) * 2.20462)
      },

      "babyGrowth.$.height": {
        SI: req.body.height,
        US: height
      },
      "babyGrowth.$.headCirc": {
        SI: req.body.headCirc,
        US: headCirc
      },
      "babyGrowth.$.weightUnit": {
        US: "lbs",
        SI: "kg"
      },
      "babyGrowth.$.heightUnit": {
        SI: "cm",
        US: "inch"
      },
      "babyGrowth.$.headCircUnit": {
        SI: "cm",
        US: "inch"
      },
      "babyGrowth.$.date": req.body.date,
      "babyGrowth.$.heightPercent": {
        SI: req.body.heightPercent,
        US: Math.floor(percentage.heightPercentage)
      },
      "babyGrowth.$.weightPercent": {
        SI: req.body.weightPercent,
        US: Math.floor(percentage.weightPercentage)
      }
    };
    // inputGrowthData.weight = {"SI":req.body.weight,"US":parseInt(req.body.weight)*2.20462};
    // inputGrowthData.height = {"SI":req.body.height,"US":parseInt(req.body.height) * 0.393701};
    // inputGrowthData.headCirc = {"US":req.body.headCirc,"SI":req.body.headCirc};
    // inputGrowthData.weightUnit = {"US":"lbs","SI":"kg"};
    // inputGrowthData.heightUnit = {"US":"inch","SI":"cm"};
    // inputGrowthData.headCircUnit = "inch";
    // inputGrowthData.heightPercent = {"SI":req.body.heightPercent,"US":percentage.heightPercentage};
    // inputGrowthData.weightPercent = {"SI":req.body.weightPercent,"US":percentage.weightPercentage};
    //console.log("inputGrowthData", inputGrowthData);
  } else if (req.body.unittype == "US unit") {
    var inputGrowthData = {
      "babyGrowth.$.weight": {
        US: req.body.weight,
        SI: Math.floor(parseInt(req.body.weight) * 0.453592)
      },
      "babyGrowth.$.height": {
        US: req.body.height,
        SI: Math.floor(parseInt(req.body.height) * 2.54)
      },
      "babyGrowth.$.headCirc": {
        US: req.body.headCirc,
        SI: Math.floor(parseInt(req.body.headCirc) * 2.54)
      },
      "babyGrowth.$.weightUnit": {
        US: "lbs",
        SI: "kg"
      },
      "babyGrowth.$.heightUnit": {
        US: "inch",
        SI: "cm"
      },
      "babyGrowth.$.headCircUnit": {
        US: "inch",
        SI: "cm"
      },
      "babyGrowth.$.date": req.body.date,
      "babyGrowth.$.heightPercent": {
        US: req.body.heightPercent,
        SI: Math.floor(percentage.heightPercentage)
      },
      "babyGrowth.$.weightPercent": {
        US: req.body.weightPercent,
        SI: Math.floor(percentage.weightPercentage)
      }
    };

    // inputGrowthData.weight = {"US":req.body.weight,"SI":parseInt(req.body.weight)*0.453592};
    // inputGrowthData.height = {"US":req.body.height,"SI":parseInt(req.body.height) * 2.54};
    // inputGrowthData.headCirc = {"US":req.body.headCirc,"SI":req.body.headCirc};
    // inputGrowthData.weightUnit = {"US":"lbs","SI":"kg"};
    // inputGrowthData.heightUnit = {"US":"inch","SI":"cm"};
    // inputGrowthData.headCircUnit = "inch";
    // inputGrowthData.heightPercent = {"US":req.body.heightPercent,"SI":percentage.heightPercentage};
    // inputGrowthData.weightPercent = {"US":req.body.weightPercent,"SI":percentage.weightPercentage};
    //console.log("inputGrowthData", inputGrowthData);
  }
  //return;

  babyObj.findOneAndUpdate(
    {
      _id: mongoose.Types.ObjectId(req.body.babyId),
      babyGrowth: {
        $elemMatch: {
          age: age
        }
      }
    },
    {
      $set: inputGrowthData
      // {
      //  "babyGrowth.$.weight": req.body.weight,
      //  "babyGrowth.$.height": req.body.height,
      //  "babyGrowth.$.headCirc": req.body.headCirc,
      //  "babyGrowth.$.weightUnit": req.body.weightUnit,
      //  "babyGrowth.$.heightUnit": req.body.heightUnit,
      //  "babyGrowth.$.headCircUnit": req.body.headCircUnit,
      //  "babyGrowth.$.date": req.body.date,
      //  "babyGrowth.$.heightPercent": req.body.heightPercent,
      //  "babyGrowth.$.weightPercent": req.body.weightPercent
      // }
    },
    {
      upsert: true,
      new: true
    },
    function(err, resp) {
      if (resp) {
        outputJSON = {
          status: constantObj.httpStatus.success,
          data: resp.babyGrowth
        };
        res.status(200).send(outputJSON);
      } else {
        outputJSON = {
          status: constantObj.httpStatus.noContent
        };
        res.status(200).send(outputJSON);
      }
    }
  );
};

/*******************************************************************
 It Will work reverse because i need us unit when i am geting si unit
********************************************************************/

function babyGrowthPercentage(weight, height, Age, unitType, gender) {
  var percentage = {};
  // It Will work reverse because i need us unit when i am geting si unit
  if (unitType == "SI unit") {
    if (gender === "boy") {
      if (Age < 6 && Age >= 0) {
        percentage.heightPercentage = ((height - 17.4) * 100) / (21.8 - 17.4);
        percentage.weightPercentage = ((weight - 4.6) * 100) / (11 - 4.6);
      } else if (Age < 12 && Age >= 6) {
        percentage.heightPercentage = ((height - 24) * 100) / (29 - 24);
        percentage.weightPercentage = ((weight - 12.5) * 100) / (24 - 12.5);
      } else if (Age < 18 && Age >= 12) {
        percentage.heightPercentage = ((height - 27) * 100) / (32.6 - 27);
        percentage.weightPercentage = ((weight - 15.2) * 100) / (29.3 - 15.2);
      } else if (Age < 24 && Age >= 18) {
        percentage.heightPercentage = ((height - 29.2) * 100) / (35.5 - 29.2);
        percentage.weightPercentage = ((weight - 17.1) * 100) / (33.7 - 17.1);
      } else if (Age < 30 && Age >= 24) {
        percentage.heightPercentage = ((height - 30.9) * 100) / (38 - 30.9);
        percentage.weightPercentage = ((weight - 18.9) * 100) / (37.6 - 18.9);
      } else if (Age < 36 && Age >= 30) {
        percentage.heightPercentage = ((height - 32.1) * 100) / (40.1 - 32.1);
        percentage.weightPercentage = ((weight - 20.7) * 100) / (41.8 - 20.7);
      } else if (Age < 42 && Age >= 36) {
        percentage.heightPercentage = ((height - 33.4) * 100) / (42.2 - 33.4);
        percentage.weightPercentage = ((weight - 22) * 100) / (45.6 - 22);
      } else if (Age < 48 && Age >= 42) {
        percentage.heightPercentage = ((height - 34.6) * 100) / (43.9 - 34.6);
        percentage.weightPercentage = ((weight - 23.3) * 100) / (49.3 - 23.3);
      } else if (Age < 54 && Age >= 48) {
        percentage.heightPercentage = ((height - 35.7) * 100) / (45.6 - 35.7);
        percentage.weightPercentage = ((weight - 24.6) * 100) / (53.3 - 24.6);
      } else if (Age < 60 && Age >= 54) {
        percentage.heightPercentage = ((height - 36.7) * 100) / (44 - 36.7);
        percentage.weightPercentage = ((weight - 26) * 100) / (57.3 - 26);
      } else if (Age < 72 && Age >= 60) {
        percentage.heightPercentage = ((height - 37.8) * 100) / (48.7 - 37.8);
        percentage.weightPercentage = ((weight - 27.3) * 100) / (61.5 - 27.3);
      }
      return percentage;
    } else {
      if (Age < 6 && Age >= 0) {
        percentage.heightPercentage = ((height - 17.1) * 100) / (21.5 - 17.1);
        percentage.weightPercentage = ((weight - 4.4) * 100) / (10.5 - 4.4);
      } else if (Age < 12 && Age >= 6) {
        percentage.heightPercentage = ((height - 23.1) * 100) / (28.5 - 23.1);
        percentage.weightPercentage = ((weight - 11.2) * 100) / (23.3 - 11.2);
      } else if (Age < 18 && Age >= 12) {
        percentage.heightPercentage = ((height - 26.1) * 100) / (32.1 - 25.1);
        percentage.weightPercentage = ((weight - 13.8) * 100) / (28.8 - 13.8);
      } else if (Age < 24 && Age >= 18) {
        percentage.heightPercentage = ((height - 28.3) * 100) / (35.1 - 28.3);
        percentage.weightPercentage = ((weight - 15.8) * 100) / (33.2 - 15.8);
      } else if (Age < 30 && Age >= 24) {
        percentage.heightPercentage = ((height - 30.1) * 100) / (37.8 - 30.1);
        percentage.weightPercentage = ((weight - 17.8) * 100) / (37.4 - 17.8);
      } else if (Age < 36 && Age >= 30) {
        percentage.heightPercentage = ((height - 31.5) * 100) / (39.8 - 31.5);
        percentage.weightPercentage = ((weight - 19.6) * 100) / (41 - 19.6);
      } else if (Age < 42 && Age >= 36) {
        percentage.heightPercentage = ((height - 32.9) * 100) / (41.9 - 32.9);
        percentage.weightPercentage = ((weight - 21.1) * 100) / (46 - 21.1);
      } else if (Age < 48 && Age >= 42) {
        percentage.heightPercentage = ((height - 34.1) * 100) / (43.7 - 34.1);
        percentage.weightPercentage = ((weight - 22.7) * 100) / (50.7 - 22.7);
      } else if (Age < 54 && Age >= 48) {
        percentage.heightPercentage = ((height - 35.3) * 100) / (45.5 - 35.3);
        percentage.weightPercentage = ((weight - 24) * 100) / (55.5 - 24);
      } else if (Age < 60 && Age >= 54) {
        percentage.heightPercentage = ((height - 36.4) * 100) / (47.1 - 36.4);
        percentage.weightPercentage = ((weight - 25.3) * 100) / (60.4 - 25.3);
      } else if (Age < 72 && Age >= 60) {
        percentage.heightPercentage = ((height - 37.4) * 100) / (48.7 - 37.4);
        percentage.weightPercentage = ((weight - 26.6) * 100) / (65 - 26.6);
      }
      return percentage;
    }
  } else {
    if (gender === "boy") {
      if (Age < 6 && Age >= 0) {
        percentage.heightPercentage = ((height - 44.2) * 100) / (55.6 - 44.2);
        percentage.weightPercentage = ((weight - 2.1) * 100) / (5 - 2.1);
      } else if (Age < 12 && Age >= 6) {
        percentage.heightPercentage = ((height - 61.2) * 100) / (74.0 - 61.2);
        percentage.weightPercentage = ((weight - 5.7) * 100) / (10.9 - 5.7);
      } else if (Age < 18 && Age >= 12) {
        percentage.heightPercentage = ((height - 68.6) * 100) / (82.9 - 68.6);
        percentage.weightPercentage = ((weight - 6.9) * 100) / (13.3 - 6.9);
      } else if (Age < 24 && Age >= 18) {
        percentage.heightPercentage = ((height - 74.2) * 100) / (90.4 - 74.2);
        percentage.weightPercentage = ((weight - 7.8) * 100) / (15.3 - 7.8);
      } else if (Age < 30 && Age >= 24) {
        percentage.heightPercentage = ((height - 78.7) * 100) / (97 - 78.7);
        percentage.weightPercentage = ((weight - 8.6) * 100) / (17.1 - 8.6);
      } else if (Age < 36 && Age >= 30) {
        percentage.heightPercentage = ((height - 81.7) * 100) / (102.1 - 81.7);
        percentage.weightPercentage = ((weight - 9.4) * 100) / (19 - 9.4);
      } else if (Age < 42 && Age >= 36) {
        percentage.heightPercentage = ((height - 85) * 100) / (107.2 - 85);
        percentage.weightPercentage = ((weight - 10) * 100) / (20.7 - 10);
      } else if (Age < 48 && Age >= 42) {
        percentage.heightPercentage = ((height - 88) * 100) / (111.7 - 88);
        percentage.weightPercentage = ((weight - 10.6) * 100) / (22.4 - 10.6);
      } else if (Age < 54 && Age >= 48) {
        percentage.heightPercentage = ((height - 90.7) * 100) / (115.9 - 90.7);
        percentage.weightPercentage = ((weight - 11.2) * 100) / (24.2 - 11.2);
      } else if (Age < 60 && Age >= 54) {
        percentage.heightPercentage = ((height - 93.4) * 100) / (119.9 - 93.4);
        percentage.weightPercentage = ((weight - 11.8) * 100) / (26 - 11.8);
      } else if (Age < 72 && Age >= 60) {
        percentage.heightPercentage = ((height - 96.1) * 100) / (123.9 - 96.1);
        percentage.weightPercentage = ((weight - 12.4) * 100) / (27.9 - 12.4);
      }
      return percentage;
    } else {
      //((i-m)*100)/max-min
      if (Age < 6 && Age >= 0) {
        percentage.heightPercentage = ((height - 43.6) * 100) / (54.7 - 43.6);
        percentage.weightPercentage = ((weight - 2) * 100) / (4.8 - 2);
      } else if (Age < 12 && Age >= 6) {
        percentage.heightPercentage = ((height - 58.9) * 100) / (72.5 - 58.9);
        percentage.weightPercentage = ((weight - 5.1) * 100) / (10.6 - 5.1);
      } else if (Age < 18 && Age >= 12) {
        percentage.heightPercentage = ((height - 66.3) * 100) / (81.7 - 66.3);
        percentage.weightPercentage = ((weight - 6.3) * 100) / (13.1 - 6.3);
      } else if (Age < 24 && Age >= 18) {
        percentage.heightPercentage = ((height - 72.0) * 100) / (89.4 - 72.0);
        percentage.weightPercentage = ((weight - 7.2) * 100) / (15.1 - 7.2);
      } else if (Age < 30 && Age >= 24) {
        percentage.heightPercentage = ((height - 76.7) * 100) / (96.1 - 76.7);
        percentage.weightPercentage = ((weight - 8.1) * 100) / (17 - 8.1);
      } else if (Age < 36 && Age >= 30) {
        percentage.heightPercentage = ((height - 80.1) * 100) / (101.3 - 80.1);
        percentage.weightPercentage = ((weight - 8.9) * 100) / (19 - 8.9);
      } else if (Age < 42 && Age >= 36) {
        percentage.heightPercentage = ((height - 83.6) * 100) / (106.5 - 83.6);
        percentage.weightPercentage = ((weight - 9.6) * 100) / (20.9 - 9.6);
      } else if (Age < 48 && Age >= 42) {
        percentage.heightPercentage = ((height - 86.8) * 100) / (111.2 - 86.8);
        percentage.weightPercentage = ((weight - 10.3) * 100) / (23 - 10.3);
      } else if (Age < 54 && Age >= 48) {
        percentage.heightPercentage = ((height - 89.8) * 100) / (115.7 - 89.8);
        percentage.weightPercentage = ((weight - 10.9) * 100) / (25.2 - 10.9);
      } else if (Age < 60 && Age >= 54) {
        percentage.heightPercentage = ((height - 92.6) * 100) / (119.8 - 92.6);
        percentage.weightPercentage = ((weight - 11.5) * 100) / (27.4 - 11.5);
      } else if (Age < 72 && Age >= 60) {
        percentage.heightPercentage = ((height - 95.2) * 100) / (123.7 - 95.2);
        percentage.weightPercentage = ((weight - 12.1) * 100) / (29.5 - 12.1);
      }
      return percentage;
    }
  }
}

exports.removeBaby = function(req, res) {
  let babyId = req.params.id;
  babyObj.remove(
    {
      _id: babyId
    },
    function(err, result) {
      if (err) {
        return res.status(400).send({
          success: false,
          error: err
        });
      } else {
        return res.status(200).send({
          success: true,
          msg: "Successfully deleted."
        });
      }
    }
  );
};

/******************************************************
  Update subscription plan according to baby it is old 
  Now working according to admin user for a baby
******************************************************/

exports.updateSubscription_old = function(req, res) {
  var outputJSON = {};
  var inputData = {};
  var lang = "";
  if (req.body.lang) {
    lang = req.body.lang;
  } else {
    lang = "en";
  }
  var findQuery = {
    _id: mongoose.Types.ObjectId(req.body.babyId)
  };
  var planId;
  var storage;
  if (req.body.subscriptionId == 2) {
    // 2:Premium
    planId = 2;
    storage = 1000; // 1 TB
  } else if (req.body.subscriptionId == 3) {
    // 3: Elite
    planId = 3;
    storage = 100000; // Unlimeted
  } else {
    outputJSON = {
      status: constantObj.httpStatus.badRequest,
      message: constantObj.messages.badErr[lang]
    };
    return res.status(outputJSON.status).send(outputJSON);
  }
  var today = new Date();
  var momentDate = moment().add(30, "days");
  var expiryDate = new Date(momentDate);
  inputData = {
    babyId: req.body.babyId,
    userId: req.body.userId,
    plan_id: planId,
    planActiveDate: today,
    planExpiryDate: expiryDate
  };
  babyPlanObj.update(
    {
      babyId: req.body.babyId,
      userId: req.body.userId
    },
    {
      $set: {
        isActive: false
      }
    },
    function(updateErr, updatePlan) {
      babyPlanObj(inputData).save(inputData, function(
        babyPlanErr,
        babyPlanData
      ) {});
    }
  );
  babyObj.findOneAndUpdate(
    findQuery,
    {
      $set: {
        plan_id: planId,
        totalStorage: storage,
        planExpiryDate: expiryDate,
        planActiveDate: today,
        usedStorage: 0
      },
      $inc: {
        plan_count: 1
      }
    },
    function(uptErr, uptData) {
      if (uptErr) {
        outputJSON = {
          status: constantObj.httpStatus.badRequest,
          message: constantObj.messages.badErr[lang]
        };
        res.status(outputJSON.status).send(outputJSON);
      } else {
        outputJSON = {
          status: constantObj.httpStatus.success,
          message: constantObj.messages.updatePlanSuccess[lang]
        };
        res.status(outputJSON.status).send(outputJSON);
      }
    }
  );
};

/**********************************************
  Update subscription plan according to user
 Working functionality
***********************************************/

exports.updateSubscription = function(req, res) {
  var outputJSON = {};
  var lang = "";
  if (req.body.lang) {
    lang = req.body.lang;
  } else {
    lang = "en";
  }
  var findQuery = {
    isDeleted: false,
    _id: mongoose.Types.ObjectId(req.body.userId)
  };
  var planId;
  var storage;
  if (req.body.subscriptionId == 2) {
    // 2:Premium
    planId = 2;
    storage = 1000; // 1 TB
  } else if (req.body.subscriptionId == 3) {
    // 3: Elite
    planId = 3;
    storage = 100000; // Unlimeted
  } else {
    outputJSON = {
      status: constantObj.httpStatus.badRequest,
      message: constantObj.messages.badErr[lang]
    };
    return res.status(outputJSON.status).send(outputJSON);
  }
  var today = new Date();
  var momentDate = moment().add(30, "days");
  var expiryDate = new Date(momentDate);
  Users.findOneAndUpdate(
    findQuery,
    {
      $set: {
        plan_id: planId,
        totalStorage: storage,
        planExpiryDate: expiryDate,
        planActiveDate: today,
        usedStorage: 0
      }
    },
    function(uptErr, uptData) {
      if (uptErr) {
        outputJSON = {
          status: constantObj.httpStatus.badRequest,
          message: constantObj.messages.badErr[lang]
        };
        res.status(outputJSON.status).send(outputJSON);
      } else {
        babyObj.update(
          { userId: mongoose.Types.ObjectId(req.body.userId) },
          {
            $set: {
              plan_id: planId,
              totalStorage: storage,
              planExpiryDate: expiryDate,
              planActiveDate: today,
              usedStorage: 0
            }
          },
          { multi: true },
          function(babyErr, babyUpdated) {
            console.log("babyplan update", babyErr, babyUpdated);
            if (babyErr) {
              outputJSON = {
                status: constantObj.httpStatus.badRequest,
                message: constantObj.messages.badErr[lang]
              };
              res.status(outputJSON.status).send(outputJSON);
            } else {
              outputJSON = {
                status: constantObj.httpStatus.success,
                message: constantObj.messages.updatePlanSuccess[lang]
              };
              res.status(outputJSON.status).send(outputJSON);
            }
          }
        );
      }
    }
  );
};

/*******************************************
All baby list 
*******************************************/
exports.babyList = function(req, res) {
  var outputJSON = "";
  babyObj.find(
    {
      is_deleted: false,
      $or: [
        {
          name: new RegExp(req.body.term, "i")
        }
      ]
    },
    function(err, data) {
      if (err) {
        outputJSON = {
          status: constantObj.httpStatus.badRequest,
          message: constantObj.messages.badErr["en"]
        };
        res.jsonp(outputJSON);
      } else {
        babyPlanObj.find({}, function(babyErr, babyData) {
          if (babyErr) {
            outputJSON = {
              status: constantObj.httpStatus.badRequest,
              message: constantObj.messages.badErr["en"]
            };
          } else {
            outputJSON = {
              status: constantObj.httpStatus.success,
              data: data
            };
          }
          res.jsonp(outputJSON);
        });
      }
    }
  );
};

/*******************************************
Find baby with his family 
*******************************************/
exports.babyFamily = function(req, res) {
  var outputJSON = "";
  var memberJson = {};
  var myFamily = [];
  babyObj
    .findOne({
      is_deleted: false,
      _id: req.params.babyId
    })
    .populate("userId", "name profileImage_path file_path")
    .exec(function(err, data) {
      if (data.userId == null) {
        babyObj
          .remove({
            _id: req.params.babyId
          })
          .exec(function(removeErr, removeData) {
            if (removeErr) {
              outputJSON = {
                status: constantObj.httpStatus.badRequest,
                message: constantObj.messages.badErr["en"]
              };
              res.jsonp(outputJSON);
            } else {
              outputJSON = {
                status: constantObj.httpStatus.noDataFound,
                message: "Invalid baby! Now it is deleted permanently."
              };
              res.jsonp(outputJSON);
            }
          });
      } else {
        if (err) {
          outputJSON = {
            status: constantObj.httpStatus.badRequest,
            message: constantObj.messages.badErr["en"]
          };
          res.jsonp(outputJSON);
        } else {
          connectBabyObj
            .find({
              usedStatus: true,
              babyId: req.params.babyId,
              connectTo: {
                $in: data.connectedUsers
              }
            })
            .populate("connectTo", "name profileImage_path file_path")
            .exec(function(familyErr, familyData) {
              familyData.map(function(mydata) {
                if (mydata.connectTo) {
                  memberJson = {
                    name: mydata.connectTo.name,
                    profileImage_path: mydata.connectTo.profileImage_path,
                    relation: mydata.relation
                  };
                  myFamily.push(memberJson);
                }
              });
              memberJson = {
                name: data.userId.name,
                profileImage_path: data.userId.profileImage_path,
                relation: data.relation
              };
              myFamily.push(memberJson);
              if (familyErr) {
                outputJSON = {
                  status: constantObj.httpStatus.badRequest,
                  message: constantObj.messages.badErr["en"]
                };
              } else {
                outputJSON = {
                  status: constantObj.httpStatus.success,
                  data: myFamily
                };
              }
              res.jsonp(outputJSON);
            });
        }
      }
    });
};

/*******************************************
All baby list 
*******************************************/
exports.babyPlanList = function(req, res) {
  var outputJSON = "";
  babyPlanObj.find(
    {
      userId: req.params.userId
    },
    function(err, data) {
      if (err) {
        outputJSON = {
          status: constantObj.httpStatus.badRequest,
          message: constantObj.messages.badErr["en"]
        };
      } else {
        outputJSON = {
          status: constantObj.httpStatus.success,
          data: data
        };
      }
      res.jsonp(outputJSON);
    }
  );
};
