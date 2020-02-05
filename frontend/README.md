# Progressive Steering - Frontend
This directory contains the files of the frontend for the progressive steering application.

```
frontend
|- build/            --> Contains the bundled version for production
|- public/           --> Static frontend files
|- src/              --> React modules for frontend
|- package-lock.json --> for package versioning
|- package.json      --> npm configuration (scripts, modules ...)
|- tsconfig.json     --> TypeScript configuration

```

## Prerequisites
The frontend requires [NodeJS v10.15.3](https://nodejs.org/en/) or higher.
In addition to that, a global installation of [TypeScript](https://www.typescriptlang.org/) is needed.
You can install it from npm using the following the command.

```sh
npm install -g typescript
```

Inside the `fronted/` directory, run `npm install` to install the local packages for the frontend.
The packages that will be downloaded are listed inside the `package.json` file under the `dependencies` property.


## Launching the Frontend
To launch the frontend, run the following command

```sh
> npm start
```

Your terminal should now show the following output:
```
Compiled successfully!
```
At the same time, a browser window should open on [localhost:3000](http://localhost:3000). Otherwise, open it manually.
If your browser displays this error message: `TypeError: eel is undefined`, you most likely need to launch the backend.
