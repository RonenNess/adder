// get the global object (either for browser or node.js)
var _window = typeof window === "undefined" ? global : window;

// for tests in nodejs
if (typeof require != 'undefined')
{
	 if (typeof _window.AdderScript == 'undefined') {
	    require("./../dist/adder_script_4tests");
	 }
}

// shim for performance
var performance = typeof performance !== "undefined" ? performance : Date;

// round result to few digits after dot
function roundMathResult(res)
{
    return Math.round(res * 1000.0) / 1000.0;
}

// measure performance of an operator and return time took.
// @param operation - function to execute N times, thing we want to measure.
// @param timesToRun - number of times to execute the operation.
// @return - time took in ms.
function measurePerformance(operation, timesToRun)
{
    // default times to run
    timesToRun = timesToRun || 1;

    // take starting time
    var t0 = performance.now();

    // run operation
    for (var i = 0; i < timesToRun; ++i)
    {
        operation();
    }

    // take ending time
    var t1 = performance.now();

    // return results
    var result = (t1 - t0);
    return roundMathResult(result);
}

// create interpreter
var interpreter = new AdderScript.Interpreter();

// load all modules
interpreter.addModule("ALL");

// evaluate line
function loadCode(code) {

    // try to evaluate and catch unhandled errors
    var ret;
    try {
        interpreter.eval(code);
        interpreter.propagateExecutionErrors();
    } catch(e) {
        alert("Unexpected error! " + e.message);
        console.warn(e);
    }
}



// summary of js / adder total time in ms.
var totalJs = 0;
var totalAdder = 0;

// how many times to run every comparison test
var timesToRun = 100000;

// delay between tests, to let JavaScript time to cleanup stuff and chill so tests won't affect each other
var chillTime = 500;

// execute a test
function runTest(title, jsCode, scriptCode, nextTest) {

	// show header
	addHeader(title, jsCode, scriptCode);

	// first measure javascript:
	var jsSpeed = measurePerformance(function() {eval(jsCode);}, timesToRun);

	// now load AdderScript corresponding code and measure performance:
	loadCode(scriptCode);
	var adderSpeed = measurePerformance(function() {interpreter.execute();}, timesToRun);

	// add to total time
	totalJs += jsSpeed;
	totalAdder += adderSpeed;

	// show test results
	addResults(jsSpeed, adderSpeed);

	// call next test
	var nextTest = tests.shift();
	if (nextTest) {
	setTimeout(nextTest, chillTime);
	}
	else {
	endTest(totalJs, totalAdder);
	}
}

// test simple variable creation
function test1() {
  runTest("Creating variables",
		  'var a = 5; var b = true; var c = null; var d = "bla"',
		  'a = 5; b = True; c = None; d = "bla"');
}

// test basic expression
function test2() {
  runTest("Evaluate arithmetic expression",
			"var b = 5; var a = 4 - 32 * 16 / 14.2 | b + (2-1) / 15.0 * 35.15 / (2.1-1.0) % 12",
			"b = 5; a = 4 - 32 * 16 / 14.2 | b + (2-1) / 15.0 * 35.15 / (2.1-1.0) % 12");
}

// call to builtin-function
function test3() {
  runTest("Calling Math builtin function",
	  "Math.round(2.3)",
	  "Math.round(2.3)");
}

// convert number to string
function test4() {
  runTest("Converting to string",
	  "toString(2.3)",
	  "str(2.3)");
}

// check type
function test5() {
  runTest("Get variables types",
	  "typeof 15",
	  "type(15)");
}

// using list
function test6() {
  runTest("Using lists",
	  "var a = [1]; a.push(5); a[0];",
	  "a = list(1); a.append(5); a.at(0);");
}

// using set
function test7() {
  runTest("Using sets",
	  "var a = new Set([1]); a.add(5); a.has(1);",
	  "a = set(1); a.add(5); a.has(1);");
}

// using dictionaries
function test8() {
  runTest("Using dictionaries",
	  "var a = {}; a['a'] = 5; a['a'];",
	  'a = dict(); a.set("a", 5); a.get("a");');
}

// define functions
function test9() {
  runTest("Define functions",
	  "function test() {return}",
	  'def test(): return;');
}

// using functions
function test10() {
  runTest("Using functions",
	  "function test() {return 15}; test()",
	  'def test(): return 15; test()');
}

// tests list (not including first test which invoke everything)
var tests = [test2, test3, test4, test5, test6, test7, test8, test9, test10];

// start tests
setTimeout(test1, chillTime);