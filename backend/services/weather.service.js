const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const { celsiusToFahrenheit, msToMph, mmToInches, pascalsToInHg, degToCompass } = require('../utils/conversions');

const CONFIG_PATH = path.join(__dirname, '../../config/event.config.json');
const CACHE_PATH = path.join(__dirname, '../../data/cache/weather.json');

class WeatherService {
  constructor() {
    this.config = null;
    this.cache = null;
    this.updateTask = null;
    this.nearestStation = null;
  }

  async loadConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    this.config = JSON.parse(configData);
    return this.config;
  }

  async getCurrentWeather() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    const apiKey = this.config.api?.synoptic?.key;
    
    if (!apiKey) {
      console.error('Synoptic API key not configured');
      return this.getCachedData() || { error: 'API key not configured' };
    }
    
    try {
      // Synoptic API: Get nearest station with latest observation
      const synopticUrl = 'https://api.synopticdata.com/v2/stations/nearesttime';
      
      const params = {
        token: apiKey,
        radius: `${latitude},${longitude},50`, // Format: lat,lon,radius_km
        limit: 1,
        within: 120, // Last 120 minutes
        vars: 'air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility,cloud_layer_1_code,cloud_layer_2_code,cloud_layer_3_code,precip_accum_one_hour,sea_level_pressure,altimeter',
        obtimezone: 'UTC',
        output: 'json'
      };
      
      console.log(`Fetching weather from Synoptic API for ${latitude}, ${longitude}...`);
      
      const response = await axios.get(synopticUrl, { 
        params,
        timeout: 15000 
      });
      
      if (!response.data.STATION || response.data.STATION.length === 0) {
        throw new Error('No stations found near location');
      }
      
      const station = response.data.STATION[0];
      this.nearestStation = station.STID;
      
      // Parse observations
      const obs = station.OBSERVATIONS;
      
      // Helper function to get latest value - try multiple possible field names
      const getLatest = (...fields) => {
        for (const field of fields) {
          if (obs[field] && typeof obs[field].value !== 'undefined') {
            return obs[field].value;
          }
        }
        return null;
      };
      
      // Helper function to get timestamp
      const getTimestamp = (...fields) => {
        for (const field of fields) {
          if (obs[field] && obs[field].date_time) {
            return obs[field].date_time;
          }
        }
        return null;
      };
      
      // Parse cloud layers
      const clouds = [];
      const cloud1 = getLatest('cloud_layer_1_code_set_1', 'cloud_layer_1_code_value_1');
      const cloud2 = getLatest('cloud_layer_2_code_set_1', 'cloud_layer_2_code_value_1');
      const cloud3 = getLatest('cloud_layer_3_code_set_1', 'cloud_layer_3_code_value_1');
      if (cloud1) clouds.push(cloud1);
      if (cloud2) clouds.push(cloud2);
      if (cloud3) clouds.push(cloud3);
      
      // Get raw values in metric
      const tempC = getLatest('air_temp_value_1', 'air_temp_set_1');
      const dewpointC = getLatest('dew_point_temperature_value_1d', 'dew_point_temperature_set_1d');
      const windSpeedMs = getLatest('wind_speed_value_1', 'wind_speed_set_1');
      const windGustMs = getLatest('wind_gust_value_1', 'wind_gust_set_1');
      const windDir = getLatest('wind_direction_value_1', 'wind_direction_set_1');
      const pressurePa = getLatest('altimeter_value_1', 'altimeter_set_1');
      const precipMm = getLatest('precip_accum_one_hour_value_1', 'precip_accum_one_hour_set_1');
      const visibility = getLatest('visibility_value_1', 'visibility_set_1');
      
      // Helper to round to 1 decimal place
      const round1 = (val) => val !== null ? Math.round(val * 10) / 10 : null;
      const round2 = (val) => val !== null ? Math.round(val * 100) / 100 : null;
      
      const weatherData = {
        timestamp: new Date().toISOString(),
        observationTime: getTimestamp('air_temp_value_1', 'air_temp_set_1'),
        source: 'Synoptic Data API',
        station: {
          id: station.STID,
          name: station.NAME,
          latitude: station.LATITUDE,
          longitude: station.LONGITUDE,
          elevation: station.ELEVATION,
          distance: station.DISTANCE,
          timezone: station.TIMEZONE
        },
        observations: {
          temperature: {
            value: round1(celsiusToFahrenheit(tempC)),
            unit: 'F'
          },
          dewpoint: {
            value: round1(celsiusToFahrenheit(dewpointC)),
            unit: 'F'
          },
          relativeHumidity: {
            value: round1(getLatest('relative_humidity_value_1', 'relative_humidity_set_1')),
            unit: '%'
          },
          wind: {
            speed: {
              value: round1(msToMph(windSpeedMs)),
              unit: 'mph'
            },
            direction: {
              value: round1(windDir),
              unit: 'degrees'
            },
            cardinal: degToCompass(windDir),
            gust: {
              value: round1(msToMph(windGustMs)),
              unit: 'mph'
            }
          },
          visibility: {
            value: round1(visibility),
            unit: 'miles'
          },
          clouds: clouds,
          pressure: {
            seaLevel: {
              value: round1(getLatest('sea_level_pressure_value_1d', 'sea_level_pressure_set_1d')),
              unit: 'mb'
            },
            altimeter: {
              value: round2(pascalsToInHg(pressurePa)),
              unit: 'inHg'
            }
          },
          precipitation: {
            oneHour: {
              value: round2(mmToInches(precipMm)),
              unit: 'inches'
            }
          }
        },
        location: this.config.event
      };
      
      // Cache the data
      await this.cacheData(weatherData);
      
      console.log(`✅ Weather data received from station ${station.STID} (${station.NAME}), ${station.DISTANCE?.toFixed(1)} km away`);
      
      return weatherData;
      
    } catch (error) {
      console.error('Error fetching current weather from Synoptic:', error.message);
      
      // Fallback to NOAA if Synoptic fails
      console.log('Attempting NOAA fallback...');
      return this.getNOAAWeather().catch(() => {
        return this.getCachedData() || { error: 'Unable to fetch weather data' };
      });
    }
  }

  async getNOAAWeather() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    // NOAA API: Get grid point
    const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
    const pointsResponse = await axios.get(pointsUrl, {
      headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
    });
    
    const { observationStations } = pointsResponse.data.properties;
    
    // Get latest observation
    const stationsResponse = await axios.get(observationStations, {
      headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
    });
    
    const stationId = stationsResponse.data.features[0].id;
    const obsResponse = await axios.get(`${stationId}/observations/latest`, {
      headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
    });
    
    const data = {
      timestamp: new Date().toISOString(),
      source: 'NOAA NWS (fallback)',
      observation: obsResponse.data.properties,
      location: this.config.event
    };
    
    await this.cacheData(data);
    return data;
  }

  async getHourlyForecast() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    try {
      const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
      const pointsResponse = await axios.get(pointsUrl, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      const { forecastHourly } = pointsResponse.data.properties;
      const forecastResponse = await axios.get(forecastHourly, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      return {
        timestamp: new Date().toISOString(),
        forecast: forecastResponse.data.properties.periods,
        location: this.config.event
      };
    } catch (error) {
      console.error('Error fetching forecast:', error.message);
      return { error: 'Unable to fetch forecast data' };
    }
  }

  async getWeatherAlerts() {
    if (!this.config) await this.loadConfig();
    
    const { latitude, longitude } = this.config.event;
    
    try {
      const alertsUrl = `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`;
      const response = await axios.get(alertsUrl, {
        headers: { 'User-Agent': 'LargeEventDashboard/1.0' }
      });
      
      return {
        timestamp: new Date().toISOString(),
        alerts: response.data.features,
        count: response.data.features.length
      };
    } catch (error) {
      console.error('Error fetching alerts:', error.message);
      return { error: 'Unable to fetch alert data', alerts: [], count: 0 };
    }
  }

  async getObservations() {
    // This will return recent observations for the area
    return this.getCurrentWeather();
  }

  async cacheData(data) {
    try {
      await fs.writeFile(CACHE_PATH, JSON.stringify(data, null, 2));
      this.cache = data;
    } catch (error) {
      console.error('Error caching data:', error.message);
    }
  }

  async getCachedData() {
    if (this.cache) return this.cache;
    
    try {
      const data = await fs.readFile(CACHE_PATH, 'utf8');
      this.cache = JSON.parse(data);
      return this.cache;
    } catch (error) {
      return null;
    }
  }

  startPeriodicUpdates() {
    // Update every 5 minutes
    this.updateTask = cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Updating weather data...');
      await this.getCurrentWeather();
    });
    
    // Initial update
    this.getCurrentWeather();
  }

  stopPeriodicUpdates() {
    if (this.updateTask) {
      this.updateTask.stop();
    }
  }
}

module.exports = new WeatherService();
