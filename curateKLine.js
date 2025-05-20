import { readFile } from 'fs/promises';
import { get } from 'http';

const sfmtaDataFile = './gfts_realtime_data_2025-05-16_8:00.json';
const stopsFile = './stops.json'

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
            if (entity.speed === 0) {
                if (vehicleStoppedArrayK.includes(entity.vehicle_id)) {
                    if (entity.vehicle_id == 2149) {
                        console.log('Vehicle already stopped');
                    }
                    // do nothing
                } else {
                    if (entity.vehicle_id == 2149) {
                        console.log('Vehicle just started to stop');
                        console.log('entity:', entity);
                    }
                    vehicleStoppedArrayK.push(entity.vehicle_id);
                    // start data curation
                    // push entity to array
                    vehicleStoppedEntitiesK.push(entity);
                }
            } else if (entity.speed > 7) {
                if (vehicleStoppedArrayK.includes(entity.vehicle_id)) {
                    if (entity.vehicle_id == 2149) {
                        console.log('Vehicle no longer stopped');
                        console.log('entity:', entity);
                    }
                    // vehicle no longer stopped, remove from array
                    vehicleStoppedArrayK = vehicleStoppedArrayK.filter(vehicle => vehicle !== entity.vehicle_id);
                    // cycle through array with entities
                    vehicleStoppedEntitiesK.forEach((stoppedEntity) => {
                        if (stoppedEntity.vehicle_id === entity.vehicle_id) {
                            let timeAtStop = getTimeDifferenceInSeconds(stoppedEntity.timestamp, entity.timestamp);
                            if (entity.vehicle_id == 2149) {
                                console.log('Found match for vehicle no longer stopped');
                                console.log('original entity:', stoppedEntity);
                                console.log('no longer stopped entity:', entity);
                                console.log('Time at stop:', timeAtStop);
                            }
                            vehicleStoppedEntitiesKFinal.push(stoppedEntity);
                            // remove from array
                            vehicleStoppedEntitiesK = vehicleStoppedEntitiesK.filter(vehicle => vehicle !== stoppedEntity);
                        }
                    });
                    // if vehicle_id matches, remove from array
                    // calculate time stopped
                    // determing if vehicle is at station
                    // push to final array
                } else {
                    // do nothing
                    if (entity.vehicle_id == 2149) {
                        console.log('Vehicle still moving');
                    }
                }
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

readFiles();

