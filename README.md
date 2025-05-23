# AI Gen Image Detector Chrome Extension

## Installation and Usage

1. Install dependencies:
   ```
   yarn install
   ```
2. Start dev server:
   ```
   yarn dev
   ```
3. Build production version:
   ```
   yarn build
   ```
4. Load `dist` folder as unpacked extension in Chrome.

## ONNX Runtime setup
- Place `onnx.min.js` in `public/js/onnx.min.js`.
- Place your model in `models/deepfake_detector_02-21.onnx`.