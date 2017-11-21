var mongoose = require('mongoose');

var SoundSchema = new mongoose.Schema({
    name: String,
    description: String,
    location: {
        type: String, // Value of this should be always 'Point'
        coordinates: [Number] // This array will always have 2 elements, first is longitude, second is latitude
    }
}, { timestamps: true });

mongoose.model('Sound', SoundSchema);