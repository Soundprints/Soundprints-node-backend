var mongoose = require('mongoose');
var crypto = require('crypto');

const fbProviderName = 'facebook';

var UserSchema = new mongoose.Schema({
    email: String,
    provider: {
        name: String,
        profileId: String,
        usesLocalPassword: Boolean
    },
    password: {
        hash: String,
        salt: String
    },
    firstName: String,
    lastName: String,
    displayName: String,
    profileImageUrl: String,
    sounds: [
        {
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Sound'
        }
    ]
}, { timestamps: true });

UserSchema.statics.upsertFbUser = function(accessToken, refreshToken, profile, callback) {
    var that = this;
    return this.findOne({
        'provider.name': fbProviderName,
        'provider.profileId': profile.id
    }, function(err, user) {
        if (!user) {
            var newUser = new that({
                email: profile.emails[0].value,
                provider: {
                    name: fbProviderName,
                    profileId: profile.id,
                    usesLocalPassword: false
                },
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                displayName: profile.displayName,
                // profileImageUrl: // TODO: Figure out where to get the profile image
                sounds: []
            });

            newUser.save(function(error, savedUser) {
                if (error) {
                    console.log(error);
                }
                return callback(error, savedUser);
            })
        } else {
            return callback(err, user);
        }
    });
};

UserSchema.methods.validPassword = function(password) {
    var hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
    return this.hash === hash;
};
  
UserSchema.methods.setPassword = function(password){
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

mongoose.model('User', UserSchema);