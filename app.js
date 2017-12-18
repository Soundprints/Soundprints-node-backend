var http = require('http'),
path = require('path'),
methods = require('methods'),
express = require('express'),
bodyParser = require('body-parser'),
session = require('express-session'),
cors = require('cors'),
passport = require('passport'),
errorhandler = require('errorhandler'),
mongoose = require('mongoose');

var isProduction = process.env.NODE_ENV === 'production';

// Create global app object
var app = express();

app.use(cors());

// Normal express config defaults
app.use(require('morgan')('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(require('method-override')());
app.use(express.static(__dirname + '/public'));

app.use(session({ secret: 'conduit', cookie: { maxAge: 60000 }, resave: false, saveUninitialized: false  }));

if (!isProduction) {
    app.use(errorhandler());
}

if(isProduction){
    mongoose.connect(process.env.MONGODB_PRODUCTION_URI, { useMongoClient: true }, (err) => {
        if (err) {
            console.log('MongoDB connection error: ' + err);
            console.log('Closing node');
            process.exit(1);
        }
    });
} else {
    mongoose.connect(process.env.MONGODB_DEVELOPMENT_URI, { useMongoClient: true }, (err) => {
        if (err) {
            console.log('MongoDB connection error: ' + err);
            console.log('Closing node');
            process.exit(1);
        }
    });
    mongoose.set('debug', true);
}

// TODO: add require for models, e.g. require('./models/User');

require('./models/User');
require('./models/Sound');
require('./config/passport');

app.use(require('./routes'));

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (!isProduction) {
    app.use(function(err, req, res, next) {
        console.log(err.stack);

        res.status(err.status || 500);

        res.json({'errors': {
            message: err.message,
            error: err
        }});
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({'errors': {
        message: err.message,
        error: {}
    }});
});

// finally, let's start our server...
// var server = app.listen( process.env.PORT || 8080, function(){
//     console.log('Listening on address ' + server.address().address);
//     console.log('Listening on port ' + server.address().port);
// });

var server = http.createServer();
server.listen(process.env.PORT || 8080, "0.0.0.0");

module.exports.isProduction = isProduction;