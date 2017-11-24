
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
    if (!req.query.lat || !req.query.lon || !req.query.maxDistance) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const maxDistance = parseFloat(req.query.maxDistance);

    if (!areNumbers([lat, lon, maxDistance])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    if (!latValid(lat) || !lonValid(lon)) {
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }
    if (maxDistance < 0) {
        const error = ApiError.api.invalidParameters.invalidDistance.general;
        return error.generateResponse(res);
    }

    var queryOptions = {
        spherical: true,
        maxDistance: maxDistance
    }

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

    const point = {
        type: 'Point',
        coordinates: [lon, lat]
    }
    Sound.geoNear(point, queryOptions, function(error, results, stats) {
        if (error) {
            const error = ApiError.general.serverError;
            return error.generateResponse(res);
        } else {
            handleSoundResults(results, function(transformedResults) {
                res.status(200).json(JSON.stringify(transformedResults));
            });
        }
    });

});

router.get('/:soundId/resourceUrl', function(req, res, next) {
    var minutes = 10; // Number of minutes the returned URL will be valid for. Default is 10.
    const givenMinutes = parseInt(req.query.minutes, 10);
    if (areNumbers([givenMinutes])) {
        minutes = givenMinutes;
    }

    Sound.findById(req.params.soundId, function(error, result) {
        if (result) {
            if (result.storageFileName) {
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
    if (!req.query.lat || !req.query.lon || !req.query.maxDistance || !req.query.count) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const maxDistance = parseFloat(req.query.maxDistance);
    const count = parseInt(req.query.count, 10);

    if (!areNumbers([lat, lon, maxDistance, count])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    if (!latValid(lat) || !lonValid(lon)) {
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }
    if (maxDistance < 0) {
        const error = ApiError.api.invalidParameters.invalidDistance.general;
        return error.generateResponse(res);
    }
    if (count < 1) {
        const error = ApiError.api.invalidParameters.general;
        return error.generateResponse(res);
    }

    Sound.addMockedSounds(req.userId, lat, lon, maxDistance, count);

    res.status(200).json(JSON.stringify({ message: 'ok' }));
});

var handleSoundResults = function(results, callback) {
    var resultsToReturn = results.map(function(result) {
        var original = result.obj;
        var transformed = {};

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

    if (!req.file) {
        const error = ApiError.api.upload.noFile;
        return error.generateResponse(res);
    }

    if (!req.body.name || !req.body.description || !req.body.lat || !req.body.lon) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    const name = req.body.name;
    const description = req.body.description;
    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon);

    if (!areNumbers([lat, lon])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    if (!latValid(lat) || !lonValid(lon)) {
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }

    // TODO: Figure out how to get the duration of (opus, other formats are not a problem) files

    var newSound = new Sound({
        name: name,
        description: description,
        location: {
            type: 'Point',
            coordinates: [lon, lat]
        },
        user: mongoose.Types.ObjectId(req.userId)
    })

    newSound.save(function(error, savedSound) {
        if (error) {
            const error = ApiError.general.serverError;
            return error.generateResponse(res);
        }

        storage.uploadSound(req.file.path, savedSound, function(err, storageFileName) {

            fs.unlinkSync(req.file.path);

            if (err) {
                savedSound.remove(function(err, sound) {
                    const error = ApiError.general.serverError;
                    return error.generateResponse(res);
                })
            } else {
                savedSound.storageFileName = storageFileName;

                savedSound.save();

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