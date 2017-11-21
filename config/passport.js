var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var User = mongoose.model('User');

passport.use(new FacebookTokenStrategy({
        clientID: 'TODO: Add client ID HERE',
        clientSecret: 'TODO: Add client secret HERE'
    },
    function (accessToken, refreshToken, profile, done) {
        // TODO: Add upsert FB user
    }));