"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const { MODE } = require(path.join(basePath, "constants/blend_mode.js"));
const { NETWORK } = require(path.join(basePath, "constants/network.js"));

const network = NETWORK.eth;

// General metadata for Ethereum
const namePrefix = "Sekushi House";
const description = "Remember to replace this description";
const baseUri = "ipfs://NewUriToReplace";

const solanaMetadata = {
  symbol: "YC",
  seller_fee_basis_points: 1000, // Define how much % you want from secondary market sales 1000 = 10%
  external_url: "https://www.youtube.com/c/hashlipsnft",
  creators: [
    {
      address: "7fXNuer5sbZtaTEPhtJ5g5gNtuyRoKkvxdjEjEnPN4mC",
      share: 100,
    },
  ],
};

// If you have selected Solana then the collection starts from 0 automatically
const pngLayerConfigurations = [
  {
    growEditionSizeTo: 1000,
    layersOrder: [
      { name: "Background" },
      { name: "Skin" },
      { name: "Facial Features" },
      { name: "Face Tattoos" },
      { name: "Eyes" },
      { name: "Lips" },
      { name: "Clothes" },
      {
        name: "Hair",
        incompatibles:
        {
          'Long Wavy Hair With Left Sided Ponytail':
          {
            'Face Tattoos': [
              'left'
            ]
          },
          'Long Hair With Left Sleek Side': {
            'Face Tattoos': [
              'left'
            ]
          },
          'Pouf With Right Bow': {
            'Face Tattoos': [
              'right'
            ]
          },
        }
      },
    ],
  },
];

const svgLayerConfigurations = [
  {
    growEditionSizeTo: 100,
    layersOrder: [
      // { name: "Background" },
      { name: "Skin" },
      { name: "Facial Features" },
      { name: "Eyes" },
      { name: "Lips" },
      { name: "Clothes" },
      { name: "Hair" },
    ],
  },
];

const shuffleLayerConfigurations = false;

const debugLogs = false;

const format = {
  width: 1000,
  height: 1000,
  type: 'png',
  // onchain: true
};

const gif = {
  export: false,
  repeat: 0,
  quality: 100,
  delay: 500,
};

const text = {
  only: false,
  color: "#ffffff",
  size: 20,
  xGap: 40,
  yGap: 40,
  align: "left",
  baseline: "top",
  weight: "regular",
  family: "Courier",
  spacer: " => ",
};

const pixelFormat = {
  ratio: 2 / 128,
};

const background = {
  generate: false,
  brightness: "80%",
  static: false,
  default: "#000000",
};

const extraMetadata = {};

const rarityDelimiter = "#";

const colorDelimiter = "@";

const uniqueDnaTorrance = 10000;

const preview = {
  thumbPerRow: 5,
  thumbWidth: 50,
  imageRatio: format.height / format.width,
  imageName: "preview.png",
};

const preview_gif = {
  numberOfImages: 5,
  order: "ASC", // ASC, DESC, MIXED
  repeat: 0,
  quality: 100,
  delay: 500,
  imageName: "preview.gif",
};


module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  svgLayerConfigurations,
  pngLayerConfigurations,
  rarityDelimiter,
  colorDelimiter,
  preview,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  preview_gif,
};
