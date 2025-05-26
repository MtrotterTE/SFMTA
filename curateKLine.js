import { readFile } from 'fs/promises';
import fs from "fs";

const sfmtaDataFile = './gfts_realtime_data_2025-05-16_8:00.json';
const stopsFile = './stops.json'
let finalData = {};
let index = 0;

async function readFiles() {
    try {
        // Read both files concurrently
        const [file1, file2] = await Promise.all([
        readFile(sfmtaDataFile, 'utf-8'),
        readFile(stopsFile, 'utf-8')
        ]);

        // Parse JSON content
        const vehicleData = JSON.parse(file1);
        const stopsData = JSON.parse(file2);

        let kLineData = [];
        let kLineStopsWestbound = [];
        let kLineStopsEastbound = [];

        // Process vehicle data
        Object.entries(vehicleData).forEach(([key, value]) => {
            // Seperate vehicle data into metro line arrays
            if (value.route_id === "K") {
                kLineData.push(value);
            }
        });

        // Process stops data
        Object.entries(stopsData).forEach(([key, value]) => {
            // Seperate stops data into metro line arrays
            if (key === "K") {
                kLineStopsWestbound = value.westbound.stops;
                kLineStopsEastbound = value.eastbound.stops;
            }
        });

        let vehicleStoppedArrayK = [];
        let vehicleStoppedEntitiesK = [];
        let vehicleStoppedEntitiesKFinal = [];
        // Cycle through K line data
        kLineData.forEach((entity) => {
            if (entity.vehicle_id === "2071" && entity.trip_id === "11735474_M21" && entity.iteration >= 501) {
                console.log(entity);
            }
            if (entity.speed === 0) {
                if (vehicleStoppedArrayK.includes(entity.vehicle_id)) {
                    // do nothing
                } else {
                    vehicleStoppedArrayK.push(entity.vehicle_id);
                    // start data curation
                    // push entity to array
                    vehicleStoppedEntitiesK.push(entity);
                }
            } else if (entity.speed > 3.12928) { // 3.12928 m/s = 7 mph
                if (vehicleStoppedArrayK.includes(entity.vehicle_id)) {
                    // vehicle no longer stopped, remove from array
                    vehicleStoppedArrayK = vehicleStoppedArrayK.filter(vehicle => vehicle !== entity.vehicle_id);
                    // cycle through array with entities
                    vehicleStoppedEntitiesK.forEach((stoppedEntity) => {
                        if (stoppedEntity.vehicle_id === entity.vehicle_id) {
                            let timeAtStop = getTimeDifferenceInSeconds(stoppedEntity.timestamp, entity.timestamp);
                            let distanceMoved = getDistanceInFeet(stoppedEntity.latitude, stoppedEntity.longitude, entity.latitude, entity.longitude);
                            // determine if direction_id is westbound or eastbound
                            // cycle though westbound or eastbound stops
                            // check if vehicle is at stop

                            let tempOriginalEntity = stoppedEntity;
                            tempOriginalEntity.timeAtStop = timeAtStop;
                            tempOriginalEntity.distanceMoved = distanceMoved;

                            // add to parent object
                            finalData[index] = tempOriginalEntity;
                            index++;

                            vehicleStoppedEntitiesKFinal.push(stoppedEntity);
                            // remove from array
                            vehicleStoppedEntitiesK = vehicleStoppedEntitiesK.filter(vehicle => vehicle !== stoppedEntity);
                        }
                    });
                    // determing if vehicle is at station
                    // push to final array
                } else {
                    // do nothing
                }
            }
        });

        // Convert parent object to JSON string
        const finalDataJSON = JSON.stringify(finalData, null, 2);
        // Write to file
        fs.writeFile('stopData.json', finalDataJSON, (err) => {
            if (err) {
            console.error('Error writing file', err);
            } else {
            console.log('Successfully wrote file');
            }
        }); 

        console.log('End of program.');
    } catch (error) {
        console.error('Error reading files:', error);
    }
}

function getTimeDifferenceInSeconds(timestamp1, timestamp2) {
    const time1 = new Date(timestamp1).getTime();
    const time2 = new Date(timestamp2).getTime();
    const differenceInMilliseconds = Math.abs(time2 - time1);
    return differenceInMilliseconds / 1000;
}

/**
 * Check if two coordinates are within a certain distance (in feet)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2 (target)
 * @param {number} lon2 - Longitude of point 2 (target)
 * @param {number} distanceInFeet - Distance threshold in feet (default 500)
 * @returns {boolean} - True if within distance, false otherwise
 */
function isWithinDistance(lat1, lon1, lat2, lon2, distanceInFeet = 500) {
    const toRadians = degrees => degrees * (Math.PI / 180);
    const earthRadiusFeet = 20903520; // Earth's radius in feet
  
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
  
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) ** 2;
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    const distance = earthRadiusFeet * c;
  
    return distance <= distanceInFeet;
}

// Function to determine how far a vehicle has moved during a stop
function getDistanceInFeet(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
  
    // Convert degrees to radians
    const toRadians = (degrees) => degrees * (Math.PI / 180);
  
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);
  
    // Haversine formula
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    const distanceInMeters = R * c;
    const distanceInFeet = distanceInMeters * 3.28084; // Convert meters to feet
  
    return distanceInFeet;
  }

readFiles();
let debugDistance = getDistanceInFeet(37.72346115112305, -122.45393371582031, 37.72577667236328, -122.46345520019531);
console.log('Program started, reading files...');
console.log('Debug distance:', debugDistance, 'feet');

