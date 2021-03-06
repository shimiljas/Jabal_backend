var Customer = require('../models/customer');
var Limit = require('../models/limit');
var Sale = require('../models/sale');
var shortid = require('shortid');
var sms = require('../utils/sendsms');
var LimitFetch = require('../utils/fetchLimit');

//import shortid from "shortid";
//import AWS from "aws-sdk";
exports.create_sale = function(req, res) {
  console.log(req.body, 'req.bodyreq.bodyreq.body');
  LimitFetch.fetchLimit()
    .then(offerData => {
      var saleData = req.body ? req.body : {};
      if (!saleData.phone_number) {
        return res.json({ status: 400, message: 'Phone number is missing' });
      }

      if (!saleData.price) {
        return res.json({ status: 400, message: 'Current price is missing' });
      }

      Customer.findOne({ phone_number: saleData.phone_number }, function(
        err,
        exists,
      ) {
        if (err)
          return res.json({ status: 400, message: 'Something went wrong' });
        if (exists) {
          if (saleData.discount) {
            let sum = Number(exists.total) + Number(saleData.price);
            let discount = exists.discount;
            if (saleData.price > 0 && saleData.price >= offerData.limit) {
              let mulitple = Math.floor(saleData.price / offerData.limit);
              discount = exists.discount + offerData.discount * mulitple;
            } else if (saleData.price < offerData.limit) {
              let reminder = exists.total % offerData.limit;

              if (
                Number(reminder) + Number(saleData.price) >=
                offerData.limit
              ) {
                let remindtotal = Number(reminder) + Number(saleData.price);
                mulitple = Math.floor(remindtotal / offerData.limit);
                discount = exists.discount + offerData.discount * mulitple;
              }
            }

            if (discount - saleData.discount < 0) {
              return res.json({
                status: 400,
                message: 'Discount is greater than existing',
              });
            }

            Customer.findOneAndUpdate(
              { phone_number: saleData.phone_number },
              {
                $set: {
                  total: sum,
                  discount: discount - saleData.discount,
                  sales: [
                    ...exists.sales,
                    {
                      price: saleData.price,
                      date: new Date(),
                    },
                  ],
                },
              },
              { new: true },
              function(err, doc) {
                if (err)
                  return res.json({
                    status: 400,
                    message: 'Something went wrong',
                    message: err,
                  });
                sms
                  .sendbytextlocal(
                    saleData.price,
                    doc.discount,
                    saleData.phone_number,
                  )
                  .then(succ => {
                    return res.json({
                      status: 200,
                      message: 'succes',
                      data: doc,
                    });
                  })
                  .catch(err => {
                    return res.json({
                      status: 200,
                      message: 'Message sending failed',
                      data: doc,
                    });
                  });
              },
            );
          } else {
            let sum = Number(exists.total) + Number(saleData.price);
            let discount = exists.discount;
            let mulitple = 0;
            let balance = sum - exists.total;
            if (saleData.price >= offerData.limit) {
              mulitple = Math.floor(saleData.price / offerData.limit);
              discount = exists.discount + offerData.discount * mulitple;
            } else if (saleData.price < offerData.limit) {
              let reminder = exists.total % offerData.limit;

              if (
                Number(reminder) + Number(saleData.price) >=
                offerData.limit
              ) {
                let remindtotal = Number(reminder) + Number(saleData.price);
                mulitple = Math.floor(remindtotal / offerData.limit);
                discount = exists.discount + offerData.discount * mulitple;
              }
            }

            Customer.findOneAndUpdate(
              { phone_number: saleData.phone_number },
              {
                $set: {
                  total: sum,
                  discount: discount,
                  sales: [
                    ...exists.sales,
                    {
                      price: saleData.price,
                      date: new Date(),
                    },
                  ],
                },
              },
              { new: true },
              function(err, updated) {
                if (err)
                  return res.json({
                    status: 400,
                    message: 'somethimg wnet wrong',
                  });
                sms
                  .sendbytextlocal(
                    saleData.price,
                    updated.discount,
                    updated.phone_number,
                  )
                  .then(succ => {
                    return res.json({
                      status: 200,
                      message: 'succes',
                      data: updated,
                    });
                  })
                  .catch(err => {
                    return res.json({
                      status: 200,
                      message: 'Message sending failed',
                      data: updated,
                    });
                  });
              },
            );
          }
        } else {
          let mulitple = Math.floor(saleData.price / offerData.limit);
          console.log(mulitple, 'mulitplemulitple');
          let newcustomer = Customer({
            phone_number: saleData.phone_number,
            total: saleData.price,
            owned_by:saleData.owned_by,
            discount: mulitple == 0 ? 0 : mulitple * offerData.discount,
            sales: [{ price: saleData.price, date: new Date() }],
          });
          newcustomer.save(function(err, newdata) {
            if (err) {
              return res.json({ status: 400, message: 'somethimg wnet wrong' });
            }
            sms
              .sendbytextlocal(
                saleData.price,
                newdata.discount,
                newdata.phone_number,
              )
              .then(succ => {
                return res.json({
                  status: 200,
                  message: 'succes',
                  data: newdata,
                });
              })
              .catch(err => {
                return res.json({
                  status: 200,
                  message: 'Message sending failed',
                  data: newdata,
                });
              });
          });
        }
      });
    })
    .catch(err => {
      return res.json({ status: 400, message: err });
    });
};

exports.search = function(req, res) {
  var saleData = req.body ? req.body : {};

  if (!saleData.phone_number)
    return res.json({ status: 400, message: 'Phone number missing' });

  Customer.findOne({ phone_number: saleData.phone_number }, function(
    err,
    exists,
  ) {
    if (err) return res.json({ status: 400, message: 'somethimg wnet wrong' });
    if (!exists) {
      return res.json({ status: 400, message: 'Data not exist' });
    }
    return res.json({ status: 200, data: exists });
  });
};

exports.offerlimit = function(req, res) {
  const { limit, discount } = req.body;

  let newlimit = Limit({ limit, discount });
  newlimit.save(function(err, data) {
    if (err) return res.json({ status: 400, message: 'somethimg wnet wrong' });
    if (res) return res.json({ status: 200, data });
  });
};

exports.fetchLatestLimit = function(req, res) {
  console.log('sdfsdf-----------<><><');
  LimitFetch.fetchLimit()
    .then(offerDataValue => {
      if (res) return res.json({ status: 200, data: offerDataValue });
    })
    .catch(err => {
      console.log(err, 'sdfsdf');
      if (err)
        return res.json({ status: 400, message: 'somethimg wnet wrong' });
    });
};
