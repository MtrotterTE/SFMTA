import fs from "fs";

// ----------------------
// Helper function to convert UTC timestamp to PST/PDT string
// ----------------------
function convertUTCToPST(utcString) {
    const utcDate = new Date(utcString);

    const options = {
        timeZone: "America/Los_Angeles", // handles PST/PDT automatically
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    };

    const formatter = new Intl.DateTimeFormat("en-US", options);
    return formatter.format(utcDate); 
}

function getPSTDateString(utcString) {
    const utcDate = new Date(utcString);

    const options = {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    };

    const formatter = new Intl.DateTimeFormat("en-US", options);
    return formatter.format(utcDate);
}

function convertTimestamps(inputFile, outputFile) {
    const rawData = fs.readFileSync(inputFile, "utf-8");
    const data = JSON.parse(rawData);

    for (const key in data) {
        if (data[key].timestamp) {
            const pstFull = convertUTCToPST(data[key].timestamp);
            const pstDate = getPSTDateString(data[key].timestamp);

            data[key].timestamp_pst = pstFull;
            data[key].date_pst = pstDate;
        }
    }

    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✅ Converted data written to ${outputFile}`);
}

convertTimestamps("gfts_realtime_data_2025-05-16_8-00.json", "gfts_realtime_data_2025-05-16_8-00_PST.json");