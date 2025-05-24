# AI Generated Image Detector - Chrome Extension

Chrome extension for real-time detection of AI-generated images.

## Features

- ✅ **AI Image Detection** - Analyze images using ONNX model
- 🎯 **Smart Face Detection** - Optional filter for images without human faces
- ⚡ **High Performance** - Optimized algorithms for web browsers
- 🎨 **Visual Indicators** - Red robot icons 🤖 on detected AI images
- ⚙️ **Flexible Settings** - Choose detection methods and confidence thresholds

## Face Detection Methods

### Enhanced Heuristic (Fast) - Default
- **Speed**: Very fast
- **Size**: No additional downloads
- **Accuracy**: High for most cases
- **Algorithms**:
  - Multi-algorithm skin tone analysis (RGB, HSV, YCbCr)
  - Eye detection with contrast analysis
  - Face symmetry analysis (horizontal and vertical)
  - Face proportions check (golden ratio)
  - Skin region clustering analysis

### MediaPipe (Accurate) - Optional
- **Speed**: Slower
- **Size**: +650KB download
- **Accuracy**: Maximum (neural network model)
- **Technology**: TensorFlow.js MediaPipe Face Detection

## Settings

Available settings in extension popup:

### AI Detection Settings
- **Enable face detection filter**: Turn on/off face filtering completely
  - ✅ **Enabled**: Only analyze images with detected faces (excludes graphics/drawings)
  - ❌ **Disabled**: Analyze all images (may include non-photographic content)
- **Face Detection Method**: Choose between Enhanced Heuristic and MediaPipe
- **Detection Threshold**: Confidence threshold (10-90%)
  - Sensitive (10-50%): Detects more images
  - Balanced (50-70%): Balanced approach
  - Conservative (70-90%): Only high-confidence results

### Image Size Filter Settings  
- **Enable minimum image size filter**: Size-based filtering
- **Min width/height**: Minimum dimensions in pixels

## How It Works

1. **Pre-filtering**: Check image size requirements
2. **Face Detection** (Optional): Determine presence of human faces in image
3. **AI Analysis**: Process through ONNX deepfake detection model
4. **Visualization**: Display 🤖 icon on AI-generated images

## Performance Recommendations

- **For maximum accuracy**: Enable face detection with MediaPipe method
- **For maximum speed**: Disable face detection or use Enhanced Heuristic
- **For balanced approach**: Enable face detection with Enhanced Heuristic (default)

## Technical Details

- **ONNX Runtime**: For running deepfake detection model
- **WebAssembly**: Performance optimization
- **Service Workers**: Background processing
- **Content Scripts**: Image analysis on web pages

## Project Structure

```
src/
├── background/          # Service worker with ML models
├── content/            # Content script for DOM analysis
├── popup/              # React settings interface
├── logs/               # Analysis logs page
└── utils/              # Utilities and helper functions
```

## Development

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Production build
pnpm build
```

## Supported Formats

- JPG/JPEG images
- PNG images  
- WebP images
- Base64 data URLs
- Blob URLs

## System Requirements

- Chrome 90+
- WebAssembly support
- ~3MB free space (including MediaPipe)

## Installation and Usage

1. Install dependencies:
   ```
   pnpm install
   ```
2. Start dev server:
   ```
   pnpm dev
   ```
3. Build production version:
   ```
   pnpm build
   ```
4. Load `dist` folder as unpacked extension in Chrome.

## ONNX Runtime Setup
- Place your model in `public/models/deepfake-detection.onnx`
- WASM files are automatically handled by the build system
- Background script initializes ONNX Runtime with WebAssembly backend