
class ApiErrorObject {
    constructor(statusCode, errorCode, developerMessage) {
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.developerMessage = developerMessage;
    }

    generateResponse(responseObject) {
        return responseObject.status(this.statusCode).send(this.jsonResponse());
    }

    jsonResponse() {
        return {
            error: {
                developerMessage: this.developerMessage,
                errorCode: this.errorCode
            }
        };
    }
}

const ApiErrorType = {
    general: {
        serverError: new ApiErrorObject(500, 'general/server-error', 'Server error')
    },
    auth: {}, // TODO: Implement auth errors when auth is added
    api: {
        auth: {
            unauthorized: new ApiErrorObject(401, 'api/auth/unathorized', 'Unauthorized')
        },
        missingParameters: new ApiErrorObject(404, 'api/missing-parameters', 'Missing parameters'),
        invalidParameters: {
            nan: new ApiErrorObject(404, 'api/invalid-parameters/nan', 'Parameter should be a number and it is not'),
            latLongOutOfRange: new ApiErrorObject(404, 'api/invalid-parameters/lat-or-long-out-of-range', 'Latitude or longitude out of range'),
            invalidDistance: {
                general: new ApiErrorObject(404, 'api/invalid-parameters/invalid-distance/general', 'Invalid distance (must not be negative)'),
                minMoreThanMax: new ApiErrorObject(404, 'api/invalid-parameters/invalid-distance/min-more-than-max', 'Min distance must be less than max distance')
            },
            invalidDuration: new ApiErrorObject(404, 'api/invalid-parameters/invalid-duration', 'Duration should be positive')
        },
        notFound: new ApiErrorObject(404, 'api/not-found', 'Not found'),
        upload: {
            noFile: new ApiErrorObject(404, 'api/upload/no-file', 'No file received on upload'),
            wrongFileType: new ApiErrorObject(400, 'api/upload/wrong-file-Type', 'Uploaded file has wrong type'),
            durationNotAvailable: new ApiErrorObject(400, 'api/upload/duration-not-available', 'Duration could not be obtained from the file')
        }
    }
};

module.exports.ApiError = ApiErrorType;
module.exports.ApiErrorObject = ApiErrorObject;
