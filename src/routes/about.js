var express = require('express');
var router = express.Router();

// Require controller modules
const about_controller = require('../controllers/aboutController');

/* GET About Page index */
router.get('/', about_controller.index);

module.exports = router;