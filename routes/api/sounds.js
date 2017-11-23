
var mongoose = require('mongoose');
var router = require('express').Router();
var Sound = mongoose.model('Sound');
var ApiError = require('./apiErrors').ApiError;
var storage = require('../../storage/storage');

function areNumbers(numberCandidates) {
    for (var i = 0; i < numberCandidates.length; i++) {
        if (isNaN(numberCandidates[i])) {
            return false;
        }
    }
    return true;
}

router.get('/', function(req, res, next) {
    if (!req.query.lat || !req.query.long || !req.query.maxDistance) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    const lat = parseFloat(req.query.lat);
    const long = parseFloat(req.query.long);
    const maxDistance = parseFloat(req.query.maxDistance);

    if (!areNumbers([lat, long, maxDistance])) {
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    if (lat < -90 || lat > 90 || long < -180 || long > 180) {
        const error = ApiError.api.invalidParameters.latLongOutOfRange;
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
        coordinates: [long, lat]
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

var handleSoundResults = function(results, callback) {
    var resultsToReturn = results.map(function(result) {
        var original = result.obj;
        var transformed = {};

        transformed.id = original._id;
        transformed.name = original.name;
        transformed.description = original.description;
        transformed.location = {
            lat: original.location.coordinates[1],
            long: original.location.coordinates[0]
        };
        transformed.userId = original.user;
        transformed.distance = result.dis;

        return transformed;
    });

    callback(resultsToReturn);
}

module.exports = router;