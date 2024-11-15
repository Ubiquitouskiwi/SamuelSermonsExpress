var orderedSermonsButton = document.querySelector("#orderedSermonsButton");
var unorderedSermonsButton = document.querySelector("#unorderedSermonsButton");
//var sermonSearchBar = document.querySelector("#sermonSearchBar");
//var sermonSearchButton = document.querySelector("#sermonSearchButton");


// Function that handles activity for when ordered sermons is selected
orderedSermonsButton.addEventListener("click", function(event) {
    event.preventDefault();
    if (!orderedSermonsButton.classList.contains("active")) {
        unorderedSermonsButton.classList.remove("active");
        orderedSermonsButton.classList.add("active");

        var orderedSermons = document.querySelector(".ordered-sermons");
        var unorderedSermons = document.querySelector(".unordered-sermons");

        if (orderedSermons.classList.contains("unactive-sermons")) {
            orderedSermons.classList.remove("unactive-sermons");
        }
        if (!unorderedSermons.classList.contains("unactive-sermons")) {
            unorderedSermons.classList.add("unactive-sermons");
            orderedSermons.classList.remove("unactive-sermons");
        }
    }
});

// Function that handles activity for when unordered sermons is selected
unorderedSermonsButton.addEventListener("click", function(event) {
    event.preventDefault();
    if (!unorderedSermonsButton.classList.contains("active")) {
        orderedSermonsButton.classList.remove("active");
        unorderedSermonsButton.classList.add("active");

        var orderedSermons = document.querySelector(".ordered-sermons");
        var unorderedSermons = document.querySelector(".unordered-sermons");

        if (unorderedSermons.classList.contains("unactive-sermons")) {
            unorderedSermons.classList.remove("unactive-sermons");
        }
        if (!orderedSermons.classList.contains("unactive-sermons")) {
            orderedSermons.classList.add("unactive-sermons");
            unorderedSermons.classList.remove("unactive-sermons");
        }
    }
});

// Function to search sermons
// sermonSearchBar.addEventListener("input", function(event) {    
//     console.log(event.target.value)
// });