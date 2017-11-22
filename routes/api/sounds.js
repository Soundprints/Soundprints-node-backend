var mongoose = require('mongoose');
var router = require('express').Router();
var Sound = mongoose.model('Sound');
var ApiError = require('./apiErrors').ApiError;

function areNumbers(numberCandidates) {
    for (item in numberCandidates) {
        if (isNaN(item)) {
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
        // TODO: Handle the results and send them back in the response
    });

});

module.exports = router;