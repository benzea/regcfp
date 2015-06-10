var express = require('express');
var router = express.Router();

var utils = require('../utils');

var models = require('../models');
var User = models.User;
var Registration = models.Registration;
var RegistrationPayment = models.RegistrationPayment;

router.all('/', utils.require_feature("registration"));

router.all('/list', utils.require_permission('registration/view_public'));
router.get('/list', function(req, res, next) {
  Registration
    .findAll({
      where: {
        is_public: true
      }
    })
    .complete(function(err, registrations) {
      res.render('registration/list', { registrations: registrations });
    });
});

router.all('/pay', utils.require_user);
router.all('/pay', utils.require_permission('registration/pay_extra'));
router.get('/pay', function(req, res, next) {
  res.render('registration/pay');
});

router.post('/pay', function(req, res, next) {
  var regfee = req.body.regfee.trim();
  
  if(regfee == null) {
    res.render('registration/pay');
  } else {
    res.render('registration/pay_do', {regfee: regfee});
  }
});

router.all('/pay/do', utils.require_user);
router.all('/pay/do', utils.require_permission('registration/pay_extra'));
router.post('/pay/do', function(req, res, next) {
  var method = req.body.method;
  if(method == 'onsite') {
    var info = {
      amount: req.body.regfee,
      paid: false,
      type: 'onsite',
    };
    RegistrationPayment
      .create(info)
      .complete(function(err, payment) {
        if(!!err) {
          console.log('Error saving payment: ' + err);
          res.status(500).send('ERROR saving payment');
        } else {
          req.user.getRegistration()
            .complete(function(err, reg) {
              reg.addRegistrationPayment(payment)
                .complete(function(err) {
                  if(!!err) {
                    console.log('Error attaching payment to reg: ' + err);
                    res.status(500).send('Error attaching payment');
                  } else {
                    res.render('registration/payment_onsite_registered', {amount: info.amount});
                  }
                });
            });
        }
      });
  } else {
    res.status(402).send('Invalid payment method selected');
  }
});

router.all('/register', utils.require_permission('registration/register'));
router.get('/register', function(req, res, next) {
  if(req.user){
    req.user.getRegistration()
    .complete(function(err, reg) {
      res.render('registration/register', { registration: reg,
                                            ask_regfee: reg == null});
    });
  } else {
    res.render('registration/register', { registration: null, ask_regfee: true });
  };
});

router.post('/register', function(req, res, next) {
  if(!req.user) {
    // Create user object and set as req.user
    if(req.body.name.trim() == '') {
      res.render('registration/register', { registration: null, submission_error: true, ask_regfee: true} );
    } else {
      var user_info = {
        email: req.session.currentUser,
        name: req.body.name.trim()
      };
      User.create(user_info)
        .complete(function(err, user) {
          if(!!err) {
            console.log("Error saving user object: " + err);
            res.status(500).send('Error saving user');
          } else {
            req.user = user;
            handle_registration();
          };
        });
    }
  } else {
    return handle_registration();
  }
}

function handle_registration() {
  req.user.getRegistration({include: [RegistrationPayment]})
  .complete(function(err, reg) {
    var reg_info = {
      irc: req.body.irc.trim(),
      country: req.body.country.trim(),
      is_public: req.body.is_public.indexOf('true') != -1,
      badge_printed: false,
      receipt_sent: false,
      UserId: req.user.Id
    };
    var regfee = req.body.regfee;
    reg_info.UserId = req.User.Id;

    if((reg == null && regfee == null)) {
      res.render('registration/register', { registration: reg_info,
                                            submission_error: true, ask_regfee: reg == null});
    } else {
      // Form OK
      if(reg == null) {
        // Create new registration
        Registration.create(reg_info)
          .complete(function(err, reg) {
            if(!!err) {
              console.log('Error saving reg: ' + err);
              res.status(500).send('Error saving registration');
            } else {
              req.user.setRegistration(reg)
                .complete(function(err) {
                  if(!!err) {
                    console.log('Error adding reg to user: ' + err);
                    res.status(500).send('Error attaching registration to your user');
                  } else {
                    res.render('registration/registration_success', {regfee: regfee});
                  }
              });
            }
        });
      } else {
        // Update
        reg.irc = reg_info.irc;
        reg.is_public = reg_info.is_public;
        reg.save().complete(function (err, reg){
          if(!!err) {
            res.render('registration/register', { registration: reg_info,
                                                  save_error: true });
          } else {
            res.render('registration/update_success');
          }
        });
      }
    }
  });
});


router.all('/admin/list', utils.require_user);
router.all('/admin/list', utils.require_permission('registration/view_all'));
router.get('/admin/list', function(req, res, next) {
  next();
});

module.exports = router;
