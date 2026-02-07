#!/usr/bin/env python3
"""
Simple radar visualization from Weather.gov station data
Creates a proper radar image with colormap
"""

import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
from PIL import Image
import requests
from io import BytesIO

def create_radar_colormap():
    """Create standard NEXRAD reflectivity colormap"""
    colors = [
        '#00FFFF',  # -30 to -20
        '#00BFFF',  # -20 to -10
        '#0000FF',  # -10 to 0
        '#00FF00',  # 0 to 10
        '#00C800',  # 10 to 20
        '#009600',  # 20 to 25
        '#FFFF00',  # 25 to 30
        '#FFD700',  # 30 to 35
        '#FFA500',  # 35 to 40
        '#FF4500',  # 40 to 45
        '#FF0000',  # 45 to 50
        '#C80000',  # 50 to 55
        '#A00000',  # 55 to 60
        '#FF00FF',  # 60 to 65
        '#9932CC',  # 65 to 70
        '#FFFFFF',  # 70+
    ]
    bounds = [-30, -20, -10, 0, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80]
    return ListedColormap(colors), BoundaryNorm(bounds, len(colors))

def enhance_weather_gov_radar(station, output_path):
    """
    Download and enhance Weather.gov radar image
    """
    try:
        # Get the latest radar image from weather.gov
        url = f"https://radar.weather.gov/ridge/standard/{station}_0.gif"
        
        print(f"Fetching radar from: {url}")
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        
        # Load image
        img = Image.open(BytesIO(response.content))
        img_array = np.array(img.convert('RGB'))
        
        print(f"Image size: {img_array.shape}")
        
        # Create enhanced figure
        fig, ax = plt.subplots(figsize=(10, 10), dpi=150)
        
        ax.imshow(img_array, aspect='auto')
        ax.axis('off')
        
        # Add title
        from datetime import datetime
        ax.set_title(f'NOAA NEXRAD Radar - Station {station}\n{datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}',
                     fontsize=14, fontweight='bold', pad=20)
        
        # Save
        plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close()
        
        print(f"✅ Enhanced radar image saved: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python simple_radar.py <STATION> <output.png>")
        sys.exit(1)
    
    station = sys.argv[1]
    output = sys.argv[2]
    
    success = enhance_weather_gov_radar(station, output)
    sys.exit(0 if success else 1)
