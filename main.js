const axios = require("axios");
const fs = require('fs');

//const token = "ed71ab34-5b4c-4bd8-841f-5a0f57ec593f";
const tokenArray = ["ed71ab34-5b4c-4bd8-841f-5a0f57ec593f", "5e3eb013-a962-4d50-980e-1eb3482c2869", "e1469b22-2c92-4ee4-8833-054b31270e5d"];

const agency = "SF";

const timestampMap = new Map();

//const path = `http://api.511.org/transit/VehicleMonitoring?api_key=${token}&agency=${agency}`;

let finalData = {};
let index = 0;
let pollCount = 0;

function pollData() {
  // cycle through tokens every 20 mins
  console.log('Poll Count: ', pollCount);
  pollCount++;
  const twentyMinuteIndex = pollCount / 240;
  const tokenIndex = Math.floor(twentyMinuteIndex % tokenArray.length);

  let path = `http://api.511.org/transit/VehicleMonitoring?api_key=${tokenArray[tokenIndex]}&agency=${agency}`;

  axios
    .get(path)
    .then((res) => {
      const vehicleData = res.data.Siri.ServiceDelivery.VehicleMonitoringDelivery;
      //console.log("Vehicle Data: ", vehicleData.VehicleActivity);
      // for each item in dict print monitored vehicle journey
      const dataTimestamp = vehicleData.VehicleActivity[0].RecordedAtTime;
      // check if the timestamp is already in the map
      if (timestampMap.has(dataTimestamp)) {
        console.log("Already have data for this timestamp. RecordedAtTime: ", dataTimestamp);
        // do nothing
      } else {
        // add the timestamp to the map
        timestampMap.set(dataTimestamp, true);
        vehicleData.VehicleActivity.forEach((item) => {
          const lineRef = item.MonitoredVehicleJourney?.LineRef;
          // if the line reference matches a metro line
          if (lineRef == "J" || lineRef == "K" || lineRef == "L" || lineRef == "M" || lineRef == "N" || lineRef == "T") {
  
            let tempData = {
              "timestamp": "",
              "lineRef": "",
              "vehicleRef": "",
              "vehicleLongitude": "",
              "vehicleLatitude": ""
            }
            // get data
            tempData.timestamp = item.RecordedAtTime;
            tempData.vehicleRef = item.MonitoredVehicleJourney?.VehicleRef;
            tempData.vehicleLongitude = item.MonitoredVehicleJourney?.VehicleLocation?.Longitude;
            tempData.vehicleLatitude = item.MonitoredVehicleJourney?.VehicleLocation?.Latitude;
            tempData.lineRef = lineRef;
            // add to parent object
            finalData[index] = tempData;
            index++;
          }
          //const monitoredVehicleJourney = item.MonitoredVehicleJourney?.MonitoredCall;
          //console.log("Monitored Vehicle Journey: ", monitoredVehicleJourney);
        });
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
    })
    .catch((err) => {
      console.log("Error: ", err.message);
    });
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
// node --input-type=module main.js

// TODO: Clean up indexes on finalData object if only using metro lines