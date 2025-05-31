import { readFile } from 'fs/promises';
import fs from "fs";

const sfmtaDataFile = './gfts_realtime_data_2025-05-11_8:00.json';
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
        let kLineStopsOutbound = [];
        let kLineStopsInbound = [];
        let kLineIntersectionStops = [];

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
                kLineStopsOutbound = value.outbound.stops; // direction_id 0 for outbound
                kLineStopsInbound = value.inbound.stops; // direction_id 1 for inbound
                kLineIntersectionStops = value.intersections.stops;
            }
        });

        let vehicleStoppedArrayK = [];
        let vehicleStoppedEntitiesK = [];
        let traversedKLineData = [];
        // Cycle through K line data
        kLineData.forEach((entity) => {
            if (entity.speed === 0) {
                if (vehicleStoppedArrayK.includes(entity.vehicle_id)) {
                    vehicleStoppedEntitiesK.forEach((stoppedEntity) => {
                        // if vehicle is already stopped
                        if (stoppedEntity.vehicle_id === entity.vehicle_id) {
                            // if longitude and latitude are the same, do nothing
                            if (entity.latitude === stoppedEntity.latitude && entity.longitude === stoppedEntity.longitude) {
                                // vehicle is still at the same stop, do nothing
                            } else { // vehicle has moved but speed is still 0
                                // calculate speed since last data update
                                let tempTimeSinceLastUpdate = 0;
                                let tempDistanceMoved = 0;
                                for (let i = traversedKLineData.length - 1; i >= 0; i--) {
                                    if (traversedKLineData[i].vehicle_id === entity.vehicle_id) {// find the latest entity in traversedKLineData with the same vehicle_id
                                        tempTimeSinceLastUpdate = getTimeDifferenceInSeconds(traversedKLineData[i].timestamp, entity.timestamp);
                                        tempDistanceMoved = getDistanceInFeet(traversedKLineData[i].latitude, traversedKLineData[i].longitude, entity.latitude, entity.longitude);
                                        break; // exit loop once found
                                    }
                                } 
                                let calculatedSpeed = (tempDistanceMoved / tempTimeSinceLastUpdate) * 0.3048; // speed in meters per second
                                
                                if (calculatedSpeed > 3.12928) { // 3.12928 m/s = 7 mph
                                    // vehicle is more than 7 mph since last data update, add stop data to final array

                                    let accurateTimeAtStop = 0;
                                    let accurateDistanceMoved = 0;
                                    
                                    // find the latest entity in traversedKLineData with the same vehicle_id
                                    for (let i = traversedKLineData.length - 1; i >= 0; i--) {
                                        if (traversedKLineData[i].vehicle_id === entity.vehicle_id) {
                                            accurateTimeAtStop = getTimeDifferenceInSeconds(stoppedEntity.timestamp, traversedKLineData[i].timestamp);
                                            accurateDistanceMoved = getDistanceInFeet(stoppedEntity.latitude, stoppedEntity.longitude, traversedKLineData[i].latitude, traversedKLineData[i].longitude);
                                            break; // exit loop once found
                                        }
                                    }

                                    let tempOriginalEntity = stoppedEntity;
                                    tempOriginalEntity.timeAtStop = accurateTimeAtStop;
                                    tempOriginalEntity.distanceMoved = accurateDistanceMoved;
                                    // check if vehicle is at station
                                    if (tempOriginalEntity.direction_id === 0) { // outbound
                                        let stopFound = false;
                                        kLineStopsOutbound.forEach((stop) => {
                                            if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, stop.location.latitude, stop.location.longitude, 500)) {
                                                stopFound = true;
                                                tempOriginalEntity.atStation = true;
                                                tempOriginalEntity.stationId = stop.stop_id;
                                                tempOriginalEntity.stationName = stop.stop_name;
                                            }
                                        });
                                        if (!stopFound) {
                                            tempOriginalEntity.atStation = false;
                                            tempOriginalEntity.stationId = null;
                                            tempOriginalEntity.stationName = null;
                                            let intersectionFound = false;
                                            kLineIntersectionStops.forEach((intersectionStop) => {
                                                if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, intersectionStop.location.latitude, intersectionStop.location.longitude, 500)) {
                                                    tempOriginalEntity.atIntersection = true;
                                                    tempOriginalEntity.intersectionCrossStreet = intersectionStop.stop_name;
                                                    intersectionFound = true;
                                                }
                                            });
                                            if (!intersectionFound) {
                                                tempOriginalEntity.atIntersection = false;
                                                tempOriginalEntity.intersectionCrossStreet = null;
                                            }
                                        }
                                    } else if (tempOriginalEntity.direction_id === 1) { // inbound
                                        let stopFound = false;
                                        kLineStopsInbound.forEach((stop) => {
                                            if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, stop.location.latitude, stop.location.longitude, 500)) {
                                                stopFound = true;
                                                tempOriginalEntity.atStation = true;
                                                tempOriginalEntity.stationId = stop.stop_id;
                                                tempOriginalEntity.stationName = stop.stop_name;
                                            }
                                        });
                                        if (!stopFound) {
                                            tempOriginalEntity.atStation = false;
                                            tempOriginalEntity.stationId = null;
                                            tempOriginalEntity.stationName = null;
                                            let intersectionFound = false;
                                            kLineIntersectionStops.forEach((intersectionStop) => {
                                                if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, intersectionStop.location.latitude, intersectionStop.location.longitude, 500)) {
                                                    tempOriginalEntity.atIntersection = true;
                                                    tempOriginalEntity.intersectionCrossStreet = intersectionStop.stop_name;
                                                    intersectionFound = true;
                                                }
                                            });
                                            if (!intersectionFound) {
                                                tempOriginalEntity.atIntersection = false;
                                                tempOriginalEntity.intersectionCrossStreet = null;
                                            }
                                        }
                                    }

                                    // add to parent object
                                    finalData[index] = tempOriginalEntity;
                                    index++;

                                    // remove from array
                                    vehicleStoppedEntitiesK = vehicleStoppedEntitiesK.filter(vehicle => vehicle !== stoppedEntity);
                                }
                            }
                        }
                    });
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
                            // determine if direction_id is westbound or eastbound
                            // cycle though westbound or eastbound stops
                            // check if vehicle is at stop

                            let accurateTimeAtStop = 0;
                            let accurateDistanceMoved = 0;

                            // find the latest entity in traversedKLineData with the same vehicle_id
                            for (let i = traversedKLineData.length - 1; i >= 0; i--) {
                                if (traversedKLineData[i].vehicle_id === entity.vehicle_id) {
                                    accurateTimeAtStop = getTimeDifferenceInSeconds(stoppedEntity.timestamp, traversedKLineData[i].timestamp);
                                    accurateDistanceMoved = getDistanceInFeet(stoppedEntity.latitude, stoppedEntity.longitude, traversedKLineData[i].latitude, traversedKLineData[i].longitude);
                                    break; // exit loop once found
                                }
                            }

                            let tempOriginalEntity = stoppedEntity;
                            tempOriginalEntity.timeAtStop = accurateTimeAtStop;
                            tempOriginalEntity.distanceMoved = accurateDistanceMoved;
                            // check if vehicle is at station
                            if (tempOriginalEntity.direction_id === 0) { // outbound
                                let stopFound = false;
                                kLineStopsOutbound.forEach((stop) => {
                                    if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, stop.location.latitude, stop.location.longitude, 500)) {
                                        stopFound = true;
                                        tempOriginalEntity.atStation = true;
                                        tempOriginalEntity.stationId = stop.stop_id;
                                        tempOriginalEntity.stationName = stop.stop_name;
                                    }
                                });
                                if (!stopFound) {
                                    tempOriginalEntity.atStation = false;
                                    tempOriginalEntity.stationId = null;
                                    tempOriginalEntity.stationName = null;
                                    let intersectionFound = false;
                                    kLineIntersectionStops.forEach((intersectionStop) => {
                                        if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, intersectionStop.location.latitude, intersectionStop.location.longitude, 500)) {
                                            tempOriginalEntity.atIntersection = true;
                                            tempOriginalEntity.intersectionCrossStreet = intersectionStop.stop_name;
                                            intersectionFound = true;
                                        }
                                    });
                                    if (!intersectionFound) {
                                        tempOriginalEntity.atIntersection = false;
                                        tempOriginalEntity.intersectionCrossStreet = null;
                                    }
                                }
                            } else if (tempOriginalEntity.direction_id === 1) { // inbound
                                let stopFound = false;
                                kLineStopsInbound.forEach((stop) => {
                                    if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, stop.location.latitude, stop.location.longitude, 500)) {
                                        stopFound = true;
                                        tempOriginalEntity.atStation = true;
                                        tempOriginalEntity.stationId = stop.stop_id;
                                        tempOriginalEntity.stationName = stop.stop_name;
                                    }
                                });
                                if (!stopFound) {
                                    tempOriginalEntity.atStation = false;
                                    tempOriginalEntity.stationId = null;
                                    tempOriginalEntity.stationName = null;
                                    let intersectionFound = false;
                                    kLineIntersectionStops.forEach((intersectionStop) => {
                                        if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, intersectionStop.location.latitude, intersectionStop.location.longitude, 500)) {
                                            tempOriginalEntity.atIntersection = true;
                                            tempOriginalEntity.intersectionCrossStreet = intersectionStop.stop_name;
                                            intersectionFound = true;
                                        }
                                    });
                                    if (!intersectionFound) {
                                        tempOriginalEntity.atIntersection = false;
                                        tempOriginalEntity.intersectionCrossStreet = null;
                                    }
                                }
                            }

                            // add to parent object
                            finalData[index] = tempOriginalEntity;
                            index++;

                            // remove from array
                            vehicleStoppedEntitiesK = vehicleStoppedEntitiesK.filter(vehicle => vehicle !== stoppedEntity);
                        }
                    });
                    // determing if vehicle is at station
                    // push to final array
                } else {
                    // do nothing
                }
            } else { // vehicle is moving less than 7 mph
                if (vehicleStoppedArrayK.includes(entity.vehicle_id)) {
                    vehicleStoppedEntitiesK.forEach((stoppedEntity) => {
                        if (stoppedEntity.vehicle_id === entity.vehicle_id) {
                            // calculate speed since last data update
                            let tempTimeSinceLastUpdate = 0;
                            let tempDistanceMoved = 0;
                            for (let i = traversedKLineData.length - 1; i >= 0; i--) {
                                if (traversedKLineData[i].vehicle_id === entity.vehicle_id) {// find the latest entity in traversedKLineData with the same vehicle_id
                                    tempTimeSinceLastUpdate = getTimeDifferenceInSeconds(traversedKLineData[i].timestamp, entity.timestamp);
                                    tempDistanceMoved = getDistanceInFeet(traversedKLineData[i].latitude, traversedKLineData[i].longitude, entity.latitude, entity.longitude);
                                    break; // exit loop once found
                                }
                            } 
                            let calculatedSpeed = (tempDistanceMoved / tempTimeSinceLastUpdate) * 0.3048; // speed in meters per second

                            if (calculatedSpeed > 3.12928) { // if speed is greater than 7 mph
                                // vehicle is more than 7 mph since last data update, add stop data to final array

                                let accurateTimeAtStop = 0;
                                let accurateDistanceMoved = 0;
                                
                                // find the latest entity in traversedKLineData with the same vehicle_id
                                for (let i = traversedKLineData.length - 1; i >= 0; i--) {
                                    if (traversedKLineData[i].vehicle_id === entity.vehicle_id) {
                                        accurateTimeAtStop = getTimeDifferenceInSeconds(stoppedEntity.timestamp, traversedKLineData[i].timestamp);
                                        accurateDistanceMoved = getDistanceInFeet(stoppedEntity.latitude, stoppedEntity.longitude, traversedKLineData[i].latitude, traversedKLineData[i].longitude);
                                        break; // exit loop once found
                                    }
                                }

                                let tempOriginalEntity = stoppedEntity;
                                tempOriginalEntity.timeAtStop = accurateTimeAtStop;
                                tempOriginalEntity.distanceMoved = accurateDistanceMoved;
                                // check if vehicle is at station
                                if (tempOriginalEntity.direction_id === 0) { // outbound
                                    let stopFound = false;
                                    kLineStopsOutbound.forEach((stop) => {
                                        if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, stop.location.latitude, stop.location.longitude, 500)) {
                                            stopFound = true;
                                            tempOriginalEntity.atStation = true;
                                            tempOriginalEntity.stationId = stop.stop_id;
                                            tempOriginalEntity.stationName = stop.stop_name;
                                        }
                                    });
                                    if (!stopFound) {
                                        tempOriginalEntity.atStation = false;
                                        tempOriginalEntity.stationId = null;
                                        tempOriginalEntity.stationName = null;
                                        let intersectionFound = false;
                                        kLineIntersectionStops.forEach((intersectionStop) => {
                                            if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, intersectionStop.location.latitude, intersectionStop.location.longitude, 500)) {
                                                tempOriginalEntity.atIntersection = true;
                                                tempOriginalEntity.intersectionCrossStreet = intersectionStop.stop_name;
                                                intersectionFound = true;
                                            }
                                        });
                                        if (!intersectionFound) {
                                            tempOriginalEntity.atIntersection = false;
                                            tempOriginalEntity.intersectionCrossStreet = null;
                                        }
                                    }
                                } else if (tempOriginalEntity.direction_id === 1) { // inbound
                                    let stopFound = false;
                                    kLineStopsInbound.forEach((stop) => {
                                        if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, stop.location.latitude, stop.location.longitude, 500)) {
                                            stopFound = true;
                                            tempOriginalEntity.atStation = true;
                                            tempOriginalEntity.stationId = stop.stop_id;
                                            tempOriginalEntity.stationName = stop.stop_name;
                                        }
                                    });
                                    if (!stopFound) {
                                        tempOriginalEntity.atStation = false;
                                        tempOriginalEntity.stationId = null;
                                        tempOriginalEntity.stationName = null;
                                        let intersectionFound = false;
                                        kLineIntersectionStops.forEach((intersectionStop) => {
                                            if (isWithinDistance(tempOriginalEntity.latitude, tempOriginalEntity.longitude, intersectionStop.location.latitude, intersectionStop.location.longitude, 500)) {
                                                tempOriginalEntity.atIntersection = true;
                                                tempOriginalEntity.intersectionCrossStreet = intersectionStop.stop_name;
                                                intersectionFound = true;
                                            }
                                        });
                                        if (!intersectionFound) {
                                            tempOriginalEntity.atIntersection = false;
                                            tempOriginalEntity.intersectionCrossStreet = null;
                                        }
                                    }
                                }

                                // add to parent object
                                finalData[index] = tempOriginalEntity;
                                index++;

                                // remove from array
                                vehicleStoppedEntitiesK = vehicleStoppedEntitiesK.filter(vehicle => vehicle !== stoppedEntity);
                            } else { // speed is less than 7 mph
                                // vehicle is still moving less than 7 mph, do nothing
                            }
                        }
                    });
                } else {
                    // not already in stopped array, do nothing
                }
            }
            traversedKLineData.push(entity);
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
console.log('Program started, reading files...');