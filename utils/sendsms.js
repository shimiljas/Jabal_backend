const accountSid = 'ACd4a0ed9babab7bb1599b2afeb8bad414';
const authToken = 'c5f65469efb8bc55e32bc82e9f05b28f';
const client = require('twilio')(accountSid, authToken);

exports.sendsms = (total, discount, mobile) => {
  console.log(total, discount, mobile, 'total, discount, mobile');
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject({ message: 'break' });
    }, 3000);

    let message = discount > 0 ? `Hi , You have compeleted a purchasing of ₹${total} and there will be discount of ₹${discount} on next purchase` : 'You have completed a purchase of ₹12 for every ₹1000 get a discount of ₹30,Thank you';
    let phoneNo = `+91${mobile}`;
    client.messages
      .create({ body: message, from: '+13343986955', to: phoneNo})
      .then(message => {
        console.log('success', message)
        resolve(message);
      })
      .catch(err => {
        console.log('twilio', err)
        reject(err);
      });
  });
};
