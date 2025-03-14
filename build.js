 
// build.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const less = require('less');

// Configuration
const SRC_DIR = 'src';
const DIST_DIR = 'dist';
const STYLES_DIR = 'styles';

// Create directories if they don't exist
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
}

// Compile LESS to CSS
console.log('Compiling LESS files...');
if (!fs.existsSync(path.join(DIST_DIR, STYLES_DIR))) {
    fs.mkdirSync(path.join(DIST_DIR, STYLES_DIR), { recursive: true });
}

// Read main LESS file
const lessContent = fs.readFileSync(path.join(STYLES_DIR, 'timeline.less'), 'utf8');

// Compile LESS to CSS
less.render(lessContent, {
    paths: [STYLES_DIR],
    filename: 'timeline.less'
})
    .then(output => {
        // Write CSS to output file
        fs.writeFileSync(path.join(DIST_DIR, STYLES_DIR, 'timeline.css'), output.css);
        console.log('LESS compiled successfully.');

        // Run TypeScript compiler
        compileTypeScript();
    })
    .catch(error => {
        console.error('Error compiling LESS:', error);
    });

// Run TypeScript compiler
function compileTypeScript() {
    console.log('Compiling TypeScript...');
    exec('tsc', (error, stdout, stderr) => {
        if (error) {
            console.error(`TypeScript compilation error: ${error.message}`);
            console.error(stderr);
            return;
        }

        if (stdout) {
            console.log(stdout);
        }

        console.log('TypeScript compilation completed successfully.');

        // Create example directory if needed
        if (!fs.existsSync(path.join(DIST_DIR, 'examples'))) {
            fs.mkdirSync(path.join(DIST_DIR, 'examples'), { recursive: true });
        }

        // Copy example files
        fs.copyFileSync(
            path.join('examples', 'basic.html'),
            path.join(DIST_DIR, 'examples', 'basic.html')
        );

        console.log('Examples copied.');
        console.log('Build completed successfully.');
    });
}