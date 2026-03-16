Busstop shade simulator

I wish to build a simplified but realistic bus stop sun shade simulator.
It would take bus stop longitude and latitude (or a city, and we would fetch the lat-long then) and then draw a 3D box to represent the bus stop and then create a 3D animation of the sun circling it from sunrise to sunset, so we can see where the shadows are cast during the process. We assume clear skies. Obviously the shadows depend on time of year and relative positions of sun and earth -- we need some math for that.
This will be a simple website (no backend) built using html + css + javascript. We'll keep the html clean by having separate files for css and javacript.
For graphical display we'll use three.js


Add discrete indicator of station dimensions in meters.


We need to understand the direction of the sun. Accurate direction of the sun, non-accurate size LOL. Maybe a smallish yellow ball (approx football size) orbiting the station. At a distance of say 5 station lengths. 

Let's make North different. Instead of the arrow let's have a compass with all sides of the world. It should also be moveable. User should be able to reposition the north by clicking anywhere on the "plot" the station is on. This should obviously recalculate and reposition the sun. Only full single clicks should count for north repositioning, not zooming, scrolling etc.

Let's now add analysis. The station will be deemed adequate if it provides cover from the direct sun for head of a 1.70m person standing in the middle of the station in periods from 6-8 AM and 4-6 PM (morning and evening peak commuting hours). We can render a human figure at the middle of the station to observe this visually. While his head is in the shade display a happy emoji, when it goes out of shade display a sad emoji.

Let's now make North moveable. Clicking anywhere on the plot should redraw the north line to be between the centre of the plot and the point of the click and extend to plot edge, with the arrow being there. Only single clicks should be considered, not clicks for zooming, rotating, etc.

Let's add to the UI the city and its longitude/latitude

Let's add a thick bar representing the time between sunrise and sunset. The left edge of the bar is the sunrise, the right is the sunset. Labels sunrise / sunset should move there. The bar should be progressively/incrementally filled with vertical lines as time goes. While the person is shaded / happy emoji is on, the line color should be green. While it's not it should be red. Change of color is affects only subsequent lines, does not those drawn thus far. Every change of color should be indicated with a black line and the hh24:mm label when it occured (position this label over the bar). Every day the bar is redrawn over the previous bar (in the same position).

Are we sure about the sun position. 


Evo jos jednog eksperimentalnog mini sajta. Sluzi za kalkulaciju valja li ili ne valja sjena koju stvara stanica javnog prevoza. Mozete "rekreirati" svoju stanicu tako da na karti pogledate kako je orjentirana i orjentirate u simulaciji identicno prema sjeveru. Racuna se za osobu od 1.70m, visima je ocito lakse, nizima teze.