import { readFile } from 'fs/promises';

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

        // Cycle through K line data
        kLineData.forEach((entity) => {
            console.log("Entity: ", entity);
        });

        console.log('End of program.');
    } catch (error) {
        console.error('Error reading files:', error);
    }
}

readFiles();

