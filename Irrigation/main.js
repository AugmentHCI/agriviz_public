'use strict';

M.AutoInit();

// potential upgrades:
// - small dots for all point, big dots for sat dates
// - rescale y axis to values/dates in view

const PARAMETERS_TO_LOAD = [
    // mm units
    { key: "Irr", label: "Irrigation amount", unit: "mm", chart: "bar" },
    { key: "Etr", label: "Evapotranspiration", unit: "mm", chart: "line" },
    { key: "Pu", label: "Usable Precipitation", unit: "mm", chart: "bar" },
    { key: "H2DispEnd", label: "Available water in soil reservoir", unit: "mm", chart: "area" },

    // no units
    { key: "AWC", label: "Water storage capacity of the soil", unit: "%", chart: "area" },
    { key: "waterStress", label: "Water stress level", unit: "mm", chart: "line" }
];
const SAT_PARAMETERS_TO_LOAD = [
    // vegetation index
    { key: "ndwi", unit: "vi", chart: "line" },
    { key: "ndvi", unit: "vi", chart: "line" }
];
const EXPERT_PARAMETERS_TO_LOAD = [
    // mm units
    { key: "Prec", unit: "mm", chart: "line" },
    { key: "Et0", unit: "mm", chart: "line" },
    { key: "H2DispStart", unit: "mm", chart: "line" },
    { key: "IrrAmt", unit: "mm", chart: "line" },

    // degree units
    { key: "Tmin", label: "Minimum temperature", unit: "°C", chart: "line" },
    { key: "Tmax", label: "Maximum temperature", unit: "°C", chart: "line" },

    // MJ*m-2 units
    // { key: "Rs", unit: "MJ*m-2" }, // Florian does not know what this is

    // m*s-1 units
    { key: "Wmax", label: "Maximum wind", unit: "m*s-1", chart: "line" },
    { key: "Wmed", label: "Medium wind", unit: "m*s-1", chart: "line" },

    // % units
    { key: "URmax", label: "Maximum relative Humidity", unit: "%", chart: "line" },
    { key: "URmin", label: "Minimum relative Humidity", unit: "%", chart: "line" }
];

const ALL_SENSOR_PARAMETERS = _.union(PARAMETERS_TO_LOAD, EXPERT_PARAMETERS_TO_LOAD);
const ALL_PARAMETERS = _.union(PARAMETERS_TO_LOAD, SAT_PARAMETERS_TO_LOAD, EXPERT_PARAMETERS_TO_LOAD);
const ALL_UNITS = _.unique(ALL_PARAMETERS.map(a => a.unit));

const UNHIGHLIGHT_OPACITY = 0.2;
const NORMAL_OPACITY = 0.9;
const AXIS_WIDTH = 45;
let barWidth = 30; // needs to change with zoom level

let data = [],
    satData = [];

// variables to store all parameters
let selectedParameters = [],
    globalDate;

let parameterToHighlight = undefined;

$(document).ready(function () {
    // reload the app when the window is resized (to reformat all the layout)
    $(window).resize(function () {
        window.location.href = window.location; // needed for FF
    });

    // load data when layout is ready
    loadDataForLot("122970-142421");
});

// load plot data
Promise.all([
    d3.csv("data/lots2.csv")
]).then(files => {

    let lots = files[0];
    let Options = []
    lots.forEach(lot => {
        Options.push('<option value="' + lot.Abaco_LOT_ID + "-" + lot.Geocledian_PARCEL_ID + '">' + lot.LOT_DESCRIPTION + '</option>');
    });

    $('#lots-select').append(Options)
    $('#lots-select').change(function () {
        loadDataForLot($(this).val());
    });

    // Init select options
    $('select').formSelect();

});

function loadDataForLot(lotId) {
    // start loading icon
    $('#loader').css("display", "initial");
    $('#content').css("opacity", 0.5);

    // prepare id
    let abacoID = lotId.split("-")[0];
    let geoID = lotId.split("-")[1];

    // First need to warm API that data will be fetched
    $.ajax({
        type: 'GET',
        url: 'https://portal.siti4farmer.eu/siticatasto/dbgis-servlet/rest_tl_data?svccode=qdc/lot_meteo&dbgauth=basic&force=0&lot_id=' + abacoID,
        dataType: 'json',
        beforeSend: function (xhr) {
            xhr.setRequestHeader('Authorization', make_base_auth("<fake_username>", "<fake_password>"));
        },
        success: function (res) {
            let result = res.services[0].entities[0];
            let maxDate = result.max_date.slice(0, 10);
            // fetch latest data
            $.ajax({
                type: 'GET',
                url: 'https://portal.siti4farmer.eu/siticatasto/dbgis-servlet/rest_tl_data?svccode=indexes/get_all_agrimeteo_indexes_month&date_ref=' + maxDate + '&dbgauth=basic&lot_id=' + abacoID,
                dataType: 'json',
                //whatever you need
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('Authorization', make_base_auth("<fake_username>", "<fake_password>"));
                },
                success: function (res2) {
                    // empty chart for new data and clear filters (needed?)
                    clearChart();

                    // hide globalDataLine
                    globalDateLine.style("opacity", 0)
                    globalDateLabel.style("opacity", 0)

                    // updata graphs with new data
                    updateData(res2.services[0].entities);

                    // update map and reinitialize
                    $("#map-hack").html('<gc-map mapid="map1" gc-apikey="<fake_key>" gc-host="geocledian.com" basemap="osm" parcel-id="' + geoID + '"></gc-map>');
                    loadJSscript("js/gc-map.js", function () {
                        /* when ready, init global vue root instance */
                        vmRoot = new Vue({
                            el: "#gc-app"
                        });
                    });

                    // first fetch NDVI data
                    $.ajax({
                        type: 'GET',
                        url: 'https://geocledian.com/agknow/api/v3/parcels/' + geoID + '/ndvi?key=<fake_key>&statistics=true',
                        dataType: 'json',
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader('Authorization', make_base_auth("<fake_username>", "<fake_password>"));
                        },
                        success: function (res3) {
                            let tempSataData = res3.content.map(e => { return { "date": e.date, "ndvi": e.statistics.mean } })

                            // second fetch NWDI data
                            $.ajax({
                                type: 'GET',
                                url: 'https://geocledian.com/agknow/api/v3/parcels/' + geoID + '/ndwi?key=<fakekey>&statistics=true',
                                dataType: 'json',
                                beforeSend: function (xhr) {
                                    xhr.setRequestHeader('Authorization', make_base_auth("<fake_username>", "<fake_password>"));
                                },
                                success: function (res4) {
                                    tempSataData.forEach(f => {
                                        f.ndwi = _.findWhere(res4.content, { date: f.date }).statistics.mean;
                                    })
                                    satData = tempSataData;
                                    satData.map(l => l.date = new Date(l.date));

                                    // finally update chart with sattelite data
                                    updateChart(satData, true);
                                }
                            });
                        }
                    });

                    // hide loading screen when ready
                    setTimeout(function () {
                        // only load waterstress when nothing else is selected
                        if (!$('#waterStress-checkbox').prop('checked') && selectedParameters.length === 0)
                            $('#waterStress-checkbox').click();

                        // hide loading screen when ready
                        $('#loader').css("display", "none");
                        $('#content').css("opacity", 1);
                    }, 3000); // give map some time to load
                }
            });
        }
    });
}

// window size parameters
let margin = { top: 30, right: 180, bottom: 45, left: 75 }, // 85 right needed for H2ODispEnd
    width = (innerWidth * 0.95) - margin.left - margin.right,
    height = (innerHeight / 3) - margin.top - margin.bottom;

if (innerHeight < 1200) height = 200;
if (innerHeight < 1100) height = 100;

// append the svg object to the body of the page
let svg = d3.select("#my_dataviz")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Add a clipPath: everything out of this area won't be drawn.
let clip = svg.append("defs").append("svg:clipPath")
    .attr("id", "clip")
    .append("svg:rect")
    .attr("width", width + 10) // allow global data dot to be drawn
    .attr("height", height + 2 * margin.top) // move a down up, otherwise dots are also clipped
    .attr("x", 0)
    .attr("y", -margin.top); // move a bit up, otherwise dots are also clipped

let areaBackgroundLayer = svg.append("svg") // background for area chart, otherwise no brush
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append('g')
    .attr("clip-path", "url(#clip)");

// add tooltip on hover
const tip = d3.tip()
    .attr("class", "d3-tip")
    .direction('n')
    .html(d => {
        let unit = parameterToHighlight.unit || "";
        let label = parameterToHighlight.label || parameterToHighlight.key;
        let value = +d[parameterToHighlight.key]; // NEEDED otherwise toFixed(2) does not work :-S
        return "<span style=\"color:" + unitColor(unit) + "\">" + label + ": </span><span>" + value.toFixed(2) + " " + unit + "</span>"
    });
svg.call(tip);

// X axis 
let x = d3.scaleTime()
    .range([0, width]);
let xAxis = svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .attr("class", "axisGray")
    .call(d3.axisBottom(x));

// x axis label
xAxis.append("text")
    .attr("class", "axis_label")
    .attr("transform", "translate(" + (width / 2) + " ," + 40 + ")")
    .style("text-anchor", "middle")
    .text("Time period");

// create scales for every unit
let scales = [];
ALL_UNITS.forEach(unit => {
    let y = d3.scaleLinear()
        .range([height, 0]);

    let yAxis = svg.append("g")
        .attr("id", "axis" + unit.replace(/[^\w\s]/gi, ''))
        .attr("class", "hide axis" + unit.replace(/[^\w\s]/gi, ''))
        .attr("transform", "translate(0, 0)")
        .call(d3.axisLeft(y))
        .style("color", unitColor(unit));

    let label = yAxis.append("text")
        .attr("id", "axis_label_" + unit.replace(/[^\w\s]/gi, ''))
        .attr("class", "axis_label_" + unit.replace(/[^\w\s]/gi, ''))
        .attr("transform", "rotate(-90)")
        .attr("y", -35)
        .attr("x", -(height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", unitColor(unit))
        .text(unit);

    let lineGen = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

    let areaGen = d3.area()
        .x(d => x(d.date))
        .y0(y(0))
        .y1(d => y(d.value))

    scales.push({ "unit": unit, "y": y, "axis": yAxis, "lineGen": lineGen, "areaGen": areaGen, "label": label });
});

// Add brushing
let brush = d3.brushX() // Add the brush feature using the d3.brush function
    .extent([
        [0, 0],
        [width, height]
    ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
    .on("end", brushed); // Each time the brush selection changes, trigger the 'updateChart' function

// Create the brush variable: where both the line and the brush take place
let brushArea = svg.append('g')
    .attr("clip-path", "url(#clip)");
// Add the brushing

// Add the brushing before the elements (for mouseover)
brushArea
    .append("g")
    .attr("class", "brush")
    .call(brush);

//Draw the line
let globalDateLine = svg.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", height)
    .attr("stroke-width", 1)
    .style("stroke-dasharray", 4)
    .attr("stroke", "grey")
    .style("opacity", 0);

// add label for global date
let globalDateLabel = svg.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("color", "grey");

// A function that set idleTimeOut to null
let idleTimeout;

function idled() { idleTimeout = null; }

// A function that update the chart for given boundaries
function brushed() {

    // What are the selected boundaries?
    let extent = d3.event.selection;

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!extent) {
        if (!idleTimeout) return idleTimeout = setTimeout(idled, 350); // This allows to wait a little bit
        x.domain(d3.extent(data, d => d.date));
    } else {
        x.domain([x.invert(extent[0]), x.invert(extent[1])]);
        brushArea.select(".brush").call(brush.move, null); // This remove the grey brush area as soon as the selection has been done
    }

    // Update axis and line position
    xAxis.transition().call(d3.axisBottom(x));


    let startDate = new Date(x.domain()[0]);
    let endDate = new Date(x.domain()[1]);

    // update bar width with values in range
    let nbDaysInSelection = (endDate - startDate) / (1000 * 3600 * 24);
    barWidth = 30 * (20 / nbDaysInSelection);

    setGlobalDateLine();

    redraw(ALL_PARAMETERS);
}

function redraw(parameters) {
    parameters.forEach(parameter => {

        // let settings = getSettingsForUnit(parameter.unit);
        let yVar = _.findWhere(scales, { unit: parameter.unit }).y;
        let lineGen = _.findWhere(scales, { unit: parameter.unit }).lineGen;
        let areaGen = _.findWhere(scales, { unit: parameter.unit }).areaGen;

        // update lines
        brushArea
            .select('.line-' + parameter.key)
            .transition()
            .attr("d", lineGen)
            .on("end", () => {
                d3.select("#label-" + parameter.key)
                    .transition()
                    .attr("y", () => {
                        let xpoint = x(x.domain()[1]);
                        let path = d3.select("#line-" + parameter.key).node();
                        if (path) {
                            let length_end = path.getTotalLength(),
                                length_start = 0,
                                point = path.getPointAtLength((length_end + length_start) / 2), // get the middle point, 
                                bisection_iterations_max = 50,
                                bisection_iterations = 0;

                            let error = 0.1;

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
                    });
            });

        // update dots
        brushArea
            .selectAll('.dot-' + parameter.key)
            .transition()
            .attr("cx", d => x(d.date))
            .attr("cy", d => yVar(d[parameter.key]));

        // update area
        areaBackgroundLayer.select('.area-' + parameter.key)
            .transition()
            .attr("d", areaGen);

        // update bars
        brushArea.selectAll('.bar-' + parameter.key)
            .transition()
            .attr("x", d => x(d.date) - barWidth / 2)
            .attr("y", d => yVar(d.value) - 2)
            .attr("height", d => height - yVar(d.value))
            .attr("width", barWidth);

        // update bar labels
        brushArea.selectAll('.barlabel-' + parameter.key)
            .transition()
            .style("fill", d => (d.value / yVar.domain()[1] < 0.05) ? unitColor(parameter.unit) : "white")
            .attr("x", d => x(d.date))
            .attr("y", d => (d.value / yVar.domain()[1] < 0.05) ? yVar(d.value) - 6 : yVar(d.value) + 12);
    });
}


// create all filters based on sensor data.

// first the normal filters
PARAMETERS_TO_LOAD.forEach(parameter => {
    $('#filters').append('<div class="filter"><label><input id="' + parameter.key + '-checkbox" type="checkbox" /><span>' + parameter.label + '</span></label></div>');
    $('#' + parameter.key + '-checkbox').change(function () {
        if (this.checked) {
            selectedParameters.push(parameter);
        } else {
            clearParameterFromChart(parameter.key);
            selectedParameters = _.reject(selectedParameters, par => par.key === parameter.key);
        }

        updateChart(data);
    });
});

// create slider for expert mode
$('#expert-mode').change(function () {
    if (this.checked) {
        $('#other-parameters-wrapper').removeClass("hide")

        updateExpertParameters($('#other-parameters').val());

    } else {
        $('#other-parameters-wrapper').addClass("hide")

        selectedParameters = _.difference(selectedParameters, EXPERT_PARAMETERS_TO_LOAD);

        EXPERT_PARAMETERS_TO_LOAD.forEach(parameter => {
            clearParameterFromChart(parameter.key)
        });

        $("#expert-header").height($("#lot-header").height());
    }
    updateChart(data);
});

// prepare expert dropdown list
let otherParametersOptions = []
EXPERT_PARAMETERS_TO_LOAD.forEach(parameter => {
    let label = parameter.label;
    if (!label)
        label = parameter.key;
    otherParametersOptions.push('<option value="' + parameter.key + '">' + label + '</option>');
});

$('#other-parameters').append(otherParametersOptions);
$('#other-parameters').change(function () {
    // add selected expert parameters
    updateExpertParameters($(this).val());

    let deselectedOtherParameters = _.difference(EXPERT_PARAMETERS_TO_LOAD.map(p => p.key), selectedParameters.map(a => a.key));

    deselectedOtherParameters.forEach(deselectKey => {
        clearParameterFromChart(deselectKey);
    });

    updateChart(data);
});

// add parameter information for expert parameterstrings
function updateExpertParameters(values) {
    // first remove all expert parameters
    selectedParameters = _.without(selectedParameters, ...EXPERT_PARAMETERS_TO_LOAD);

    values.forEach(p => {
        let parameter = _.findWhere(EXPERT_PARAMETERS_TO_LOAD, { key: p });
        if (!_.contains(selectedParameters, parameter)) {
            selectedParameters.push(parameter);
        }
    });
}

// create all filters based on sat data.
SAT_PARAMETERS_TO_LOAD.forEach(parameter => {
    let label = parameter.label;
    if (!label)
        label = parameter.key;
    $('#sat-filters').append('<div class="filter"><label><input id="' + parameter.key + '-checkbox" type="checkbox" /><span>' + label + '</span></label></div>');
    $('#' + parameter.key + '-checkbox').change(function () {
        if (this.checked) {
            selectedParameters.push(parameter);

        } else {
            clearParameterFromChart(parameter.key);
            selectedParameters = _.reject(selectedParameters, par => par.key === parameter.key);
        }

        updateChart(satData, true);
    });
});

// clear all elements from the chart
function clearChart() {
    ALL_PARAMETERS.forEach(parameter => {
        clearParameterFromChart(parameter.key);
    });
}

// remove all elements of a certain parameter from the chart
function clearParameterFromChart(parameterKey) {
    d3.selectAll(".line-" + parameterKey).transition().attr("stroke-opacity", 0).remove();
    d3.selectAll(".dot-" + parameterKey).transition().attr("fill-opacity", 0).remove();
    d3.selectAll(".area-" + parameterKey).transition().attr("fill-opacity", 0).remove();
    d3.selectAll(".bar-" + parameterKey).transition().attr("fill-opacity", 0).remove();
    d3.selectAll(".label-" + parameterKey).transition().attr("fill-opacity", 0).remove();
    d3.selectAll(".barlabel-" + parameterKey).transition().attr("fill-opacity", 0).remove();
}

// update the sensor data
function updateData(res) {
    let newData = res;

    // format values
    newData.forEach(e => {
        e.date = new Date(e.date);
        e.IrrAmt = e.AWC - e.H2DispStart;
        e.WC = e.H2DispEnd + e.Pu + e.Irr - e.Etr;
        e.waterStress = Math.max(0, (1 - (e.H2DispEnd / e.AWC)) * 100); // check negative waterstress (index = 1)
        e.waterBalance = Math.min(100, ((e.H2DispEnd / e.AWC)) * 100);
    });

    // use underscore. Firefox CANNOT SORT properly
    let chronicData = _.sortBy(newData, e => e.date);

    globalDate = chronicData[newData.length - 1].date;

    x.domain(d3.extent(newData, d => d.date));
    xAxis.transition().call(d3.axisBottom(x));

    data = newData;
    updateChart(data);
}

function unitColor(unit) {
    if (unit == "mm") {
        return "#1F77B4"; // blue
    } else if (unit == "°C") {
        return "#d62728"; // red 
    } else if (unit == "vi") {
        return "#FF7F0E"; // orange
    } else if (unit == "m*s-1") {
        return "#2CA02C"; // green
    } else if (unit == "%") {
        return "#9467bd"; // purple
    } else {
        return "#8C564B";
        // tableau colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#CFECF9', '#7F7F7F', '#BCBD22', '#17BECF']
    }
}

function updateChart(dataToDraw, satBoolean) {

    /*
     *   update axes first
     */

    // filter and update scales needed
    let selectedScales = scales.filter(s => _.contains(_.pluck(selectedParameters, "unit"), s.unit));
    for (let i = 0; i < selectedScales.length; i++) {
        let axis = selectedScales[i].axis;
        axis.attr("transform", "translate(" + (i * AXIS_WIDTH) + ", 0)"); // do not add transition, messed up transform
        axis.node().classList.remove("hide");
    }

    // hide axis that are not needed
    let deSelectedScales = _.difference(scales, selectedScales);
    deSelectedScales.forEach(s => {
        s.axis.node().classList.add("hide");
    });

    // X axis 
    let xOffset = (selectedScales.length - 1) * AXIS_WIDTH;
    x.range([xOffset, width]);
    xAxis.transition().call(d3.axisBottom(x));

    // update clipping area
    clip.attr("width", (width + 10) - xOffset)
        .attr("x", xOffset);

    // update global date with new x scale
    setGlobalDateLine();

    // manually redraw (no new data, so need to trigger redraw)
    redraw(selectedParameters);

    // filter parameters to update with new data
    let parameters;
    if (satBoolean) {
        parameters = _.filter(selectedParameters, p => _.contains(SAT_PARAMETERS_TO_LOAD, p));
    } else {
        parameters = _.filter(selectedParameters, p => _.contains(ALL_SENSOR_PARAMETERS, p));
    }

    let unitGroups = _.groupBy(parameters, i => i.unit);

    _.keys(unitGroups).forEach(unit => {

        let variables = unitGroups[unit].map(a => a.key)

        // update unit axis
        let max = 0.25;
        variables.forEach(parameter => {
            d3.max(dataToDraw, d => +d[parameter]) > max ? max = d3.max(dataToDraw, d => +d[parameter]) : null;
        });

        let min = 0; // to avoid sat axis jumping
        variables.forEach(parameter => {
            d3.min(dataToDraw, d => +d[parameter]) < min ? min = d3.min(dataToDraw, d => +d[parameter]) : null;
        });

        // update y axis domain with new values
        let yVar = _.findWhere(scales, { "unit": unit }).y;
        yVar.domain([min, max + 1]) // +1 to draw max values within visible range

        // redraw y axis with new values
        let axis = _.findWhere(scales, { "unit": unit }).axis
        axis.transition().call(d3.axisLeft(yVar));
    });

    /*
     * redraw the chart elements
     */

    parameters.forEach(parameter => {

        let parameterKey = parameter.key;
        let unit = parameter.unit;
        let yVar = _.findWhere(scales, { "unit": unit }).y;
        let color = unitColor(unit);

        let newData = dataToDraw.map(e => { return { "type": parameterKey, "date": e.date, "value": e[parameterKey] } });

        // draw all lines
        if (parameter.chart == "line") {
            let lineGen = _.findWhere(scales, { "unit": unit }).lineGen;

            let lines = brushArea.selectAll(".line-" + parameterKey)
                .data([newData], d => d.type); // <-- in array for uniqueness !important

            lines.transition()
                .attr("d", lineGen);

            lines.enter().append("path")
                .on("mouseover", () => highlight(parameter))
                .on("mouseout", () => unHighlight())
                .transition()
                .attr("class", "line-" + parameterKey)
                .attr("id", "line-" + parameterKey) // I add the class line to be able to modify this line later on.
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-opacity", NORMAL_OPACITY)
                .attr("stroke-width", 3)
                .attr("d", lineGen);

            lines.exit().remove();

            let dots = brushArea.selectAll(".dot-" + parameterKey)
                .data(dataToDraw);

            dots
                .transition()
                .attr("cx", d => x(d.date))
                .attr("cy", d => yVar(d[parameterKey]));

            dots.enter()
                .append("circle")
                .attr("id", d => parameterKey + "_" + d.date.simpleDate()) // simpleDate to correct for milliseconds difference
                .attr("fill", color)
                .attr("fill-opacity", 0)
                .style("stroke", "#fff")
                .attr("class", "dot-" + parameterKey)
                .attr("cx", d => x(d.date))
                .attr("cy", d => yVar(d[parameterKey]))
                .attr("r", 4)
                .on("mouseover", d => {
                    parameterToHighlight = parameter;
                    updateGuage(d.date);
                    highlightDot(d.date, parameterToHighlight.key);
                    highlight(parameterToHighlight);
                    return tip.show(d);
                })
                .on("mouseout", d => {
                    d3.selectAll(".dot-" + parameterKey)
                        .attr("r", 4);

                    updateGuage(globalDate)
                    highlightDot(globalDate, parameterKey);
                    unHighlight();
                    return tip.hide(d)
                })
                .on("click", d => {
                    // next function sets a global date! DO NOT SET MANUALLY AGAIN
                    vmRoot.$children[0].currentDate = getNearestDate(satData, d.date);
                })
                .transition()
                .attr("fill-opacity", NORMAL_OPACITY)

            dots.exit().remove();

            addLabel(newData, parameter);

            // draw all area charts
        } else if (parameter.chart == "area") {

            let areaGen = _.findWhere(scales, { "unit": unit }).areaGen;

            let area = areaBackgroundLayer.selectAll(".area-" + parameterKey)
                .data([newData], d => d.type);

            // // Add the area
            area.transition().attr("d", areaGen);

            area.enter().append("path")
                .attr("class", "area-" + parameterKey)
                .attr("d", areaGen)
                .style("fill", color)
                .attr("fill-opacity", NORMAL_OPACITY);

            area.exit().remove();

            addLabel(newData, parameter);

            // draw all bar charts
        } else if (parameter.chart == "bar") {

            let bar = brushArea.selectAll(".bar-" + parameterKey)
                .data(newData, d => d.type);

            bar.attr("x", d => x(d.date) - barWidth / 2)
                .attr("y", d => yVar(d.value) - 2)
                .attr("height", d => height - yVar(d.value))
                .attr("width", barWidth);

            bar.enter().append("rect")
                .on("mouseover", (d) => {
                    updateGuage(d.date);
                    highlight(parameter);
                })
                .on("mouseout", () => {
                    updateGuage(globalDate)
                    unHighlight()
                })
                .attr("class", "bar-" + parameterKey)
                .attr("x", d => x(d.date) - barWidth / 2)
                .attr("y", d => yVar(d.value) - 2)
                .attr("height", d => height - yVar(d.value))
                .attr("width", barWidth)
                .attr("fill", color)
                .attr("fill-opacity", NORMAL_OPACITY);

            bar.exit().remove();

            // draw on svg (otherwise behind bars)
            let barLabels = brushArea.selectAll(".barlabel-" + parameter.key)
                .data(newData, d => d.type); // needed when new data is loaded

            barLabels
                .transition()
                .attr("x", d => x(d.date))
                .attr("y", d => (d.value / yVar.domain()[1] < 0.05) ? yVar(d.value) - 6 : yVar(d.value) + 12)
                .style("fill", d => (d.value / yVar.domain()[1] < 0.05) ? color : "white");

            barLabels.enter().append("text")
                .attr("class", "barlabel-" + parameter.key)
                .style("fill", d => (d.value / yVar.domain()[1] < 0.05) ? color : "white")
                .attr("x", d => x(d.date))
                .attr("y", d => (d.value / yVar.domain()[1] < 0.05) ? yVar(d.value) - 6 : yVar(d.value) + 12)
                .attr("fill-opacity", NORMAL_OPACITY)
                .text(d => d.value.toFixed(1));

            barLabels.exit().remove();

        }
    });

    // set a global date and update guage
    highlightGlobalDate();
}

// add labels to right of the chart
function addLabel(newData, parameter) {
    let unit = parameter ? parameter.unit : undefined;
    let label = parameter.label || parameter.key;

    let yVar = _.findWhere(scales, { "unit": unit }).y;
    let color = unitColor(unit);
    let labels = svg.selectAll(".label-" + parameter.key)
        .data([newData], d => d.type);

    labels
        .transition()
        .attr("x", width + 10)
        .attr("y", d => yVar(d[d.length - 1].value))
        .style("fill-opacity", NORMAL_OPACITY)

    labels.enter().append("text")
        .on("mouseover", () => { highlight(parameter) })
        .on("mouseout", () => { unHighlight() })
        .attr("class", "label-" + parameter.key)
        .attr("id", "label-" + parameter.key)
        .style("fill", "white")
        .attr("x", width + 10)
        .attr("y", d => yVar(d[d.length - 1].value))
        .transition()
        .style("fill", color)
        .style("fill-opacity", NORMAL_OPACITY)
        .attr("dy", ".35em")
        .text(label);

    labels.exit().remove();
}

// create and set gauge
let gauge = new JustGage({
    id: "gauge",
    value: 0,
    symbol: "%",
    min: 0,
    max: 100,
    levelColors: ["#ff0000", "#f9c802", "#a9d70b"]
});

function updateGuage(date) {
    setGlobalDateLine();

    let value = -1;
    if (dateIsWithinRange(date)) {
        let nearestDate = getNearestDate(data, date); // needed when date is set externally
        value = _.findWhere(data, { date: nearestDate }).waterBalance;
    }
    gauge.refresh(value);
    $('#donut_text').html("<span id='donut_text'>" + getIrrigationLabel(value) + "</span>");
    $('#donut_date').html("<span>" + date.toISOString().slice(0, 10) + "</span>");
}

function unHighlight() {
    // unhighlight lines, dots, and labels
    ALL_PARAMETERS.forEach(u => {
        d3.selectAll(".line-" + u.key)
            .style("opacity", NORMAL_OPACITY);
        d3.selectAll(".dot-" + u.key)
            .style("opacity", NORMAL_OPACITY);
        d3.selectAll(".label-" + u.key)
            .style("opacity", NORMAL_OPACITY);
        d3.selectAll(".bar-" + u.key)
            .style("opacity", NORMAL_OPACITY);
        d3.selectAll(".barlabel-" + u.key)
            .style("opacity", NORMAL_OPACITY);
    });

    // unhighlight axes
    scales.forEach(scale => {
        scale.axis.style("color", unitColor(scale.unit));
        scale.label.style("fill", unitColor(scale.unit));
    });
}

function highlight(hightlightObject) {
    // first unhighlight all lines.
    ALL_PARAMETERS.forEach(u => {
        d3.selectAll(".line-" + u.key)
            .style("opacity", UNHIGHLIGHT_OPACITY);
        d3.selectAll(".dot-" + u.key)
            .style("opacity", UNHIGHLIGHT_OPACITY);
        d3.selectAll(".label-" + u.key)
            .style("opacity", UNHIGHLIGHT_OPACITY);
        d3.selectAll(".bar-" + u.key)
            .style("opacity", UNHIGHLIGHT_OPACITY);
        d3.selectAll(".barlabel-" + u.key)
            .style("opacity", UNHIGHLIGHT_OPACITY);
    });

    // unhighlight axes
    scales.forEach(scale => {
        scale.axis.style("color", "lightgrey");
        scale.label.style("fill", "lightgrey")
    });

    // highlight line
    let key = hightlightObject.key;
    d3.selectAll(".line-" + key)
        .style("opacity", NORMAL_OPACITY);
    d3.selectAll(".dot-" + key)
        .style("opacity", NORMAL_OPACITY);
    d3.selectAll(".label-" + key)
        .style("opacity", NORMAL_OPACITY);
    d3.selectAll(".bar-" + key)
        .style("opacity", NORMAL_OPACITY);
    d3.selectAll(".barlabel-" + key)
        .style("opacity", NORMAL_OPACITY);

    // highlight axis
    let unit = hightlightObject.unit;
    let axis = _.findWhere(scales, { "unit": unit }).axis;
    axis.style("color", unitColor(unit));
    axis.node().classList.remove("hide");

    // recolor labels
    d3.selectAll(".axis_label_" + unit.replace(/[^\w\s]/gi, '')).style("fill", unitColor(unit));
}

// get the nearest date in the sensor data.
function getNearestDate(dataToSelectFrom, date) {
    let days = _.pluck(dataToSelectFrom, "date");
    console.log(dataToSelectFrom);

    // find nearest date to given date
    let testDate = date;
    let bestDate = days.length;
    let bestDiff = -(new Date(0, 0, 0)).valueOf();
    let currDiff = 0;
    let i;

    for (i = 0; i < days.length; ++i) {
        currDiff = Math.abs(days[i] - testDate);
        if (currDiff < bestDiff) {
            bestDate = i;
            bestDiff = currDiff;
        }
    }

    // todo? latest date return last value available
    bestDate = bestDate >= dataToSelectFrom.length ? dataToSelectFrom.length - 1 : bestDate;

    console.log(dataToSelectFrom[bestDate].date);
    return dataToSelectFrom[bestDate].date;
}

// function called from mapwidget
function setGlobalDate(date) { // eslint-disable-line no-unused-vars
    globalDate = new Date(date);
    setGlobalDateLine();
    updateGuage(globalDate);

    ALL_PARAMETERS.forEach(u => {
        d3.selectAll(".dot-" + u.key)
            .attr("r", 4);
        highlightDot(globalDate, u.key);
    });
}

function highlightGlobalDate() {
    updateGuage(globalDate);

    ALL_PARAMETERS.forEach(u => {
        d3.selectAll(".dot-" + u.key)
            .attr("r", 4);
        highlightDot(globalDate, u.key);
    });
}

function highlightDot(nearestDate, parameter) {
    d3.select("#" + parameter + "_" + nearestDate.simpleDate())
        .attr("r", 8);
}

function setGlobalDateLine() {
    globalDateLine.transition()
        .attr("x1", x(globalDate))
        .attr("x2", x(globalDate))
        .style("opacity", 1);

    globalDateLabel.transition()
        .attr("x", x(globalDate) - 40)
        .style("opacity", 1)
        .text(globalDate.toISOString().slice(0, 10));
}

//////////////////////////
// Helper functions
//////////////////////////

function getIrrigationLabel(value) {
    if (value < 0) {
        return "No data available for this date"
    } else if (value >= 60 && value <= 95) {
        return "Plant water supply is ok, no irrigation requested"
    } else if (value > 95 && value <= 100) {
        return "Water excess risk, please don't irrigate"
    } else if (value > 40 && value <= 59) {
        return "Plant water supply is decreasing , short irrigation is needed (please recover over 60 %)"
    } else if (value > 24 && value <= 40) {
        return "Plant water supply is low, irrigation is needed (sudden recover over 60%)"
    } else if (value >= 0 && value <= 24) {
        return "Stress level,danger, irrigate now (recover almost 40 %)"
    } else {
        return "Undefined water level?"
    }
}

function make_base_auth(user, password) {
    let tok = user + ':' + password;
    let hash = btoa(tok);
    return 'Basic ' + hash;
}

function dateIsWithinRange(date) {
    let nearestDate = getNearestDate(data, date);
    if (nearestDate <= data[0].date || date > data[data.length - 1].date) {
        return false;
    } else {
        return true;
    }
}
