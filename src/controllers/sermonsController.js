const orderedSermonData = require('../utils/orderedSermonData');
const unorderedSermonData = require('../utils/unorderedSermonData');
const asyncHandler = require("express-async-handler");

// Display Sermons page
exports.index = asyncHandler(async (req, res, next) => {
    // const filters = req.query;
    // console.log(filters);
    // const filteredSermons = orderedSermonData.filter(sermon => {
    //     let isValid = true;
    //     for (key in filters) {
    //         // Checks if sermon title contains search term
    //         isValid = isValid && sermon[key].toLowerCase().includes(filters[key].toLowerCase())
    //     }
    //     return isValid
    // });
    let unorderedSermons = null;
    if (unorderedSermonData.length != 0) {
        unorderedSermons = unorderedSermonData;
    }
    res.status(200).render("sermons", { orderedSermons: orderedSermonData, unorderedSermons: unorderedSermons });
});

// Display list of sermons
exports.sermons_list = asyncHandler(async (req, res, next) => {
    res.send("NOT IMPLEMENTED: Sermon List");
});

// Display detail page for sermon
exports.sermon_detail = asyncHandler(async (req, res, next) => {
    let sermonId = req.query.id;
    console.log("SERMON ID: " + sermonId);
    let sermon_obj = null;
    for (var sermon of orderedSermonData) {
        console.log("SERMON: " + sermon);
        console.log("Comparing " + sermon.id + " " + sermonId)
        if (sermon.id == parseInt(sermonId)) {
            sermon_obj = sermon;
            break;
        }
    }
    console.log(sermon_obj)
    res.status(200).render("sermon_detail", {sermon: sermon_obj}); //send("NOT IMPLEMENTED: Sermon Details");
});

// Display Sermon create page on GET
exports.sermon_create_get = asyncHandler(async (req, res, next) => {
    res.render("sermon_create");
});

// Handle Sermon create on POST
exports.sermons_create_post = asyncHandler(async (req, res, next) => {
    res.send("NOT IMPLEMENTED: Sermon create POST");
});

// Display Sermon delete form on GET
exports.sermons_delete_get = asyncHandler(async (req, res, next) => {
    res.send("NOT IMPLEMENTED: Sermon delete form on GET");
});

// Handle Sermon delete on POST
exports.sermons_delete_post = asyncHandler(async (req, res, next) => {
    res.send("NOT IMPLEMENTED: Sermon delete on POST");
});

// Display Sermon update form on GET
exports.sermons_update_get = asyncHandler(async (req, res, next) => {
    res.send("NOT IMPLEMENTED: Sermon update form on GET");
});

// Handle Sermon update on POST
exports.sermons_update_post = asyncHandler(async (req, res, next) => {
    res.send("NOT IMPLEMENTED: Sermon update on POST");
});