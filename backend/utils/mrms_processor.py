#!/usr/bin/env python3
"""
MRMS GRIB2 Processor
Downloads, decompresses, and plots NOAA MRMS reflectivity on a regional map.
Crops the full CONUS grid (3500×7000) to a tight region around the event
location before plotting, which makes rendering fast and the output detailed.
"""

import sys
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import cartopy.crs as ccrs
import cartopy.feature as cfeature
from matplotlib.colors import ListedColormap, BoundaryNorm
from datetime import datetime


# ---------------------------------------------------------------------------
# GRIB2 loaders
# ---------------------------------------------------------------------------

def load_grib2(grib_path):
    """Load MRMS GRIB2 with pygrib (preferred — fast C library)."""
    try:
        import pygrib
        grbs = pygrib.open(grib_path)
        grb  = grbs[1]

        data = grb.values.astype(np.float32)
        lats, lons = grb.latlons()
        valid_date = grb.validDate

        grbs.close()

        print(f"Loaded GRIB2 via pygrib — shape {data.shape}")
        print(f"  Valid: {valid_date}")
        # Replace the MRMS missing-data sentinel (-999) with NaN
        data[data <= -990] = np.nan
        vmin = np.nanmin(data)
        vmax = np.nanmax(data)
        print(f"  Reflectivity range: {vmin:.1f} to {vmax:.1f} dBZ")

        return data, lats, lons, valid_date

    except ImportError:
        print("pygrib unavailable — falling back to xarray+cfgrib")
        return _load_grib2_xarray(grib_path)


def _load_grib2_xarray(grib_path):
    """Fallback loader using xarray + cfgrib engine."""
    import xarray as xr
    ds = xr.open_dataset(grib_path, engine='cfgrib')

    var_name = list(ds.data_vars)[0]
    data = ds[var_name].values.astype(np.float32)

    lat1d = ds['latitude'].values
    lon1d = ds['longitude'].values
    if lat1d.ndim == 1 and lon1d.ndim == 1:
        lons, lats = np.meshgrid(lon1d, lat1d)
    else:
        lats, lons = lat1d, lon1d

    valid_date = None
    if 'time' in ds.coords:
        valid_date = ds.time.values

    ds.close()
    data[data <= -990] = np.nan

    print(f"Loaded GRIB2 via xarray — shape {data.shape}")
    return data, lats, lons, valid_date


# ---------------------------------------------------------------------------
# Regional crop
# ---------------------------------------------------------------------------

def crop_region(data, lats, lons, center_lat, center_lon, radius_deg=3.0):
    """
    Crop the CONUS grid to ± radius_deg around the center point.
    Returns cropped arrays that are much smaller and faster to plot.

    MRMS GRIB2 files use 0-360° longitudes (e.g. 230-300 for CONUS).
    The caller passes standard -180/180 longitudes, so we convert here.
    After cropping we shift lons back to -180/180 for Cartopy PlateCarree.
    """
    lat_min = center_lat - radius_deg
    lat_max = center_lat + radius_deg

    # Convert center_lon to the 0-360 system used by the GRIB2 file
    grid_center_lon = center_lon % 360          # -121.97 → 238.03
    lon_min = grid_center_lon - radius_deg
    lon_max = grid_center_lon + radius_deg

    print(f"  Grid lon range for crop: {lon_min:.2f} – {lon_max:.2f} (0-360)")

    if lats.ndim == 2:
        # 2-D lat/lon grids (from pygrib)
        lat_col = lats[:, 0]  # latitudes along the first column
        lon_row = lons[0, :]  # longitudes along the first row

        row_mask = (lat_col >= lat_min) & (lat_col <= lat_max)
        col_mask = (lon_row >= lon_min) & (lon_row <= lon_max)

        data_c = data[np.ix_(row_mask, col_mask)]
        lats_c = lats[np.ix_(row_mask, col_mask)]
        lons_c = lons[np.ix_(row_mask, col_mask)]
    else:
        data_c, lats_c, lons_c = data, lats, lons

    # Convert longitudes back to -180/180 for Cartopy
    lons_c = np.where(lons_c > 180, lons_c - 360, lons_c)

    print(f"  Cropped to {data_c.shape} (±{radius_deg}° around event)")
    return data_c, lats_c, lons_c


# ---------------------------------------------------------------------------
# NEXRAD-style reflectivity colormap
# ---------------------------------------------------------------------------

def nexrad_colormap():
    """Return (cmap, norm) matching NWS reflectivity colours."""
    colors = [
        '#646464',  #  -5  Light grey (barely detectable)
        '#04e9e7',  #   0  Cyan
        '#019ff4',  #   5  Light blue
        '#0300f4',  #  10  Blue
        '#02fd02',  #  15  Light green
        '#01c501',  #  20  Green
        '#008e00',  #  25  Dark green
        '#fdf802',  #  30  Yellow
        '#e5bc00',  #  35  Gold
        '#fd9500',  #  40  Orange
        '#fd0000',  #  45  Red
        '#d40000',  #  50  Dark red
        '#bc0000',  #  55  Crimson
        '#f800fd',  #  60  Magenta
        '#9854c6',  #  65  Purple
        '#fdfdfd',  #  70+ White
    ]
    bounds = [-5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80]

    cmap = ListedColormap(colors)
    norm = BoundaryNorm(bounds, cmap.N)
    return cmap, norm, bounds


# ---------------------------------------------------------------------------
# Map rendering
# ---------------------------------------------------------------------------

def plot_mrms(data, lats, lons, output_path, center_lat, center_lon,
              valid_date=None, radius_deg=3.0):
    """Render reflectivity on a regional map and save as PNG."""

    print(f"Rendering map (±{radius_deg}° around {center_lat:.2f}, {center_lon:.2f})...")

    # ---- figure & projection --------------------------------------------------
    fig = plt.figure(figsize=(14, 11))
    proj = ccrs.LambertConformal(central_longitude=center_lon,
                                  central_latitude=center_lat)
    ax = fig.add_axes([0.05, 0.08, 0.90, 0.85], projection=proj)

    extent = [center_lon - radius_deg, center_lon + radius_deg,
              center_lat - radius_deg, center_lat + radius_deg]
    ax.set_extent(extent, crs=ccrs.PlateCarree())
    ax.set_facecolor('#1a1f3a')          # match dashboard dark theme

    # ---- map features ---------------------------------------------------------
    ax.add_feature(cfeature.LAND.with_scale('50m'),  facecolor='#1a1a2e')
    ax.add_feature(cfeature.OCEAN.with_scale('50m'), facecolor='#0d1117')
    ax.add_feature(cfeature.STATES.with_scale('50m'),
                   edgecolor='#555577', linewidth=0.6)
    ax.add_feature(cfeature.COASTLINE.with_scale('50m'),
                   edgecolor='#8888aa', linewidth=0.8)
    ax.add_feature(cfeature.BORDERS.with_scale('50m'),
                   edgecolor='#8888aa', linewidth=0.5, linestyle='--')
    ax.add_feature(cfeature.LAKES.with_scale('50m'),
                   facecolor='#0d1117', edgecolor='#555577', linewidth=0.4)

    # ---- reflectivity ---------------------------------------------------------
    cmap, norm, bounds = nexrad_colormap()

    # Mask NaN / below-threshold so the background shows through
    masked = np.ma.masked_invalid(data)
    masked = np.ma.masked_less(masked, -5)

    im = ax.pcolormesh(lons, lats, masked,
                       cmap=cmap, norm=norm,
                       transform=ccrs.PlateCarree(),
                       shading='auto', alpha=0.85)

    # ---- event marker ---------------------------------------------------------
    txt_effect = [pe.withStroke(linewidth=3, foreground='black')]
    ax.plot(center_lon, center_lat, marker='*', color='#ff4444',
            markersize=22, markeredgecolor='white', markeredgewidth=1.2,
            transform=ccrs.PlateCarree(), zorder=10)
    ax.text(center_lon + 0.08, center_lat + 0.08, 'Event',
            transform=ccrs.PlateCarree(), fontsize=10, color='white',
            weight='bold', path_effects=txt_effect, zorder=10)

    # ---- colorbar -------------------------------------------------------------
    cbar = fig.colorbar(im, ax=ax, orientation='horizontal',
                        pad=0.04, shrink=0.75, aspect=45,
                        ticks=bounds[::2])
    cbar.set_label('Reflectivity (dBZ)', fontsize=12, color='white')
    cbar.ax.tick_params(labelsize=9, colors='white')
    cbar.outline.set_edgecolor('#555577')

    # ---- title & timestamp ----------------------------------------------------
    if valid_date:
        ts = valid_date if isinstance(valid_date, str) else str(valid_date)
        title_time = ts[:19].replace('T', ' ') + ' UTC'
    else:
        title_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

    ax.set_title(f'NOAA MRMS — Reflectivity at Lowest Altitude (0.50°)\n{title_time}',
                 fontsize=14, color='white', weight='bold', pad=12)

    fig.text(0.02, 0.02,
             f'Generated {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}  •  '
             f'Source: NOAA MRMS (noaa-mrms-pds S3)',
             fontsize=8, color='#888888')

    fig.patch.set_facecolor('#0a0e27')

    # ---- save -----------------------------------------------------------------
    fig.savefig(output_path, dpi=150, bbox_inches='tight',
                facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"✅ Map saved: {output_path} ({size_kb:.0f} KB)")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 3:
        print("Usage: mrms_processor.py <grib2_file> <output_png> [lat] [lon] [radius_deg]")
        sys.exit(1)

    grib_path   = sys.argv[1]
    output_path = sys.argv[2]
    center_lat  = float(sys.argv[3]) if len(sys.argv) > 3 else 37.403147
    center_lon  = float(sys.argv[4]) if len(sys.argv) > 4 else -121.969814
    radius_deg  = float(sys.argv[5]) if len(sys.argv) > 5 else 3.0

    print(f"Processing: {os.path.basename(grib_path)}")

    # 1. Load the full CONUS grid
    data, lats, lons, valid_date = load_grib2(grib_path)

    # 2. Crop to the region of interest (saves memory + render time)
    data, lats, lons = crop_region(data, lats, lons,
                                   center_lat, center_lon, radius_deg)

    # 3. Render the map
    plot_mrms(data, lats, lons, output_path,
              center_lat, center_lon, valid_date, radius_deg)

    print("✅ MRMS processing complete")


if __name__ == '__main__':
    main()
