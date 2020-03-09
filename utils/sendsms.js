const config = {
  accountSid: 'ACfb04543343e50fba31bcf5efe8ea00bc',
  authToken: 'cb10bc70b15fe71fb2e275996005d048',
  sender: '+12073864114',
  AUTHY_API_KEY: 'boygRptasuc2OwU19UnsH5Uy6hUEvNhv'
}
const client = require('twilio')(config.accountSid, config.authToken)
const authy = require('authy')(config.AUTHY_API_KEY)
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
    setTimeout(function() {
      reject({ message: 'break' });
    }, 5000);

    let message =
      discount > 0
        ? `Thank you for purchasing from Zadi Boutique. You have completed a purchasing of ${total}.00 rupees. Get a discount of ${discount}.00 on your next purchase.`
        : `Thank you for purchasing from Zadi Boutique.You have completed a purchasing of ${total}.00 rupees.`;

        
      // client.messages
      //   .create({ body: message, from:config.sender, to: `+91${mobile}` })
      //   .then(message => {
      //     console.log('success', message);
      //     resolve(message);
      //   })
      //   .catch(err => {
      //     console.log('twilio', err);
      //     reject(err);
      //   });
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
      var str = ''; 
      response.on('data', function(chunk) {
        str += chunk;
      }); 
      response.on('end', function() {
        resolve(message);
      });
    }; 
    http.request(options, callback).end(); 
  });
};
