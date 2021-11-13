"use strict";

const { Worker } = require('worker_threads')
const Path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : Path.dirname(process.execPath);
const { NETWORK } = require(Path.join(basePath, "constants/network.js"));
const fs = require("fs");
const { promises } = require("dns");
const sha1 = require(Path.join(basePath, "/node_modules/sha1"));
const async = require('async')
const totalCPUs = require('os').cpus().length;
const { time } = require("console");
const { createCanvas, loadImage } = require(Path.join(
  basePath,
  "/node_modules/canvas"
));
const buildDir = Path.join(basePath, "/build");
const layersDir = Path.join(basePath, "/layers");
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  namePrefix,
  network,
  solanaMetadata,
  colorDelimiter,
  gif,
} = require(Path.join(basePath, "/src/config.js"));


var metadataList = [];
var metadataList2 = [];
var dnaSet = new Set();
const dnaToLayerConfig = new Map();
const loadedLayersMap = new Map();
var layerSetup = []


const DNA_DELIMITER = "-";

const HashlipsGiffer = require(Path.join(
  basePath,
  "/modules/HashlipsGiffer.js"
));

let hashlipsGiffer = null;

const buildSetup = () => {
  if (fs.existsSync(buildDir)) {
    fs.rmdirSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir);
  fs.mkdirSync(Path.join(buildDir, "/json"));
  fs.mkdirSync(Path.join(buildDir, "/images"));
  if (gif.export) {
    fs.mkdirSync(Path.join(buildDir, "/gifs"));
  }
};

const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = Number(
    nameWithoutExtension.split(rarityDelimiter).pop()
  );
  if (isNaN(nameWithoutWeight)) {
    nameWithoutWeight = 1;
  }
  return nameWithoutWeight;
};

const cleanDna = (_str) => {
  const withoutOptions = removeQueryStrings(_str)
  return Number(withoutOptions.split(":").shift());
};

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift().split(colorDelimiter).shift();
  return nameWithoutWeight;
};

const cleanColor = (_str) => {
  if (!_str.includes(colorDelimiter))
    return ""
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(colorDelimiter).pop().split(rarityDelimiter).shift()
  return nameWithoutWeight;
};

const getElements = (pp) => {
  return fs
    .readdirSync(pp)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => {
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: Path.join(pp, i),
        weight: getRarityWeight(i),
        color: cleanColor(i),
      };
    });
};

const layersSetup = async (layersOrder) => {
  return await Promise.all(layersOrder.map(async (layerObj, index) => {
    let z = {
      id: index,
      elements: getElements(Path.join(layersDir, layerObj.name)),
      name:
        layerObj.options?.["displayName"] != undefined
          ? layerObj.options?.["displayName"]
          : layerObj.name,
      blend:
        layerObj.options?.["blend"] != undefined
          ? layerObj.options?.["blend"]
          : "source-over",
      opacity:
        layerObj.options?.["opacity"] != undefined
          ? layerObj.options?.["opacity"]
          : 1,
      bypassDNA:
        layerObj.options?.["bypassDNA"] !== undefined
          ? layerObj.options?.["bypassDNA"]
          : false
    }

    await Promise.all(z.elements.map(async (element) => {
      await loadImagetoMap(element.path)
    }))
    return z;
  }));
};

const saveImage = (_editionCount, canvas) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer('image/png')
  );
};

const saveImageV2 = async (_editionCount, canvas) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas
  );
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
  return pastel;
};

const drawBackground = (ctx) => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

const addMetadata = (_dna, _edition, attributesList) => {
  let dateTime = Date.now();
  let ethMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: `${baseUri}/${_edition}.png`,
    dna: sha1(_dna),
    edition: _edition,
    date: dateTime,
    ...extraMetadata,
    attributes: attributesList,
    compiler: "HashLips Art Engine",
  };
  let solMetadata = {
    //Added metadata for solana
    name: ethMetadata.name,
    symbol: solanaMetadata.symbol,
    description: ethMetadata.description,
    //Added metadata for solana
    seller_fee_basis_points: solanaMetadata.seller_fee_basis_points,
    image: `image.png`,
    //Added metadata for solana
    external_url: solanaMetadata.external_url,
    edition: _edition,
    ...extraMetadata,
    attributes: ethMetadata.attributes,
    properties: {
      files: [
        {
          uri: "image.png",
          type: "image/png",
        },
      ],
      category: "image",
      creators: solanaMetadata.creators,
    },
  };

  metadataList.push(ethMetadata);
  metadataList2.push(solMetadata);
  jsonSaver.push({ 'index': _edition, 'metadata': network == NETWORK.sol ? solMetadata : ethMetadata });
  // saveMetaDataSingleFilev2(_edition, tempMetadata);
};

const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    let image = loadedLayersMap.get(_layer.selectedElement.path)
    // console.log(`MAP SIZE: ${loadedLayersMap.size}`)
    if (image) {
      resolve({ layer: _layer, loadedImage: image });
    }
    else {
      image = await loadImage(`${_layer.selectedElement.path}`);
      loadedLayersMap.set(_layer.selectedElement.path, image)
      resolve({ layer: _layer, loadedImage: image });
    }
  });
};

const loadImagetoMap = async (pp) => {
  return new Promise(async (resolve) => {
    let image = loadedLayersMap.get(pp)
    if (!image) {
      image = await loadImage(`${pp}`);
      loadedLayersMap.set(pp, image)
    }
    resolve()
  });
};

const addText = (_sig, x, y, size, ctx) => {
  ctx.fillStyle = text.color;
  ctx.font = `${text.weight} ${size}pt ${text.family}`;
  ctx.textBaseline = text.baseline;
  ctx.textAlign = text.align;
  ctx.fillText(_sig, x, y);
};

const drawElement = (_renderObject, _index, _layersLen, ctx, addAttributes) => {
  ctx.globalAlpha = _renderObject.layer.opacity;
  ctx.globalCompositeOperation = _renderObject.layer.blend;
  text.only
    ? addText(
      `${_renderObject.layer.name}${text.spacer}${_renderObject.layer.selectedElement.name}`,
      text.xGap,
      text.yGap * (_index + 1),
      text.size
    )
    : ctx.drawImage(
      _renderObject.loadedImage,
      0,
      0,
      format.width,
      format.height
    );

  addAttributes(_renderObject);
};

const constructLayerToDna = async (_dna = "", _layers = []) => {
  return await Promise.all(_layers.map(async (layer, index) => {
    return new Promise((resolve) => {
      let selectedElement = layer.elements[cleanDna(_dna.split(DNA_DELIMITER)[index])];
      resolve({
        name: layer.name,
        blend: layer.blend,
        opacity: layer.opacity,
        selectedElement: selectedElement,
      });
    });
  }))
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
  const dnaItems = _dna.split(DNA_DELIMITER)
  const filteredDNA = dnaItems.filter(element => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) {
      return true
    }
    const options = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);

    return options.bypassDNA
  })

  return filteredDNA.join(DNA_DELIMITER)
}

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, '')
}

const isDnaUnique = (_DnaList = new Set(), _dna = "") => {
  const _filteredDNA = filterDNAOptions(_dna);
  return !_DnaList.has(_filteredDNA);
};

const createDna = (_layers) => {
  let randNum = [];
  _layers.forEach((layer) => {
    var totalWeight = 0;
    layer.elements.forEach((element) => {
      totalWeight += element.weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= layer.elements[i].weight;
      if (random < 0) {
        return randNum.push(
          `${layer.elements[i].id}:${layer.elements[i].filename}${layer.bypassDNA ? '?bypassDNA=true' : ''}`
        );
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
};

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  debugLogs
    ? console.log(
      `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
    )
    : null;
  fs.writeFileSync(
    `${buildDir}/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

const saveMetaDataSingleFilev2 = (_editionCount, metadata) => {
  debugLogs
    ? console.log(
      `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
    )
    : null;
  fs.writeFileSync(
    `${buildDir}/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

const imageSaver = async.queue(async.asyncify(async (task) => {
  saveImageV2(task.index, task.canvas.toBuffer('image/png'));
}), 2)

const jsonSaver = async.queue(async.asyncify(async (task) => {
  saveMetaDataSingleFilev2(task.index, task.metadata);
}), 2)

const doWork = async.queue(async.asyncify(async (task) => {


  const canvas = createCanvas(format.width, format.height);
  const ctx = canvas.getContext("2d");
  const newDna = task.newDna
  const _index = task.idx
  const layers = layerSetup[dnaToLayerConfig.get(newDna)]
  let attributesList = [];
  let results = await constructLayerToDna(newDna, layers);
  let loadedElements = [];


  await Promise.all(
    results.map(async (layer) => {
      loadedElements.push(await loadLayerImg(layer));
    })
  )


  debugLogs ? console.log("Clearing canvas") : null;
  ctx.clearRect(0, 0, format.width, format.height);
  if (gif.export) {
    hashlipsGiffer = new HashlipsGiffer(
      canvas,
      ctx,
      `${buildDir}/gifs/${_index}.gif`,
      gif.repeat,
      gif.quality,
      gif.delay
    );
    hashlipsGiffer.start();
  }
  if (background.generate) {
    drawBackground(ctx);
  }

  await Promise.all(loadedElements.map((renderObject, index) => {
    drawElement(
      renderObject,
      index,
      layerConfigurations[dnaToLayerConfig.get(newDna)].layersOrder.length,
      ctx,
      (_element) => {
        let selectedElement = _element.layer.selectedElement;
        attributesList.push({
          trait_type: _element.layer.name,
          value: selectedElement.name,
        });
        if (selectedElement.color) {
          attributesList.push({
            trait_type: `${_element.layer.name} - Color`,
            value: selectedElement.color,
          });
        }
      }
    );
    if (gif.export) {
      hashlipsGiffer.add();
    }
  }));


  if (gif.export) {
    hashlipsGiffer.stop();
  }
  debugLogs
    ? console.log("Editions left to create: ", abstractedIndexes)
    : null;


  imageSaver.push({ 'index': _index, 'canvas': canvas });
  // await saveImage(_index, canvas)
  // saveImageV2(_index, canvas.toBuffer('image/png'))

  addMetadata(newDna, _index, attributesList);
  attributesList = [];
  console.log(
    `Created edition: ${_index}, with DNA: ${sha1(
      newDna
    )}`
  );


}), 4);

const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];
  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  if (shuffleLayerConfigurations) {
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  debugLogs
    ? console.log("Editions left to create: ", abstractedIndexes)
    : null;

  layerSetup = await Promise.all(layerConfigurations.map(async (element) => {
    return await layersSetup(
      element.layersOrder
    );
  }))


  while (layerConfigIndex < layerConfigurations.length) {
    const layers = layerSetup[layerConfigIndex]

    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {

      let newDna = createDna(layers);
      if (isDnaUnique(dnaSet, newDna)) {
        dnaSet.add(filterDNAOptions(newDna));
        dnaToLayerConfig.set(filterDNAOptions(newDna), layerConfigIndex)
        doWork.push({ 'newDna': newDna, 'idx': abstractedIndexes[0] });
        editionCount++;
        abstractedIndexes.shift();
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
  await doWork.drain()
};


module.exports = { startCreating, buildSetup, getElements };
