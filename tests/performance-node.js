var AdderScript = require("./../dist/adder_4tests.js");

// add title to test
global.addHeader = function(title, jsCode, scriptCode) {
  console.log("Running test: " + title);
  console.log("JavaScript code: " + jsCode);
  console.log("Adder code: " + scriptCode);
}

// add results
global.addResults = function(jsTime, adderTime) {
   console.log("JavaScript time: " + jsTime + "ms");
   console.log("Adder time: " + adderTime + "ms");
   console.log("----------------------------------------------------------");
}

// when finish running
global.endTest = function(jsTotal, adderTotal) {
	console.log("TOTAL JS: " + jsTotal);
	console.log("TOTAL ADDER: " + adderTotal);
}

var performance = require("./performance.js");