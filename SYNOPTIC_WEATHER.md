# ✅ Synoptic Weather API Integration - Complete

## Summary

Successfully integrated Synoptic Data API for real-time weather observations from the nearest station to the event location.

---

## Configuration

### API Key Added
```json
{
  "api": {
    "synoptic": {
      "key": "e0fb17ad65504848934b1f1ece0c78f8",
      "enabled": true
    }
  }
}
```

### Event Location (User Configurable)
```json
{
  "event": {
    "latitude": 37.403147,
    "longitude": -121.969814
  }
}
```

---

## Current Weather Data

### Nearest Station
- **ID**: 462PG
- **Name**: Milpitas IDSM
- **Distance**: 3.1 km from Levi's Stadium
- **Elevation**: 24 m (79 ft)
- **Timezone**: America/Los_Angeles

### Latest Observations (2026-02-07 02:10 UTC)

```json
{
  "temperature": {
    "value": 17.783,
    "unit": "C"
  },
  "dewpoint": {
    "value": 10.94,
    "unit": "C"
  },
  "relativeHumidity": {
    "value": 64.42,
    "unit": "%"
  },
  "wind": {
    "speed": {
      "value": 0.288,
      "unit": "m/s"
    },
    "direction": {
      "value": 331.1,
      "unit": "degrees"
    },
    "gust": {
      "value": 2.156,
      "unit": "m/s"
    }
  }
}
```

---

## Implemented Features

### ✅ Data Fields
- **Temperature** (°C)
- **Dew Point** (°C)
- **Relative Humidity** (%)
- **Wind Speed** (m/s)
- **Wind Direction** (degrees)
- **Wind Cardinal Direction** (when available)
- **Wind Gust** (m/s)
- **Visibility** (statute miles, when available)
- **Cloud Layers** (when available)
- **Sea Level Pressure** (mb, when available)
- **Altimeter** (Pa, when available)
- **Precipitation (1-hour)** (mm, when available)

### ✅ Station Metadata
- Station ID (STID)
- Station Name
- Latitude/Longitude
- Elevation
- Distance from event
- Timezone

### ✅ System Features
- Automatic nearest station selection (within 50 km)
- Observations from last 2 hours
- Fallback to NOAA NWS if Synoptic fails
- Data caching to `data/cache/weather.json`
- Periodic updates every 5 minutes
- Full error handling

---

## API Endpoints

### Get Current Weather
```bash
GET /api/weather/current
```

**Response**:
```json
{
  "timestamp": "2026-02-07T02:15:06.026Z",
  "observationTime": "2026-02-07T02:10:00Z",
  "source": "Synoptic Data API",
  "station": { ... },
  "observations": { ... },
  "location": { ... }
}
```

### Get Hourly Forecast
```bash
GET /api/weather/forecast/hourly
```
*(Still using NOAA NWS for forecasts)*

### Get Weather Alerts
```bash
GET /api/weather/alerts
```
*(Using NOAA NWS)*

---

## Technical Details

### API Endpoint Used
```
https://api.synopticdata.com/v2/stations/nearesttime
```

### Parameters
```javascript
{
  token: apiKey,
  radius: `${lat},${lon},50`, // 50 km radius
  limit: 1,
  within: 120, // Last 120 minutes
  vars: 'air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility,cloud_layer_1_code,cloud_layer_2_code,cloud_layer_3_code,precip_accum_one_hour,sea_level_pressure,altimeter',
  obtimezone: 'UTC'
}
```

### Field Name Mapping

Synoptic uses different field naming conventions. The service handles multiple variations:

| Data Type | Synoptic Field Names | Fallback Names |
|-----------|---------------------|----------------|
| Temperature | `air_temp_value_1` | `air_temp_set_1` |
| Dewpoint | `dew_point_temperature_value_1d` | `dew_point_temperature_set_1d` |
| RH | `relative_humidity_value_1` | `relative_humidity_set_1` |
| Wind Speed | `wind_speed_value_1` | `wind_speed_set_1` |
| Wind Direction | `wind_direction_value_1` | `wind_direction_set_1` |
| Wind Gust | `wind_gust_value_1` | `wind_gust_set_1` |
| Visibility | `visibility_value_1` | `visibility_set_1` |

---

## Service Architecture

### Fallback Chain
1. **Primary**: Synoptic Data API
2. **Fallback**: NOAA NWS API
3. **Cache**: Last successful observation

### Update Schedule
- **Frequency**: Every 5 minutes
- **Method**: Cron job
- **Cache**: JSON file in `data/cache/`

---

## Testing

### Quick Test
```bash
curl http://localhost:3000/api/weather/current | python3 -m json.tool
```

### Expected Output
```
✅ Weather data received from station 462PG (Milpitas IDSM), 3.1 km away
```

### Test Script
```bash
node test-synoptic.js
```

---

## Files Modified

1. **config/event.config.json**
   - Added `api.synoptic` section
   - Updated latitude/longitude precision

2. **backend/services/weather.service.js**
   - Complete rewrite of `getCurrentWeather()`
   - Added Synoptic API integration
   - Field name mapping for multiple naming conventions
   - NOAA NWS fallback method
   - Enhanced error handling

3. **test-synoptic.js** (new)
   - API testing script

---

## Configuration Guide

### To Change Event Location

Edit `config/event.config.json`:
```json
{
  "event": {
    "latitude": YOUR_LAT,
    "longitude": YOUR_LON
  }
}
```

### To Change Update Frequency

Edit `config/event.config.json`:
```json
{
  "dashboard": {
    "weatherRefreshInterval": 300000  // milliseconds (5 minutes)
  }
}
```

### To Change Search Radius

Edit `backend/services/weather.service.js`:
```javascript
radius: `${latitude},${longitude},50`, // Change 50 to desired km
```

---

## Limitations & Notes

### Current Limitations
- Visibility data not always available
- Cloud layer data station-dependent
- Pressure data station-dependent
- Some stations may not report all variables

### Data Availability
- **Best Coverage**: Temperature, humidity, wind
- **Variable Coverage**: Visibility, pressure, clouds, precip
- **Update Frequency**: Typically 5-15 minutes per station

### Station Selection
- Automatically selects nearest station within 50 km
- Multiple stations tested in order of distance
- Falls back to NOAA if no Synoptic stations available

---

## Future Enhancements

### Possible Additions
1. **Multiple Stations**: Average data from nearby stations
2. **Historical Data**: Pull past observations for trends
3. **Alerts**: Synoptic API also has alert capabilities
4. **Derived Variables**: Calculate heat index, feels-like temp
5. **Station Selection**: Allow manual station override
6. **Metadata**: Display station equipment info

---

## Status

✅ **OPERATIONAL**

- Synoptic API: Connected
- Nearest Station: Found (462PG, 3.1 km)
- Data Quality: Good
- Update Frequency: 5 minutes
- Fallback: NOAA NWS available

---

**Integration Completed**: February 6, 2026  
**API Provider**: Synoptic Data  
**Status**: 🟢 Production Ready  
