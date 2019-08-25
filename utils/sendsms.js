const accountSid = 'ACd4a0ed9babab7bb1599b2afeb8bad414';
const authToken = 'c5f65469efb8bc55e32bc82e9f05b28f';
const client = require('twilio')(accountSid, authToken);

const http = require('http');
const urlencode = require('urlencode');

exports.sendsms = (total, discount, mobile) => {
  console.log(total, discount, mobile, 'total, discount, mobile');
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject({ message: 'break' });
    }, 3000);

    let message =
      discount > 0
        ? `Hi , You have compeleted a purchasing of ${total} and there will be discount of ${discount} on next purchase`
        : 'You have completed a purchase of ₹12 for every ₹1000 get a discount of ₹30,Thank you';
    let phoneNo = `+91${mobile}`;
    client.messages
      .create({ body: message, from: '+13343986955', to: phoneNo })
      .then(message => {
        console.log('success', message);
        resolve(message);
      })
      .catch(err => {
        console.log('twilio', err);
        reject(err);
      });
  });
};

exports.sendbytextlocal = (total, discount, mobile) => {
  return new Promise(function(resolve, reject) {
    console.log(
      total,
      discount,
      mobile,
      'total, discount, mobile)total, discount, mobile)',
    );
    setTimeout(function() {
      reject({ message: 'break' });
    }, 5000);

    let message =
      discount > 0
        ? `Hi , You have compeleted a purchasing of total ${total}.00 from Jabal Mini Market  and there will be discount of ${discount}.00 on next purchase`
        : 'You have completed a purchase of  12.00  for every 1000 get a discount of  30.00,Thank you';

    console.log(message, 'message');
    var msg = urlencode(message);

    var toNumber = `+91${mobile}`;
    var username = 'Jabalminimarket@gmail.com';
    var hash =
      '08eb9374e3fdca007c984045095f63ef6eb1994f5d5d58870fb1f215145070d5'; // The hash key could be found under Help->All Documentation->Your hash key. Alternatively you can use your Textlocal password in plain text.
    var sender = 'txtlcl';
    var data =
      'username=' +
      username +
      '&hash=' +
      hash +
      '&sender=' +
      sender +
      '&numbers=' +
      toNumber +
      '&message=' +
      msg;
    var options = {
      host: 'api.textlocal.in',
      path: '/send?' + data,
    };
    callback = function(response) {
      var str = ''; //another chunk of data has been recieved, so append it to `str`
      response.on('data', function(chunk) {
        str += chunk;
      }); //the whole response has been recieved, so we just print it out here
      response.on('end', function() {
        console.log('succcc');
        resolve(message);
      });
    }; //console.log('hello js'))
    http.request(options, callback).end(); //url encode instalation need to use $ npm install urlencode
  });
};
