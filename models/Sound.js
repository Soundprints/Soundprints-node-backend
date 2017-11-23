var mongoose = require('mongoose');

var SoundSchema = new mongoose.Schema({
    name: String,
    description: String,
    location: {
        type: { // Value of this should be always 'Point'
            type: String
        },
        coordinates: [Number] // This array will always have 2 elements, first is longitude, second is latitude
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    storageFileName: String
}, { timestamps: true });

SoundSchema.statics.addMockedSounds = function(userId, callback) {
    var sound1 = new this({
        name: 'Sample Sound 1',
        description: 'This is a sample sound number 1',
        location: {
            type: 'Point',
            coordinates: [14.510333, 46.052169]
        },
        user: mongoose.Types.ObjectId(userId)
    });
    var sound2 = new this({
        name: 'Sample Sound 2',
        description: 'This is a sample sound number 2',
        location: {
            type: 'Point',
            coordinates: [14.508419, 46.051987]
        },
        user: mongoose.Types.ObjectId(userId)
    });
    var sound3 = new this({
        name: 'Sample Sound 3',
        description: 'This is a sample sound number 3',
        location: {
            type: 'Point',
            coordinates: [14.507323, 46.051630]
        },
        user: mongoose.Types.ObjectId(userId)
    });

    this.insertMany([sound1, sound2, sound3]);
}

mongoose.model('Sound', SoundSchema);