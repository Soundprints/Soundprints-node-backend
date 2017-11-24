var passport = require('passport');
var ApiError = require('./apiErrors').ApiError;

// Function for performing Facebook OAuth 2.0 authentication using access token
var facebookAuthentication = function(req, res, next) {
    passport.authenticate('facebook-token', {session: false}, function (err, user, info) {
        if (err) {
            if (err.oauthError) {
                const error = ApiError.api.auth.unauthorized;
                return error.generateResponse(res);
            } else {
                const error = ApiError.general;
                return error.generateResponse(res);
            }
        } else {
            // Expose the authenticated user ID in the request object.
            req.userId = user._id;
            next();
        }
    })(req, res, next);
};

// Function for handling authentication
var authentication = function(req, res, next) {
    const provider = req.headers.provider;

    // Check for which provider should the authentication be performed
    if (provider === 'facebook') {
        facebookAuthentication(req, res, next);
    } else {
        const error = ApiError.api.auth.unauthorized;
        return error.generateResponse(res);
    } // TODO: Implement auth for other providers
}

module.exports.authentication = authentication;