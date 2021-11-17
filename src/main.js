"use strict";
const { fork } = require('child_process');
const Path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : Path.dirname(process.execPath);
const { NETWORK } = require(Path.join(basePath, "constants/network.js"));
const fs = require("fs");
// const { promises } = require("dns");
const sha1 = require(Path.join(basePath, "/node_modules/sha1"));
const async = require('async')
const { time } = require("console");
const { finished } = require('stream');
const { createCanvas, loadImage } = require(Path.join(
  basePath,
  "/node_modules/canvas"
));
const buildDir = Path.join(basePath, "/build");
const layersDir = Path.join(basePath, "/layers");
var total;
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  svgLayerConfigurations,
  pngLayerConfigurations,
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

const layerConfigurations = format.type == 'png' ? pngLayerConfigurations : svgLayerConfigurations

const worker = require(Path.join(basePath, "/src/worker.js"));


var metadataList = [];
var metadataList2 = [];
var processes = [];
var promises = [];
const numProcesses = 4;
var lastIndex = 0;
var dnaSet = new Set();
const dnaToLayerConfig = new Map();
const loadedLayersMap = new Map();
var layerSetup = []
var incompatibles = {};
var stream;

const DNA_DELIMITER = "-";

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

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift().split(colorDelimiter).shift();
  return nameWithoutWeight.trim();
};

const removeRarity = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight.trim();
};

const cleanColor = (_str) => {
  if (!_str.includes(colorDelimiter))
    return ""
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(colorDelimiter).pop().split(rarityDelimiter).shift()
  return nameWithoutWeight.replace(/\s/g, '').trim();
};

const getElements = (pp, po, nameToidx) => {
  return fs
    .readdirSync(pp)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => {
      if (nameToidx)
        nameToidx[Path.join(po, removeRarity(i))] = index
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
    var nameToidx = {};
    let name = layerObj.options?.["displayName"] != undefined
      ? layerObj.options?.["displayName"]
      : layerObj.name
    let z = {
      id: index,
      elements: getElements(Path.join(layersDir, layerObj.name), name, nameToidx),
      nameToidx: nameToidx,
      name: name,
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

    incompatibles[z.name] = layerObj.incompatibles
    // await Promise.all(z.elements.map(async (element) => {
    //   await loadImagetoMap(element.path)
    // }))
    return z;
  }));
};

var ii = network == NETWORK.sol ? 0 : 1

const jsonSaver = async.queue((task, callback) => {
  function checkFlag() {
    if (ii == task.index) {
      stream.write(JSON.stringify(task.metadata, null, 2));
      // fs.writeFileSync(Path.join(buildDir, `/json/_metadata.json`),
      // JSON.stringify(task.metadata, null, 2), { 'flag': 'a' })
      if (ii == (network == NETWORK.sol ? total - 1 : total)) {
        // stream.write(']');
        fs.writeFileSync(Path.join(buildDir, `/json/_metadata.json`),
          ']', { 'flag': 'a' })
      }
      else {
        //   fs.writeFileSync(Path.join(buildDir, `/json/_metadata.json`),
        //     ',\n', { 'flag': 'a' })
        stream.write(',\n');
      }
      callback()
    } else {
      setTimeout(checkFlag, 100)
    }
  }
  checkFlag()
  // saveMetaDataSingleFilev2(task.index, task.metadata);
}, numProcesses * 2 + 1)

const addMetadata = (_dna, _edition, attributesList, base64 = null) => {
  let index = network == NETWORK.sol ? _edition : _edition - 1;
  let dateTime = Date.now();
  let ethMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: base64 ? base64 : `${baseUri}/${_edition}.png`,
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
    image: base64 ? base64 : `${baseUri}/${_edition}.png`,
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

  // metadataList[index] = ethMetadata;
  // metadataList2.push(solMetadata);

  jsonSaver.push({ 'index': _edition, 'metadata': network == NETWORK.sol ? solMetadata : ethMetadata }, function (err, res) {
    if (err)
      console.log(`Error ${err}`);
    else {
      promises[ii]()
      delete promises[ii]
      ii++;
    }
  })
  saveMetaDataSingleFilev2(_edition, network == NETWORK.sol ? solMetadata : ethMetadata);
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

const isDnaUnique = (_DnaList = new Set(), _dna = "") => {
  const _filteredDNA = filterDNAOptions(_dna);
  return !_DnaList.has(_filteredDNA);
};

const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, '')
}


const cleanDna = (_str) => {
  const withoutOptions = removeQueryStrings(_str)
  return withoutOptions.split(":").shift();
};

const isCompatible = (_dna = "", _layers = []) => {
  let justNames = {}

  _layers.forEach((layer, index) => {
    justNames[layer.name] = layer.elements[layer.nameToidx[cleanDna(_dna.split(DNA_DELIMITER)[index])]].name
  })

  let keys = Object.keys(justNames)
  for (let i = 0; i < keys.length; i++) {
    let key1 = keys[i];
    let keys2 = keys.filter(l => l != key1)
    for (let j = 0; j < keys2.length; j++) {
      let key2 = keys2[j];
      let _e = incompatibles[key1]?.[justNames[key1]]?.[key2]
      if (_e) {
        if (_e.length == 0) {
          if (justNames[key2] != 'None')
            return false
        } else {
          for (let k = 0; k < _e.length; k++) {
            if (justNames[key2].toLowerCase().includes(_e[k].toLowerCase()))
              return false
          }
        }
      }
    }
  }
  return true
}



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
          `${Path.join(layer.name, removeRarity(layer.elements[i].filename))}:${removeRarity(layer.elements[i].filename)}${layer.bypassDNA ? '?bypassDNA=true' : ''}`
        );
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
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

const doWork = async.queue((task, callback) => {

  const newDna = task.newDna
  const _index = task.idx
  const configIndex = task.configIndex

  let WorkerData = {
    'newDna': newDna,
    'idx': _index,
    'configIndex': configIndex,
    'layerSetup': layerSetup,
  }


  processes[_index % numProcesses].send({ WorkerData: WorkerData });
  // let o = new Promise((res, rej) => {
  //   callback()
  // })
  promises[_index] = callback

  // let process = fork(Path.join(basePath, "/src/worker.js"))
  // process.send({ WorkerData: WorkerData });
  // listen for messages from forked process
  // processes[_index % numProcesses].on('message', (attributesList) => {
  //   addMetadata(newDna, _index, attributesList);
  //   console.log(
  //     `Created edition: ${_index}, with DNA: ${sha1(
  //       newDna
  //     )}`
  //   );
  //   // procIndex = (procIndex + 1) % numProcesses
  //   resolve();
  // });

}, numProcesses);

const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];
  try {
    fs.unlinkSync(Path.join(buildDir, `/json/_metadata.json`));
  } catch { }
  stream = fs.createWriteStream(Path.join(buildDir, `/json/_metadata.json`), { 'flags': 'a' });
  stream.write('[\r\n');
  // fs.writeFileSync(Path.join(buildDir, `/json/_metadata.json`),
  //   '[\r\n', { 'flag': 'a' })
  for (let index = 0; index < numProcesses; index++) {
    processes.push(fork(Path.join(basePath, "/src/worker.js")))
    processes[index].on('message', (ret) => {
      let newDna = ret[0], _index = ret[1], attributesList = ret[2]
      if (format.onchain)
        addMetadata(newDna, _index, attributesList, ret[3]);
      else
        addMetadata(newDna, _index, attributesList);
      console.log(
        `Created edition: ${_index}, with DNA: ${newDna}`
      );
    });
    processes[index].on('uncaughtException', function (error) {
      console.log(error);
    });

    processes[index].on('exit', function (code, signal) {
      console.log('child process exited with ' +
        `code ${code} and signal ${signal}`);
    });
  }

  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  total = abstractedIndexes.length
  lastIndex = total + (network == NETWORK.sol ? 0 : 1);
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
      while (!isCompatible(newDna, layers))
        newDna = createDna(layers);
      if (isDnaUnique(dnaSet, newDna)) {
        dnaSet.add(filterDNAOptions(newDna));
        dnaToLayerConfig.set(filterDNAOptions(newDna), layerConfigIndex)
        doWork.push({ 'newDna': newDna, 'idx': abstractedIndexes[0], 'configIndex': layerConfigIndex }, function (err, res) {
          if (err)
            console.log(`Error ${err}`);
        });
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
  await doWork.drain()

  // async function checkFlag() {
  //   if (ii == lastIndex) {
  //     return
  //   } else if (ii < lastIndex) {
  //     await setTimeout(async function () {
  //       await checkFlag();
  //     }, 1000)
  //   } else {
  //     return
  //   }
  // }

  // await checkFlag()



  // stream.end();
  // for (let index = 0; index < numProcesses; index++) {
  //   processes[index].kill()
  // }

};


module.exports = { startCreating, buildSetup, getElements };
