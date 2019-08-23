var Customer = require('../models/customer');
var Sale = require('../models/sale');
var shortid = require('shortid');
var sms = require('../utils/sendsms');

//import shortid from "shortid";
//import AWS from "aws-sdk";
exports.create_sale = function(req, res) {
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
    if (err) return res.json({ status: 400, message: 'Something went wrong' });
    if (exists) {
      if (saleData.discount) {
        let sum = Number(exists.total) + Number(saleData.price);
        let discount = exists.discount;
        let balance = sum - exists.total;
        if (balance > 0 && balance < 1000) {
          discount = exists.discount + 30;
        } else if (balance > 1000) {
          let mulitple = Math.floor(balance / 1000);

          discount = exists.discount + 30 * mulitple;
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
              .sendsms(sum, doc.discount, saleData.phone_number)
              .then(succ => {
                return res.json({ status: 200, message: 'succes', data: doc });
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
        let balance = sum - exists.total;
        let mulitple = 0;
        if (exists.discount > 0) {
          if (balance > 0 && balance < 1000) {
            discount = exists.discount + 30;
          } else if (balance > 1000) {
            mulitple = Math.floor(balance / 1000);

            discount = exists.discount + 30 * mulitple;
          }
        } else {
          mulitple = Math.floor(sum / 1000);

          discount = exists.discount + 30 * mulitple;
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
              return res.json({ status: 400, message: 'somethimg wnet wrong' });
            sms
              .sendsms(updated.total, updated.discount, updated.phone_number)
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
      let mulitple = Math.floor(saleData.price / 1000);
      let newcustomer = Customer({
        phone_number: saleData.phone_number,
        total: saleData.price,
        discount: mulitple == 0 ? 0 : mulitple * 30,
        sales: [{ price: saleData.price, date: new Date() }],
      });
      newcustomer.save(function(err, newdata) {
        if (err)
          return res.json({ status: 400, message: 'somethimg wnet wrong' });
        sms
          .sendsms(newdata.total, newdata.discount, newdata.phone_number)
          .then(succ => {
            return res.json({ status: 200, message: 'succes', data: newdata });
          })
          .catch(err => {
            console.log('error in message ', err)
            return res.json({
              status: 200,
              message: 'Message sending failed',
              data: newdata,
            });
          });
      });
    }
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
