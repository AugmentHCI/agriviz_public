"use strict";

// TODO: update the following in parcoords-filter.js (https://github.com/timelyportfolio/parcoords-es/tree/filters)
// remove canvas.brushed from highlight: selectAll([canvas.foreground, canvas.brushed]).classed('faded', true);
// add events to reorderable(config, pc, xscale, position, dragging, flags, events) and call axesreorder event on end
// add class for colored axis, line, path in createAxes = function createAxes(config, pc, xscale, flags, axis)
// important add pc.resize() in side_effects (parcoords)

let chart;

const initialDimensions = ["ETP1", "ETP2", "ETP3", "wind", "sandy", "silty", "clay", "harvestDate", "yield", "fermentationLenght", "sugars_initialMust", "ph_initialMust", "totalAcidity_initialMust"];

const externalFilters = ["grapeVariety", "year", "wine_color"];
const initialFilters = { "hack": [1], "grapeVariety": [], "year": [], "wine_color": [] };
const viticulture = ["ETP1", "ETP2", "ETP3", "wind", "sandy", "silty", "clay", "harvestDate", "yield"];
const winemaking = ["fermentationLenght", "sugars_initialMust", "ph_initialMust", "totalAcidity_initialMust"];

const heightThresshold = 880;

// empty for english
// const LANGUAGE = "-en";


// Init materialize components
M.AutoInit();

//init checkbox.
$('#union-inter')[0].checked=true;

// create mousemoveend event (to prevent redrawing on every move)
(function($) {
    let timeout;
    $(document).on('mousemove', function(event) {
        if (timeout !== undefined) {
            window.clearTimeout(timeout);
        }
        timeout = window.setTimeout(function() {
            // trigger the new event on event.target, so that it can bubble appropriately
            let mousePos = { x: event.pageX, y: event.pageY };


            $(event.target).trigger('mousemoveend', mousePos);
        }, 100);
    });
}(jQuery));


// reload the app when the window is resized (to reformat all the layout)
$(document).ready(function() {
    $(window).resize(function() {
        window.location.href = window.location; // needed for FF
    });
});


let showTooltip = true;
$('#show-tooltip').change(function() {
    showTooltip = !showTooltip;
});


// load data and init chart
Promise.all([
    //d3.csv("data/resultDataSetv3-pp.csv"), // dataset
    d3.csv("data/result.csv"), // dataset imputated
    d3.csv("data/aromas2-en.csv"), // aromas
    d3.csv("data/labels-" + LANGUAGE + ".csv"), // labels for axes
    d3.json("data/aroma_ontology.owl") //ontology for wordcloud
]).then(files => {

    // init data
    let importedData = files[0];
    let activeFilters = initialFilters;
    let activeFiltersOR = {_join:"OR", "hack": [1], "grapeVariety": [], "year": [], "wine_color": [] , "terms" : []}; //activeFilters when union

    // init aromas
    let aromaData = files[1]; 
    let aromas = _.keys(aromaData[0]).slice(1); 

    // init dimensions
    let parcoordsDimensions = initDimensions(initialDimensions);

    function initDimensions(newDimensions) {
        let parcoordsDimensions = {};
        newDimensions.forEach(init => {
            parcoordsDimensions[init] = {};
        });

        // add labels to dimensions
        let labels = files[2];
        labels.forEach(label => {
            let dimension = parcoordsDimensions[label.parameter];
            if (dimension) {
                parcoordsDimensions[label.parameter].title = label.label;
                if (label.ticks)
                    parcoordsDimensions[label.parameter].ticks = label.ticks;
            }
        });
        return parcoordsDimensions;
    }


    // merge data with aromas
    let idCounter = 0;
    importedData.forEach(e => {
        // Slickgrid needs a unique id
        e.id = idCounter++;

        let publicWine = +e.public_1_private_0;
        e.label = !publicWine ? "PRIVATE_WINE_LABEL" : e.wine;

        // bug in parcoords-filter: only empties filter with first searchJS filter
        e.hack = 1;

        // parse all dimensions for parcoords
        _.keys(parcoordsDimensions).forEach(d => {
            if (typeof e[d] === 'string') {
                e[d] = Number(e[d].replace(",", ".")) //type conversion : String to int
            } else {
                e[d] = +e[d];
            }
        });

        // add aroma values
        aromas.forEach(aroma => {
            let aromaDataValues = _.findWhere(aromaData, { wine: e.wine });
            e[aroma] = aromaDataValues ? +aromaDataValues[aroma] : undefined;
        });


    });

    /*
    // sort data on GrapeVariety (for filters) -> Done while imputating missing values
    //importedData = importedData.sort(e => e.grapeVariety.toLowerCase().trim());
    importedData=importedData.sort(function(a, b) {
        return d3.ascending(a.grapeVariety.toLowerCase().trim(), b.grapeVariety.toLowerCase().trim());
    });
    */


    // init dropdown to select new variables
    let otherVariablesOptions = []
    initialDimensions.forEach(parameter => {
        let selected = "";
        if (parcoordsDimensions[parameter])
            selected = "selected";
        otherVariablesOptions.push('<option value="' + parameter + '" ' + selected + '>' + parcoordsDimensions[parameter].title + '</option>');
    });
    $('#other-parameters').append(otherVariablesOptions);

    $('#other-parameters').change(function() {
        let selectedParameters = $(this).val();
        let newDimensions = initDimensions(selectedParameters)
        chart.dimensions(newDimensions) // important add pc.resize() in side_effects (parcoords)
        updateIntersectionPoints();
        recolorAxes();
    });
    $('select').formSelect();

    // change height of parcoords according to window
    let parcoordsHeight = window.innerHeight < heightThresshold ? window.innerHeight / 4 : window.innerHeight / 3;

    chart = ParCoords()("#parcoords-widget")
        .data(importedData)
        .alpha(1)
        .alphaOnBrushed(0.075)
        .mode("queue")
        .height(parcoordsHeight)
        .margin({
            top: 15,
            left: 40,
            right: 40,
            bottom: 10
        })
        .dimensions(parcoordsDimensions)
        .render()
        .reorderable()
        .interactive()
        .brushMode("1D-axes")
        .on('brushend', function(d) {
            updateIntersectionPoints();
            gridUpdate(chart.brushed() || chart.data());
            reCalculateWordCloud(d);
        })
        .on('axesreorder', () => {
            recolorAxes();
            updateIntersectionPoints();
        });  
    recolorAxes();



    function recolorAxes() {
        d3.selectAll(".label").filter((d) => _.contains(viticulture, d)).style("fill", "#6aa84f");
        viticulture.forEach(v => {
            d3.selectAll(".line-" + v).style("stroke", "#6aa84f");
            d3.selectAll(".axis-" + v + " > path").style("stroke", "#6aa84f");
            d3.selectAll(".axis-" + v + " > .tick > text").style("fill", "#6aa84f");
        });

        d3.selectAll(".label").filter((d) => _.contains(winemaking, d)).style("fill", "#a64d79");
        winemaking.forEach(v => {
            d3.selectAll(".line-" + v).style("stroke", "#a64d79");
            d3.selectAll(".axis-" + v + " > path").style("stroke", "#a64d79");
            d3.selectAll(".axis-" + v + " > .tick > text").style("fill", "#a64d79");
        });
    }

    // init external filters
    for (let i = 0; externalFilters[i]; i++) {
        let filter = externalFilters[i];

        let filterValues = _.unique(importedData.map(j => j[filter])).sort();

        // include all filters to the filter object (data is included when string is in activeFilter)
        activeFilters[filter] = activeFilters[filter].concat(filterValues);

        // init select all button for each filter
        $('#' + filter + '-all').click(function() {
            $('form#filters' + i + ' input:checkbox').each(function() {
                $(this).prop('checked', true);
            });
            let filterValues = _.unique(importedData.map(j => j[filter])).sort();
            activeFilters[filter] = activeFilters[filter].concat(filterValues);
            activeFilters["hack"] = [1];
            updateChart();
        });

        // init select none button for each filter
        $('#' + filter + '-none').click(function() {
            $('form#filters' + i + ' input:checkbox').each(function() {
                $(this).prop('checked', false);
            });
            activeFilters[filter] = [];
            activeFilters["hack"] = [];
            updateChart();
        });

        filterValues.forEach(parameter => {
            // parse name for css-selector
            let cssId = parameter.replace("(", "").replace(")", "").replace(/ /g, '').replace(/\+/g, "");

            // check for empty filters
            let name = parameter == "" ? "none" : parameter;

            // append the filters to the DOM
            $('#filters' + i)
                .append('<div class="filter" id="' + cssId + '-div">' +
                    '<label>' +
                    '<input id="' + cssId + '-checkbox" checked type="checkbox" />' +
                    '<span>' + name + '</span>' +
                    '</label></div>');

            // add filter to the SearchJS object on change
            $('#' + cssId + '-checkbox').change(function() {
                if (this.checked) {
                    activeFilters[filter].push(parameter);
                    activeFilters["hack"] = [1];
                } else {
                    const index = activeFilters[filter].findIndex(a => a === parameter);
                    if (index > -1) {
                        activeFilters[filter].splice(index, 1);
                    }
                    if (activeFilters[filter].length === 0) {
                        activeFilters["hack"] = [];
                    }
                }
                updateChart();
            });

            // highlight lines that will be shown when user hovers over filter
            $('#' + cssId + '-div').mouseover(function() {
                chart.unhighlight();
                let workingData = chart.brushed() || importedData; // false if no brushes active
                let emptyFilters = 0;
                externalFilters.forEach(f => {
                    if (activeFilters[f].length == 0) {
                        emptyFilters++;
                    }
                });

                // show when no data is filtered, or when in active filter --> but only show when other filters allow it
                if ((workingData.length == 0 || activeFilters[filter].length > 0) && emptyFilters < 2) {
                    let tempFilter = Object.assign({}, activeFilters);
                    tempFilter["hack"] = [1];
                    delete tempFilter[filter];
                    chart.filter(tempFilter);
                    workingData = chart.brushed();
                }

                let filteredData = _.filter(workingData, w => w[filter] == parameter)
                chart.highlight2(filteredData);
                gridUpdate(filteredData);
            });

            // restore graph on mouseout
            $('#' + cssId + '-div').mouseout(function() {
                chart.unhighlight();
                chart.filter(activeFilters);
                updateIntersectionPoints();
                gridUpdate(chart.brushed() || chart.data())
            });
        });
    }



    // union or intersection on wine selection from aromas
    let intersection = true;
    $('#union-inter').change(function(e) {
        intersection = !intersection;
        activeFiltersOR["terms"] = [];
        resetWordcloud();
    });


    //reset wordCloud
    function resetWordcloud(){
        $('#other-aroma-groups').formSelect('destroy');
        $('#other-aroma-groups option:not(:disabled)').not(':selected').prop('selected', true); //reselect all the groups
        $('#other-aroma-groups').formSelect();

        //need to show all the aromas but considering activeFilters -> To check, normally done
        selectedAromas=getAromasOfGroup(allAromaGroups);

        //remove selected aromas from activeFilters or activeFiltersOR
        aromas.forEach(aroma => {
            delete activeFilters[aroma];
        });
        activeFiltersOR["terms"] = [];
        updateChart();
    }

    // init reset button for aromas
    $('#aromas-reset').click(function() {
        //reset wordcloud checkbox
        $('#union-inter')[0].checked=true;
        intersection = true;
        resetWordcloud();
    });



    // init general reset button
    $('#reset').click(function() {
        //reset wordcloud checkbox 
        $('#union-inter')[0].checked=true;
        intersection = true;
        resetWordcloud();
        window.location.reload();
    });

    // setting up the grid
    let column_keys = d3.keys(importedData[0]);
    column_keys = _.without(column_keys, "", "wine", "id", "public_1_private_0", "label", "hack");
    column_keys.unshift("label");

    let columns = column_keys.map(key => {
        return {
            id: key,
            name: key,
            field: key,
            sortable: true,
            width: 100
        }
    });

    let options = {
        // enableCellNavigation: true,
        enableColumnReorder: false,
        multiColumnSort: false,
    };

    let dataView = new Slick.Data.DataView();
    let grid = new Slick.Grid("#grid", dataView, columns, options);
    // grid.registerPlugin(new Slick.ColRes());

    // let pager = new Slick.Controls.Pager(dataView, grid, $("#pager"));

    // wire up model events to drive the grid
    dataView.onRowCountChanged.subscribe(function() {
        grid.updateRowCount();
        grid.render();
    });

    dataView.onRowsChanged.subscribe(function(e, args) {
        grid.invalidateRows(args.rows);
        grid.render();
    });

    // column sorting
    let sortcol = column_keys[0];

    function comparer(a, b) {
        let x = a[sortcol],
            y = b[sortcol];
        return (x == y ? 0 : (x > y ? 1 : -1));
    }

    // click header to sort grid column
    grid.onSort.subscribe(function(e, args) {
        sortcol = args.sortCol.field;
        dataView.sort(comparer, args.sortAsc);
    });

    // highlight row in chart
    grid.onMouseEnter.subscribe(function(e) {
        // Get row number from grid
        let grid_row = grid.getCellFromEvent(e).row;

        // Get the id of the item referenced in grid_row
        let item_id = grid.getDataItem(grid_row).id;
        let d = chart.brushed() || importedData;

        // Get the element position of the id in the data object
        let elementPos = d.map(function(x) { return x.id; }).indexOf(item_id);

        // Highlight that element in the parallel coordinates graph
        chart.highlight2([d[elementPos]]);
    });

    grid.onMouseLeave.subscribe(function() {
        chart.unhighlight();
    });

    let timer;

    grid.onScroll.subscribe(function() {
        if (timer) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(function() {
            grid.invalidate(); // fix mismatch between header and cells
        }, 200);
    });

    // fill grid with data
    gridUpdate(chart.data());

    function gridUpdate(data) {
        dataView.beginUpdate();
        dataView.setItems(data);
        dataView.endUpdate();
    }


    /*
       WORDCLOUD ONTOLOGY
    */

      let allAromaGroups = []; //list of all aroma groups in ontology
      let selectedAromas = []; //list of aromas of selected groups

      //get all aroma groups from ontology
      let aromaOntology = files[3];
      aromaOntology.forEach(a => {
           if(a["@type"] == "http://www.w3.org/2002/07/owl#Class"){ //make sure to take only classes
               let type = a["http://www.w3.org/2000/01/rdf-schema#type"][0]["@value"];
               if(type == "group"){ //take only groups
                   let element = {};
                   element.id = a["@id"];
                   let groupLabel = a["http://www.w3.org/2000/01/rdf-schema#label"];
                   if(groupLabel[0]["@language"] == LANGUAGE){
                       element.label = groupLabel[0]["@value"];
                   }else if (groupLabel[1]["@language"] == LANGUAGE){
                       element.label = groupLabel[1]["@value"];
                   }
                   allAromaGroups.push(element);
               }
           }
       })



      // init dropdown to select new aroma Groups
      let otherAromaGroupOptions = [];

      allAromaGroups.forEach(group => {
           let selected = "selected";
           otherAromaGroupOptions.push('<option value="' + group.id + '" ' + selected + '>' + group.label + '</option>');
      });
      $('#other-aroma-groups').append(otherAromaGroupOptions);

      $('#other-aroma-groups').change(function() {
          let selectedAromaGroups = []; //selected aroma groups
          $(this).val().forEach(val =>{
              let element = {};
              element.id = val;
              selectedAromaGroups.push(element);
          })
          selectedAromas=getAromasOfGroup(selectedAromaGroups);

          //if an aroma is in activeFilters/activeFiltersOR but not in selectedAromas, delete it from activeFilters/activeFiltersOR (its group is now unselected)
          if(intersection){
            let aromasInFilters = Object.keys(activeFilters);
            let basicFilters = aromasInFilters.splice(0,4); //removed elements = hack, grapeV, year, wine_color, useless
            aromasInFilters.forEach(a=>{
               var bool = selectedAromas.find(function(aroma) {
                   return aroma.label === a;
               });
               if(bool == undefined) delete activeFilters[a];
            });
          }else{
              let aromasInFiltersOR = [];
              activeFiltersOR["terms"].forEach (a => {
                    aromasInFiltersOR.push(Object.keys(a)[0]);
              });
              aromasInFiltersOR.forEach (a =>{
                  var bool = selectedAromas.find(function(aroma) {
                     return aroma.label  === a;  
                  });
                  if(bool == undefined){
                    activeFiltersOR.terms.some(e=> e[a]?activeFiltersOR.terms.splice(activeFiltersOR.terms.indexOf(e),1):console.log("error"));
                  }  
              });
          }
          updateChart();
      });
      $('select').formSelect();

      //get aromas when the groups are selected
      selectedAromas=getAromasOfGroup(allAromaGroups);
      
      function getAromasOfGroup(group){
          let aromasGroup = [];
          group.forEach(g => {
              aromaOntology.forEach(a => {
                  if(a["@type"] == "http://www.w3.org/2002/07/owl#Class"){ //make sure to take only classes
                      let type = a["http://www.w3.org/2000/01/rdf-schema#type"][0]["@value"];
                      if(type == "aroma"){ //take only aromas
                          let superClass = a["http://www.w3.org/2000/01/rdf-schema#subClassOf"][0]["@id"];
                          if(superClass == g.id){
                              let element = {};
                              element.id = a["@id"];
                              let aromaLabel = a["http://www.w3.org/2000/01/rdf-schema#label"];
                               if(aromaLabel[0]["@language"] == LANGUAGE){
                                   //aromasGroup.indexOf(aromaLabel[0]["@value"]) === -1? aromasGroup.push(aromaLabel[0]["@value"]): null
                                   element.label =aromaLabel[0]["@value"];
                               }else if (aromaLabel[1]["@language"] == LANGUAGE){
                                   //aromasGroup.indexOf(aromaLabel[1]["@value"]) === -1?aromasGroup.push(aromaLabel[1]["@value"]): null
                                   element.label =aromaLabel[1]["@value"];
                               }
                               aromasGroup.push(element);
                           }
                       aromasGroup.filter((value,index) => aromasGroup.indexOf(value) == index); //remove duplicates in aromasGroup array
                      }
                   }
              })
           })
           return aromasGroup;
       }



    // set the dimensions and margins of the word cloud
    let marginCloud = {
            top: window.innerHeight < heightThresshold ? 5 : 20,
            right: window.innerHeight < heightThresshold ? 5 : 20,
            bottom: window.innerHeight < heightThresshold ? 50 : 80,
            left: window.innerHeight < heightThresshold ? 5 : 20
        },
        widthCloud = window.innerWidth / 2 - marginCloud.left - marginCloud.right,
        heightCloud = window.innerHeight < heightThresshold ? window.innerHeight * 0.6 : window.innerHeight / 2.2 - marginCloud.top - marginCloud.bottom;


    // append the svg object to the body of the page
    let wordCloudSvg = d3.select("#my_dataviz").append("svg")
        .attr("width", widthCloud + marginCloud.left + marginCloud.right)
        .attr("height", heightCloud + marginCloud.top + marginCloud.bottom)
        .append("g")
        .attr("transform", "translate(" + marginCloud.left + "," + marginCloud.top + ")") //margin between the title and the cloud
        .append("g")
        .attr("transform", "translate(" + widthCloud / 2 + "," + heightCloud /2.5  + ")"); //centrage de wordcloud

    let minFont = window.innerHeight < heightThresshold ? 8 : 10;
    let maxFont = window.innerHeight < heightThresshold ? 15 : 30;
    let fontSizeScale = d3.scalePow().exponent(2).domain([0, 1]).range([minFont, maxFont]); // max 34 if not trimmed

    function getWordColor(word) {
        if(intersection) return activeFilters[word] ? "#009688" : "#9e9e9e";
        else {
            var result = activeFiltersOR["terms"].some(e => e.hasOwnProperty(word));
            return result? "#009688" : "#9e9e9e";
        }
    }

    let previousData = [];
    
    reCalculateWordCloud(importedData);

    function reCalculateWordCloud(newData) {
        //Hack!!! in case of Union, when unselecting the last word from wordcloud, the wordcloud disappears (because chart.brushed() is empty)
        if(newData.length == 0){ 
            newData = importedData;
            chart.filter({}); 
        }
        // check if needed to recalculate word cloud
        if (newData.length == previousData.lenght) {
            console.log("skipped new word cloud");
            return;
        } else {
            previousData = newData;
        }

        let allWords = []; // Array of aroma word with its size
        selectedAromas=selectedAromas.filter(value => aromas.includes(value.label)); //intersection of selectedAromas and aromas (selectedAromas from ontology, aromas from dataset)
        selectedAromas.forEach(a => {
            let aroma = a.label;
            //if (newData && newData.length == 0) {
            //  allWords = [];
            //} else {
                // Calculate the size of each aroma
                let size = 0;
                newData.forEach(e => {
                    if (e[aroma]) // otherwise NaN
                        size = size + e[aroma]; //size = scores of each aroma
                        //size = size + 1; //size = number of occurrences of each aroma
                });
                // Add in allWords list the aromas with sizes
                let word = aroma;
                if (aroma.length > 16)
                    word = aroma.slice(0, 15) + "...";
                if (size > 0) {
                    allWords.push({ "word": word, "size": size, "key": aroma });
                }
            //}
        });

        let maxSize = d3.max(allWords, function(d) { return d.size; });

        // Constructs a new cloud layout instance. It run an algorithm to find the position of words that suits your requirements
        // Wordcloud features that are different from one word to the other must be here
        let layout = d3.layout.cloud()
            .size([widthCloud, heightCloud])
            .words(allWords.map(d => ({ "text": d.word, "size": d.size, "key": d.key, "cssId": d.key.replace("(", "").replace(")", "").replace(/ /g, '').replace(/\+/g, "") })))
            .padding(window.innerHeight < heightThresshold ? 5 : 8) //space between words
            .rotate(0)
            .fontSize(d => fontSizeScale(d.size / maxSize)) // font size of words
            .on("end", draw);
        layout.start();

        // This function takes the output of 'layout' above and draw the words
        // Wordcloud features that are THE SAME from one word to the other can be here
        function draw(words) {
            let cloud = wordCloudSvg
                .selectAll("text")
                .data(words, w => w.key);

            cloud.exit().transition()
                .duration(200)
                .style('fill-opacity', 1e-6)
                .attr('font-size', 1)
                .remove();

            cloud
                .transition()
                .style("fill", d => getWordColor(d.key))
                .style("font-size", d => d.size + "px")
                .attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")");

            cloud
                .enter().append("text")
                .attr("id", d => "text-" + d.cssId)
                .attr("class", "word") // change cursor
                .style("fill", d => getWordColor(d.key))
                .attr("text-anchor", "middle")
                .style("font-size", d => d.size + "px") // add px for firefox..
                .style("font-family", "Impact")
                .attr("transform", d => "translate(" + [d.x, d.y] + ") rotate(" + d.rotate + ")")
                .text(d => d.text)

            // hack because d3 on does not work after update... don't ask me why?
            words.forEach(word => {
                // select DOM element
                let textElement = $('#text-' + word.cssId);

                // first remove listeners. Otherwise multiple on listeneres
                textElement.off();

                textElement.mouseover(function() {
                    highlightAroma(word.key)
                });

                textElement.mouseout(function() {
                    chart.unhighlight();
                    gridUpdate(chart.brushed() || chart.data())
                });
                
                textElement.mousedown(function() {
                    if(intersection){//intersection
                        if (activeFilters[word.key]) {
                            delete activeFilters[word.key];
                        } else { 
                            activeFilters[word.key] = { gt: 0 };
                        }
                        chart.unhighlight();
                        chart.filter(activeFilters);
                        
                    }else{ //union
                        var result = activeFiltersOR["terms"].some(e => e.hasOwnProperty(word.key)); //check if word is in terms
                        if(result) {//remove the element from terms
                            activeFiltersOR.terms.some(e=> e[word.key]?activeFiltersOR.terms.splice(activeFiltersOR.terms.indexOf(e),1):console.log("error"));
                            activeFiltersOR.terms.filter(Boolean); //reset index 
                        } else {
                            activeFiltersOR["grapeVariety"]=activeFilters["grapeVariety"];
                            activeFiltersOR["wine_color"]=activeFilters["wine_color"];
                            activeFiltersOR["year"]=activeFilters["year"];
                            let aroma = {};
                            aroma[word.key] = { gt :0 };
                            activeFiltersOR["terms"].push(aroma);
                        }
                        chart.unhighlight();
                        chart.filter(activeFiltersOR);
                    }
                    updateIntersectionPoints();
                    reCalculateWordCloud(chart.brushed())
                });
            });
        }

        function highlightAroma(aroma) {
            let workingData = chart.brushed() || importedData;
            let filteredData = _.filter(workingData, w => w[aroma] > 0)
            chart.highlight2(filteredData);
            gridUpdate(filteredData);
        }
    }

    /*
    //intersection=true par defaut
    function passFilter(wine, intersection){
        console.log(wine["wine"]);
        var bool = false;
        let grapeVariety=activeFilters["grapeVariety"]; //list of grapeVarieties in filters
        let year=activeFilters["year"]; //list of years in filters
        let wine_color=activeFilters["wine_color"]; //list of wine colors in filters
        let aromas = Object.keys(activeFilters);
        let basicFilters = aromas.splice(0,4); //removed elements = hack, grapeV, year, wine_color
        if(grapeVariety.includes(wine["grapeVariety"]) && year.includes(wine["year"]) && wine_color.includes(wine["wine_color"])){
            bool = true;
        }else{
            return bool;
        }
        if(!intersection){ //union
            var i;
            for(i = 0; i < aromas.length; i++) {
                if(wine[aromas[i]]>0){
                    bool=true;
                    console.log(bool);
                    break;
                }
                else {
                    bool=false;
                    console.log(bool);
                }
            }
        }else{ //intersection
            var i;
            for(i = 0; i < aromas.length; i++) {
                if(!(wine[aromas[i]]>0)){
                    bool=false;
                    break;
                }
            }
        }
        return bool;
    } */


    function updateChart() {
        externalFilters.forEach(f => {
            if (activeFilters[f].length == 0) {
                activeFilters["hack"] = [];
            }
        });
        chart.unhighlight(); 
        if(intersection) chart.filter(activeFilters);        
        else chart.filter(activeFiltersOR);
        gridUpdate(chart.brushed() || chart.data());
        reCalculateWordCloud(chart.brushed());
        updateIntersectionPoints();
    }

    function computeCentroids(data) {
        let margins = chart.margin();
        return chart.compute_real_centroids(data).map(function(d) { return [d[0] + margins.left, d[1] + margins.top]; });
    }

    let intersectionPoints;

    function updateIntersectionPoints() {
        let brushedData = chart.brushed() ? chart.brushed() : chart.data();
        intersectionPoints = brushedData.map(function(d) { return computeCentroids(d) });
    }

    updateIntersectionPoints();
    addHighlightSettings();


    // hack to prevent update table immediately
    let lastMouseLocation = undefined;

    // highlight lines when hover
    function addHighlightSettings() {
        let svg = d3.select('#parcoords-widget svg');

        svg
            .on('mousemove', function() {
                tooltip
                    .style("visibility", "hidden")
                lastMouseLocation = d3.mouse(this);
                chart.unhighlight();
                let condition = chart.brushed() ? chart.brushed().length > 0 : true; // no hight when no lines
                if (condition)
                    highlightLines(d3.mouse(this));
            })
            .on('mouseout', function() {
                chart.unhighlight();
                // gridUpdate(chart.brushed() || importedData)
                // cleanTooltip();
            });

        $('#parcoords-widget')
            .on('mousemoveend', function(event, mousePos) {
                let highlightedLines = getLinesForHighlight(lastMouseLocation);
                if (highlightedLines && highlightedLines[0].length) {
                    gridUpdate(highlightedLines[0]);
                    if (showTooltip) {
                        let wines = highlightedLines[0].map(w => w.label);
                        let tooltipString = "";
                        wines.forEach(wine => {
                            tooltipString += wine + "\r\n";
                        });

                        // make sure tooltip is not drawn outside the screen
                        let tooltipX = ((innerWidth - (mousePos.x + 10)) <= 205) ? innerWidth - 205 : (mousePos.x + 10);

                        tooltip
                            .style("visibility", "visible")
                            .style("top", (mousePos.y + 10) + "px")
                            .style("left", tooltipX + "px")
                            .text(tooltipString);
                    }
                }
            });
    }

    // create a tooltip
    let tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden");

    function highlightLines(mouseCoordinates) {
        let highlightedLines = getLinesForHighlight(mouseCoordinates);

        if (highlightedLines && highlightedLines[0].length) {
            let currentData = highlightedLines[0];
            chart.highlight2(currentData);
            // if (currentData.length)
            //     cleanTooltip();
            // addTooltip(currentData, highlightedLines[1]);
        }
    }

    function getLinesForHighlight(mouseCoordinates) {

        let rightAxisNumber = getNearAxis(mouseCoordinates);

        if (intersectionPoints.length && rightAxisNumber) {
            let leftAxisNumber = rightAxisNumber - 1;

            let brushedData = chart.brushed().length ? chart.brushed() : chart.data();

            let currentData = [];
            let currentIntersectionPoints = [];

            intersectionPoints.forEach(function(d, i) {
                if (isMouseOnLine(d[leftAxisNumber], d[rightAxisNumber], mouseCoordinates)) {
                    if (brushedData[i]) {
                        currentData.push(brushedData[i]);
                        currentIntersectionPoints.push(intersectionPoints[i]);
                    }
                }
            });

            return [currentData, currentIntersectionPoints];
        }
    }

    function isMouseOnLine(startIntersectionPoint, endIntersectionPoint, mouseCoordinates) {
        let accuracy = 2;

        let x0 = mouseCoordinates[0];
        let y0 = mouseCoordinates[1];
        let x1 = startIntersectionPoint[0];
        let y1 = startIntersectionPoint[1];
        let x2 = endIntersectionPoint[0];
        let y2 = endIntersectionPoint[1];

        let dX = x2 - x1;
        let dY = y2 - y1;

        let delta = Math.abs(dY * x0 - dX * y0 - x1 * y2 + x2 * y1) / Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2));

        return delta <= accuracy;
    }

    function getNearAxis(mouseCoordinates) {
        let x = mouseCoordinates[0];

        let intersectionPointsSample = intersectionPoints[0];
        let leftMostXPoint = intersectionPointsSample[0][0];
        let rightMostXPoint = intersectionPointsSample[intersectionPointsSample.length - 1][0];

        if (leftMostXPoint <= x && x <= rightMostXPoint) {
            for (let axisNumber = 0; axisNumber < intersectionPointsSample.length; axisNumber++) {
                if (intersectionPointsSample[axisNumber][0] > x) { return axisNumber; }
            }
        }
    }

    // function addTooltip(currentData, currentIntersectionPoints) {
    //     let tooltipData = getTooltipData(currentData, currentIntersectionPoints);

    //     let fontSize = 14;
    //     let padding = 2;
    //     let rectHeight = fontSize + 2 * padding;

    //     chart.svg.selectAll('rect .tooltip')
    //         .data(tooltipData).enter()
    //         .append('rect')
    //         .attr('x', function(d) { return d[0] - d[2].length * 5; })
    //         .attr('y', function(d) { return d[1] - rectHeight + 2 * padding; })
    //         .attr('rx', '2')
    //         .attr('ry', '2')
    //         .attr('class', 'tooltip')
    //         .attr('fill', 'grey')
    //         .attr('opacity', 0.9)
    //         .attr('width', function(d) { return d[2].length * 10; })
    //         .attr('height', rectHeight);

    //     chart.svg.selectAll('text .tooltip')
    //         .data(tooltipData).enter()
    //         .append('text')
    //         .attr('x', function(d) { return d[0]; })
    //         .attr('y', function(d) { return d[1]; })
    //         .attr('class', 'tooltip')
    //         .attr('fill', 'white')
    //         .attr('text-anchor', 'middle')
    //         .attr('font-size', fontSize)
    //         .text(function(d) { return d[2]; });
    // }

    // function getTooltipData(currentData, currentIntersectionPoints) {
    //     let margins = chart.margin();
    //     let tooltipData = [];

    //     for (let i = 0; i < currentData.length; i++) {
    //         for (let j = 0; j < currentIntersectionPoints[i].length; j++) {
    //             let text = d3.values(currentData[i])[j];
    //             let x = currentIntersectionPoints[i][j][0];
    //             let y = currentIntersectionPoints[i][j][1];

    //             tooltipData.push([x - margins.left, y - margins.top, text]);
    //         }
    //     }

    //     return tooltipData;
    // }

    // function cleanTooltip() { chart.svg.selectAll('.tooltip').remove(); }

});

function exportData() { // eslint-disable-line no-unused-vars
    let data = chart.brushed() ? chart.brushed() : chart.data();
    let json = [JSON.stringify(data, null, 1)];
    let blob1 = new Blob(json, { type: "text/plain;charset=utf-8" });

    //Check the Browser.
    let isIE = false || !!document.documentMode;
    if (isIE) {
        window.navigator.msSaveBlob(blob1, "export.json");
    } else {
        let url = window.URL || window.webkitURL;
        let link = url.createObjectURL(blob1);
        let a = document.createElement("a");
        a.download = "export.json";
        a.href = link;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}
