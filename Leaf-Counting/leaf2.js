'use strict';

let parameterToVisualize = "Real_Label";

// TODO: show cummulative

// Init materialize components
M.AutoInit();

MicroModal.init();

// create DB
const DB_NAME = "BdgLeafcountDB";

const SCENARIO_LABELS = [
    { scenario: "WW", label: "Well-watered" },
    { scenario: "WD", label: "Water deficit" },
    { scenario: "S", label: "Severe water deficit" }
];

let request = indexedDB.open(DB_NAME, 4);
let db;

request.onerror = function(event) {
    console.log("openDb:", event.target.errorCode);
    alert("Appologies, your privacy settings are too strict. We only cache the images for performance. Please use Chrome or disable private mode in Firefox.")
        // window.location = "http://www.bigdatagrapes.eu/";
};

let data = [];

request.onsuccess = function(evt) {
    db = request.result;

    var retrievedItems = [];
    db.transaction("leafcountData").objectStore("leafcountData").openCursor().onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
            retrievedItems.push(cursor.value);
            cursor.continue();
        } else {
            let data2 = _.sortBy(retrievedItems, "date")
            if (data2.length > 0) {
                data = data2;
                initGraph(data);
            }
        }
    };

}

request.onupgradeneeded = function(event) {
    // let db = event.target.result;

    // Create an objectStore to hold information about our customers. We're
    // going to use "uri" as our key path because it's guaranteed to be
    // unique
    try {
        event.target.result.deleteObjectStore("leafcountData");
    } catch (error) {
        console.log("no need to delete old database");
    }

    let objectStore = event.target.result.createObjectStore("leafcountData", { keyPath: "uri" });

    // Create an index to search customers by date. We may have duplicates
    // so we can't use a unique index.
    // objectStore.createIndex("date", "date", { unique: false });

    //   // Create an index to search customers by email. We want to ensure that
    //   // no two customers have the same email, so use a unique index.
    //   objectStore.createIndex("email", "email", { unique: true });

    // Use transaction oncomplete to make sure the objectStore creation is 
    // finished before adding data into it.
    objectStore.transaction.oncomplete = function(event) {
        Promise.all([
            d3.csv("data/ScenarioPlantExperiment.csv"),
            d3.csv("data/counting_leaves.csv"), // parcelID removed
        ]).then(files => {

            let experiments = files[0];

            let data = files[1];
            // extract entities data from json
            // data = data.entities;

            // format all dates to js-date objects
            data.map(e => {
                let splittedUri = e.uri.split("/");

                let scenarioKey = _.findWhere(experiments, { plantAlias: e.plant_alias }).Scenario;
                let scenario = _.findWhere(SCENARIO_LABELS, { scenario: scenarioKey });
                e.id = splittedUri[splittedUri.length - 1];
                e.date = new Date(e.date);
                e.Real_Label = +e.Real_Label;
                e.Predicted_Label = +e.Predicted_Label;
                e.plant = e.plant_alias.split("/")[2].replace(/\+/g, ""); // id cannot contain a plus sign!
                e.scenario = scenario;
                e.type = e.genotype.split("-")[0];
                e.comment = "";
                e.newId = e.type + "/" + e.plant_alias.split("/")[0] + "/" + e.date.getFullYear();
            });

            data[0].real_cummulative = 0;
            data[0].predicted_cummulative = 0;
            data[0].Predicted_Label = (data[0].Predicted_Label + data[1].Predicted_Label) / 2
            for (let i = 2; i < data.length; i = i + 2) {
                data[i].Predicted_Label = (data[i].Predicted_Label + data[i + 1].Predicted_Label) / 2

                data[i].real_cummulative = data[i].Real_Label - data[i - 2].Real_Label;
                data[i].predicted_cummulative = data[i].Predicted_Label - data[i - 2].Predicted_Label;
            }

            let newData = []
            for (let i = 0; i < data.length; i = i + 2) {
                newData.push(data[i])
            }
            data = newData //.slice(0, 1000);
            let groups = _.groupBy(data, e => e.plant);
            let filteredGroups = _.filter(groups, e => e.length > 3);
            data = _.flatten(filteredGroups);

            // Store values in the newly created objectStore.
            let leafcountObjectStore = db.transaction("leafcountData", "readwrite").objectStore("leafcountData");
            data.forEach(function(d) {
                leafcountObjectStore.add(d);
            });

            initGraph(data);
        });
    };
};

let allTypes = [],
    allPlants = [],
    allScenarios = [];

// reload the app when the window is resized (to reformat all the layout)
$(document).ready(function() {
    $(window).resize(function() {
        window.location.href = window.location; // needed for FF
    });
});

// set the dimensions and margins of the graph
var margin = { top: 10, right: 100, bottom: 40, left: 60 },
    width = (innerWidth - 50) - margin.left - margin.right,
    height = innerHeight - 200 - margin.top - margin.bottom;

// append the svg object to the body of the page
var svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")");

// Add X axis --> it is a date format
let x = d3.scaleTime()
    .range([0, width]);
let xAxis = svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .attr("class", "axisGray")
    .call(d3.axisBottom(x));

// Add Y axis
let y = d3.scaleLinear()
    .range([height, 0]);
let yAxis = svg.append("g")
    .attr("class", "axisGray")
    .call(d3.axisLeft(y));

svg.append("text")
    .attr("class", "axis_label")
    .attr("transform",
        "translate(" + (width / 2) + " ," +
        (height + margin.top + 20) + ")")
    .style("text-anchor", "middle")
    .text("Time period");

// text label for the y axis
svg.append("text")
    .attr("class", "axis_label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left + 20)
    .attr("x", 0 - (height / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("number of leafs");

// Add a clipPath: everything out of this area won't be drawn.
svg.append("defs").append("svg:clipPath")
    .attr("id", "clip")
    .append("svg:rect")
    .attr("width", width)
    .attr("height", height)
    .attr("x", 0)
    .attr("y", 0);

// create a global area to draw in
let brushArea;

let lineGen = d3.line()
    .x(function(d) { return x(d.date) })
    .y(function(d) { return y(d.value) })
    .curve(d3.curveMonotoneX);

let selectedElement;
// add tooltip on hover
const tip = d3.tip()
    .attr("class", "d3-tip")
    .direction('s')
    .html(d => {
        return "<span style=\"color:" + colors(d.scenario.scenario) + "\">" + d.newId + ": </span><span>" + d[parameterToVisualize].toFixed(1) + " number of leafs</span>"
    });
svg.call(tip);

$('#expert-mode').change(function() {
    parameterToVisualize = getDataLabel();
    updateChart();
});

$('#cummulative-mode').change(function() {
    parameterToVisualize = getDataLabel();
    updateChart();
});

function initGraph(data) {

    // fill the multiselect box with all keys in data
    allTypes = _.uniq(_.map(data, e => e.genotype)).sort();
    allScenarios = _.uniq(_.map(data, e => e.scenario.scenario));

    allPlants = _.uniq(_.map(data, e => e.plant));

    let genotypeOptions = []
    allTypes.forEach(type => {
        genotypeOptions.push('<option selected value="' + type + '">' + type + '</option>');
    });

    let preventChanged = false;
    $('.genotypes').append(genotypeOptions);
    $('.genotypes').change(function() {
        $('#loader').css("display", "initial");
        $('#content').css("opacity", 0.5);
        // If no selection, back to initial coordinate. Otherwise, update X axis domain
        if (preventChanged) {
            return;
        } else {
            let deselectedTypes = _.difference(allTypes, $(this).val());
            deselectedTypes.forEach(deselectedType => {
                data.forEach(plant => {
                    if (plant.genotype == deselectedType) {
                        brushArea.selectAll(".line-" + plant.plant)
                            .remove();
                        brushArea.selectAll(".dot-" + plant.plant)
                            .remove();
                        d3.selectAll(".label-" + plant.plant)
                            .remove();
                        // remove from allPlants, otherwise union is not correct
                        allPlants = _.reject(allPlants, e => e === plant.plant);
                    }
                });
            });

            allTypes = $(this).val();

            let plantsOfNewType = _.filter(data, d => _.contains(allTypes, d.genotype) && _.contains(allScenarios, d.scenario.scenario));
            allPlants = _.union(allPlants, plantsOfNewType.map(e => e.plant));

            updateChart();

        }
    });

    $('select').formSelect();

    $('select.genotypes').siblings('ul').prepend('<li id=sm_genotypes><span>Select None</span></li>');
    $('li#sm_genotypes').on('click', function() {
        preventChanged = true;
        $('#loader').css("display", "initial");
        $('#content').css("opacity", 0.5);

        var jq_elem = $(this),
            jq_elem_span = jq_elem.find('span'),
            select_all = jq_elem_span.text() == 'Select All',
            set_text = select_all ? 'Select None' : 'Select All';
        jq_elem_span.text(set_text);
        jq_elem.siblings('li').filter(function() {
            return $(this).find('input').prop('checked') != select_all;
        }).click();
        if (!select_all) {
            allTypes = [];
            allPlants = [];
            d3.selectAll("path[class*='line-']").remove();
            d3.selectAll("circle[class*='dot-']").remove();
            d3.selectAll("text[class*='label-']").remove();
        } else {
            allTypes = _.uniq(_.map(data, e => e.genotype)).sort();
            allPlants = _.uniq(_.map(data, e => e.plant));
        }
        preventChanged = false;
        $('#loader').css("display", "none");
        $('#content').css("opacity", 1);
        updateChart();
    });

    SCENARIO_LABELS.forEach(parameter => {
        $('#filters2').append('<div class="filter"><label><input id="' + parameter.scenario + '-checkbox" checked type="checkbox" /><span style=\"color:' + colors(parameter.scenario) + '\">' + parameter.label + '</span></label></div>');
        $('#' + parameter.scenario + '-checkbox').change(function() {
            if (this.checked) {
                allScenarios.push(parameter.scenario);
                let plantsOfNewType = _.filter(data, d => {
                    return d.scenario.scenario === parameter.scenario && _.contains(allTypes, d.genotype)
                });

                allPlants = _.union(allPlants, plantsOfNewType.map(e => e.plant));
            } else {
                data.forEach(plant => {
                    if (plant.scenario.scenario == parameter.scenario) {
                        brushArea.selectAll(".line-" + plant.plant)
                            .remove();
                        brushArea.selectAll(".dot-" + plant.plant)
                            .remove();
                        d3.selectAll(".label-" + plant.plant)
                            .remove();
                        allPlants = _.reject(allPlants, e => e === plant.plant);
                    }
                })
                allScenarios = _.reject(allScenarios, par => par === parameter.scenario);
            }
            updateChart();
        });
    });

    x.domain(d3.extent(data, function(d) { return d.date; }))

    // Add brushing
    var brush = d3.brushX() // Add the brush feature using the d3.brush function
        .extent([
            [0, 0],
            [width, height]
        ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
        .on("end", brushed) // Each time the brush selection changes, trigger the 'updateChart' function

    // Create the brush variable: where both the line and the brush take place
    brushArea = svg.append('g')
        .attr("clip-path", "url(#clip)")
        // Add the brushing

    // Add the brushing before the elements (for mouseover)
    brushArea
        .append("g")
        .attr("class", "brush")
        .call(brush);

    // A function that set idleTimeOut to null
    var idleTimeout

    function idled() { idleTimeout = null; }

    // A function that update the chart for given boundaries
    function brushed() {

        // What are the selected boundaries?
        let extent = d3.event.selection

        // If no selection, back to initial coordinate. Otherwise, update X axis domain
        if (!extent) {
            if (!idleTimeout) return idleTimeout = setTimeout(idled, 350); // This allows to wait a little bit
            x.domain(d3.extent(data, function(d) { return d.date; }))
        } else {
            x.domain([x.invert(extent[0]), x.invert(extent[1])])
            brushArea.select(".brush").call(brush.move, null) // This remove the grey brush area as soon as the selection has been done
        }

        // Update axis and line position
        xAxis
        // .transition(t)
            .call(d3.axisBottom(x))
        allPlants.forEach(parameter => {
            brushArea
                .select('.line-' + parameter)
                // .transition(t)
                .attr("d", lineGen)
                .on("end", () => { // move label to last point when brushed
                    d3.select("#label-" + parameter)
                        // .transition(t)
                        .attr("y", () => {
                            let xpoint = x(x.domain()[1]);
                            let path = d3.select("#line-" + parameter).node();
                            if (path) {

                                let length_end = path.getTotalLength(),
                                    length_start = 0,
                                    point = path.getPointAtLength((length_end + length_start) / 2), // get the middle point, 
                                    bisection_iterations_max = 50,
                                    bisection_iterations = 0;

                                let error = 0.01;

                                while (xpoint < point.x - error || xpoint > point.x + error) {
                                    // get the middle point
                                    point = path.getPointAtLength((length_end + length_start) / 2)

                                    if (xpoint < point.x) {
                                        length_end = (length_start + length_end) / 2
                                    } else {
                                        length_start = (length_start + length_end) / 2
                                    }

                                    // Increase iteration
                                    if (bisection_iterations_max < ++bisection_iterations)
                                        break;
                                }
                                return point.y
                            }
                            return 0
                        }) // todo if no extent (doubleclick)
                })

            brushArea
                .selectAll('.dot-' + parameter)
                .attr("cx", d => x(d.date))
                .attr("cy", function(d) { return y(d[parameterToVisualize]) })
        });
    }
    updateChart()
}

function updateChart() {

    // prepare data if not ready yet
    if (data.length == 0) {
        console.log("init data");

        db.transaction("leafcountData").objectStore("leafcountData").openCursor().onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                data.push(cursor.value);
                cursor.continue();
            }
        }
    }

    try {
        x.domain(d3.extent(data, function(d) { return d.date; }))
        xAxis.call(d3.axisBottom(x));

        let max = 0;
        d3.max(data, function(d) { return +d[parameterToVisualize]; }) > max ? max = d3.max(data, function(d) { return +d[parameterToVisualize]; }) : null;
        // update y axis with new values
        y.domain([0, max + 1]) // +1 to draw max values within visible range
        yAxis.call(d3.axisLeft(y));

        // let objectStore = db.transaction("leafcountData").objectStore("leafcountData")

        let groupedByPlants = _.groupBy(data, e => e.plant);

        allPlants.forEach(parameter => {

            let filteredData = groupedByPlants[parameter];

            let newData = filteredData.map(e => {
                return {
                    "plant": e.plant,
                    "scenario": e.scenario,
                    "type": e.genotype,
                    "date": e.date,
                    "value": e[parameterToVisualize],
                    "newId": e.newId
                }
            });

            let lines = brushArea.selectAll(".line-" + parameter)
                .data([newData], d => d.plant); // <-- in array for uniqueness !important

            lines.attr("d", lineGen);

            lines.enter().append("path")
                .attr("class", "line-" + parameter)
                .attr("id", "line-" + parameter)
                .attr("fill", "none")
                .attr("stroke", d => colors(d[0].scenario.scenario))
                .attr("stroke-opacity", 0.15)
                .attr("stroke-width", 2)
                .on("mouseover", d => {
                    d3.select("#line-" + parameter)
                        .attr("stroke-width", 4)
                        .attr("stroke-opacity", 1);
                    d3.select(".label-" + d[0].plant)
                        .attr("stroke-width", 2)
                        .style("opacity", 1);
                })
                .on("mouseout", d => {
                    d3.select("#line-" + parameter).attr("stroke-opacity", 0.15);
                    d3.select(".label-" + d[0].plant).style("opacity", 0);
                })
                .attr("d", lineGen);

            lines.exit().remove();


            let dots = brushArea.selectAll(".dot-" + parameter)
                .data(filteredData);

            dots
                .attr("cx", d => x(d.date))
                .attr("cy", function(d) { return y(d[parameterToVisualize]) })

            dots.enter()
                .append("circle")
                .attr("id", d => "id" + parameter + "" + d.date.getTime() + "" + Math.round(d[parameterToVisualize]))
                .attr("fill", d => colors(d.scenario.scenario))
                .style("stroke", "#fff")
                .style("stroke-width", 0.5)
                .attr("class", "dot-" + parameter)
                .attr("cx", d => x(d.date))
                .attr("cy", function(d) { return y(d[parameterToVisualize]) })
                .attr("r", 2.5)
                .on("mouseover", d => {
                    d3.select("#id" + parameter + "" + d.date.getTime() + "" + Math.round(d[parameterToVisualize]))
                        .attr("r", 5)
                        .attr("fill-opacity", 1);
                    d3.select(".label-" + d.plant).style("opacity", 1)
                    selectedElement = parameter;
                    return tip.show(d);
                })
                .on("mouseout", d => {
                    d3.select("#id" + parameter + "" + d.date.getTime() + "" + Math.round(d[parameterToVisualize]))
                        .attr("r", 2.5)
                        .attr("fill-opacity", 0.2);
                    d3.select(".label-" + d.plant).style("opacity", 0)
                    return tip.hide()
                })
                .on("click", (d) => {
                    selectedElement = d;
                    openModal(d)
                })
                .attr("fill-opacity", 0.2)

            dots.exit().remove();

            let labels = svg.selectAll(".label-" + parameter)
                .data([newData], d => d.genotype);

            labels
                .attr("x", width + 3)
                .attr("y", d => y(d[d.length - 1].value))

            labels.enter().append("text")
                .attr("class", "label-" + parameter)
                .attr("id", "label-" + parameter)
                .style("fill", "white")
                .attr("x", width + 3)
                .attr("y", d => y(d[d.length - 1].value))
                .style("fill", d => colors(d[0].scenario.scenario))
                .style("opacity", 0)
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .text(d => d[0].newId);

            labels.exit().remove();

            $('#loader').css("display", "none");
            $('#content').css("opacity", 1);
        });
    } catch (error) {
        // data not ready yet. Wait
        let intervalId = setInterval(() => {
            console.log("data not ready yet.");
            if (data.length !== 0) {
                console.log("data is ready.");
                updateChart();
                clearInterval(intervalId);
            }
        }, 1000);

    }

}

// function redraw() {

//     x.domain(d3.extent(data, function(d) { return d.date; }))
//     xAxis.call(d3.axisBottom(x));

//     let max = 0;
//     d3.max(data, function(d) { return +d[parameterToVisualize]; }) > max ? max = d3.max(data, function(d) { return +d[parameterToVisualize]; }) : null;
//     // update y axis with new values
//     y.domain([0, max + 1]) // +1 to draw max values within visible range
//     yAxis.call(d3.axisLeft(y));
//     lines.attr("d", lineGen);

//     dots
//     .attr("cx", d => x(d.date))
//     .attr("cy", function(d) { return y(d[parameterToVisualize]) })

//     labels
//     .attr("x", width + 3)
//     .attr("y", d => y(d[d.length - 1].value))

// }

function openModal(d) {
    $("#modal_image").attr("src", "images/" + d.id + ".png");
    $("#modal_date").val(d.date.toISOString().substring(0, 19));
    $("#modal_comment").val(d.comment);
    $("#modal_count").val(d.Real_Label);
    $("#modal_predicted_count").val(d.Predicted_Label);
    MicroModal.show('modal-1');
}

function saveEvent() {
    let updatedElem = selectedElement;
    updatedElem.date = new Date($("#modal_date").val());
    updatedElem.Real_Label = +$("#modal_count").val().replace(/,/g, '.');
    updatedElem.comment = $("#modal_comment").val();
    updatedElem.Predicted_Label = $("#modal_predicted_count").val().replace(/,/g, '.');

    let leafcountObjectStore = db.transaction("leafcountData", "readwrite").objectStore("leafcountData");
    let request = leafcountObjectStore.get(selectedElement.uri);
    request.onerror = function(event) {
        console.error("openDb:", event.target.errorCode);
    };
    request.onsuccess = function(event) {
        // Put the updated object back into the database.
        let requestUpdate = leafcountObjectStore.put(updatedElem);
        requestUpdate.onerror = function(event) {
            console.error("openDb:", event.target.errorCode);
        };
        requestUpdate.onsuccess = function(event) {
            // Success - the data is updated!
        };

        updateChart();
        MicroModal.close("modal-1");
    };
}

let colors = d3.scaleOrdinal().domain(allTypes).range(d3.schemeTableau10);

function getDataLabel() {

    if ($('#expert-mode').is(':checked') && $('#cummulative-mode').is(':checked')) {
        return "predicted_cummulative"
    } else if ($('#expert-mode').is(':checked') && !$('#cummulative-mode').is(':checked')) {
        return "Predicted_Label"
    } else if (!$('#expert-mode').is(':checked') && $('#cummulative-mode').is(':checked')) {
        return "real_cummulative"
    } else if (!$('#expert-mode').is(':checked') && !$('#cummulative-mode').is(':checked')) {
        return "Real_Label"
    }
}

function exportData() {
    var retrievedItems = [];
    db.transaction("leafcountData").objectStore("leafcountData").openCursor().onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
            retrievedItems.push(cursor.value);
            cursor.continue();
        } else {
            let data = _.sortBy(retrievedItems, "date")
            if (data.length > 0) {
                //Convert JSON string to BLOB.
                let json = [JSON.stringify(data, null, 1)];
                var blob1 = new Blob(json, { type: "text/plain;charset=utf-8" });

                //Check the Browser.
                var isIE = false || !!document.documentMode;
                if (isIE) {
                    window.navigator.msSaveBlob(blob1, "Customers.txt");
                } else {
                    var url = window.URL || window.webkitURL;
                    let link = url.createObjectURL(blob1);
                    var a = document.createElement("a");
                    a.download = "export.json";
                    a.href = link;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }

        }
    };
}

function changeOpacity(selection) { selection.attr("stroke-opacity", "0.9"); }