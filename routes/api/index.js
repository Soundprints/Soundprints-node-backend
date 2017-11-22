var router = require('express').Router();
var auth = require('./auth');

router.use(auth.authentication);

router.use(function(err, req, res, next) {
    if (err.name === 'ValidationError') {
        return res.status(422).json({
            errors: Object.keys(err.errors).reduce(function(errors, key) {
                errors[key] = err.errors[key].message;
                return errors;
            }, {})
        });
    }
    return next(err);
});

// TODO: Add other routes when added
router.use('/sounds', require('./sounds'));

module.exports = router;