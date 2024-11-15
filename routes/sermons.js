var express = require('express');
var router = express.Router();

// Require controllers
var sermons_controller = require('../controllers/sermonsController');

/* GET sermons pagge */
router.get('/', sermons_controller.index);

// GET Sermon details page
router.get("/details", sermons_controller.sermon_detail);

// GET sermon create form
router.get("/create", sermons_controller.sermon_create_get);

// POST sermon create data
router.post("/create", sermons_controller.sermons_create_post);

// GET sermon delete form
router.get("/delete/:id", sermons_controller.sermons_delete_get);

// POST sermon delete data
router.post("/delete/:id", sermons_controller.sermons_delete_post);

// GET sermon update form
router.get("/update/:id", sermons_controller.sermons_update_get);

// POST sermon update data
router.post("/update/:id", sermons_controller.sermons_update_post);

module.exports = router;
