
var GoogleCloudStorage = require('@google-cloud/storage');
var Promise = require('bluebird');
const readChunk = require('read-chunk');
const fileType = require('file-type');

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

var uploadSound = function(localPath, soundObject, callback) {
    const buffer = readChunk.sync(localPath, 0, 4100);
    const fileInfo = fileType(buffer);

    const storageDestination = soundObject._id + '.' + fileInfo.ext;

    soundsBucket.upload(localPath, { destination: storageDestination }, function(err, file, apiResponse) {
        callback(err, storageDestination);
    });
}

module.exports.obtainSoundSignedUrl = obtainSoundSignedUrl;
module.exports.uploadSound = uploadSound;