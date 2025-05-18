Hi Temba,

Thanks for meeting with me earlier this week. I have completed my node.js GFTS realtime data collecter and have started collecting data. I ran the script yesterday for 13 hours with no issues. After looking closer at the requirements for analytics and at the GFTS realtime data, I found a direction_id boolean that is part of the vehicle's trip data. I have included that in my script for further data collecion in the hope we can use that to determine the direction of travel. I've attached the 13 hours of data I collected yesterday if you want to take a look, but note that it does not include the direction_id boolean. That was a change I added late last night and will be included in further data collection.

I'm really exctied to get started on this analysis task. I have been thinking about my plan for approach, and here is what I have so far (any feedback would be greaty appreciated):

Curate Data:
1.  Pick one metro line to visualize first (Maybe the K line since it has the least amount of stations);
2.  Gather longitude and latitude data for each station on that line.
3.  Loop through all our current data, filtering by metro line, and determine if longitude and latitude for each data point is within a certain radius (maybe 500 feet?) of the stations's longitude and latitude. If it is, and the vehicles speed is at 0 (or less than 5mph, please advise on which approach to take here), we can assume the train is at the station. If the data point is at the station, I would add values to that data point "isAtStation": true, "stationName": "e.g. Powell Station", and "lastStationVisited": undefined. Otherwise, add values "isAtStation": false, "stationName": undefined, and "lastStationVisited": "e.g. Powell Station".
4.  Write curated data to new file for each metro line, will end with 6 different files (one for each line) with "isAtStation", "stationName", and "lastStationVisited" attributes included.

Quick question about curating the data:
1.  Is it ok that your data collection is creating .csv files and mine is creating .json files? Should I change my script to create .csv files? I found some online tools that can change a .csv into a .json and vice versa, so maybe its not an issue?

Visualize Data:
1.  Set up a vue web application hosted on GitHub pages with an automatic workflow to deploy changes from the main branch to GitHub Pages (This is something I have done before and is the best way I have found to host D3.js applications. It's free and pretty easy to set up.)
2.  Each metro line visualization will have two line figures (one line for eastbound, one line for westbound, determined by direction_id).
3.  Create two counter's for each station (one for westbound, one for eastbound).
4.  If a data point is at a station, increment the corresponding counter.
5.  Bind each counter to the radius of a circle and add that circle to each line with label (eastbound and westbound, station name as label). The idea is that the larger a circle is, the longer the trains are stopping at each station.
6.  Repeat steps 3-5 for when the trains are stopped but not at a station. Add circles to corresponding location in the visual, determined by "lastStationVisited".
7.  Compute averages for the time spent at each station and, the time spent at intersections in between two stations, and the average trip duration.
8.  Add average time at stations and intersections to tooltips on each circle, so when you hover with your cursor you will be able to see the average time spent stopped in a popup tooltip.
9.  Add average trip duration as a figure below each visual.
10. Optional: Add a color scale to each circle to reinforce the time spent at each station/intersection (the more red a circle is, the longer it is stopped. The more green, the less it is stopped)

Notes about visualizing the data:
1.  My whole approach here is based on the idea that in order to determine if a vehicle is stopped at an intersection (not a station), we are just looking at the speed of a vehicle when it is not at a station. This seems to be the easiest and most straightforward approach, but the caveat is I wont be able to distinguish individual intersections from one another. So computing the average time at each intersection won't be possible, instead I would be computing the average time at all intersections in between two stations. Is this approach valid? If not, I totally understand. I would just ask if you have a suggestion on how to find longitude and latitude data for intersections where the metro line is stopped. In my research, I have found that longitude and latitude data for stations is easily accessible, but not easily accessible for intersections.

Final questions:
1.  If you noticed, I haven't mentioned anything about filtering data for the time of day. This one is tricky, and I was hoping to pick your brain about this. One option is I can add a filter once I have completed all the steps above. It would be a dropdown filter, where you could select a time of day, and the visual would rerender using only data points for that selected time of day. Another option is I could filter the time of day during the data curating process. In this scenario, I would end up with something line 12 files instead of 6, where there are 2 files for each metro line (morning and night. Or whatever time interval we want to use). In either scenario, I think in order to keep the average trip duration number accurate, the length of duration that we are filtering by needs to be at least one full trip by a vehicle. I'm not quite sure exactly what that number is, but I can do some research to find out what that is.

I know there is a lot here, I tried to keep it breif but I also wanted to make sure my plan was detailed enough to avoid pitfalls. I'm more than happy to meet sometime this week and go over this plan on a call if it's easier than email. Ultimately, either way is fine with me.