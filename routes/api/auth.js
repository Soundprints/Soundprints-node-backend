var passport = require('passport');
var ApiError = require('./apiErrors').ApiError;

var facebookAuthentication = function(req, res, next) {
    passport.authenticate('facebook-token', {session: false}, function (err, user, info) {
        if (err) {
            if (err instanceof ApiErrorObject) {
                return err.generateResponse(res);
            } else if (err.oauthError) {
                const error = ApiError.api.auth.unauthorized;
                return error.generateResponse(res);
            } else {
                const error = ApiError.general;
                return error.generateResponse(res);
            }
        } else {
            next();
        }
    })(req, res, next);
};

var authentication = function(req, res, next) {
    const provider = req.headers.provider;

    // TODO: Implement auth for other providers
    if (provider === 'facebook') {
        facebookAuthentication(req, res, next);
    } else {
        const error = ApiError.api.auth.unauthorized;
        return error.generateResponse(res);
    }
}

module.exports.authentication = authentication;