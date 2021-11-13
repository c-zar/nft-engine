const Path = require("path");
const sharp = require('sharp');
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : Path.dirname(process.execPath);
const { NETWORK } = require(Path.join(basePath, "constants/network.js"));
const fs = require("fs");
const sha1 = require(Path.join(basePath, "/node_modules/sha1"));
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

const async = require('async')

const DNA_DELIMITER = "-";

var configIndex
var loadedLayersMap = new Map();
var layerSetup;

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

const saveImageV2 = async (_editionCount, canvas) => {
    fs.writeFileSync(
        `${buildDir}/images/${_editionCount}.png`,
        canvas
    );
};

const sharpLoad = async (path) => {
    return await sharp(path)
        .resize({ width: format.width, height: format.height })
        .toBuffer()
}

const loadLayerImg = async (_layer) => {
    return new Promise(async (resolve) => {
        let image = loadedLayersMap.get(_layer.selectedElement.path)
        // console.log(`MAP SIZE: ${loadedLayersMap.size}`)
        if (image) {
            resolve({ layer: _layer, loadedImage: image });
        }
        else {
            image = await sharpLoad(`${_layer.selectedElement.path}`);
            loadedLayersMap.set(_layer.selectedElement.path, image)
            resolve({ layer: _layer, loadedImage: image });
        }
    });
};

const loadImagetoMap = async (pp) => {
    return new Promise(async (resolve) => {
        let image = loadedLayersMap.get(pp)
        if (!image) {
            image = await sharpLoad(`${pp}`);
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

const imageSaver = async.queue(async.asyncify(async (task) => {
    saveImageV2(task.index, task.canvas.toBuffer('image/png'));
}), 2)

const doWork = async (task) => {

    const newDna = task.newDna
    const _index = task.idx
    // const callback = task.callback
    let sharpCanvas = await sharp({
        create: {
            width: format.width,
            height: format.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    const layers = layerSetup[configIndex]
    let attributesList = [];
    let results = await constructLayerToDna(newDna, layers);
    let loadedElements = [];

    await Promise.all(
        results.map(async (layer) => {
            loadedElements.push(await loadLayerImg(layer));
        })
    )

    debugLogs ? console.log("Clearing canvas") : null;

    let composite = await Promise.all(loadedElements.map((renderObject, index) => {
        let selectedElement = renderObject.layer.selectedElement;
        attributesList.push({
            trait_type: renderObject.layer.name,
            value: selectedElement.name,
        });
        if (selectedElement.color) {
            attributesList.push({
                trait_type: `${renderObject.layer.name} - Color`,
                value: selectedElement.color,
            });
        }
        return ({ input: _renderObject.loadedImage })
    }));

    await sharpCanvas.composite(composite).png({ quality: 90 })
        .toBuffer()

        
    debugLogs
        ? console.log("Editions left to create: ", abstractedIndexes)
        : null;


    imageSaver.push({ 'index': _index, 'canvas': canvas });
    // await saveImage(_index, canvas)
    // saveImageV2(_index, canvas.toBuffer('image/png'))
    // console.log(`Create by ${process.pid}`)

    return [newDna, _index, attributesList]
};


process.on('message', async (workerData) => {
    configIndex = workerData.WorkerData.configIndex;
    layerSetup = workerData.WorkerData.layerSetup
    let ret = await doWork(workerData.WorkerData)
    // send response to master process
    process.send(ret);
});
