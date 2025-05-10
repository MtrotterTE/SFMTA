import requests
from google.transit import gtfs_realtime_pb2
import json
from datetime import datetime
import csv
import time
import os

# API configuration
tokens = [
    # insert your access tokens here
]
current_token_index = 0
duration_minutes = 3600  # 4 hours by default

AGENCY = "SF"  # SFMTA agency code

# SFMTA train routes
TRAIN_ROUTES = {"J", "K", "L", "M", "N", "T"}

# Dictionary to track the last known position of each vehicle
vehicle_positions = {}


def get_api_path():
    """Get the current API path with the current token."""
    return f"http://api.511.org/transit/vehiclepositions?api_key={tokens[current_token_index]}&agency={AGENCY}"


def rotate_token():
    """Rotate to the next token in the list."""
    global current_token_index
    current_token_index = (current_token_index + 1) % len(tokens)
    print(f"Switching to token {current_token_index + 1} of {len(tokens)}")


def fetch_vehicle_positions():
    """Fetch realtime vehicle positions from the 511.org API."""
    global current_token_index
    max_retries = len(tokens)  # Try each token once

    for retry in range(max_retries):
        try:
            url = get_api_path()
            response = requests.get(url)
            response.raise_for_status()

            # Parse the protobuf message
            feed = gtfs_realtime_pb2.FeedMessage()
            feed.ParseFromString(response.content)

            # Process vehicle positions
            vehicles = []
            for entity in feed.entity:
                if entity.HasField("vehicle"):
                    vehicle = entity.vehicle
                    # Check if this is a train route
                    route_id = vehicle.trip.route_id
                    if any(
                        route_id.startswith(train_route) for train_route in TRAIN_ROUTES
                    ):
                        position = vehicle.position

                        vehicle_data = {
                            "vehicle_id": vehicle.vehicle.id,
                            "trip_id": vehicle.trip.trip_id,
                            "route_id": route_id,
                            "latitude": position.latitude,
                            "longitude": position.longitude,
                            "speed": round(position.speed, 2),
                            "timestamp": datetime.fromtimestamp(
                                vehicle.timestamp
                            ).isoformat(),
                            "iteration": None,  # Will be set in main()
                        }
                        vehicles.append(vehicle_data)

            return vehicles

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:  # Too Many Requests
                print(
                    f"Error fetching data: 429 Client Error: Too Many Requests. for url: {url}"
                )
                rotate_token()
                # If we've tried all tokens, wait a bit before trying again
                if retry == max_retries - 1:
                    print(
                        "All tokens have been rate limited. Waiting 60 seconds before retrying..."
                    )
                    time.sleep(60)
            else:
                print(f"Error fetching data: {e}")
                return None
        except Exception as e:
            print(f"Error processing data: {e}")
            return None

    return None  # Return None if all retries failed


def save_to_csv(vehicles_data, filename):
    """Save vehicle data to CSV file, avoiding duplicates."""
    global vehicle_positions

    # Define CSV headers
    headers = [
        "iteration",
        "timestamp",
        "route_id",
        "vehicle_id",
        "trip_id",
        "latitude",
        "longitude",
        "speed",
    ]

    # Filter out vehicles that haven't changed position
    new_positions = []
    for vehicle in vehicles_data:
        vehicle_id = vehicle["vehicle_id"]
        current_position = (
            vehicle["latitude"],
            vehicle["longitude"],
            vehicle["speed"],
        )

        # Check if this is a new vehicle or if its position has changed
        if (
            vehicle_id not in vehicle_positions
            or vehicle_positions[vehicle_id] != current_position
        ):
            new_positions.append(vehicle)
            # Update the tracking dictionary
            vehicle_positions[vehicle_id] = current_position

    # Only write to CSV if we have new positions
    if new_positions:
        write_header = not os.path.exists(filename)
        with open(filename, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            if write_header:
                writer.writeheader()
            for vehicle in new_positions:
                # Prepare row data with only the fields we want
                row = {field: vehicle[field] for field in headers}
                writer.writerow(row)

        return len(new_positions)
    return 0


def main():
    print("Fetching SFMTA train positions...")

    # Create filename with start date and time
    start_datetime = datetime.now()
    formatted_datetime = start_datetime.strftime("%Y-%m-%d_%H-%M-%S")
    csv_file = f"sfmta_data/gtfs_realtime_data_{formatted_datetime}.csv"

    delay = 10  # seconds between iterations

    start_time = time.time()
    end_time = start_time + (duration_minutes * 60)
    iteration = 1

    print(f"Starting data collection for {duration_minutes} minutes...")
    print(f"Data will be saved to: {csv_file}")

    while time.time() < end_time:
        print(
            f"\nIteration {iteration} (Time remaining: {int((end_time - time.time()) / 60)} minutes)"
        )
        vehicles = fetch_vehicle_positions()

        if vehicles:
            # Add iteration number to each vehicle record
            for vehicle in vehicles:
                vehicle["iteration"] = iteration

            # Print summary
            print(f"Found {len(vehicles)} trains:")

            # Save to CSV and get count of new positions
            new_positions_count = save_to_csv(vehicles, csv_file)
            print(f"Saved {new_positions_count} new/updated positions to {csv_file}")
        else:
            print("No train data available")

        iteration += 1

        # Wait before next iteration (unless we're at the end)
        if time.time() + delay < end_time:
            print(f"Waiting {delay} seconds...")
            time.sleep(delay)

    print("\nData collection complete!")


if __name__ == "__main__":
    main()
