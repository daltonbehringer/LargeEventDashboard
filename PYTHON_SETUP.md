# Python Virtual Environment Setup

## Overview

This project uses a Python virtual environment (`venv`) to manage Python dependencies for radar data processing. The venv ensures all Python packages are isolated from your system Python installation.

## Quick Setup

Run the automated setup script:

```bash
./setup.sh
```

This will:
1. Create a Python virtual environment
2. Install all Python dependencies
3. Install Node.js dependencies
4. Create necessary data directories

## Verifying Everything Works

Check the radar images being generated:

```bash
ls -lh data/radar/
```

You should see PNG files around 340KB each (not 20KB blank files).

View the server logs to confirm Python venv is being used:

```bash
# The logs should show successful radar fetching like:
# ✅ Enhanced radar image saved: /path/to/radar_*.png
# ✅ Radar image ready: radar_*.png (340.5 KB)
```

## Current Status

✅ **Virtual environment created**: `venv/`  
✅ **Python dependencies installed**: matplotlib, numpy, Pillow, requests, xarray, cfgrib  
✅ **Server using venv Python**: Auto-detected at `venv/bin/python`  
✅ **Radar images generating**: ~340KB PNG files with actual imagery  
✅ **Periodic updates working**: Every 2 minutes  
✅ **Cleanup functioning**: Max 20 images maintained  

## Dependencies Installed

```
matplotlib==3.10.8
numpy==2.4.2
Pillow==12.1.0
requests==2.32.5
xarray==2026.1.0
cfgrib==0.9.15.1
eccodes==2.45.0
```

Plus supporting libraries: pandas, attrs, cffi, etc.

---

**Setup Complete**: February 6, 2026  
**Status**: ✅ Fully Operational