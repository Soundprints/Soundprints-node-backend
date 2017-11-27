
var mongoose = require('mongoose');
var router = require('express').Router();
var ApiError = require('./apiErrors').ApiError;
var storage = require('../../storage/storage');
var multer = require('multer');
var fs = require('fs');

var Sound = mongoose.model('Sound');
var User = mongoose.model('User');

var upload = multer({ dest: 'sound-uploads/' });

function areNumbers(numberCandidates) {
    for (var i = 0; i < numberCandidates.length; i++) {
        if (isNaN(numberCandidates[i])) {
            return false;
        }
    }
    return true;
}

function latValid(lat) {
    return lat >= -90 && lat <= 90;
}

function lonValid(lon) {
    return lon >= -180 && lon <= 180;
}

router.get('/', function(req, res, next) {

    // Check if latitude, longitude and maxDistance are present
    if (!req.query.lat || !req.query.lon || !req.query.maxDistance) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    // Extract the parameters
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const maxDistance = parseFloat(req.query.maxDistance);

    // Check if latitude, longitude and maxDistance are numbers
    if (!areNumbers([lat, lon, maxDistance])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    // Check if latitude and longitude are valid
    if (!latValid(lat) || !lonValid(lon)) {
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }
    // Check if maxDistance is valid
    if (maxDistance < 0) {
        const error = ApiError.api.invalidParameters.invalidDistance.general;
        return error.generateResponse(res);
    }

    // Create query options for the geoNear query
    var queryOptions = {
        spherical: true,
        maxDistance: maxDistance
    }

    // Handle minDistance parameter
    if (req.query.minDistance) {
        const minDistance = parseFloat(req.query.minDistance);
        if (!areNumbers([minDistance])) {
            const error = ApiError.api.invalidParameters.nan;
            return error.generateResponse(res);
        }
        if (minDistance < 0) {
            const error = ApiError.api.invalidParameters.invalidDistance.minMoreThanMax;
            return error.generateResponse(res);
        }
        if (minDistance > maxDistance) {
            const error = ApiError.api.invalidParameters.invalidDistance.minMoreThanMax;
            return error.generateResponse(res);
        }

        queryOptions.minDistance = minDistance;
    }

    // Handle limit parameter
    if (req.query.limit) {
        const limit = parseInt(req.query.limit, 10);
        if (!areNumbers([limit])) {
            const error = ApiError.api.invalidParameters.nan;
            return error.generateResponse(res);
        }
        if (limit < 0) {
            const error = ApiError.api.invalidParameters.invalidDistance.minMoreThanMax;
            return error.generateResponse(res);
        }

        queryOptions.limit = limit;
    }

    // Handle only last day parameter
    if (req.query.onlyLastDay === 'true') {
        var oneDayBefore = new Date();
        oneDayBefore.setDate(oneDayBefore.getDate()-1);

        if (queryOptions.query) {
            // Add to existing query if it already exists
            queryOptions.query.createdAt = {
                $gt: oneDayBefore.toISOString()
            }
        } else {
            // Create a new query and add it to options
            queryOptions.query = {
                createdAt: {
                    $gt: oneDayBefore.toISOString()
                }
            }
        }
    }

    const point = {
        type: 'Point',
        coordinates: [lon, lat]
    }

    // Execute the geoNear query
    Sound.geoNear(point, queryOptions, function(error, results, stats) {
        if (error) {
            const error = ApiError.general.serverError;
            return error.generateResponse(res);
        } else {
            // Handle the results and return success response
            handleSoundResults(results, function(transformedResults) {
                res.status(200).json(JSON.stringify(transformedResults));
            });
        }
    });

});

router.get('/:soundId/resourceUrl', function(req, res, next) {
    var minutes = 10; // Number of minutes the returned URL will be valid for. Default is 10.
    // Extract the minutes parameter
    const givenMinutes = parseInt(req.query.minutes, 10);
    // Check if minutes is a number
    if (areNumbers([givenMinutes])) {
        minutes = givenMinutes;
    }

    // Find the sound with the given soundId
    Sound.findById(req.params.soundId, function(error, result) {
        if (result) {
            if (result.storageFileName) {
                // Get the cloud storage signed URL
                storage.obtainSoundSignedUrl(result.storageFileName, minutes, function(error, resourceUrl) {
                    if (resourceUrl) {
                        res.status(200).json(JSON.stringify({ url: resourceUrl }));
                    } else {
                        // The link generation should not fail, so treat this as a server error
                        const error = ApiError.general.serverError;
                        return error.generateResponse(res);
                    }
                })
            } else {
                // storageFileName should always be present, so treat this as a server error
                const error = ApiError.general.serverError;
                return error.generateResponse(res);    
            }
        } else {
            const error = ApiError.api.notFound;
            return error.generateResponse(res);
        }
    });
});

router.post('/addMockedSounds', function(req, res, next) {

    // Check if latitude, longitude, maxDistance and count are present
    if (!req.query.lat || !req.query.lon || !req.query.maxDistance || !req.query.count) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    // Extract the parameters
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const maxDistance = parseFloat(req.query.maxDistance);
    const count = parseInt(req.query.count, 10);

    // Check if latitude, longitude, maxDistance and count are numbers
    if (!areNumbers([lat, lon, maxDistance, count])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    // Check if latitude and longitude are valid
    if (!latValid(lat) || !lonValid(lon)) {
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }
    // Check if distance is valid
    if (maxDistance < 0) {
        const error = ApiError.api.invalidParameters.invalidDistance.general;
        return error.generateResponse(res);
    }
    // Check if count is valid
    if (count < 1) {
        const error = ApiError.api.invalidParameters.general;
        return error.generateResponse(res);
    }

    // Add mocked sounds
    Sound.addMockedSounds(req.userId, lat, lon, maxDistance, count);

    res.status(200).json(JSON.stringify({ message: 'ok' }));
});

var handleSoundResults = function(results, callback) {
    // Transform the given results to what the response will contain
    var resultsToReturn = results.map(function(result) {
        var original = result.obj;
        var transformed = {};

        // Set the properties that we want to expose to the API response
        transformed.id = original._id;
        transformed.name = original.name;
        transformed.description = original.description;
        transformed.location = {
            lat: original.location.coordinates[1],
            lon: original.location.coordinates[0]
        };
        transformed.userId = original.user;
        transformed.distance = result.dis;

        return transformed;
    });

    callback(resultsToReturn);
}

router.post('/upload', upload.single('file'), function (req, res, next) {

    // Check if uploaded file is present
    if (!req.file) {
        const error = ApiError.api.upload.noFile;
        return error.generateResponse(res);
    }

    // Check if name, description, latitude and longitude are present
    if (!req.body.name || !req.body.description || !req.body.lat || !req.body.lon) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    // Extract the parameters
    const name = req.body.name;
    const description = req.body.description;
    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon);

    // Check if latitude and longitude are numbers
    if (!areNumbers([lat, lon])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    // Check if latitude and longitude are valid
    if (!latValid(lat) || !lonValid(lon)) {
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }

    // TODO: Figure out how to get the duration of (opus, other formats are not a problem) files

    // Create a new Sound model instance
    var newSound = new Sound({
        name: name,
        description: description,
        location: {
            type: 'Point',
            coordinates: [lon, lat]
        },
        user: mongoose.Types.ObjectId(req.userId)
    })

    // Save the new sound object
    newSound.save(function(error, savedSound) {
        if (error) {
            const error = ApiError.general.serverError;
            return error.generateResponse(res);
        }

        // Upload the uploaded file to cloud storage
        storage.uploadSound(req.file.path, savedSound, function(err, storageFileName) {

            // Delete the local uploaded file
            fs.unlinkSync(req.file.path);

            if (err) {
                savedSound.remove();
                const error = ApiError.general.serverError;
                return error.generateResponse(res);
            } else {

                // Update the storage file name in the sound object in DB
                savedSound.storageFileName = storageFileName;
                savedSound.save();

                // Add new sound to the user
                User.findById(req.userId, function(err, user) {
                    user.sounds.push(mongoose.Types.ObjectId(savedSound._id));
                    user.save();

                    res.status(200).json(JSON.stringify({ message: 'ok' }));
                });
            }
        });
    })
});

module.exports = router;