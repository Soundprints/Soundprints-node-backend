var passport = require('passport');
var FacebookTokenStrategy = require('passport-facebook-token');
var mongoose = require('mongoose');
var User = mongoose.model('User');

passport.use(new FacebookTokenStrategy({
        clientID: '302659940232001',
        clientSecret: 'd7d3e484f483f9945a45bf6d4b671a84'
    },
    function (accessToken, refreshToken, profile, done) {
        User.upsertFbUser(accessToken, refreshToken, profile, function(err, user) {
            return done(err, user);
        });
    }));