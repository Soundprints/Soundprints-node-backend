var GoogleCloudStorage = require('@google-cloud/storage');
var Promise = require('bluebird');
var app = require('../app.js');

var storage = GoogleCloudStorage({
    projectId: process.env.GOOGLE_CLOUD_STORAGE_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_STORAGE_KEYFILE
})

if (app.isProduction) {
    var soundsBucket = storage.bucket(process.env.STORAGE_BUCKET_PRODUCTION);
} else {
    var soundsBucket = storage.bucket(process.env.STORAGE_BUCKET_DEVELOPMENT);
}

Promise.Promise.promisifyAll(GoogleCloudStorage);
Promise.Promise.promisifyAll(soundsBucket);

var obtainSoundSignedUrl = function(storageFileName, expirationTimeInMinutes, callback) {
    // Create configuration for the signed link. Allow read and set expiration time.
    var config = {
        action: 'read',
        expires: (new Date()).getTime() + (60*expirationTimeInMinutes*1000) // current time + expirationTimeInMinutes minutes
    }
    var file = soundsBucket.file(storageFileName);
    // Get the signed URL for the file and return it in callback
    file.getSignedUrl(config, function(error, signedUrl) {
        callback(error, signedUrl, config.expires);
    });
};

var uploadSound = function(localPath, storageDestination, callback) {
    soundsBucket.upload(localPath, { destination: storageDestination }, function(err, file, apiResponse) {
        callback(err, storageDestination);
    });
}

module.exports.obtainSoundSignedUrl = obtainSoundSignedUrl;
module.exports.uploadSound = uploadSound;