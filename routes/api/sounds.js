
var mongoose = require('mongoose');
var router = require('express').Router();
var ApiError = require('./apiErrors').ApiError;
var ApiErrorObject = require('./apiErrors').ApiErrorObject;
var storage = require('../../storage/storage');
var multer = require('multer');
var fs = require('fs');
var mi = require('mediainfo-wrapper');

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

function soundTypeValid(type) {
    return type === 'normal' || type === 'premium';
}

router.get('/timeBased', function(req, res, next) {

    // Check if latitude, longitude, maxDistance and soundType are present
    if (!req.query.soundType) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    // Extract the parameters
    const soundType = String(req.query.soundType);

    // Check if soundType is valid
    if (!soundTypeValid(soundType)) {
        const error = ApiError.api.invalidParameters.invalidSoundType;
        return error.generateResponse(res);
    }

    var query = {
        soundType: soundType
    };

    var createdAtQuery = {};

    if (req.query.upTo) {
        const upTo = parseFloat(req.query.upTo);
        // Check if upTo is a number
        if (!areNumbers([upTo])) {
            const error = ApiError.api.invalidParameters.nan;
            return error.generateResponse(res);
        }
        const upToDate = new Date(upTo*1000.0);
        createdAtQuery.$lt = upToDate.toISOString();
    }

    if (req.query.since) {
        const since = parseFloat(req.query.since);
        // Check if since is a number
        if (!areNumbers([since])) {
            const error = ApiError.api.invalidParameters.nan;
            return error.generateResponse(res);
        }
        const sinceDate = new Date(since*1000.0);
        createdAtQuery.$gt = sinceDate.toISOString();
    }

    if (Object.keys(createdAtQuery).length > 0) {
        query.createdAt = createdAtQuery;
    }

    var limit = 0;
    if (req.query.limit) {
        const limitParam = parseInt(req.query.limit);
        // Check if limitParam is a number
        if (!areNumbers([limitParam])) {
            const error = ApiError.api.invalidParameters.nan;
            return error.generateResponse(res);
        }
        limit = limitParam;
    }

    // Query the sounds which were added after 'upToDate' and have sound type 'soundType'.
    // Sort them from newest to oldest and limit them to 'limit'.
    Sound.find(query)
    .sort('-createdAt')
    .limit(limit)
    .exec(function(err, results) {
        if (err) {
            console.log('error: ' + err);
            const error = ApiError.general.serverError;
            return error.generateResponse(res);
        }
        // Map the results into Sound objects
        var results = results.map(function(result) {
            return new Sound(result);
        });

        // Populate the Sound objects with certain user properties
        Sound.populate(results, { path: 'user', select: 'profileImageUrl displayName' }, function(err, populatedResults) {
            if (err) {
                const error = ApiError.general.serverError;
                return error.generateResponse(res);
            } else {
                // Handle the results and return success response
                handleSoundResults(populatedResults, function(transformedResults) {
                    res.status(200).json({ sounds: transformedResults });
                });
            }
        });
    });
});

router.get('/locationBased', function(req, res, next) {

    // Check if latitude, longitude, maxDistance and soundType are present
    if (!req.query.lat || !req.query.lon || !req.query.maxDistance || !req.query.soundType) {
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    // Extract the parameters
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const maxDistance = parseFloat(req.query.maxDistance);
    const soundType = String(req.query.soundType);

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
    // Check if soundType is valid
    if (!soundTypeValid(soundType)) {
        const error = ApiError.api.invalidParameters.invalidSoundType;
        return error.generateResponse(res);
    }

    // Create query options for the geoNear query
    var queryOptions = {
        spherical: true,
        maxDistance: maxDistance,
        query: {
            soundType: soundType
        }
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
    if (req.query.onlyLastDay === 'true' || req.query.onlyLastDay === 1) {
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

    Sound.geoNear(point, queryOptions, function(err, results, stats) {
        if (err) {
            const error = ApiError.general.serverError;
            return error.generateResponse(res);
        }

        // Map the results into Sound objects
        var results = results.map(function(result) {
            var mapped = new Sound(result.obj);
            mapped.distance = result.dis;
            return mapped;
        });
        // Populate the Sound objects with certain user properties
        Sound.populate(results, { path: 'user', select: 'profileImageUrl displayName' }, function(err, populatedResults) {
            if (err) {
                const error = ApiError.general.serverError;
                return error.generateResponse(res);
            } else {
                // Handle the results and return success response
                handleSoundResults(populatedResults, function(transformedResults) {
                    res.status(200).json({ sounds: transformedResults });
                });
            }
        });
    });

});

var handleSoundResults = function(results, callback) {
    // Transform the given results to what the response will contain
    var resultsToReturn = results.map(function(result) {
        var original = result;
        var transformed = {};

        // Set the properties that we want to expose to the API response
        transformed.id = original._id;
        transformed.name = original.name;
        transformed.description = original.description;
        transformed.location = {
            lat: original.location.coordinates[1],
            lon: original.location.coordinates[0]
        };
        transformed.user = {
            id: original.user._id,
            displayName: original.user.displayName,
            profileImageUrl: original.user.profileImageUrl
        }
        transformed.submissionDate = original.createdAt.getTime()/1000.0;
        transformed.distance = original.distance;
        transformed.duration = original.duration;
        transformed.soundType = original.soundType;

        return transformed;
    });

    callback(resultsToReturn);
}

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
                storage.obtainSoundSignedUrl(result.storageFileName, minutes, function(error, resourceUrl, expires) {
                    if (resourceUrl) {
                        res.status(200).json({ url: resourceUrl, expirationDate: expires/1000.0 });
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

router.post('/upload', upload.single('file'), function (req, res, next) {

    const localFilePath = req.file.path;

    // Check if uploaded file is present
    if (!req.file) {
        const error = ApiError.api.upload.noFile;
        return error.generateResponse(res);
    }

    // Check if name, description, latitude and longitude are present
    if (!req.body.lat || !req.body.lon || !req.body.soundType) {
        fs.unlinkSync(localFilePath);
        const error = ApiError.api.missingParameters;
        return error.generateResponse(res);
    }

    // Extract the parameters
    const lat = parseFloat(req.body.lat);
    const lon = parseFloat(req.body.lon);
    const soundType = String(req.body.soundType);

    var name = req.body.name;
    if (!name) {
        name = '';
    }
    var description = req.body.description;
    if (!description) {
        description = '';
    }

    // Check if latitude and longitude are numbers
    if (!areNumbers([lat, lon])) {
        fs.unlinkSync(localFilePath);
        const error = ApiError.api.invalidParameters.nan;
        return error.generateResponse(res);
    }

    // Check if latitude and longitude are valid
    if (!latValid(lat) || !lonValid(lon)) {
        fs.unlinkSync(localFilePath);
        const error = ApiError.api.invalidParameters.latlonOutOfRange;
        return error.generateResponse(res);
    }
    // Check if soundType is valid
    if (!soundTypeValid(soundType)) {
        fs.unlinkSync(localFilePath);
        const error = ApiError.api.invalidParameters.invalidSoundType;
        return error.generateResponse(res);
    }

    // Get media info of the uploaded file
    mi(localFilePath).then(function(data) {
        const mediainfo = data[0];

        const getFromObject = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);

        // Check if audio codec is AAC
        const format = getFromObject(['audio', 0, 'format', 0], mediainfo);
        if (format != 'AAC') {
            fs.unlinkSync(localFilePath);
            const error = ApiError.api.upload.wrongFileType;
            return error.generateResponse(res);
        }

        // Get duration from the mediainfo
        var duration = parseFloat(getFromObject(['audio', 0, 'duration', 0], mediainfo));
        if (isNaN(duration)) {
            fs.unlinkSync(localFilePath);
            const error = ApiError.api.upload.durationNotAvailable;
            return error.generateResponse(res);
        }
        // Convert to seconds 
        duration = duration/1000.0;

        // Check if duration is valid
        if (!duration > 0) {
            fs.unlinkSync(localFilePath);
            const error = ApiError.api.invalidParameters.invalidDuration;
            return error.generateResponse(res);
        }

        // Create a new Sound model instance
        var newSound = new Sound({
            name: name,
            description: description,
            duration: duration,
            location: {
                type: 'Point',
                coordinates: [lon, lat]
            },
            user: mongoose.Types.ObjectId(req.userId),
            soundType: soundType
        });

        // Save the new sound object
        newSound.save(function(error, savedSound) {
            if (error) {
                console.log('error: ' + error);
                fs.unlinkSync(localFilePath);
                savedSound.remove();
                const error = ApiError.general.serverError;
                return error.generateResponse(res);
            }

            // Generate the name under which the file will be stored on cloud storage -> SOUND_ID.EXT
            const storageDestination = String(savedSound._id) + '.aac'
            
            storage.uploadSound(localFilePath, storageDestination, function(err, storageFileName) {

                // Delete the local uploaded file
                fs.unlinkSync(localFilePath);
        
                if (err) {
                    console.log('error: ' + err);
                    savedSound.remove();
                    const error = ApiError.general.serverError;
                    return error.generateResponse(res);
                } else {

                    // Update the storage file name in the sound object in DB
                    savedSound.storageFileName = storageFileName;
                    savedSound.save();

                    // Add new sound to the user
                    User.findById(req.userId, function(err, user) {

                        if (err) {
                            console.log('error: ' + err);
                            savedSound.remove();
                            const error = ApiError.general.serverError;
                            return error.generateResponse(res);
                        }

                        user.sounds.push(mongoose.Types.ObjectId(savedSound._id));
                        user.save();

                        savedSound.distance = 0.0;

                        // Populate the Sound objects with certain user properties
                        Sound.populate([savedSound], { path: 'user', select: 'profileImageUrl displayName' }, function(err, populatedResults) {
                            if (error) {
                                console.log('error: ' + err);
                                const error = ApiError.general.serverError;
                                return error.generateResponse(res);
                            } else {
                                // Handle the results and return success response
                                handleSoundResults(populatedResults, function(transformedResults) {
                                    res.status(200).json({ uploadedSound: transformedResults[0] });
                                });
                            }
                        });
                    });
                }
            });
        });

    });
});

module.exports = router;