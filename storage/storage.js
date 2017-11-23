
var GoogleCloudStorage = require('@google-cloud/storage');
var Promise = require('bluebird');

var storage = GoogleCloudStorage({
    projectId: process.env.GOOGLE_CLOUD_STORAGE_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_STORAGE_KEYFILE
})

var soundsBucket = storage.bucket('soundprints-sounds');

Promise.Promise.promisifyAll(GoogleCloudStorage);
Promise.Promise.promisifyAll(soundsBucket);

var obtainSoundSignedUrl = function(storageFileName, expirationTimeInMinutes, callback) {
    var config = {
        action: 'read',
        expires: (new Date()).getTime() + (60*expirationTimeInMinutes*1000) // current time + expirationTimeInMinutes minutes
    }
    var file = soundsBucket.file(storageFileName);
    file.getSignedUrl(config, function(error, signedUrl) {
        callback(error, signedUrl);
    });
};

module.exports.obtainSoundSignedUrl = obtainSoundSignedUrl;