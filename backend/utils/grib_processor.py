#!/usr/bin/env python3
"""
GRIB2 Radar Data Processor
Converts GRIB2 radar data to PNG with proper colormap and handling
"""

import sys
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import xarray as xr
import gzip
import shutil
from datetime import datetime

def create_radar_colormap():
    """
    Create standard NEXRAD reflectivity colormap
    Based on NWS radar color scale (dBZ)
    """
    # Reflectivity colors (dBZ ranges)
    colors = [
        '#00FFFF',  # -30 to -20: Cyan (very light precip)
        '#00BFFF',  # -20 to -10: Deep sky blue
        '#0000FF',  # -10 to 0: Blue
        '#00FF00',  # 0 to 10: Green
        '#00C800',  # 10 to 20: Dark green
        '#009600',  # 20 to 25: Darker green
        '#FFFF00',  # 25 to 30: Yellow
        '#FFD700',  # 30 to 35: Gold
        '#FFA500',  # 35 to 40: Orange
        '#FF4500',  # 40 to 45: Orange red
        '#FF0000',  # 45 to 50: Red
        '#C80000',  # 50 to 55: Dark red
        '#A00000',  # 55 to 60: Darker red
        '#FF00FF',  # 60 to 65: Magenta
        '#9932CC',  # 65 to 70: Dark orchid
        '#FFFFFF',  # 70+: White (extreme)
    ]
    
    # dBZ boundaries
    bounds = [-30, -20, -10, 0, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80]
    
    return ListedColormap(colors), BoundaryNorm(bounds, len(colors))

def process_grib2_file(input_path, output_path, lat_bounds=None, lon_bounds=None):
    """
    Process GRIB2 file and create radar image
    
    Args:
        input_path: Path to GRIB2 file (can be .gz compressed)
        output_path: Path for output PNG
        lat_bounds: Tuple of (min_lat, max_lat) for cropping
        lon_bounds: Tuple of (min_lon, max_lon) for cropping
    """
    try:
        # Handle gzipped files
        temp_file = None
        if input_path.endswith('.gz'):
            temp_file = input_path.replace('.gz', '')
            with gzip.open(input_path, 'rb') as f_in:
                with open(temp_file, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            grib_file = temp_file
        else:
            grib_file = input_path
        
        # Open GRIB2 file with xarray/cfgrib
        print(f"Opening GRIB2 file: {grib_file}")
        
        # Try different backends
        try:
            ds = xr.open_dataset(grib_file, engine='cfgrib')
        except:
            # Fallback: try with filter_by_keys
            ds = xr.open_dataset(grib_file, engine='cfgrib', 
                                backend_kwargs={'filter_by_keys': {'typeOfLevel': 'surface'}})
        
        # Find reflectivity variable (common names)
        var_name = None
        for name in ['unknown', 'refc', 'REFC', 'reflectivity', 'dBZ', 'Reflectivity']:
            if name in ds.variables:
                var_name = name
                break
        
        if var_name is None:
            # Use first non-coordinate variable
            coord_vars = set(['latitude', 'longitude', 'lat', 'lon', 'x', 'y', 'time'])
            data_vars = [v for v in ds.variables if v not in coord_vars]
            if data_vars:
                var_name = data_vars[0]
            else:
                raise ValueError(f"No data variable found. Variables: {list(ds.variables)}")
        
        print(f"Using variable: {var_name}")
        data = ds[var_name]
        
        # Get coordinates
        if 'latitude' in ds.variables and 'longitude' in ds.variables:
            lat = ds['latitude'].values
            lon = ds['longitude'].values
        elif 'lat' in ds.variables and 'lon' in ds.variables:
            lat = ds['lat'].values
            lon = ds['lon'].values
        else:
            # Generate coordinate grid
            lat = np.linspace(20, 55, data.shape[-2])
            lon = np.linspace(-130, -60, data.shape[-1])
        
        # Extract reflectivity data
        refl_data = data.values
        
        # Handle time dimension if present
        if len(refl_data.shape) > 2:
            refl_data = refl_data[0] if refl_data.shape[0] == 1 else refl_data[-1]
        
        print(f"Data shape: {refl_data.shape}")
        print(f"Data range: {np.nanmin(refl_data):.1f} to {np.nanmax(refl_data):.1f}")
        
        # Mask missing/invalid data
        refl_data = np.ma.masked_invalid(refl_data)
        refl_data = np.ma.masked_less(refl_data, -30)  # Mask very weak returns
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 10), dpi=150)
        
        # Get colormap
        cmap, norm = create_radar_colormap()
        
        # Plot reflectivity
        if lat_bounds and lon_bounds:
            # Crop to region of interest
            lat_mask = (lat >= lat_bounds[0]) & (lat <= lat_bounds[1])
            lon_mask = (lon >= lon_bounds[0]) & (lon <= lon_bounds[1])
            
            if len(lat.shape) == 1:
                refl_crop = refl_data[lat_mask][:, lon_mask]
                lat_crop = lat[lat_mask]
                lon_crop = lon[lon_mask]
            else:
                # 2D coordinate arrays
                mask = lat_mask & lon_mask
                refl_crop = refl_data[mask]
                lat_crop = lat[mask]
                lon_crop = lon[mask]
            
            im = ax.pcolormesh(lon_crop, lat_crop, refl_crop, cmap=cmap, norm=norm, shading='auto')
            ax.set_xlim(lon_bounds)
            ax.set_ylim(lat_bounds)
        else:
            # Full CONUS
            if len(lat.shape) == 1:
                LON, LAT = np.meshgrid(lon, lat)
            else:
                LON, LAT = lon, lat
            
            im = ax.pcolormesh(LON, LAT, refl_data, cmap=cmap, norm=norm, shading='auto')
        
        # Add colorbar
        cbar = plt.colorbar(im, ax=ax, orientation='vertical', pad=0.02, fraction=0.046)
        cbar.set_label('Reflectivity (dBZ)', fontsize=12)
        
        # Labels and title
        ax.set_xlabel('Longitude', fontsize=12)
        ax.set_ylabel('Latitude', fontsize=12)
        ax.set_title(f'NOAA Radar Reflectivity\n{datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}', 
                     fontsize=14, fontweight='bold')
        
        # Grid
        ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
        
        # Save
        plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close()
        
        print(f"✅ Radar image saved: {output_path}")
        
        # Cleanup
        ds.close()
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
        
        return True
        
    except Exception as e:
        print(f"❌ Error processing GRIB2: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python grib_processor.py <input.grib2[.gz]> <output.png> [min_lat max_lat min_lon max_lon]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    lat_bounds = None
    lon_bounds = None
    
    if len(sys.argv) >= 7:
        lat_bounds = (float(sys.argv[3]), float(sys.argv[4]))
        lon_bounds = (float(sys.argv[5]), float(sys.argv[6]))
    
    success = process_grib2_file(input_file, output_file, lat_bounds, lon_bounds)
    sys.exit(0 if success else 1)
