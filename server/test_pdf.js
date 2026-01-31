const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('pdf properties:', Object.keys(pdf));
if (typeof pdf === 'function') {
    console.log('pdf is a function');
} else {
    console.log('pdf is likely an object', pdf);
}
