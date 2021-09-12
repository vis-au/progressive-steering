# Progressive Steering - Frontend
This directory contains the files of the frontend module for ProSteer, our steering-by-example demo application.

```
frontend
|- public/           --> Static frontend files
|- src/              --> React modules for frontend
|- package-lock.json --> for package versioning
|- package.json      --> npm configuration (scripts, modules ...)
|- tsconfig.json     --> TypeScript configuration
```

## Setup
### Prerequisites
The frontend module requires [NodeJS v10.15.4](https://nodejs.org/en/) or higher.
You can install it from npm using the following the command.

Inside the `fronted/` directory, run `npm install` to install the local packages for the frontend.
The packages that will be downloaded are listed inside the `package.json` file under the `dependencies` property.


### Launching the Frontend
To launch the frontend, run the following command

```sh
> npm start
```

Your terminal should now show the compilation method, ending with the following output:
```
Compiled successfully!
```
At the same time, a browser window should open on [localhost:3000](http://localhost:3000). Otherwise, open it manually, for instance by clicking on [this link](http://localhost:3000).
If your browser displays this error message: `TypeError: eel is undefined`, you need to launch the backend module first.
See the README.md in the `backend/` directory of this project.

## Using ProSteer
We suggest you watch our [demo video]() first to get an impression on what ProSteer does and how it can be used. If you are interested in the technical background, you can have a look at [our paper](./).

### Launching the progression
- press button in bottom right corner or press the spacebar
- data items will progressively appear in the view
- progress bar in the bottom right informs you about the overall progress in percent

### Select a region of interest
- use the brush to select a region of interest in view space
- watch the number below the box you just drew indicating how many data items are in the selected region of interest.
- watch how points are rendered differently based on whether they lie inside or outside that selection
- watch statistics by clicking on the button labeled "progression" widget in the bottom left
- once enough points of interest have been sampled, you will notice how the grid in the background changes color, indicating differences between the progression using steering and a progression using random uniform sampling
- more data will be sampled in the region that you selected with the brush, meaning that you see interesting data first
- at some point, the steering module does not find any other points that are of interest and falls back to using random uniform sampling
- notice now how the sampling is more evenly distributed across the dataspace than before
- notice also how the precision statistic decreases, just as the number of points in the selection
- while some points may still land inside the selection, the majority has already been retrieved during the steering phase

### Compare steering-by-example with random uniform sampling
- click on the "side-by-side" button in the bottom row, which splits the view in half and visualizes another progression that only uses random uniform sampling to retrieve the next chunk
- compare how the two progressions retrieve the data over time

### More features
- you can add histograms using the dropdown list in the top row, which visualize the data distributions found in the selection and the overall dataset
- you can "replay" the presets we used for our benchmarks by selecting one of the scenarios in the dropdown list at the top.
- you can visualize the absolute number of items per bin in the background bin by clicking the "difference bins" button in the bottom row.