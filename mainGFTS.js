import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import fetch from "node-fetch";
import fs from "fs";

const tokenArray = ["ed71ab34-5b4c-4bd8-841f-5a0f57ec593f", "5e3eb013-a962-4d50-980e-1eb3482c2869", "e1469b22-2c92-4ee4-8833-054b31270e5d", "c76b17d3-c452-4149-ab94-3a8cbd26a9f2", "f335f336-39d0-403d-8a79-ea42a9515f7f", "bc0c3754-7377-42cb-b34c-c7fc2d5bcfe3", "efaeb025-20fa-4ba1-b874-0ee53f3aa8dc", "4637d8b5-948d-41b2-91b5-9d82cbba863f", "863bd2d4-8810-4a92-a660-88974986556d", "f36c9b1e-ad0e-4890-a55a-b3eeef92877a", "71834008-d6db-4eaa-b52d-3baad857f950", "5f543597-99ad-49a6-ae9c-c836af98a757", "0b9bc40c-02e5-49ab-b364-f1c830f7f64d", "10324853-6e4f-469a-9cb8-30dfb9620f66", "a07440d0-0088-4b35-a8dc-59f9177c2f1a", "eca5b898-62bd-444d-9f7b-000b5d69796c", "05562549-18fe-475f-9c4a-214a63bf4651", "d1bcf7d7-56ea-413a-907d-6f81509f1ade", "06f1c4bf-0046-4414-9bb3-9a6c41a1aab3", "e3f7e561-58b2-4252-849d-065e8d0273e9"];
const agency = "SF";
const timestampMap = new Map();
let finalData = {};
let index = 0;
let pollCount = 0;

console.log("tokenArray.length: " + tokenArray.length);

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const isoString = date.toISOString();
    // Remove milliseconds and the 'Z' if you don't want it in UTC
    return isoString.slice(0, 19);
}

function pollData() {
    (async () => {
        try {
            // cycle through tokens every 5 mins
            pollCount++;
            console.log('Poll Count: ', pollCount);
            const fiveMinuteIndex = pollCount / 60;
            const tokenIndex = Math.floor(fiveMinuteIndex % tokenArray.length);
            console.log("tokenIndex: " + tokenIndex);
            let path = `http://api.511.org/transit/vehiclepositions?api_key=${tokenArray[tokenIndex]}&agency=${agency}`;
            const response = await fetch(path);
            if (!response.ok) {
                const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
                error.response = response;
                throw error;
            }
            const buffer = await response.arrayBuffer();
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
                new Uint8Array(buffer)
            );

            // get first vehicle timestamp
            const firstTimestamp = formatTimestamp(feed.entity[0].vehicle?.timestamp * 1000);
            // check if the timestamp is already in the map
            if (timestampMap.has(firstTimestamp)) {
                console.log("Already have data for this timestamp. RecordedAtTime: ", firstTimestamp);
                // do nothing
            } else {
                // add the timestamp to the map
                timestampMap.set(firstTimestamp, true);
                feed.entity.forEach((entity) => {
                    let routeId = entity.vehicle?.trip?.routeId;
                    // if the routeID matches a metro line
                    if (routeId == "J" || routeId == "K" || routeId == "L" || routeId == "M" || routeId == "N" || routeId == "T") {
                        const timestamp = formatTimestamp(entity.vehicle?.timestamp * 1000); // convert to milliseconds
                        // get data
                        const tempData = {
                            "vehicle_id": entity.vehicle?.vehicle?.id,
                            "trip_id": entity.vehicle?.trip?.tripId,
                            "direction_id": entity.vehicle?.trip?.directionId,
                            "route_id": entity.vehicle?.trip?.routeId,
                            "latitude": entity.vehicle?.position?.latitude,
                            "longitude": entity.vehicle?.position?.longitude,
                            "speed": entity.vehicle?.position?.speed,
                            "timestamp": timestamp,
                            "iteration": pollCount
                        }
                        // add to parent object
                        finalData[index] = tempData;
                        index++;
                    }
                });
            }
            // Convert parent object to JSON string
            const finalDataJSON = JSON.stringify(finalData, null, 2);
            // Write to file
            fs.writeFile('data.json', finalDataJSON, (err) => {
                if (err) {
                console.error('Error writing file', err);
                } else {
                console.log('Successfully wrote file');
                }
            }); 
        }
        catch (error) {
            console.log(error);
            process.exit(1);
        }
    })();
}

const intervalId = setInterval(() => {
    pollData();
}, 5000); // Poll every 5 seconds

// documentation: https://511.org/sites/default/files/2024-11/511%20SF%20Bay%20Open%20Data%20Specification%20-%20Transit.pdf

// for specific route
// for each vehicle on route (VehicleRef)
// get location
// get timestamp
// get speed
// save to file

// to run program:
// node mainGFTS.js