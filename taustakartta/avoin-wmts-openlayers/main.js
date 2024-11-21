import Map from 'ol/Map.js';
import OSM from 'ol/source/OSM.js';
//import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS.js';
import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import { fromLonLat } from 'ol/proj';
import DataTile from 'ol/source/DataTile.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { get as getProjection, getTransform } from 'ol/proj.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';

proj4.defs("EPSG:3067", "+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs");
register(proj4);



const apiKey = '<INSERT-YOUR-API-KEY>',
  epsg = 'EPSG:3067',
  layer = 'maastokartta',
  //  tileMatrixSet = 'WGS84_Pseudo-Mercator',
  tileMatrixSet = 'ETRS-TM35FIN',
  capsUrl = `https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/WMTSCapabilities.xml?api-key=${apiKey}`;

const proj = getProjection(epsg),
  extent = [-548576, 6291456, 1548576, 8388608],
  resolutions = [8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5],
  tileGrid = new TileGrid({
    extent: extent,
    resolutions: resolutions,
    tileSize: [256, 256],
  });

const parser = new WMTSCapabilities();
let map;

const size = 256;

const canvas = document.createElement('canvas');
canvas.width = size;
canvas.height = size;

const context = canvas.getContext('2d', { willReadFrequently: true });
context.strokeStyle = 'white';
context.textAlign = 'center';
context.font = '24px sans-serif';
const lineHeight = 30;

fetch(capsUrl)
  .then(function (response) {
    return response.text();
  })
  .then(function (text) {
    const result = parser.read(text);
    const options = optionsFromCapabilities(result, {
      layer: layer,
      matrixSet: tileMatrixSet,
      requestEncoding: 'REST',
      tileGrid: tileGrid
    });

    console.log(options);
    const optionsWithApiKey = {
      ...options,
      ...{
        tileLoadFunction: (tile, src) => {

          let tilesrc = `${src}?api-key=${apiKey}`
          tile.getImage().src = tilesrc;
        }
      }
    };


    map = new Map({
      layers: [
        new TileLayer({
          opacity: 0.7,
          source: new WMTS(optionsWithApiKey)
        }),
        new TileLayer({
          source: new WMTS({
            ...optionsWithApiKey, ...{
              tileLoadFunction: async function (imageTile, src) {
                let tileCoord = imageTile.getTileCoord(),
                   z = tileCoord[0], x = tileCoord[1], y= tileCoord[2];

                let tilesrc = `${src}?api-key=${apiKey}`
                let lastModified = await fetch(tilesrc).then(r => r.headers.get('Last-Modified')),
                  lastModifiedText = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : '?';
                const half = size / 2;
                context.clearRect(0, 0, size, size);
                context.fillStyle = 'rgba(100, 100, 100, 0.2)';
                context.fillRect(0, 0, size, size);
                context.fillStyle = 'blue';
                context.fillText(`/${z}/${y}/${x}`, half, half - lineHeight);
                context.fillText(`${lastModifiedText}`, half, half + lineHeight);
                context.strokeRect(0, 0, size, size);
                imageTile.getImage().src = canvas.toDataURL();
              },
              // disable opacity transition to avoid overlapping labels during tile loading
              transition: 0,
            }
          })
        })
      ],
      target: 'map',
      view: new View({
        projection: proj,
        resolutions: resolutions,
        resolution: 32,
        center: fromLonLat([24, 60], epsg),
        zoom: 5,
      }),
    });
  });
