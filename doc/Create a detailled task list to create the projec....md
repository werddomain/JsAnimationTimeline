# **Project Setup & Implementation: Task List**

This document outlines the step-by-step tasks to initialize the JsTimeLine control project.

**To GitHub Copilot:** Please follow each prompt. After you complete the actions described in a prompt, please add ✅ \*\*Task Completed\*\* at the end of that task's section.

### **Phase 1: Initial Project & Folder Structure**

**Task 1.1: Create Root Folders**

Prompt:  
"Copilot, create the root directory structure for our project. We need the following folders at the root level:

* /src: This will contain all our source code (TypeScript and LESS).  
* /dist: This will be the output directory for our compiled and bundled code.  
* /doc: This is for all project documentation, like specifications and guidelines."

✅ **Task Completed**

**Task 1.2: Initialize npm**

Prompt:  
"Copilot, initialize a new npm project. Run npm init and fill in the basic information:

* **package name:** js-timeline-control  
* **version:** 0.1.0  
* **description:** "A timeline control inspired by the Flash MX timeline, built with TypeScript and LESS."  
* **entry point:** dist/index.js  
* **test command:** (leave empty for now)  
* **git repository:** (leave empty for now)  
* **keywords:** timeline, typescript, less, control  
* **author:** (your name/org)  
* **license:** MIT

After initialization, create a .gitignore file and add /node\_modules and /dist to it."

✅ **Task Completed**

**Task 1.3: Create Source Code Structure**

Prompt:  
"Copilot, based on our project guidelines, create the initial folder and file structure inside the /src directory for the JsTimeLine control. The structure should be:  
src/  
├── core/  
│   ├── EventManager.ts  
│   └── StateManager.ts  
├── data/  
│   └── TimeLineData.ts  
├── plugins/  
│   ├── IPlugin.ts  
│   └── (empty folder)  
├── styles/  
│   └── JsTimeLine.less  
├── ui/  
│   ├── (empty folder)  
├── IJsTimeLineContext.ts  
└── JsTimeLine.ts

Please create these folders and empty files."

✅ **Task Completed**

### **Phase 2: TypeScript Configuration**

**Task 2.1: Install TypeScript**

Prompt:  
"Copilot, install TypeScript as a development dependency."  

✅ **Task Completed**

**Task 2.2: Create tsconfig.json**

Prompt:  
"Copilot, create a tsconfig.json file in the root directory. Configure it with the following settings to ensure correct compilation and source map generation for debugging:
```  
{  
  "compilerOptions": {  
    "target": "ES2018",  
    "module": "ESNext",  
    "moduleResolution": "node",  
    "declaration": true,  
    "outDir": "./dist",  
    "rootDir": "./src",  
    "strict": true,  
    "esModuleInterop": true,  
    "forceConsistentCasingInFileNames": true,  
    "skipLibCheck": true,  
    // Key settings for debugging:  
    "sourceMap": true,   
    "inlineSources": true  
  },  
  "include": \[  
    "src/\*\*/\*.ts"  
  \],  
  "exclude": \[  
    "node\_modules"  
  \]  
}  
```

✅ **Task Completed**

---

### **Phase 3: Webpack & LESS Configuration**

**Task 3.1: Install Webpack Dependencies**

**Prompt:**
"Copilot, install Webpack and all necessary loaders for our project as development dependencies:
* `webpack`
* `webpack-cli`
* `ts-loader` (to handle TypeScript files)
* `less` (the LESS preprocessor)
* `less-loader` (to load LESS files)
* `css-loader` (to resolve CSS imports)
* `style-loader` (to inject styles into the DOM)
* `webpack-dev-server` (for our watch/debug server)"

✅ **Task Completed**

---

**Task 3.2: Create `webpack.config.js`**

**Prompt:**
"Copilot, create a `webpack.config.js` file in the root directory. Configure it to:
1.  Use `ts-loader` for `.ts` files.
2.  Use `style-loader`, `css-loader`, and `less-loader` for `.less` files.
3.  Set the entry point to `./src/JsTimeLine.ts`.
4.  Output a bundled file named `JsTimeLine.bundle.js` into the `/dist` folder.
5.  Enable source maps for debugging.
6.  Configure `webpack-dev-server` to serve from the root and watch for changes.

Here is the configuration file content:

```javascript
const path = require('path');

module.exports = {
  mode: 'development', // Use 'production' for minified builds
  entry: './src/JsTimeLine.ts',
  devtool: 'inline-source-map', // Ensures best source maps for debugging
  
  output: {
    filename: 'JsTimeLine.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'JsTimeLine',
    libraryTarget: 'umd',
    clean: true, // Clean the dist folder before each build
  },
  
  resolve: {
    extensions: ['.ts', '.js'],
  },
  
  module: {
    rules: [
      // TypeScript Loader
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      // LESS/CSS Loaders
      {
        test: /\.less$/i,
        use: [
          'style-loader', // Injects styles into DOM
          'css-loader',   // Translates CSS into CommonJS
          'less-loader',  // Compiles LESS to CSS
        ],
      },
    ],
  },
  
  devServer: {
    static: {
      directory: path.join(__dirname), // Serve from root
    },
    compress: true,
    port: 9000,
    hot: true, // Enable hot module replacement
    watchFiles: ['src/**/*', 'index.html'], // Watch src and index.html
  },
};
```

✅ **Task Completed**

---

**Task 3.3: Create Test HTML**

**Prompt:**
"Copilot, create an `index.html` file in the root directory. This file will be used by `webpack-dev-server` for debugging. It should:
1.  Have a basic HTML structure.
2.  Include a `div` with an ID like `timeline-container`.
3.  Load our bundled script `dist/JsTimeLine.bundle.js`."

✅ **Task Completed**

---

### **Phase 4: npm Scripts**

**Task 4.1: Add Scripts to `package.json`**

**Prompt:**
"Copilot, open `package.json` and add the following scripts to the `scripts` section:

```json
"scripts": {
  "build": "webpack --mode=production",
  "build:dev": "webpack --mode=development",
  "watch": "webpack --watch --mode=development",
  "debug": "webpack-dev-server --open --mode=development"
}
```

Explain what each script does:

* build: Creates a minified production build.  
* build:dev: Creates an unminified development build with source maps.  
* watch: Watches for file changes and rebuilds using the dev config.  
* debug: Starts the webpack-dev-server, opens the browser, and enables live reloading. This is our main 'compile, webpack, and debug in one action' command."

✅ **Task Completed**

### **Phase 5: Implement Control Stub**

**Task 5.1: Add Base Code**

Prompt:  
"Copilot, let's add minimal 'hello world' code to get started.

1. In src/styles/JsTimeLine.less, add a simple rule to prove it's working:  
   .JsTimeLine {  
     border: 2px solid steelblue;  
     padding: 10px;  
     font-family: sans-serif;  
     color: \#333;  
   }

2. In src/JsTimeLine.ts, add a basic class constructor to import the styles and find the container:  
   // Import the styles directly  
   import './styles/JsTimeLine.less';

   export class JsTimeLine {  
     private container: HTMLElement;

     constructor(elementId: string) {  
       const element \= document.getElementById(elementId);  
       if (\!element) {  
         throw new Error(\`Element with id '${elementId}' not found.\`);  
       }  
       this.container \= element;  
       this.container.classList.add('JsTimeLine');  
       this.container.innerHTML \= '\<h2\>JsTimeLine Control Initialized\!\</h2\>';

       console.log('JsTimeLine control instantiated.');  
     }  
   }

3. In index.html, add a script tag *inside the body* to instantiate the class:  
   \<body\>  
     \<h1\>My Timeline Project\</h1\>  
     \<div id="timeline-container"\>\</div\>

     \<\!-- Load the bundled script \--\>  
     \<script src="dist/JsTimeLine.bundle.js"\>\</script\>

     \<\!-- Instantiate the control \--\>  
     \<script\>  
       new JsTimeLine('timeline-container');  
     \</script\>  
   \</body\>  
   ```"

✅ **Task Completed**

### **Phase 6: Verification**

**Task 6.1: Run and Verify**

Prompt:  
"Copilot, the setup is complete. To verify everything works:

1. Run npm install in the terminal to install all dependencies.  
2. Run npm run debug in the terminal.

This should open index.html in your browser. You should see the 'JsTimeLine Control Initialized\!' text inside a blue border. The console should log the 'instantiated' message. This confirms TypeScript, LESS, and Webpack are all working together correctly."