var passport = require('passport');
var FacebookTokenStrategy = require('passport-facebook-token');
var mongoose = require('mongoose');
var User = mongoose.model('User');

passport.use(new FacebookTokenStrategy({
        clientID: process.env.FB_APP_ID,
        clientSecret: process.env.FB_APP_SECRET
    },
    function (accessToken, refreshToken, profile, done) {
        User.upsertFbUser(accessToken, refreshToken, profile, function(err, user) {
            return done(err, user);
        });
    }));