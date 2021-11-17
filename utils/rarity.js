"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require("fs");
const layersDir = `${basePath}/layers`;

const { pngLayerConfigurations, svgLayerConfigurations, format } = require(path.join(basePath, "/src/config.js"));

const { getElements } = require("../src/main.js");
const { SSL_OP_ALL } = require("constants");

const layerConfigurations = format.type == 'png' ? pngLayerConfigurations : svgLayerConfigurations

// read json data
let rawdata = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
let data = JSON.parse(rawdata);
let editionSize = data.length;

let rarityData = [];

// intialize layers to chart
layerConfigurations.forEach((config) => {
  let layers = config.layersOrder;

  layers.forEach((layer) => {
    // get elements for each layer
    var nameToidx = {};
    const ss = new Set();
    let elementsForLayer = [];
    let colorForLayer = [];
    let elements = getElements(`${layersDir}/${layer.name}/`);
    elements.forEach((element) => {
      // just get name and weight for each element
      if (!ss.has(element.name)) {
        elementsForLayer.push({
          trait: element.name,
          // chance: element.weight.toFixed(0),
          occurrence: 0, // initialize at 0
        });
        ss.add(element.name)
      }
      if (element.color) {
        if (!ss.has(element.color)) {
          colorForLayer.push({
            trait: element.color,
            // chance: element.weight.toFixed(0),
            occurrence: 0, // initialize at 0
          });
          ss.add(element.color)
        }
      }
      // else {
      //   if (!ss.has('N/A')) {
      //     colorForLayer.push({
      //       trait: 'N/A',
      //       chance: element.weight.toFixed(0),
      //       occurrence: 0, // initialize at 0
      //     });
      //     ss.add('N/A')
      //   }
      // }
    });
    let layerName =
      layer.options?.["displayName"] != undefined
        ? layer.options?.["displayName"]
        : layer.name;
    // don't include duplicate layers
    if (!rarityData.includes(layer.name)) {
      // add elements for each layer to chart
      rarityData[layerName] = elementsForLayer;
    }
    if (!rarityData.includes(`${layer.name} - Color`) && colorForLayer.length > 0) {
      // add elements for each layer to chart
      rarityData[`${layer.name} - Color`] = colorForLayer;
    }
  });
});

// fill up rarity chart with occurrences from metadata
data.forEach((element) => {
  let attributes = element.attributes;
  attributes.forEach((attribute) => {
    let traitType = attribute.trait_type;
    let value = attribute.value;

    let rarityDataTraits = rarityData[traitType];
    rarityDataTraits.forEach((rarityDataTrait) => {
      if (rarityDataTrait.trait == value) {
        // keep track of occurrences
        rarityDataTrait.occurrence++;
      }
    });
  });
});

// convert occurrences to percentages
for (var layer in rarityData) {
  let num = editionSize;
  for (var attribute in rarityData[layer]) {
    num -= rarityData[layer][attribute].occurrence;
    // convert to percentage
    rarityData[layer][attribute].occurrence = rarityData[layer][attribute].occurrence + ` out of ${editionSize}`;

    if (rarityData[layer][attribute].trait == 'None')
      rarityData[layer][attribute].occurrence = num + ` out of ${editionSize}`;
    // show two decimal places in percent
    // rarityData[layer][attribute].occurrence =
    //   rarityData[layer][attribute].occurrence.toFixed(0) + "% out of 100%";
  }
}

// print out rarity data
const tt = [];
for (var layer in rarityData) {
  console.log(`Trait type: ${layer} ${rarityData[layer].length}`);
  tt.push(rarityData[layer].length)
  console.table(rarityData[layer])
  // for (var trait in rarityData[layer]) {
  //   console.log(rarityData[layer][trait]);
  // }
}
// console.table(rarityData)
console.table(tt)
console.log(tt.reduce((previousValue, currentValue) => previousValue * currentValue).toLocaleString());
