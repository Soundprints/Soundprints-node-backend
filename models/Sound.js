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

SoundSchema.statics.addMockedSounds = function(userId, lat, lon, radius, count) {

    var sounds = [];
    for (var i = 0; i < count; i++) {
        // Lets generate a new location
        var u = Math.random();
        var v = Math.random();
        var r = radius/111300
        var w = r*Math.sqrt(u);
        var t = 2*Math.PI*v;
        var x = w*Math.cos(t) / Math.cos(lon);
        var y = w*Math.sin(t);

        var pointLat = lat + x;
        var pointLon = lon + y;

        // These sound files should already be uploaded to cloud storage
        var availableSoundFiles = ['SampleAudio1.mp3', 'SampleAudio2.mp3'];
        var availableSoundFileDurations = [28, 45];

        var selectedSoundFileIndex = Math.floor(Math.random()*availableSoundFiles.length);

        var newSound = new this({
            name: 'Sample Sound',
            description: 'This is a mocked sound',
            duration: availableSoundFileDurations[selectedSoundFileIndex],
            location: {
                type: 'Point',
                coordinates: [pointLon, pointLat]
            },
            user: mongoose.Types.ObjectId(userId),
            storageFileName: availableSoundFiles[selectedSoundFileIndex]
        });

        sounds.push(newSound);
    }

    this.insertMany(sounds);
}

mongoose.model('Sound', SoundSchema);