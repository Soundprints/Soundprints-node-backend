var mongoose = require('mongoose');

var SoundSchema = new mongoose.Schema({
    name: String,
    description: String,
    duration: Number,
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

SoundSchema.index({ location: '2dsphere' });

mongoose.model('Sound', SoundSchema);