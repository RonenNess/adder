// get the global object (either for browser or node.js)
var _window = typeof window === "undefined" ? global : window;

// for tests in nodejs
if (typeof require != 'undefined')
{
	 if (typeof _window.AdderScript == 'undefined') {
	    require("./../dist/adder_4tests");
	 }
}

// like parseFloat, but returns NaN if contain english characters
function strictParseFloat(value) {
    if (typeof value !== "string" && typeof value !== "number") {return NaN;}
    if(/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/
      .test(value))
      return Number(value);
  return NaN;
}

// supported operators
var operators = ["+=", "-=", "*=", "/=", "|=", "&=", "%=", "**", "==", "!=", ">=", "<=", ">", "<", "+", "-", "*", "/", "|", "&", "%", "=", "."];
var wordsOperators = ["is not", "not in", "not", "in", "or", "and", "is"];
operators = operators.concat(wordsOperators);

// return if value is a number
function isNumber(value)
{
    return (!isNaN(strictParseFloat(value)));
}

// execute code and return [lastStatementCode, lastValue]
function executeAndReturn(code) {

    // create interpreter
    var interpreter = new AdderScript.Interpreter({throwErrors: true});

    // to disable print() output
    interpreter.output = function() {};

    // load all modules
    interpreter.addModule("ALL");

    // on browsers only, connect output (on node.js we don't want it it will spam results)
    if (typeof window !== "undefined") {
        AdderScript.Console.bindToNativeConsole();
    }

    // execute
    interpreter.eval(code);
    interpreter.propagateExecutionErrors();
    var ret = interpreter.getLastValue();

    // make sure scope is back to global
    if (interpreter._context._stack.length !== 1) {
        throw "Context is not back to global scope!";
    }

    // sanity test - run again to make sure second time we got the same value
    interpreter.execute();
    var ret2 = interpreter.getLastValue();
    if (ret.isSimple && ret.getValue() !== ret2.getValue()) {
        throw "Different return value on second run (" + ret.getValue() + ", " + ret2.getValue() + ")!";
    }

    // get last statement
    var statement = interpreter.getLastStatement();
    statement = statement ? statement.identifier : null

    // parse return value
    ret = ret && ret.getValue ? ret._value : ret;
    if (ret instanceof Array) {ret = ret.map(function(x) {return x ? x._value : x;});};

    // return
    return [statement, ret];
}

// convert return value into native js
function toNativeJs(val) {

    // get value from variable
    val = val && val.getValue ? val._value : val;

    // handle list
    if (val && val.constructor == _window.AdderScript.Core.List)
    {
        val = val._list;
        return val.map(function(x) {
            return toNativeJs(x);
        })
    }

    // handle set
    if (val && val.constructor == _window.AdderScript.Core.Set)
    {
        val = val._set;
        var ret = new Set();
        val.forEach(function(x) {
            ret.add(toNativeJs(x));
        });
        return ret;
    }

    // handle dictionary
    if (val && val.constructor == _window.AdderScript.Core.Dict)
    {
        val = val._dict;
        var ret = {};
        for (var key in val) {
            ret[key] = toNativeJs(val[key]);
        }
        return ret;
    }

    // handle plain variable
    return val;
}

// use assert.deepEqual or assert.strictEqual based on expected type
function smartCompare(assert, ret, expected)
{

    // special case - check if NaN
    if (isNaN(expected) && typeof expected === "number")
    {
        assert.ok(isNaN(ret) && typeof(ret) === "number");
    }
    // check result for list
    else if ((expected !== null) && (expected !== undefined) &&
                (expected instanceof Array || expected instanceof Set || expected.constructor == Object))
    {
        assert.deepEqual(ret, expected);
    }
    // check result for plain objects
    else
    {
        assert.strictEqual(ret, expected);
    }
}

// execute code and check returned value
// processResults - if provided will run this function on result and on expected
function testReturnValue(assert, code, expected, processResults)
{
    // execute and get value
    var ret = executeAndReturn(code)[1];

    // convert return value to plain js object
    ret = toNativeJs(ret);

    // run result process
    if (processResults) {
        ret = processResults(ret);
        expected = processResults(expected);
    }

    // check return value
    smartCompare(assert, ret, expected);
}

// round result to few digits after dot
function roundMathResult(res)
{
    if (typeof res !== "number") {return res;}
    return Math.round(res * 100000.0) / 100000.0;
}

// execute arithmetic expression and compare rounded results
function compareExpression(assert, code, expected)
{
    testReturnValue(assert, code, expected, roundMathResult)
}

function listToTokensList(expression)
{
    for (var i = 0; i < expression.length; ++i)
    {
        var curr = expression[i];
        if (curr === "," || curr === ":") {curr = {t: "p", "v": curr};}
        else if (operators.indexOf(curr) !== -1) {curr = {t: "o", "v": curr};}
        else if (isNumber(curr)) {curr = {t: "n", "v": curr};}
        else if (curr[0] === '"' && curr[curr.length-1] === '"') {curr = {t: "s", "v": curr};}
        else if (curr === "(" || curr === ")") {curr = {t: "o", "v": curr};}
        else if (curr === "\n" || curr === ";") {curr = {t: "b", "v": curr};}
        else if (curr[0] === '~') {curr = {t: "_", "v": parseInt(curr[2])};}
        else {curr = {t: "v", "v": curr};}
        expression[i] = curr;
    }
    return expression;
}

// parse utils - parse expression
QUnit.test("lexer", function( assert ) {

    // create lexer
    var lexer = new AdderScript.Lexer();

    // check basic expression
    assert.deepEqual(lexer.parseExpression(
                     "5 + 5"),
                    listToTokensList(["5", "+", "5"]));

    // with line break
    assert.deepEqual(lexer.parseExpression(
                 "5 + 5\na"),
                listToTokensList(["5", "+", "5", "\n", "a"]));
    assert.deepEqual(lexer.parseExpression(
                 "5 + 5;a"),
                listToTokensList(["5", "+", "5", ";", "a"]));
    assert.deepEqual(lexer.parseExpression(
                 "5 + 5\\\na"),
                listToTokensList(["5", "+", "5", "a"]));

    // with different blocks
    assert.deepEqual(lexer.parseExpression(
                 "5 + 5\n    a;a"),
                listToTokensList(["5", "+", "5", "\n", "~:1", "a", ";", "a"]));
    assert.deepEqual(lexer.parseExpression(
                 "5 + 5;    a"),
                listToTokensList(["5", "+", "5", ";", "a"]));
    assert.deepEqual(lexer.parseExpression(
                 "5 + 5\\\n    a"),
                listToTokensList(["5", "+", "5", "a"]));

    // with comment
    assert.deepEqual(lexer.parseExpression(
                     "5 + 5 # comment lol"),
                    listToTokensList(["5", "+", "5"]));
    assert.deepEqual(lexer.parseExpression(
                     "5 + 5#comment lol"),
                    listToTokensList(["5", "+", "5"]));
    assert.deepEqual(lexer.parseExpression(
                     '5 + 5 + "not # comment"'),
                    listToTokensList(["5", "+", "5", "+", '"not # comment"']));

    // some statements
    assert.deepEqual(lexer.parseExpression(
                 'print "test"'),
                listToTokensList(["print", '"test"']));
    assert.deepEqual(lexer.parseExpression(
                 'if True == a:'),
                listToTokensList(["if", "True", "==", "a", ":"]));
    assert.deepEqual(lexer.parseExpression(
                 'for i in range(50)'),
                listToTokensList(["for", "i", "in", "range", "(", "50", ")"]));

    // check more complicated expression
    assert.deepEqual(lexer.parseExpression(
                     "5 * 2 / 4 + 1 - 5 / 1.1 + 2.2 * 1.4 + -1"),
                    listToTokensList(["5", "*", "2", "/", "4", "+", "1", "-", "5", "/", "1.1", "+", "2.2", "*", "1.4", "+", "-", "1"]));

    // check tricky spaces and tabs
    assert.deepEqual(lexer.parseExpression(
                     "5 * 2 / 4 + 1         - 5 /     1.1 +   2.2 *      1.4 + -1"),
                    listToTokensList(["5", "*", "2", "/", "4", "+", "1", "-", "5", "/", "1.1", "+", "2.2", "*", "1.4", "+", "-", "1"]));

    // check brackets
    assert.deepEqual(lexer.parseExpression(
                     "5 * 2 + ( 6 +4)"),
                    listToTokensList(["5", "*", "2", "+", "(", "6", "+", "4", ")"]));
    assert.deepEqual(lexer.parseExpression(
                     "5 * 2 + ( 6 +(2-4))"),
                    listToTokensList(["5", "*", "2", "+", "(", "6", "+", "(", "2", "-", "4", ")", ")"]));
    assert.deepEqual(lexer.parseExpression(
                     "(5 * 2) + ( 6 +(2-4))"),
                    listToTokensList(["(", "5", "*", "2", ")", "+", "(", "6", "+", "(", "2","-","4", ")", ")"]));
    assert.deepEqual(lexer.parseExpression(
                     "((5 * 2))"),
                    listToTokensList(["(", "(", "5", "*", "2", ")", ")"]));

    // check with strings
    assert.deepEqual(lexer.parseExpression(
                     '"5 + 2"'),
                    listToTokensList(['"5 + 2"']));
    assert.deepEqual(lexer.parseExpression(
                     '"5 \n 2"'),
                    listToTokensList(['"5 \n 2"']));
    assert.deepEqual(lexer.parseExpression(
                     '"5 \\ \r \n 2"'),
                    listToTokensList(['"5 \\ \r \n 2"']));
    assert.deepEqual(lexer.parseExpression(
                     '"5 + 2" + "" + 5'),
                    listToTokensList(['"5 + 2"', "+", '""', "+", "5"]));
    assert.deepEqual(lexer.parseExpression(
                     '5 + "5 +, 2" * 2'),
                    listToTokensList(["5", "+", '"5 +, 2"', "*", "2"]));
    assert.deepEqual(lexer.parseExpression(
                     '5 + " (5 + #, 2" * 2'),
                    listToTokensList(["5", "+", '" (5 + #, 2"', "*", "2"]));
    assert.deepEqual(lexer.parseExpression(
                     '5 + (" (5 + #, 2 )") * 2'),
                    listToTokensList(["5", "+", "(", '" (5 + #, 2 )"', ")", "*", "2"]));

    // long, complex expression
    assert.deepEqual(lexer.parseExpression("(5 + 2) + foo(5)(2)*foo(4)+5*2"),
                        listToTokensList(["(", "5","+","2", ")","+","foo","(", "5", ")", "(", "2", ")","*","foo","(", "4", ")","+","5","*","2"]));

    // try weird yet legal stuff
    assert.deepEqual(lexer.parseExpression("5 +- 2"), listToTokensList(["5", "+", "-", "2"]));
    assert.deepEqual(lexer.parseExpression("5 -+ 2"), listToTokensList(["5", "-", "+", "2"]));
    assert.deepEqual(lexer.parseExpression("5 *+ 2"), listToTokensList(["5", "*", "+", "2"]));
    assert.deepEqual(lexer.parseExpression("5 * +2"), listToTokensList(["5", "*", "+", "2"]));
    assert.deepEqual(lexer.parseExpression("5 / -2"), listToTokensList(["5", "/", "-", "2"]));
    assert.deepEqual(lexer.parseExpression("5 + - + + -2"), listToTokensList(["5", "+", "-", "+", "+", "-", "2"]));
    assert.deepEqual(lexer.parseExpression("5 +-+ 2"), listToTokensList(["5", "+", "-", "+", "2"]));
    assert.deepEqual(lexer.parseExpression("5  * + + 2"), listToTokensList(["5", "*", "+", "+", "2"]));

    // function calls
    assert.deepEqual(lexer.parseExpression("5 + func()"), listToTokensList(["5", "+", "func", "(", ")"]));
    assert.deepEqual(lexer.parseExpression("5 + func(2 * 3)"), listToTokensList(["5", "+", "func", "(", '2', '*', '3', ")"]));
    assert.deepEqual(lexer.parseExpression("5 + func(aa)"), listToTokensList(["5", "+", "func", "(", 'aa', ")"]));

    // check using variables
    assert.deepEqual(lexer.parseExpression("5 / test-2"), listToTokensList(["5", "/", "test", "-", "2"]));
    assert.deepEqual(lexer.parseExpression("5 / test5 -2"), listToTokensList(["5", "/", "test5", "-", "2"]));

    // check some illegal stuff
    assert.throws(function(){lexer.parseExpression("6 + 0test - 4")},     AdderScript.Errors.IllegalExpression);
    assert.throws(function(){lexer.parseExpression("6 + 5test - 4")},     AdderScript.Errors.IllegalExpression);
    assert.throws(function(){lexer.parseExpression("6 + 9test - 4")},     AdderScript.Errors.IllegalExpression);
    assert.throws(function(){lexer.parseExpression('4 + "bla')},          AdderScript.Errors.IllegalExpression);

});

// test parser and AST
QUnit.test("parser", function( assert ) {

    // create parser
    var lexer = new AdderScript.Lexer();

    // remove undefined values by json dumps-loads
    function cleanup(data)
    {
        return JSON.parse(JSON.stringify(data));
    }

    assert.deepEqual(cleanup(AdderScript.Parser.parse(lexer.parseExpression("5 + 2"))),
        [{"type":"+","left":{"type":"number","value":"5"},"right":{"type":"number","value":"2"}}]);
    assert.deepEqual(cleanup(AdderScript.Parser.parse(lexer.parseExpression("5 + 2 * 1"))),
        [{"left": {"type": "number","value": "5"},"right": {"left": {"type": "number","value": "2"},"right": {"type": "number","value": "1"},"type": "*"},"type": "+"}]);
    assert.deepEqual(cleanup(AdderScript.Parser.parse(lexer.parseExpression("func(2,3)"))),
        [{"args":[{"type":"number","value":"2"},{"type":"number","value":"3"}],"name":"func","type":"call"}]);
    assert.deepEqual(cleanup(AdderScript.Parser.parse(lexer.parseExpression('5 + "2"'))),
        [{"type":"+","left":{"type":"number","value":"5"},"right":{"type":"string","value":'"2"'}}]);
});

// pass statement
QUnit.test("statement_pass", function( assert ) {

    // check legal cases
    assert.deepEqual(executeAndReturn("pass"), ["builtin.statements.pass", null]);
    assert.deepEqual(executeAndReturn("pass\n"), ["builtin.statements.pass", null]);

    // these are not a pass statement but evaluations..
    assert.throws(function(){executeAndReturn("pass + NOT")}, AdderScript.Errors.UndefinedVariable);
    assert.throws(function(){executeAndReturn("passover")}, AdderScript.Errors.UndefinedVariable);
});

// comments
QUnit.test("statement_comment", function( assert ) {

    var compiler = new AdderScript.Compiler();

    // check legal cases
    assert.deepEqual(executeAndReturn("# foo"), [null, null]);
    assert.deepEqual(executeAndReturn("#foo"), [null, null]);

});

// strings
QUnit.test("strings", function( assert ) {

    // quotes with "
    compareExpression(assert, 'a = "test"', "test");
    compareExpression(assert, 'a = "te;st"', "te;st");
    compareExpression(assert, 'a = "te; \n \t ; # st"', "te; \n \t ; # st");
    compareExpression(assert, 'a = "te; \n \' \' \t ; # st"', "te; \n ' ' \t ; # st");

    // quotes with '
    compareExpression(assert, "a = 'test'", "test");
    compareExpression(assert, "a = 'te;st'", "te;st");
    compareExpression(assert, "a = 'te; \n \t ; # st'", "te; \n \t ; # st");
    compareExpression(assert, "a = 'te; \n \" \" \t ; # st'", "te; \n \" \" \t ; # st");
});

// compiler - compile def
QUnit.test("statement_def", function( assert ) {

    // check legal cases
    assert.equal(executeAndReturn("def test(): pass")[0], "builtin.statements.def");
    assert.equal(executeAndReturn("def    test  (\t )  :  pass")[0], "builtin.statements.def");
    assert.equal(executeAndReturn("def test(foo2): pass")[0], "builtin.statements.def");
    assert.equal(executeAndReturn("def test($foo_2): pass")[0], "builtin.statements.def");
    assert.equal(executeAndReturn("def test(foo): pass")[0], "builtin.statements.def");
    assert.equal(executeAndReturn("def test(__foo): pass# just a comment")[0], "builtin.statements.def");
    assert.equal(executeAndReturn("def test(\tfoo ): pass")[0], "builtin.statements.def");
    assert.equal(executeAndReturn('def test(\tfoo, bar ): pass')[0], "builtin.statements.def");

    // check syntax errors
    assert.throws(function(){executeAndReturn("def (): pass")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn("defoo test(): pass")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn("def test ()")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn("def test (: pass")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn("def test ):")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn("def test (#):")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn("def test () #:")}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('def test(\tfoo, "bar" ):')}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('def test(\tfoo, "bar"   + "gaga," ):')}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('def test(1+2-3*4/5.0, 6 ):')}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('def test(foo, 5):')}, AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('def test(5):')}, AdderScript.Errors.SyntaxError);
});

// defining and using functions
QUnit.test("functions", function( assert ) {

    // basic functions calls
    compareExpression(assert, "def test(): pass; test()", null);
    compareExpression(assert, "def test(): return 15; test()", 15);
    compareExpression(assert, "a = 5; def test(): return a; test()", 5);
    compareExpression(assert, "a = 5; def test(): return a+=1; test()", 6);
    compareExpression(assert, "a = 5; def test(): return a+=1; test(); a", 6);
    compareExpression(assert, "a = 5; b = 2; def test1(): return a; def test2(): return test1() + b; test2()", 5+2);
    compareExpression(assert, "def test(a): return 15 + a; test(2)", 15 + 2);
    compareExpression(assert, "def test(a): return 15 + a; test(2); test(3)", 15 + 3);
    compareExpression(assert, "a = 0; def test(): return a; a", 0);


    // try function with block
    var code = "" +
        "def func(a,b,c):\n" +
        "    return a + b + c\n" +
        "\n" +
        "func(1,2,3)\n";
    compareExpression(assert, code, 1+2+3);

    // function inside function!
    var code = "" +
        "def func(a,b,c):\n" +
        "    def internal(): return 5\n" +
        "    return a + b + c + internal()\n" +
        "func(1,2,3)\n";
    compareExpression(assert, code, 1+2+3+5);

    // function inside function with block body!
    var code = "" +
        "def func(a,b,c):\n" +
        "    def internal():\n" +
        "        return 5\n" +
        "    return a + b + c + internal()\n" +
        "func(1,2,3)\n";
    compareExpression(assert, code, 1+2+3+5);

    // function that calls another function and return value
    var code = "" +
        "def test2():\n" +
        "    return 5\n" +
        "def test():\n" +
        "    return test2()\n" +
        "test()\n";
    compareExpression(assert, code, 5);

    // function that calls another function but note that the wrapping function "forgets" to add return, so should return None
    var code = "" +
        "def test2():\n" +
        "    return 5\n" +
        "def test():\n" +
        "    test2() # missing return statement here \n" +
        "test()\n";
    compareExpression(assert, code, null);
});

// basic expressions evaluation
QUnit.test("basic_expressions", function( assert ) {

    // test basic expressions
    compareExpression(assert, "5", 5);
    compareExpression(assert, "5 + 5", 5 + 5);
    compareExpression(assert, "5 + -5", 5 + -5);
    compareExpression(assert, "-5 + -5", -5 + -5);
    compareExpression(assert, "5 + 5 * 2", 5 + 5 * 2);
    compareExpression(assert, "5 + 5 * 2 / 5 ", 5 + 5 * 2 / 5);
    compareExpression(assert, "5 + 5 * 2 / 5 + (2+5/2) * 3", 5 + 5 * 2 / 5 + (2+5/2) * 3);
    compareExpression(assert, "5 + -5 * -2 / -5 + (2+5/-2) * 3", 5 + -5 * -2 / -5 + (2+5/-2) * 3);
    compareExpression(assert, "-5.2 + - - + - - + 5.1 * - -2.6 / (2+3.0) -+5 + (2+\t5/-2) * 3", -5.2 + - - + - - + 5.1 * - -2.6 / (2+3.0) -+5 + (2+ 5/-2) * 3);
    compareExpression(assert, "5 - 3 + 52 / 2.1 * 5.2 + 2 - 4 % 23 * 21.2 - 0.23 / ( 1 -4 ) + 1.422 + Math.abs(-4) - 2", 5 - 3 + 52 / 2.1 * 5.2 + 2 - 4 % 23 * 21.2 - 0.23 / ( 1 -4 ) + 1.422 + Math.abs(-4) - 2);
    compareExpression(assert, "4 + 63 | 52", 4 + 63 | 52);
    compareExpression(assert, "4 + 63 & 52", 4 + 63 & 52);
    compareExpression(assert, "4 + 63 % 52", 4 + 63 % 52);
    compareExpression(assert, "3 | 5 & 2 * 54 % 23 * 21.2", 3 | 5 & 2 * 54 % 23 * 21.2);
    compareExpression(assert, "52 / 2.1 * 5.2 + 2 - 3 | 5 & 2 * 54 % 23 * 21.2", 52 / 2.1 * 5.2 + 2 - 3 | 5 & 2 * 54 % 23 * 21.2);
    compareExpression(assert, "5 - 3 + 52 / 2.1 * 5.2 + 2 - 3 | 5 & 2 * 54 % 23 * 21.2 - 0.23 / ( 1 -4 ) + 1.422 + Math.abs(-4) - 2",
                               5 - 3 + 52 / 2.1 * 5.2 + 2 - 3 | 5 & 2 * 54 % 23 * 21.2 - 0.23 / ( 1 -4 ) + 1.422 + Math.abs(-4) - 2);
    compareExpression(assert, "a = 5 - 3 + 52 / 2.1 * 5.2 + 2 - 3 | 5 & 2 * 54 % 23 * 21.2 - 0.23 / ( 1 -4 ) + 1.422 + Math.abs(-4) - 2; a",
                               5 - 3 + 52 / 2.1 * 5.2 + 2 - 3 | 5 & 2 * 54 % 23 * 21.2 - 0.23 / ( 1 -4 ) + 1.422 + Math.abs(-4) - 2);

    // now do expressions with functions calls
    _window.__adder_script_test = function() {return 5.2;};
    var _sec_test = _window.__adder_script_test;
    compareExpression(assert, "_sec_test()", _sec_test());
    compareExpression(assert, "5 + 5 - _sec_test()", 5 + 5 - _sec_test());
    compareExpression(assert, "5 + -_sec_test()", 5 + -_sec_test());
    compareExpression(assert, "-5 + -_sec_test()", -5 + -_sec_test());
    compareExpression(assert, "5 + _sec_test() * 2", 5 + _sec_test() * 2);
    compareExpression(assert, "5 + 5 * _sec_test() / 5 ", 5 + 5 * _sec_test() / 5);
    compareExpression(assert, "5 + 5 * _sec_test() / 5 + (2+5/_sec_test()) * 3", 5 + 5 * _sec_test() / 5 + (2+5/_sec_test()) * 3);
    compareExpression(assert, "5 + -5 * -2 / -5 + (2+5/-_sec_test()) * 3", 5 + -5 * -2 / -5 + (2+5/-_sec_test()) * 3);
    compareExpression(assert, "-_sec_test() + - - + - - + 5.1 * - -_sec_test() / (2+3.0) -+5 + (2+\t5/-2) * 3", -_sec_test() + - - + - - + 5.1 * - -_sec_test() / (2+3.0) -+5 + (2+ 5/-2) * 3);

    // with variables
    compareExpression(assert, "a = 5; a + 5", 5 + 5);
    compareExpression(assert, "a = 5; b = 2; a + b", 5 + 2);
    var a = 5; var b = 6; var c = 2.3;
    compareExpression(assert, "a = 5; b = 6; a + 5 * b / 5 + (2+a/2) * 3", a + 5 * b / 5 + (2+a/2) * 3);
    compareExpression(assert, "a = 5; b = 6; a + -a * -b / -5 + (a+5/-b) * a", a + -a * -b / -5 + (a+5/-b) * a);
    compareExpression(assert, "a = 5; b = 6; c = 2.3; -c + - - + - - + a * - -b / (2+a) -+c + (2+\t5/-2) * 3", -c + - - + - - + a * - -b / (2+a) -+c + (2+ 5/-2) * 3);
    compareExpression(assert, "a = 5; b = 6; c = 2.3; a = a | b & c; a", a | b & c);

    // now with a function that gets param
    _window.__adder_script_test = function(x) {return x;};
    var _sec_test = _window.__adder_script_test;
    compareExpression(assert, "_sec_test(5)", _sec_test(5));
    compareExpression(assert, "5 + 5 - _sec_test(5)", 5 + 5 - _sec_test(5));
});

// test all operators
QUnit.test("operators", function( assert ) {

    // just a reminder:
    // ["+=", "-=", "*=", "/=", "|=", "&=", "%=", "**", "==", "!=", ">", "<", ">=", "<=",
    // "+", "-", "*", "/", "|", "&", "%", "=", "not", "in", "or", "and"];

    // test all the following: "+=", "-=", "*=", "/=", "|=", "&=", "%="
    var ops = ["+=", "-=", "*=", "/=", "|=", "&=", "%="];
    for (var i = 0; i < ops.length; ++i)
    {
        var op = ops[i];
        var expected = eval("var d = 5; d " + op + " 2; d");
        compareExpression(assert, "d = 5; d " + op + " 2; d", expected);
    }

    // test ** operator
    compareExpression(assert, "3 ** 2", Math.pow(3, 2));

    // test "==", "!=", ">", "<", ">=", "<="
    compareExpression(assert, "3 == 3", true);
    compareExpression(assert, "3 == 2", false);
    compareExpression(assert, "3 != 2", true);
    compareExpression(assert, "3 != 3", false);
    compareExpression(assert, "3 > 1", true);
    compareExpression(assert, "3 > 3", false);
    compareExpression(assert, "3 > 5", false);
    compareExpression(assert, "3 < 1", false);
    compareExpression(assert, "3 < 3", false);
    compareExpression(assert, "3 < 5", true);
    compareExpression(assert, "3 >= 3", true);
    compareExpression(assert, "3 >= 5", false);
    compareExpression(assert, "3 <= 1", false);
    compareExpression(assert, "3 <= 3", true);
    compareExpression(assert, "3 <= 5", true);

    // test the basics: +, -, *, /, |, &, %
    compareExpression(assert, "3 + 2", 3 + 2);
    compareExpression(assert, "3 - 2", 3 - 2);
    compareExpression(assert, "3 * 2", 3 * 2);
    compareExpression(assert, "3 / 2", 3 / 2);
    compareExpression(assert, "3 + 2.1", 3 + 2.1);
    compareExpression(assert, "3 - 2.1", 3 - 2.1);
    compareExpression(assert, "3 * 2.1", 3 * 2.1);
    compareExpression(assert, "3 / 2.1", 3 / 2.1);
    compareExpression(assert, "3 | 2", 3 | 2);
    compareExpression(assert, "3 & 2", 3 & 2);
    compareExpression(assert, "3 % 2", 3 % 2);

    // check basic assignment
    compareExpression(assert, "a = 2; a", 2);

    // test 'not'
    compareExpression(assert, "not True", false);
    compareExpression(assert, "not False", true);
    compareExpression(assert, "not 5", false);
    compareExpression(assert, "not 0", true);

    // test 'or'
    compareExpression(assert, "0 or 5", 5);
    compareExpression(assert, "5 or 0", 5);
    compareExpression(assert, "True or False", true);
    compareExpression(assert, "False or True", true);
    compareExpression(assert, "False or None or 5 or 10", 5);
    compareExpression(assert, "a = False or None or 5 or 10; a", 5);
    compareExpression(assert, '"aa" or False', "aa");
    compareExpression(assert, 'True or "aa" or False', true);
    compareExpression(assert, '0 or False', false);
    compareExpression(assert, 'a = False and None and "yay!" or True; a', true);
    compareExpression(assert, 'a = False or None and "yay!" and True; a', null);

    // test 'and'
    compareExpression(assert, "0 and 5", 0);
    compareExpression(assert, "5 and 0", 0);
    compareExpression(assert, "True and False", false);
    compareExpression(assert, "False and True", false);
    compareExpression(assert, '"aa" and False', false);
    compareExpression(assert, 'True and "aa" and False', false);
    compareExpression(assert, '1 and True', true);

    // test 'in'
    compareExpression(assert, '1 in 100', true);
    compareExpression(assert, '1 in 430', false);
    compareExpression(assert, '"a" in "abcd"', true);
    compareExpression(assert, '"z" in "abcd"', false);
    compareExpression(assert, '"a" not in "abcd"', false);
    compareExpression(assert, '"z" not in "abcd"', true);
    compareExpression(assert, '"a" in list("a", "b", "c")', true);
    compareExpression(assert, '"z" in list("a", "b", "c")', false);
    compareExpression(assert, '1 in list(1,2,3)', true);
    compareExpression(assert, '5 in list(1,2,3)', false);
    compareExpression(assert, '"1" in list(1,2,3)', false);
    compareExpression(assert, '"True" in dir()', true);
    compareExpression(assert, '"bla bla" in dir()', false);

    // test 'is'
    compareExpression(assert, '1 is 1', true);
    compareExpression(assert, 'True is True', true);
    compareExpression(assert, 'True is False', false);
    compareExpression(assert, 'None is False', false);
    compareExpression(assert, 'list() is list()', false);
    compareExpression(assert, 'list() is not list()', true);
    compareExpression(assert, 'True is not True', false);
    compareExpression(assert, 'True is not False', true);
});

// test for loops
QUnit.test("loop_while", function( assert ) {

    // legal values
    compareExpression(assert, 'a = ""; letters = list("t", "e", "s", "t"); while letters.len(): a += letters.shift(); a', "test");
    compareExpression(assert, 'a = ""; letters = list("t", "e", "s", "t"); while False: a += letters.shift(); a', "");
    compareExpression(assert, 'a = 0; while a < 10: a += 1; a', 10);
    compareExpression(assert, 'a = 0; while a < 10 and False: a += 1; a', 0);

    // invalid syntax
    assert.throws(function(){executeAndReturn('while pass')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('while True pass')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('while True False: pass')}, _window.AdderScript.Errors.SyntaxError);
});

// test for loops
QUnit.test("loop_for", function( assert ) {

    // legal values
    compareExpression(assert, 'a = ""; for i in "test": a += i; a', "test");
    compareExpression(assert, 'a = 0; for i in range(10): a += i; a', 1+2+3+4+5+6+7+8+9);
    compareExpression(assert, 'a = 0; for i in range(10): continue; a', 0);
    compareExpression(assert, 'a = 0; for i in range(10): break; a', 0);
    compareExpression(assert, 'a = 0; def test(): a+=1; for i in range(10): test(); a', 10);
    compareExpression(assert, 'a = 1; for i in range(10): pass; a', 1);

    // invalid syntax
    assert.throws(function(){executeAndReturn('a = 5; for 5 in "test": pass')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a = 5; for "a" in "test": pass')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a = 5; for vg in "test" pass')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a = 5; for vg + 5 in "test": pass')}, _window.AdderScript.Errors.SyntaxError);
});

// test loop continue
QUnit.test("loop_continue", function( assert ) {

    // continue to skip odd values
    var code = "" +
        "a = 0;\n" +
        "for i in range(10):\n" +
        "    if i % 2 == 0: continue\n" +
        "    a += 1\n" +
        "a";
    compareExpression(assert, code, 5);

    // continue to skip all
    var code = "" +
        "a = 0;\n" +
        "for i in range(10):\n" +
        "    if True: continue\n" +
        "    a += 1\n" +
        "a";
    compareExpression(assert, code, 0);

    // continue to skip odd values
    var code = "" +
        "a = 0; i = 0;\n" +
        "while i < 10:\n" +
        "    i += 1\n" +
        "    if i % 2 == 0: continue\n" +
        "    a += 1\n" +
        "a";
    compareExpression(assert, code, 5);

    // continue to skip all
    var code = "" +
        "a = 0; i = 0;\n" +
        "while i < 10:\n" +
        "    i += 1\n" +
        "    if True: continue\n" +
        "    a += 1\n" +
        "a";
    compareExpression(assert, code, 0);

    // invalid syntax - using continue / break outside loops
    assert.throws(function(){executeAndReturn('a = 5; continue;')}, _window.AdderScript.Errors.RuntimeError);
});

// test loop break
QUnit.test("loop_break", function( assert ) {

    // continue to skip odd values
    var code = "" +
        "a = 0;\n" +
        "for i in range(10):\n" +
        "    if i == 5: break\n" +
        "    a += 1\n" +
        "a";
    compareExpression(assert, code, 5);

    // continue to skip all
    var code = "" +
        "a = 0;\n" +
        "for i in range(10):\n" +
        "    if i is 0: break\n" +
        "    a += 1\n" +
        "a";
    compareExpression(assert, code, 0);

    // invalid syntax - using continue / break outside loops
    assert.throws(function(){executeAndReturn('a = 5; break;')}, _window.AdderScript.Errors.RuntimeError);
});

// test if
QUnit.test("if_statement", function( assert ) {

    var code = "" +
        "a = 0;\n" +
        "if True: a = 1\n" +
        "a";
    compareExpression(assert, code, 1);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "a";
    compareExpression(assert, code, 0);

    var code = "" +
        "n = 1\n" +
        "a = 0\n" +
        "if n == 1 or n == 2: a = 1\n" +
        "a";
    compareExpression(assert, code, 1);

    var code = "" +
        "n = 1\n" +
        "a = 0\n" +
        "if n == 1 and n == 2: a = 1\n" +
        "a";
    compareExpression(assert, code, 0);

    // invalid syntax
    assert.throws(function(){executeAndReturn('if True a = 5')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('if True')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('if : a = 5')}, _window.AdderScript.Errors.SyntaxError);
});

// test else
QUnit.test("else_statement", function( assert ) {

    var code = "" +
        "a = 0;\n" +
        "if True: a = 1\n" +
        "else: a = 2\n" +
        "a";
    compareExpression(assert, code, 1);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "else: a = 2\n" +
        "a";
    compareExpression(assert, code, 2);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "else: if True: a = 2\n" +
        "a";
    compareExpression(assert, code, 2);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "else: if None: a = 2\n" +
        "a";
    compareExpression(assert, code, 0);

    // some basic cases
    compareExpression(assert, 'if False: a=5; else: a=1; a', 1);
    compareExpression(assert, 'if True: a=5; else: a=1; a', 5);
    compareExpression(assert, 'a=5; if False: a=1; else:; a', 5);

    var code = "" +
        "a=0\n"+
        "if False:\n" +
        "    pass\n" +
        "else:\n" +
        "    if 0:\n" +
        "        a = 1\n" +
        "    else:\n" +
        "        a = 5\n" +
        "a"
    compareExpression(assert, code, 5);

    var code = "" +
        "a=0\n"+
        "if False:\n" +
        "    pass\n" +
        "else:\n" +
        "    if True:\n" +
        "        a = 1\n" +
        "    else:\n" +
        "        a = 5\n" +
        "a"
    compareExpression(assert, code, 1);

    // invalid syntax
    assert.throws(function(){executeAndReturn('if True: a = 5; else foo')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('else: a = 5')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a = 6; else: a = 5;')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a=0; if False: pass; else: if 0: a = 1; else: a = 5; a')}, _window.AdderScript.Errors.SyntaxError);
});

// test elif
QUnit.test("elif_statement", function( assert ) {

    var code = "" +
        "a = 0;\n" +
        "if True: a = 1\n" +
        "elif True: a = 2\n" +
        "a";
    compareExpression(assert, code, 1);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "elif True: a = 2\n" +
        "a";
    compareExpression(assert, code, 2);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "elif False: a = 2\n" +
        "a";
    compareExpression(assert, code, 0);

    var code = "" +
        "a = 0;\n" +
        "if False: a = 1\n" +
        "elif a == 0: \n" +
        "    a = 2\n" +
        "a";
    compareExpression(assert, code, 2);

    // some basic cases
    compareExpression(assert, 'if False: a=5; elif True: a=1; a', 1);
    compareExpression(assert, 'if True: a=5; elif 1: a=1; a', 5);
    compareExpression(assert, 'a=5; if False: a=1; elif list():; a', 5);

    var code = "" +
        "a=0\n"+
        "if False:\n" +
        "    pass\n" +
        "elif a == 1 or True:\n" +
        "    if 0:\n" +
        "        a = 1\n" +
        "    else:\n" +
        "        a = 5\n" +
        "a"
    compareExpression(assert, code, 5);

    var code = "" +
        "a=0\n"+
        "if False:\n" +
        "    pass\n" +
        "elif a == 0 or False and True:\n" +
        "    if True:\n" +
        "        a = 1\n" +
        "    elif False:\n" +
        "        a = 5\n" +
        "a"
    compareExpression(assert, code, 1);

    // invalid syntax
    assert.throws(function(){executeAndReturn('if True: a = 5; elif foo')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('elif True: a = 5')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a = 6; elif True: a = 5;')}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function(){executeAndReturn('a=0; if False: pass; elif: if 0: a = 1; else: a = 5; a')}, _window.AdderScript.Errors.SyntaxError);
});

// basic function calls
QUnit.test("basic_function_call", function( assert ) {

    // register temp test function
    _window.__adder_script_test = function()
    {
        var args = _window.AdderScript.Utils.toArray(arguments);
        if (args.length === 1) {return args[0]._value;}
        return args.map(function(x) {
            return x._value;
        });
    }

    // call with simple values
    var values = ["1,2,3", '"das"', "15", "__VERSION__", "15 + 5", "15 + 5 * 2 + -1", '"5+2"', '1,2 + 2,3 + "abcd"', '1, "2,3"'];
    var results = [[1,2,3], 'das', 15, AdderScript.version, 20, 15 + 5 * 2 + -1, '5+2', [1,2 + 2 ,3 + 'abcd'], [1, '2,3']];
    for (var i = 0; i < values.length; ++i)
    {
        var val = values[i];
        var expected = results[i];
        assert.deepEqual(executeAndReturn("_sec_test(" + val + ")")[1], expected);
    }
});

// test strings api
QUnit.test("strings_api", function( assert ) {

    // test len()
    testReturnValue(assert, '"".len()', 0);
    testReturnValue(assert, '"abcd".len()', 4);
    testReturnValue(assert, 'a = "abcd"; a.len()', 4);

    // test split()
    testReturnValue(assert, '"abc def".split()', ["abc", "def"]);
    testReturnValue(assert, '"abc def".split(" ")', ["abc", "def"]);
    testReturnValue(assert, '"abc def".split("-")', ["abc def"]);
    testReturnValue(assert, '"abc-word-def".split("-word-")', ["abc", "def"]);
    testReturnValue(assert, '"abc def".split("")', ["a", "b", "c", " ", "d", "e", "f"]);

    // test replace()
    testReturnValue(assert, '"abc def".replace("abc", "foo")', "foo def");
    testReturnValue(assert, '"abc def abc".replace("abc", "foo")', "foo def foo");
    testReturnValue(assert, 'a = "abc def abc"; a.replace("abc", "foo"); a', "abc def abc");
    testReturnValue(assert, 'a = "abc def abc abc234"; a.replace("abc", "foo")', "foo def foo foo234");

    // test remove()
    testReturnValue(assert, '"abc def".remove("abc")', " def");
    testReturnValue(assert, '"abc def abc".remove("abc")', " def ");
    testReturnValue(assert, 'a = "abc def abc"; a.remove("abc"); a', "abc def abc");
    testReturnValue(assert, 'a = "abc def abc abc234"; a.remove("abc")', " def  234");

    // test index()
    testReturnValue(assert, '"abcdefg".index("abc")', 0);
    testReturnValue(assert, '"abcdefg".index("fofo")', -1);
    testReturnValue(assert, '"abcdefg".index("ef")', 4);
    testReturnValue(assert, '"abcdefg".index("efaaaa")', -1);

    // test has()
    testReturnValue(assert, '"abcdefg".has("abc")', true);
    testReturnValue(assert, '"abcdefg".has("fofo")', false);
    testReturnValue(assert, '"abcdefg".has("ef")', true);
    testReturnValue(assert, '"abcdefg".has("efaaaa")', false);

    // test count()
    testReturnValue(assert, '"abcdefgabcabc".count("abc")', 3);
    testReturnValue(assert, '"abcfoodefg".count("foo")', 1);
    testReturnValue(assert, '"abcdefg".count("nope")', 0);

    // test trim()
    testReturnValue(assert, '"  abcd  ".trim()', "abcd");
    testReturnValue(assert, '" \n abcd \t ".trim()', "abcd");

    // test hash()
    testReturnValue(assert, '"abcd".hash()', 2987074);

    // test ends_with()
    testReturnValue(assert, '"abcdefg".ends_with("efg")', true);
    testReturnValue(assert, '"abcdefg".ends_with("g")', true);
    testReturnValue(assert, '"abcdefg".ends_with("aaa")', false);
    testReturnValue(assert, '"abcdefg".ends_with("")', false);

    // test starts_with()
    testReturnValue(assert, '"abcdefg".starts_with("abc")', true);
    testReturnValue(assert, '"abcdefg".starts_with("a")', true);
    testReturnValue(assert, '"abcdefg".starts_with("aaa")', false);
    testReturnValue(assert, '"abcdefg".starts_with("")', true);

    // test is_alpha()
    testReturnValue(assert, '"abcdefg".is_alpha()', true);
    testReturnValue(assert, '"".is_alpha()', false);
    testReturnValue(assert, '"abc defg".is_alpha()', false);
    testReturnValue(assert, '"abcd1efg".is_alpha()', false);
    testReturnValue(assert, '"abcd?efg".is_alpha()', false);
    testReturnValue(assert, '"_".is_alpha()', false);
    testReturnValue(assert, '"ab\ncdefg".is_alpha()', false);

    // test is_digit()
    testReturnValue(assert, '"123".is_digit()', true);
    testReturnValue(assert, '"".is_digit()', false);
    testReturnValue(assert, '"123 456".is_digit()', false);
    testReturnValue(assert, '"123a456".is_digit()', false);
    testReturnValue(assert, '"123?456".is_digit()', false);
    testReturnValue(assert, '"1_".is_digit()', false);
    testReturnValue(assert, '"1\n2".is_digit()', false);

    // test lower()
    testReturnValue(assert, '"AbCdE fG12".lower()', "abcde fg12");

    // test upper()
    testReturnValue(assert, '"AbCdE fG12".upper()', "ABCDE FG12");

    // test title()
    testReturnValue(assert, '"hello there my friend! nice_to\nmeet\tyou".title()', "Hello There My Friend! Nice_to\nMeet\tYou");

    // test slice()
    testReturnValue(assert, '"hello world".slice(3)', "lo world");
    testReturnValue(assert, '"hello world".slice(3, 2)', "lo");
});

// test some builtin functions
QUnit.test("basic_function_builtins", function( assert ) {

    // test all()
    testReturnValue(assert, "all()", true);
    testReturnValue(assert, "all(5)", true);
    testReturnValue(assert, "all(True, 1, 5 + 2)", true);
    testReturnValue(assert, "all(0)", false);
    testReturnValue(assert, "all(True, 1, False)", false);
    testReturnValue(assert, "all(True, 1, None, 4)", false);
    testReturnValue(assert, 'all(1 + 1, "fw", True, False)', false);

    // test any()
    testReturnValue(assert, "any()", false);
    testReturnValue(assert, "any(5)", true);
    testReturnValue(assert, "any(True, 1, 5 + 2)", true);
    testReturnValue(assert, "any(0)", false);
    testReturnValue(assert, "any(0, False, None)", false);
    testReturnValue(assert, "any(True, 1, False)", true);
    testReturnValue(assert, "any(True, 1, None, 4)", true);
    testReturnValue(assert, 'any(1 + 1, "fw", True, False)', true);

    // test bin()
    testReturnValue(assert, "bin(0)", "0");
    testReturnValue(assert, "bin(1)", "1");
    testReturnValue(assert, "bin(5238965)", "10011111111000010110101");

    // test delete
    testReturnValue(assert, "a = 5; b = a; delete(a); b", 5);
    assert.throws(function() {testReturnValue(assert, "a = 5; b = a; delete(a); a", 5)}, _window.AdderScript.Errors.UndefinedVariable);
    assert.throws(function() {testReturnValue(assert, "delete(Math)", 5)}, _window.AdderScript.Errors.RuntimeError);
    assert.throws(function() {testReturnValue(assert, "a = 5; def test(): delete(a); test(); a", 5)}, _window.AdderScript.Errors.UndefinedVariable);
    assert.throws(function() {testReturnValue(assert, "a = 5; def test(): a = 5 and delete(a); test(); a", 5)}, _window.AdderScript.Errors.UndefinedVariable);
    testReturnValue(assert, 'a = 5; delete(a); exist("a");', false);

    // test exist
    testReturnValue(assert, 'exist("Math")', true);
    testReturnValue(assert, 'exist("None")', true);
    testReturnValue(assert, 'exist("True")', true);
    testReturnValue(assert, 'a=5; exist("a")', true);
    testReturnValue(assert, 'a=5; exist("b")', false);

    // test bool()
    testReturnValue(assert, "bool(1)", true);
    testReturnValue(assert, 'bool("5")', true);
    testReturnValue(assert, "bool(1 + 3)", true);
    testReturnValue(assert, "bool(True)", true);
    testReturnValue(assert, "bool(0)", false);
    testReturnValue(assert, "bool(None)", false);
    testReturnValue(assert, "bool(False)", false);

    // test callable
    testReturnValue(assert, "callable(any)", true);
    testReturnValue(assert, "callable(\"55\")", false);
    testReturnValue(assert, "callable(435)", false);
    testReturnValue(assert, "callable(False)", false);
    testReturnValue(assert, "callable(None)", false);

    // test chr
    testReturnValue(assert, "chr(90)", 'Z');

    // test cmp
    testReturnValue(assert, 'cmp("a", "b")', -1);
    testReturnValue(assert, 'cmp("b", "a")', 1);
    testReturnValue(assert, 'cmp(5, 1)', 4);
    testReturnValue(assert, 'cmp(1, 5)', -4);

    // test float
    testReturnValue(assert, 'float("0")', 0);
    testReturnValue(assert, 'float("0.5")', 0.5);
    testReturnValue(assert, 'float("bla")', NaN);

    // test int
    testReturnValue(assert, 'int("0")', 0);
    testReturnValue(assert, 'int("5.0")', 5);
    testReturnValue(assert, 'int("100", 8)', 64);
    testReturnValue(assert, 'int("100")', 100);
    testReturnValue(assert, 'int("bla")', NaN);

    // test ord
    testReturnValue(assert, 'ord("a")', 97);

    // test repr
    testReturnValue(assert, 'repr("foo")', '"foo"');
    testReturnValue(assert, 'repr(10)', '10');
    testReturnValue(assert, 'repr(list("foo"))', 'list(foo)');
    testReturnValue(assert, 'repr(None)', 'None');
    testReturnValue(assert, 'repr(True)', 'True');

    // test range
    testReturnValue(assert, 'equal(range(3), list(0,1,2))', true);
    testReturnValue(assert, 'equal(range(1, 3), list(1,2))', true);
    testReturnValue(assert, 'equal(range(5, 1, -1), list(5,4,3,2))', true);
    testReturnValue(assert, 'equal(range(5, 1, -2), list(5,3))', true);
    testReturnValue(assert, 'equal(range(1, 3, -1), list())', true);
    testReturnValue(assert, 'equal(range(5, 2, 1), list())', true);
    testReturnValue(assert, 'equal(range(0), list())', true);
    compareExpression(assert, 'range(0)', []);
    compareExpression(assert, 'range(1)', [0]);
    compareExpression(assert, 'range(10)', [0,1,2,3,4,5,6,7,8,9]);

    // test str
    testReturnValue(assert, 'str("5")', "5");
    testReturnValue(assert, 'str(None)', "");
    testReturnValue(assert, 'str(True)', "True");
    testReturnValue(assert, 'str(False)', "False");
    testReturnValue(assert, 'str("abc")', "abc");

    // test type
    testReturnValue(assert, 'type(True)', "boolean");
    testReturnValue(assert, 'type(False)', "boolean");
    testReturnValue(assert, 'type(None)', "none");
    testReturnValue(assert, 'type("a")', "string");
    testReturnValue(assert, 'type(123)', "number");
    testReturnValue(assert, 'type(__VERSION__)', "string");

    // test list creation
    testReturnValue(assert, 'type(list())', "list");
    testReturnValue(assert, 'type(list(1,2,3))', "list");

    // test reversed
    testReturnValue(assert, 'equal(reversed(list(1,2,3)), list(3,2,1))', true);
});


// test the built-in Random module
QUnit.test("module_random", function( assert ) {

    // test basic rand()
    var oldRand = Math.random;
    Math.random = function() {return 0.2;}
    testReturnValue(assert, "Random.rand()", 0.2);
    testReturnValue(assert, "Random.rand_int(5)", 1);
    testReturnValue(assert, "Random.rand_int(5, 10)", 6);
    testReturnValue(assert, "Random.rand_float(4.0)", 0.8);
    testReturnValue(assert, "Random.rand_float(5.5, 10.0)", 6.4);
    testReturnValue(assert, "Random.binary()", 0);
    testReturnValue(assert, "Random.boolean()", false);
    testReturnValue(assert, 'Random.select(list("foo", "bar", "goo"))', "foo");
    testReturnValue(assert, 'Random.select(set("foo", "bar", "goo"))', "foo");
    testReturnValue(assert, 'a = dict(); a.set("foo", 5); a.set("bar", 6); Random.select(a)', "foo");
    Math.random = oldRand;
});

// test the built-in Math module
QUnit.test("module_math", function( assert ) {

    // test abs()
    testReturnValue(assert, "Math.abs(5)", 5);
    testReturnValue(assert, "Math.abs(-5)", 5);
    testReturnValue(assert, "Math.abs(5 + 2 * -1)", Math.abs(5 + 2 * -1));
    testReturnValue(assert, "Math.abs(5 + 2 * -1 - 10)", Math.abs(5 + 2 * -1 - 10));

    // test min
    testReturnValue(assert, 'Math.min(1,2,3,1)', 1);
    testReturnValue(assert, 'Math.min(1,3)', 1);
    testReturnValue(assert, 'Math.min(-5,-1)', -5);
    testReturnValue(assert, 'Math.min(list(2, 4, -5,-1))', -5);
    testReturnValue(assert, 'Math.min(set(2, 4, -5,-1))', -5);

    // test max
    testReturnValue(assert, 'Math.max(1,2,3, 1)', 3);
    testReturnValue(assert, 'Math.max(1,3)', 3);
    testReturnValue(assert, 'Math.max(-5,-1)', -1);
    testReturnValue(assert, 'Math.max(list(2, 4, -5,-1))', 4);
    testReturnValue(assert, 'Math.max(set(2, 4, -5,-1))', 4);

    // test pow
    testReturnValue(assert, 'Math.pow(2, 2)', 4);
    testReturnValue(assert, 'Math.pow(3, 2)', 9);

    // test round / floor / ceil
    testReturnValue(assert, 'Math.round(5)', 5);
    testReturnValue(assert, 'Math.round(5.2)', 5);
    testReturnValue(assert, 'Math.floor(5.2)', 5);
    testReturnValue(assert, 'Math.ceil(5.2)', 6);

    // test sum
    testReturnValue(assert, 'Math.sum()', 0);
    testReturnValue(assert, 'Math.sum(1,2,3)', 1+2+3);
    testReturnValue(assert, 'Math.sum(1, 1)', 2);
    testReturnValue(assert, 'Math.sum(list(1,2,3))', 1+2+3);
    testReturnValue(assert, 'Math.sum(set(1,2,3))', 1+2+3);
    testReturnValue(assert, 'Math.sum(-3, 2, 5)', -3 + 2 + 5);

    // test mul
    testReturnValue(assert, 'Math.mul()', 1);
    testReturnValue(assert, 'Math.mul(1,2,3)', 1*2*3);
    testReturnValue(assert, 'Math.mul(1, 1)', 1*1);
    testReturnValue(assert, 'Math.mul(list(1,2,3))', 1*2*3);
    testReturnValue(assert, 'Math.mul(set(1,2,3))', 1*2*3);
    testReturnValue(assert, 'Math.mul(-3, 2, 5)', -3 * 2 * 5);

    // test cos / sin / tan / atan / exp..
    testReturnValue(assert, 'Math.cos(42)', Math.cos(42));
    testReturnValue(assert, 'Math.tan(42)', Math.tan(42));
    testReturnValue(assert, 'Math.atan(42)', Math.atan(42));
    testReturnValue(assert, 'Math.sin(42)', Math.sin(42));
    testReturnValue(assert, 'Math.exp(42)', Math.exp(42));
    testReturnValue(assert, 'Math.log(42)', Math.log(42));

    // check sqrt
    testReturnValue(assert, 'Math.sqrt(42)', Math.sqrt(42));
    testReturnValue(assert, 'Math.sqrt(9)', Math.sqrt(9));

    // check sign
    testReturnValue(assert, 'Math.sign(42)', 1);
    testReturnValue(assert, 'Math.sign(0)', 0);
    testReturnValue(assert, 'Math.sign(-3)', -1);

    // test consts
    testReturnValue(assert, 'Math.PI', Math.PI);
    testReturnValue(assert, 'Math.E', Math.E);
    testReturnValue(assert, 'Math.SQRT2', Math.SQRT2);

});

// test the builtin equal function
QUnit.test("equal", function( assert ) {

    // create a list of values to check
    var values = ['0', '1', 'True', 'False', 'None', 'list(1,2,3)', 'list(5,4,3)', 'list()'];

    // check equal cases
    for (var i = 0; i < values.length; ++i)
    {
        assert.ok(executeAndReturn('equal(' + values[i] + ', ' + values[i] + ')')[1]);
    }

    // now check unequal cases
    for (var i = 0; i < values.length; ++i)
    {
        for (var j = 0; j < values.length; ++j)
        {
            if (i === j) {continue;}
            assert.notOk(executeAndReturn('equal(' + values[i] + ', ' + values[j] + ')')[1]);
        }
    }
});

// test list object
QUnit.test("list", function( assert ) {

    // basic list creation
    testReturnValue(assert, "list()", []);
    testReturnValue(assert, "list(1,2,3)", [1,2,3]);
    testReturnValue(assert, "list(5).at(0)", 5);
    testReturnValue(assert, "type(list(2))", "list");

    // test clone
    testReturnValue(assert, "a = list(2); a.clone().clear(); a", [2]);
    testReturnValue(assert, "a = list(2); b = a.clone(); b.clear(); b", []);

    // test to_set
    testReturnValue(assert, "a = list(2); type(a.to_set())", "set");

    // test len
    testReturnValue(assert, "list(1,2,3).len()", 3);
    testReturnValue(assert, "list().len()", 0);
    testReturnValue(assert, "a = list(); a.append(1); a.len()", 1);

    // test append
    testReturnValue(assert, "a = list(); a.append(1); a", [1]);
    testReturnValue(assert, "a = list(); a.append(1); a.append(list()); a", [1, []]);

    // test has
    testReturnValue(assert, "a = list(); a.has(1)", false);
    testReturnValue(assert, "a = list(1); a.has(1)", true);
    testReturnValue(assert, "list(1,2,3).has(2)", true);
    testReturnValue(assert, "list(1,2,3, list()).has(list())", true);
    testReturnValue(assert, "list(1,2,3, list(), None).has(None)", true);
    testReturnValue(assert, "list(1,2,3, list()).has(None)", false);
    testReturnValue(assert, "list(1,2,3, list(), 0).has(False)", false);
    testReturnValue(assert, "list(1,2,3, list(), False).has(False)", true);

    // test 'in'
    testReturnValue(assert, "a = list(); 1 in a", false);
    testReturnValue(assert, "a = list(1); 1 in a", true);
    testReturnValue(assert, "2 in list(1,2,3)", true);
    testReturnValue(assert, "list() in list(1,2,3, list())", true);
    testReturnValue(assert, "None in list(1,2,3, list(), None)", true);
    testReturnValue(assert, "None in list(1,2,3, list())", false);
    testReturnValue(assert, "False in list(1,2,3, list(), 0)", false);
    testReturnValue(assert, "False in list(1,2,3, list(), False)", true);

    // test empty
    testReturnValue(assert, "a = list(); a.empty()", true);
    testReturnValue(assert, "a = list(1,2,3); a.empty()", false);
    testReturnValue(assert, "a = list(1,2); a.clear(); a.empty()", true);

    // test clear
    testReturnValue(assert, "a = list(1, 2, 3); a", [1,2,3]);
    testReturnValue(assert, "a = list(1, 2, 3); a.clear(); a", []);

    // test count
    testReturnValue(assert, "list(1, 2, 3).count(4)", 0);
    testReturnValue(assert, "list(1, 2, 3).count(2)", 1);
    testReturnValue(assert, "list(1, 2, 3, 2, 3, 2, 1).count(2)", 3);
    testReturnValue(assert, "list(1, 2, 3, list()).count(5)", 0);
    testReturnValue(assert, "list(1, 2, 3, list()).count(list())", 1);

    // test extend
    testReturnValue(assert, "a = list(1, 2, 3); b = list(4,5,6); a.extend(b); a", [1,2,3,4,5,6]);
    assert.throws(function(){executeAndReturn('list(1, 2, 3).extend(False);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('list(1, 2, 3).extend(1);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('list(1, 2, 3).extend(set());')}, AdderScript.Errors.RuntimeError);

    // test index
    testReturnValue(assert, "list(1, 2, 3).index(4)", -1);
    testReturnValue(assert, "list(1, 2, 3).index(2)", 1);

    // test remove
    testReturnValue(assert, "a = list(1, 2, 3); a.remove(2); a", [1,3]);
    testReturnValue(assert, "a = list(1, 2, 3); a.remove(5); a", [1, 2,3]);
    testReturnValue(assert, "a = list(1, 2, 3); a.remove(2)", true);
    testReturnValue(assert, "a = list(1, 2, 3); a.remove(5)", false);

    // test reverse
    testReturnValue(assert, "a = list(1, 2, 3); a.reverse(); a", [3,2,1]);

    // test pop
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(); a", [1, 2]);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop()", 3);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(0); a", [2, 3]);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(0)", 1);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(1); a", [1, 3]);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(1)", 2);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(-1)", 3);
    testReturnValue(assert, "a = list(1, 2, 3); a.pop(100)", null);

    // test insert
    testReturnValue(assert, 'a = list(1, 2, 3); a.insert("a", 0)', "a");
    testReturnValue(assert, 'a = list(1, 2, 3); a.insert("a", 0); a', ["a", 1,2,3]);
    testReturnValue(assert, 'a = list(1, 2, 3); a.insert("a", 2); a', [1,2, "a",3]);
    testReturnValue(assert, 'a = list(1, 2, 3); a.insert("a", 20); a', [1,2,3,"a"]);

    // test join
    testReturnValue(assert, 'list(1, 2, 3).join()', "1,2,3");
    testReturnValue(assert, 'list(1, 2, 3).join("--")', "1--2--3");

    // test sort
    testReturnValue(assert, 'a = list(3, 1, 2); a.sort(); a', [1,2,3]);

    // test at
    testReturnValue(assert, 'list(1,2,3).at(1)', 2);
    testReturnValue(assert, 'list(1,2,3).at(-1)', 3);
    testReturnValue(assert, 'list(1,2,3).at(0)', 1);
    assert.throws(function(){executeAndReturn('list(1, 2, 3).at(3)')}, AdderScript.Errors.RuntimeError);

    // test slice
    testReturnValue(assert, 'list(1,2,3).slice(0)', [1,2,3]);
    testReturnValue(assert, 'list(1,2,3).slice(1)', [2,3]);
    testReturnValue(assert, 'list(1,2,3,4).slice(1, 2)', [2]);
    testReturnValue(assert, 'list(1,2,3,4).slice(1, -1)', [2,3]);

});

// test set object
QUnit.test("set", function( assert ) {

    // basic set creation
    testReturnValue(assert, "set()", AdderScript.Utils.toSet());
    testReturnValue(assert, "set(1,2,3)", AdderScript.Utils.toSet([1,2,3]));
    testReturnValue(assert, "type(set(2))", "set");

    // test comparison
    testReturnValue(assert, "set(1,2,3) == set(1,2,3)", true);
    testReturnValue(assert, "set(1,2,3) == set(1,2)", false);
    testReturnValue(assert, "set(1,2,3) is set(1,2,3)", false);

    // test clone
    testReturnValue(assert, "a = set(2); a.clone().clear(); a", AdderScript.Utils.toSet([2]));
    testReturnValue(assert, "a = set(2); b = a.clone(); b.clear(); b", AdderScript.Utils.toSet());

    // test to_list
    testReturnValue(assert, "a = set(2); type(a.to_list())", "list");

    // test len
    testReturnValue(assert, "set(1,2,3).len()", 3);
    testReturnValue(assert, "set().len()", 0);
    testReturnValue(assert, "a = set(); a.add(1); a.len()", 1);

    // test add
    testReturnValue(assert, "a = set(); a.add(1); a", AdderScript.Utils.toSet([1]));
    testReturnValue(assert, "a = set(); a.add(1); a.add(False); a", AdderScript.Utils.toSet([1, false]));

    // test has
    testReturnValue(assert, "a = set(); a.has(1)", false);
    testReturnValue(assert, "a = set(1); a.has(1)", true);
    testReturnValue(assert, "set(1,2,3).has(2)", true);
    testReturnValue(assert, "set(1,2,3).has(set())", false);
    testReturnValue(assert, "set(1,2,3,None).has(None)", true);
    testReturnValue(assert, "set(1,2,3).has(None)", false);
    testReturnValue(assert, "set(1,2,3,0).has(False)", false);
    testReturnValue(assert, 'set(1,2,3,"test",0).has("test")', true);
    testReturnValue(assert, 'set(1,2,3,False,0).has("false")', false);
    testReturnValue(assert, 'set(1,2,3,"b",0).has("a")', false);
    testReturnValue(assert, "set(1,2,3,False).has(False)", true);

    // test 'in'
    testReturnValue(assert, "a = set(); 1 in a", false);
    testReturnValue(assert, "a = set(1); 1 in a", true);
    testReturnValue(assert, "2 in set(1,2,3)", true);
    testReturnValue(assert, "set() in set(1,2,3)", false);
    testReturnValue(assert, "None in set(1,2,3,None)", true);

    // test empty
    testReturnValue(assert, "a = set(); a.empty()", true);
    testReturnValue(assert, "a = set(1,2,3); a.empty()", false);
    testReturnValue(assert, "a = set(1,2); a.clear(); a.empty()", true);

    // test clear
    testReturnValue(assert, "a = set(1, 2, 3); a", AdderScript.Utils.toSet([1,2,3]));
    testReturnValue(assert, "a = set(1, 2, 3); a.clear(); a", AdderScript.Utils.toSet());

    // test extend
    testReturnValue(assert, "a = set(1, 2, 3); b = set(4,5,6); a.extend(b); a", AdderScript.Utils.toSet([1,2,3,4,5,6]));
    assert.throws(function(){executeAndReturn('set(1, 2, 3).extend(False);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('set(1, 2, 3).extend(1);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('set(1, 2, 3).extend(list());')}, AdderScript.Errors.RuntimeError);

    // test index
    testReturnValue(assert, "set(1, 2, 3).index(4)", -1);
    testReturnValue(assert, "set(1, 2, 3).index(2)", 1);

    // test remove
    testReturnValue(assert, "a = set(1, 2, 3); a.remove(2); a", AdderScript.Utils.toSet([1,3]));
    testReturnValue(assert, "a = set(1, 2, 3); a.remove(5); a", AdderScript.Utils.toSet([1, 2,3]));
    testReturnValue(assert, "a = set(1, 2, 3); a.remove(2)", true);
    testReturnValue(assert, "a = set(1, 2, 3); a.remove(5)", false);

    // test join
    testReturnValue(assert, 'set(1, 2, 3).join()', "1,2,3");
    testReturnValue(assert, 'set(1, 2, 3).join("--")', "1--2--3");

});

// test dictionary object
QUnit.test("dict", function( assert ) {

    // basic dictionary creation
    testReturnValue(assert, "dict()", {});
    testReturnValue(assert, "type(dict())", "dict");

    // test comparison
    testReturnValue(assert, "dict() == dict()", true);
    testReturnValue(assert, 'a = dict(); a.set("a", 5); a == dict()', false);
    testReturnValue(assert, 'a = dict(); b = dict(); a.set("a", 5); b.set("a", 6); a == b', false);
    testReturnValue(assert, 'a = dict(); b = dict(); a.set("a", 5); b.set("a", 5); a == b', true);
    testReturnValue(assert, "dict() is dict()", false);

    // test clone
    testReturnValue(assert, 'a = dict(2); a.set("test", 1); a.clone().clear(); a', {"test": 1});
    testReturnValue(assert, 'a = dict(); a.set("test", 1); b = a.clone(); b.clear(); b', {});

    // test keys()
    testReturnValue(assert, 'a = dict(); a.set("a", 1); a.set("b", 2); a.keys()', ["a", "b"]);

    // test values()
    testReturnValue(assert, 'a = dict(); a.set("a", 1); a.set("b", 2); a.values()', [1, 2]);

    // test len
    testReturnValue(assert, 'a = dict(); a.set("a", 1); a.set("b",2); a.len()', 2);
    testReturnValue(assert, "dict().len()", 0);

    // test set
    testReturnValue(assert, 'a = dict(); a.set("a", 2); a', {"a": 2});
    testReturnValue(assert, 'a = dict(); a.set("a", 2); a.set(3, 4); a', {"a": 2, '3': 4});
    testReturnValue(assert, 'a = dict(); a.set("a", 2); a.set(3, 4); a.set(None, 5); a', {"a": 2, '3': 4, null: 5});
    assert.throws(function(){executeAndReturn('dict().set(set(), 5);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('dict().set(set(), 5);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('dict().set(dir, 5);')}, AdderScript.Errors.RuntimeError);

    // test has
    testReturnValue(assert, "a = dict(); a.has(1)", false);
    testReturnValue(assert, 'a = dict(1); a.set(1, True); a.has(1)', true);
    testReturnValue(assert, "a = dict(); a.set(1, 2); a.has(2)", false);

    // test 'in'
    testReturnValue(assert, "a = dict(); 1 in a", false);
    testReturnValue(assert, 'a = dict(1); a.set(1, True); 1 in a', true);
    testReturnValue(assert, "a = dict(); a.set(1, 2); 2 in a", false);


    // test empty
    testReturnValue(assert, "a = dict(); a.empty()", true);
    testReturnValue(assert, 'a = dict(); a.set("a", 2); a.empty()', false);
    testReturnValue(assert, 'a = dict(); a.set("a", 2); a.clear(); a.empty()', true);

    // test clear
    testReturnValue(assert, 'a = dict(); a.set("A", 4); a.clear(); a', {});

    // test extend
    testReturnValue(assert, 'a = dict(); a.set("A", 1); b = dict(); b.set("B", 2); a.extend(b); a', {"A": 1, "B": 2});
    assert.throws(function(){executeAndReturn('dict().extend(False);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('dict().extend(1);')}, AdderScript.Errors.RuntimeError);
    assert.throws(function(){executeAndReturn('dict().extend(set());')}, AdderScript.Errors.RuntimeError);

    // test remove
    testReturnValue(assert, 'a = dict(); a.set("A", 1); a.set("B", 2); a.remove(2); a', {"A": 1, "B": 2});
    testReturnValue(assert, 'a = dict(); a.set("A", 1); a.set("B", 2); a.remove("A"); a', {"B": 2});

});

// test misc stuff make sure they don't fail
QUnit.test("misc", function( assert ) {

    // basic calls and lists
    compareExpression(assert, 'print(dir())', null);
    compareExpression(assert, 'def test(): return dir(); print(test())', null);
    compareExpression(assert, 'a = dir(); def test(): return a; print(test())', null);
    compareExpression(assert, 'def test(): return dir(); print(test().has("print"))', null);

    // fibonacci example 1
    var fibo = '\n\
# Example 1: Using looping technique \n\
def fib(n): \n\
    a = 1\n\
    b = 1\n\
    for i in range(n-1): \n\
        _a = a \n\
        a = b \n\
        b = _a + b \n\
    return a \n\
fib(10)'
    compareExpression(assert, fibo, 55);

    // fibonacci example 2
    var fibo = '\n\
# Example 2: Using recursion \n\
def fibR(n): \n\
    if n==1 or n==2: \n\
        return 1 \n\
    return fibR(n-1)+fibR(n-2) \n\
fibR(11)';
    compareExpression(assert, fibo, 89);

    var prime = '\n\
ret = list() \n\
\n\
# This example will print all prime numbers from 1 to 1000.\n\
for num in range(1, 100):\n\
\n\
    # calculate if number is prime\n\
    is_prime = True\n\
    # comment \n\
    for i in range(2,num):\n\
        if (num % i) == 0:\n\
            is_prime = False # random comment \n\
            break\n\
    \n\
    # if number is prime print it\n\
    if is_prime:\n\
        ret.append(num)\n\
ret';
    compareExpression(assert, prime, [1,2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97]);

    var hanoi = '\n\
# This example implements a simple recursive solution to Hanoi towers problem. \n\
def moveTower(height,fromPole, toPole, withPole): \n\
    if height >= 1: \n\
        moveTower(height-1,fromPole,withPole,toPole) \n\
        moveDisk(fromPole,toPole) # move disk \n\
        moveTower(height-1,withPole,toPole,fromPole) \n\
\n\
def moveDisk(fp,tp): \n\
    print("moving disk from",fp,"to",tp) \n\
\n\
moveTower(3,"A","B","C") \n\
';
    compareExpression(assert, hanoi, null);

    var weirdIfs = '\n\
if (((5 == 5))): \n\
    print ("A") \n\
    print(not (5)) \n\
';
    compareExpression(assert, weirdIfs, null);

    var weirdIfs = '\n\
if not 5 == 4: \n\
    print ("A") \n\
    print(not (5)) \n\
else: \n\
    None = 5 \n\
';
    compareExpression(assert, weirdIfs, null);

});

// test scopes and dir()
QUnit.test("scopes_and_dir", function( assert ) {

    // test if dir() gets the right global scope
    var scopes = '\n\
test = 5 \n\
def t(): \n\
	while True: \n\
    	if True: \n\
			return ("test" in dir()) \n\
def t2(): \n\
    test2 = 6 \n\
    return t() \n\
t2()'
    compareExpression(assert, scopes, true);

    // test if dir() gets the right parent scope
    var scopes = '\n\
def t(): \n\
	test = 5 \n\
	while True: \n\
    	if True: \n\
			return ("test" in dir()) \n\
def t2(): \n\
    test2 = 6 \n\
    return t() \n\
t2()'
    compareExpression(assert, scopes, true);

    // make sure dir() doesn't get something it shouldn't get
    var scopes = '\n\
test = 5 \n\
def t(): \n\
	while True: \n\
    	if True: \n\
			return ("test2" in dir()) \n\
def t2(): \n\
    test2 = 6 \n\
    return t() \n\
t2()'
    compareExpression(assert, scopes, false);


    // make sure dir() doesn't get something it shouldn't get
    var scopes = ' \n\
def test(): \n\
	a = 5 \n\
	while True: \n\
    	if True: \n\
        	return("a" in dir()) \n\
test()';
    compareExpression(assert, scopes, true);

});

// execute a program and expect output
function execProgram(assert, code, expected) {

    // get AdderScript object
    var AdderScript = _window.AdderScript.Adder;

    // compile code and create program
    compiledCode = AdderScript.compile(code);
    var program = AdderScript.newProgram(compiledCode);

    // do everything twice to be sure value didn't change in second run
    for (var i = 0; i < 2; ++i) {

        // execute and propagate errors, if happened
        program.execute(); program.propagateExecutionErrors();

        // check return value
        if (expected !== undefined) {
            smartCompare(assert, program.getLastValue(), expected);
        }
    }
}


// register a built-in function
QUnit.test("add_builtin_function", function( assert ) {

    // init AdderScript environment
    var AdderScript = _window.AdderScript.Adder;
    AdderScript.init({flags: {throwErrors: true}});

    // add builtin function
    AdderScript.addBuiltinFunction({name: "test",                       // function name
                                    func: function(x) {return x + 2},   // the function itself
                                    requiredParams: 1,                  // number of required params
                                    optionalParams: 0});                // number of additional optional params

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = test(2); a', 4);
    execProgram(assert, 'a = type(test); a', "function");
    execProgram(assert, 'a = repr(test); a', "<custom.builtin.functions.test>");
    execProgram(assert, 'a = type(test(2)); a', "number");


    // call the builtin function without illegal number of params - get exceptions
    assert.throws(function() {execProgram(assert, 'a = test(); a', null)}, _window.AdderScript.Errors.RuntimeError);
    assert.throws(function() {execProgram(assert, 'a = test(1, 2); a', null)}, _window.AdderScript.Errors.RuntimeError);

    // add builtin function that returns a list
    AdderScript.addBuiltinFunction({name: "test2",                       // function name
                                    func: function(x) {return [x]},     // the function itself
                                    requiredParams: 1,                  // number of required params
                                    optionalParams: 0});                // number of additional optional params

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = type(test2(2)); a', "list");
    execProgram(assert, 'a = test2(4); a', [4]);

    // add builtin function that returns a set
    AdderScript.addBuiltinFunction({name: "test3",                              // function name
                                    func: function() {return new Set()},        // the function itself
                                    requiredParams: 0,                          // number of required params
                                    optionalParams: 0});                        // number of additional optional params

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = type(test3()); a', "set");
    execProgram(assert, 'a = test3(); a', new Set());

    // add builtin function that returns a dictionary
    AdderScript.addBuiltinFunction({name: "test4",                              // function name
                                    func: function() {return {a:1}},            // the function itself
                                    requiredParams: 0,                          // number of required params
                                    optionalParams: 0});                        // number of additional optional params

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = type(test4()); a', "dict");
    execProgram(assert, 'a = test4(); a', {a:1});

    // add builtin function that returns a string
    AdderScript.addBuiltinFunction({name: "test5",                              // function name
                                    func: function() {return "test"},           // the function itself
                                    requiredParams: 0,                          // number of required params
                                    optionalParams: 0});                        // number of additional optional params

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = type(test5()); a', "string");
    execProgram(assert, 'a = test5(); a', "test");
    execProgram(assert, 'a = test5() + test5(); a', "testtest");

    // remove the builtin function we created for this test
    AdderScript.removeBuiltinFunction("test");
});

// test adding built-in module
QUnit.test("add_builtin_module", function( assert ) {

    // init AdderScript environment
    var AdderScript = _window.AdderScript.Adder;
    AdderScript.init({flags: {throwErrors: true}});

    // add builtin module
    AdderScript.addBuiltinModule("TestModule",
                                  {
                                    // define a function named 'foo'
                                    "foo": {
                                        func: function(x) {return x + 1},
                                        requiredParams: 1,
                                        optionalParams: 0
                                     },

                                     // define a const named 'bar' that equals to "World"
                                     "bar": 1,
                                  }
                              );

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = TestModule.foo(2); a', 3);
    execProgram(assert, 'a = TestModule.foo(TestModule.bar); a', 2);
    execProgram(assert, 'a = type(TestModule); a', "module");
    execProgram(assert, 'a = repr(TestModule); a', "<Module.TestModule>");
    execProgram(assert, 'a = type(TestModule.foo); a', "function");
    execProgram(assert, 'a = repr(TestModule.foo); a', "<Module.TestModule.foo>");
    execProgram(assert, 'a = type(TestModule.bar); a', "number");
    execProgram(assert, 'a = repr(TestModule.bar); a', "1");
    execProgram(assert, 'if TestModule: a = 5; a', 5);

    // test some illegal cases
    assert.throws(function() {execProgram(assert, 'TestModule = 5; a', null)}, _window.AdderScript.Errors.RuntimeError);
    assert.throws(function() {execProgram(assert, 'delete(TestModule); a', null)}, _window.AdderScript.Errors.RuntimeError);
    assert.throws(function() {execProgram(assert, 'TestModule.foo = 5; a', null)}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function() {execProgram(assert, 'TestModule.bar = 5; a', null)}, _window.AdderScript.Errors.SyntaxError);
    assert.throws(function() {execProgram(assert, 'for i in TestModule: pass; a', null)}, _window.AdderScript.Errors.RuntimeError);

    // remove the builtin module we created for this test
    AdderScript.removeBuiltinModule("TestModule");
});

// test adding built-in object
QUnit.test("add_builtin_object", function( assert ) {

    // init AdderScript environment
    var AdderScript = _window.AdderScript.Adder;
    AdderScript.init({flags: {throwErrors: true}});

    // define the object and get a function to create a new instance
    createFunc = AdderScript.defineBuiltinObject("Test", {
                                        "foo": {
                                            func: function(x) {return 3 + x;},
                                            requiredParams: 1,
                                            optionalParams: 0
                                         },
                                         "val": 2,
                                      });

    // create a function to create a new test instance
    AdderScript.addBuiltinFunction({name: "create_test",                            // function name
                                    func: function(x) {return createFunc(this)},    // the function itself to create Person.
                                    requiredParams: 0,              // number of required params
                                    optionalParams: 0});            // number of additional optional params

    // call the builtin function properly and validate return value
    execProgram(assert, 'a = create_test(); type(a)', "Test");
    execProgram(assert, 'a = create_test(); a.foo(1)', 4);
    execProgram(assert, 'a = create_test(); a.foo(a.val)', 5);
    assert.throws(function() {execProgram(assert, 'create_test = 5', null)}, _window.AdderScript.Errors.RuntimeError);
});


// test limits and other flags
QUnit.test("limits_and_flags", function( assert ) {

    // default flags - disable all limits
    var default_flags = {
        stackLimit: undefined,               // Stack depth limit. If exceeded will throw 'StackOverflow' exception.
        maxStatementsPerRun: undefined,      // Maximum statements that can be executed in a single run. If exceeded will throw 'ExceededStatementsLimit' exception.
        maxStringLen: undefined,             // Maximum allowed string lengths. If exceeded will throw 'ExceedMemoryLimit' exception.
        maxContainersLen: undefined,         // Maximum values allowed in lists, sets and dictionaries. If exceeded will throw 'ExceedMemoryLimit' exception.
        maxVarsInScope: undefined,           // Limit number of variables allowed per scope. If exceeded will throw 'ExceedMemoryLimit' exception.
        executionTimeLimit: undefined,       // Time limit for a single execution (in milliseconds). If exceeded will throw 'ExceededTimeLimit' exception.
        memoryAllocationLimit: undefined,    // Memory limit, very roughly estimated, in bytes (per execution). If exceeded will throw 'ExceedMemoryLimit' exception.
        throwErrors: true,                   // throw errors
        removeBuiltins: [],                  // An optional list of builtin function and const names you want to remove from the language.
    };

    // get AdderScript environment
    var AdderScript = _window.AdderScript.Adder;

    // create and return flags dictionary based on default_flags
    function makeFlags(dict) {
        for (var key in default_flags) {
            if (dict[key] === undefined) {
                dict[key] = default_flags[key];
            }
        }
        return dict;
    }

    // test stack limit
    var flags = makeFlags({stackLimit: 5});
    AdderScript.init({flags: flags});
    assert.throws(function() {execProgram(assert, 'def test(): test(); test()');}, _window.AdderScript.Errors.StackOverflow);

    // test maximum statements limit
    var flags = makeFlags({maxStatementsPerRun: 3});
    AdderScript.init({flags: flags});
    assert.throws(function() {execProgram(assert, 'a = 4; b = 5; c = 6; d = 7;');}, _window.AdderScript.Errors.ExceededStatementsLimit);

    // test maximum statements limit
    var flags = makeFlags({maxStringLen: 5});
    AdderScript.init({flags: flags});
    assert.throws(function() {execProgram(assert, 'a = "1234567890"');}, _window.AdderScript.Errors.ExceedMemoryLimit);

    // test maximum container limit
    var flags = makeFlags({maxContainersLen: 3});
    AdderScript.init({flags: flags});
    assert.throws(function() {execProgram(assert, 'list(1,2,3,4,5)');}, _window.AdderScript.Errors.ExceedMemoryLimit);
    assert.throws(function() {execProgram(assert, 'a = list(1); a.append(1); a.append(1); a.append(1);');}, _window.AdderScript.Errors.ExceedMemoryLimit);
    assert.throws(function() {execProgram(assert, 'set(1,2,3,4,5)');}, _window.AdderScript.Errors.ExceedMemoryLimit);
    assert.throws(function() {execProgram(assert, 'a = set(1); a.add(2); a.add(3); a.add(4);');}, _window.AdderScript.Errors.ExceedMemoryLimit);
    assert.throws(function() {execProgram(assert, 'a = dict(); a.set(1, 1); a.set(2, 1); a.set(3, 1); a.set(4, 1);');}, _window.AdderScript.Errors.ExceedMemoryLimit);

    // test max vars in scope
    var flags = makeFlags({maxVarsInScope: 3});
    AdderScript.init({flags: flags});
    assert.throws(function() {execProgram(assert, 'a = 1; b = 2; c = 3; d = 4; e = 5;');}, _window.AdderScript.Errors.ExceedMemoryLimit);

    // test time limit
    var flags = makeFlags({executionTimeLimit: 1, maxStatementsPerRun:100000000});
    AdderScript.init({flags: flags});
    assert.throws(function() {execProgram(assert, 'for i in range(1000): for j in range(1000): x = 2 ** 6;');}, _window.AdderScript.Errors.ExceededTimeLimit);

    // test memory limit
    var flags = makeFlags({memoryAllocationLimit: 5});
    AdderScript.init({flags: flags});
    execProgram(assert, 'pass', null);
    assert.throws(function() {execProgram(assert, 'a = "123456"');}, _window.AdderScript.Errors.ExceedMemoryLimit);
    assert.throws(function() {execProgram(assert, 'a = "123"; b = "123";');}, _window.AdderScript.Errors.ExceedMemoryLimit);
    assert.throws(function() {execProgram(assert, 'a = 1; b = 2; c = 3; d = 4; e = 5; f = 6; g = 7; h = 8;');}, _window.AdderScript.Errors.ExceedMemoryLimit);

    // test undefined variable exception
    assert.throws(function() {execProgram(assert, 'a = b + 1');}, _window.AdderScript.Errors.UndefinedVariable);

});